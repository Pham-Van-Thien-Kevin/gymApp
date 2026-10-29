-- =============================================================================
-- Liftlog: databaseschema voor Supabase (Postgres)
--
-- Voer dit volledige bestand uit in de Supabase SQL Editor (Dashboard → SQL).
-- Het script begint met opruimen, zodat je het tijdens development opnieuw kan
-- draaien. LET OP: opnieuw uitvoeren wist dus alle app-data (niet de accounts).
--
-- Opbouw:
--   1. Opruimen
--   2. Types
--   3. Tabellen + indexen
--   4. Helperfuncties voor Row Level Security
--   5. Row Level Security (RLS) policies
--   6. Rechten (wie mag welke kolom aanpassen)
--   7. Triggers (updated_at + profiel bij registratie)
--   8. RPC-functies (koppelen aan trainer, uitnodigingscode, import, schema toewijzen)
--   9. Standaardgegevens (globale oefeningenbibliotheek)
--
-- Online (productie) voer je ENKEL dit bestand uit. supabase/seed.sql bevat
-- demo-accounts met een publiek wachtwoord en is enkel voor lokaal testen.
-- =============================================================================


-- 1. OPRUIMEN -----------------------------------------------------------------
drop trigger if exists on_auth_user_created on auth.users;
drop view if exists public.set_log, public.member_activity;
drop table if exists
  public.workout_feedback,
  public.weekly_checkins,
  public.strength_tests,
  public.body_metrics,
  public.cardio_entries,
  public.workout_sets,
  public.workout_exercises,
  public.workouts,
  public.import_batches,
  public.program_assignments,
  public.program_exercises,
  public.program_days,
  public.programs,
  public.exercises,
  public.profiles
  cascade;
drop function if exists
  public.handle_new_user,
  public.set_updated_at,
  public.generate_invite_code,
  public.current_app_role,
  public.my_trainer_id,
  public.is_trainer_of,
  public.can_access_member,
  public.owns_program,
  public.is_assigned_program,
  public.can_read_program,
  public.day_program,
  public.workout_member,
  public.can_read_workout,
  public.can_write_workout,
  public.workout_of_exercise,
  public.join_trainer,
  public.leave_trainer,
  public.regenerate_invite_code,
  public.assign_program,
  public.log_workout,
  public.import_sheet
  cascade;
drop type if exists public.user_role, public.rating, public.workout_status, public.import_source cascade;


-- 2. TYPES --------------------------------------------------------------------
create type public.user_role as enum ('member', 'trainer');
-- Schaal van de wekelijkse check-in (en de recap in de sheet).
create type public.rating as enum ('AMAZING', 'NEUTRAAL', 'BAD');
-- 'planned' = staat in het schema/de sheet maar is (nog) niet uitgevoerd.
create type public.workout_status as enum ('completed', 'planned');
create type public.import_source as enum ('link', 'upload');


-- 3. TABELLEN -----------------------------------------------------------------

-- Eén rij per gebruiker. id = auth.users.id, zo hangt het profiel 1-op-1 aan het account.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  role public.user_role not null default 'member',
  trainer_id uuid references public.profiles (id) on delete set null,
  invite_code text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint trainer_has_invite_code check (role = 'member' or invite_code is not null),
  constraint member_has_no_invite_code check (role = 'trainer' or invite_code is null),
  constraint not_own_trainer check (trainer_id is null or trainer_id <> id)
);
create index profiles_trainer_id_idx on public.profiles (trainer_id);

-- Oefeningenbibliotheek. created_by = null betekent: globale oefening (zichtbaar voor iedereen).
create table public.exercises (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  category text not null default 'Andere',
  equipment text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- Geen twee oefeningen met dezelfde naam (hoofdletterongevoelig) per eigenaar.
create unique index exercises_owner_name_key
  on public.exercises (coalesce(created_by, '00000000-0000-0000-0000-000000000000'::uuid), lower(trim(name)));
create index exercises_created_by_idx on public.exercises (created_by);

-- Schema's: programma → dagen → oefeningen.
create table public.programs (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references public.profiles (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index programs_trainer_id_idx on public.programs (trainer_id);

create table public.program_days (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs (id) on delete cascade,
  position integer not null default 0,
  name text not null,
  -- 0 = maandag ... 6 = zondag. Optioneel: zonder weekdag volgt de app de volgorde.
  weekday smallint check (weekday between 0 and 6),
  created_at timestamptz not null default now()
);
create index program_days_program_idx on public.program_days (program_id, position);

create table public.program_exercises (
  id uuid primary key default gen_random_uuid(),
  program_day_id uuid not null references public.program_days (id) on delete cascade,
  exercise_id uuid not null references public.exercises (id) on delete restrict,
  position integer not null default 0,
  target_sets smallint check (target_sets > 0),
  target_reps text,            -- tekst, want "8-10" is ook een geldig doel
  target_rpe text,             -- tekst, want "8-8,5" is ook een geldig doel
  notes text,
  optional boolean not null default false,
  created_at timestamptz not null default now()
);
create index program_exercises_day_idx on public.program_exercises (program_day_id, position);
create index program_exercises_exercise_idx on public.program_exercises (exercise_id);

create table public.program_assignments (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs (id) on delete cascade,
  member_id uuid not null references public.profiles (id) on delete cascade,
  start_date date not null default current_date,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
-- Maximaal één actief schema per member.
create unique index program_assignments_one_active
  on public.program_assignments (member_id) where active;
create index program_assignments_program_idx on public.program_assignments (program_id);

-- Elke import uit Google Sheets krijgt een batch. Geïmporteerde rijen verwijzen
-- hiernaar met "on delete cascade": batch weg = alles van die import weg.
create table public.import_batches (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.profiles (id) on delete cascade,
  imported_by uuid references public.profiles (id) on delete set null,
  source public.import_source not null,
  sheet_tab text not null,
  block_description text,
  created_at timestamptz not null default now()
);
create index import_batches_member_tab_idx on public.import_batches (member_id, sheet_tab);

create table public.workouts (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.profiles (id) on delete cascade,
  date date not null,
  title text,
  program_day_id uuid references public.program_days (id) on delete set null,
  duration_minutes integer check (duration_minutes >= 0),
  notes text,
  status public.workout_status not null default 'completed',
  import_batch_id uuid references public.import_batches (id) on delete cascade,
  -- Gepland uit een sheet en in de app afgewerkt: de oorspronkelijke datum en
  -- titel, zodat een nieuwe import deze sessie herkent (zie import_sheet).
  planned_date date,
  planned_title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index workouts_member_date_idx on public.workouts (member_id, date desc);
create index workouts_import_batch_idx on public.workouts (import_batch_id);
create index workouts_program_day_idx on public.workouts (program_day_id);

create table public.workout_exercises (
  id uuid primary key default gen_random_uuid(),
  workout_id uuid not null references public.workouts (id) on delete cascade,
  exercise_id uuid not null references public.exercises (id) on delete restrict,
  position integer not null default 0,
  target_sets smallint,
  target_reps text,
  target_intensity text,       -- "RPE 8-8,5" of vrije tekst zoals "Load indien te licht"
  actual_rpe numeric(3, 1) check (actual_rpe between 0 and 10),
  notes text,
  optional boolean not null default false,
  performed boolean not null default true,  -- false = gepland, telt niet mee in progressie
  raw jsonb,                   -- originele celwaarden uit de sheet
  created_at timestamptz not null default now()
);
create index workout_exercises_workout_idx on public.workout_exercises (workout_id, position);
create index workout_exercises_exercise_idx on public.workout_exercises (exercise_id);

create table public.workout_sets (
  id uuid primary key default gen_random_uuid(),
  workout_exercise_id uuid not null references public.workout_exercises (id) on delete cascade,
  set_number smallint not null check (set_number > 0),
  reps smallint check (reps >= 0),
  weight numeric(6, 2) check (weight >= 0),
  rpe numeric(3, 1) check (rpe between 0 and 10),
  reps_estimated boolean not null default false,  -- true als de sheet een bereik ("8-10") gaf
  created_at timestamptz not null default now()
);
create index workout_sets_exercise_idx on public.workout_sets (workout_exercise_id, set_number);

create table public.cardio_entries (
  id uuid primary key default gen_random_uuid(),
  workout_id uuid not null references public.workouts (id) on delete cascade,
  type text not null,
  duration_minutes integer check (duration_minutes >= 0),
  created_at timestamptz not null default now()
);
create index cardio_entries_workout_idx on public.cardio_entries (workout_id);

create table public.body_metrics (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.profiles (id) on delete cascade,
  date date not null default current_date,
  weight numeric(5, 2) not null check (weight > 0),
  created_at timestamptz not null default now(),
  unique (member_id, date)
);

create table public.strength_tests (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.profiles (id) on delete cascade,
  label text not null,               -- bv. "Blok 2"
  squat numeric(6, 2) check (squat >= 0),
  bench numeric(6, 2) check (bench >= 0),
  deadlift numeric(6, 2) check (deadlift >= 0),
  -- Generated column: Postgres rekent het totaal zelf uit, het kan nooit fout staan.
  total numeric(7, 2) generated always as (coalesce(squat, 0) + coalesce(bench, 0) + coalesce(deadlift, 0)) stored,
  tested_on date,
  import_batch_id uuid references public.import_batches (id) on delete cascade,
  created_at timestamptz not null default now()
);
create index strength_tests_member_idx on public.strength_tests (member_id);

create table public.weekly_checkins (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.profiles (id) on delete cascade,
  week_start date not null check (extract(isodow from week_start) = 1),  -- altijd een maandag
  training public.rating,
  motivation public.rating,
  pain public.rating,
  overall_feeling public.rating,
  score smallint check (score between 1 and 10),
  sessions_done smallint check (sessions_done >= 0),
  feedback text,
  raw jsonb,
  import_batch_id uuid references public.import_batches (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (member_id, week_start)
);

create table public.workout_feedback (
  id uuid primary key default gen_random_uuid(),
  workout_id uuid not null references public.workouts (id) on delete cascade,
  trainer_id uuid not null references public.profiles (id) on delete cascade,
  message text not null check (length(trim(message)) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index workout_feedback_workout_idx on public.workout_feedback (workout_id);


-- 4. HELPERFUNCTIES VOOR RLS --------------------------------------------------
-- Waarom "security definer"? Een policy op profiles die zelf profiles leest,
-- zou opnieuw de policy triggeren → "infinite recursion". Een security definer-
-- functie draait met de rechten van de eigenaar en slaat RLS dus over.
-- Daarom: altijd `set search_path = ''` en volledige namen (public.x), zodat
-- niemand de functie kan misleiden met een eigen tabel met dezelfde naam.
-- "stable" vertelt Postgres dat het resultaat binnen één query niet verandert,
-- zodat het de functie niet voor elke rij opnieuw hoeft uit te voeren.

create function public.current_app_role()
returns public.user_role
language sql stable security definer set search_path = ''
as $$ select role from public.profiles where id = (select auth.uid()) $$;

create function public.my_trainer_id()
returns uuid
language sql stable security definer set search_path = ''
as $$ select trainer_id from public.profiles where id = (select auth.uid()) $$;

-- Is de ingelogde gebruiker de trainer van deze member?
create function public.is_trainer_of(member uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = member and trainer_id = (select auth.uid())
  )
$$;

-- Mag de ingelogde gebruiker de data van deze member lezen? (zichzelf of eigen cliënt)
create function public.can_access_member(member uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$ select member = (select auth.uid()) or public.is_trainer_of(member) $$;

create function public.owns_program(program uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.programs where id = program and trainer_id = (select auth.uid()))
$$;

create function public.is_assigned_program(program uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.program_assignments
    where program_id = program and member_id = (select auth.uid())
  )
$$;

create function public.can_read_program(program uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$ select public.owns_program(program) or public.is_assigned_program(program) $$;

create function public.day_program(day uuid)
returns uuid
language sql stable security definer set search_path = ''
as $$ select program_id from public.program_days where id = day $$;

create function public.workout_member(workout uuid)
returns uuid
language sql stable security definer set search_path = ''
as $$ select member_id from public.workouts where id = workout $$;

create function public.can_read_workout(workout uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.workouts w
    where w.id = workout and public.can_access_member(w.member_id)
  )
$$;

-- Schrijven mag de member zelf, of de trainer als het om een import gaat.
create function public.can_write_workout(workout uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.workouts w
    where w.id = workout
      and (
        w.member_id = (select auth.uid())
        or (w.import_batch_id is not null and public.is_trainer_of(w.member_id))
      )
  )
$$;

create function public.workout_of_exercise(workout_exercise uuid)
returns uuid
language sql stable security definer set search_path = ''
as $$ select workout_id from public.workout_exercises where id = workout_exercise $$;


-- 5. ROW LEVEL SECURITY -------------------------------------------------------
-- RLS staat "aan" = standaard mag niemand iets. Elke policy hieronder opent één
-- specifieke deur. `using` filtert welke bestaande rijen je ziet/aanpast,
-- `with check` controleert nieuwe of gewijzigde rijen.
-- `(select auth.uid())` i.p.v. `auth.uid()`: Postgres rekent het dan één keer
-- per query uit in plaats van per rij (aanbevolen door Supabase).

alter table public.profiles enable row level security;
alter table public.exercises enable row level security;
alter table public.programs enable row level security;
alter table public.program_days enable row level security;
alter table public.program_exercises enable row level security;
alter table public.program_assignments enable row level security;
alter table public.import_batches enable row level security;
alter table public.workouts enable row level security;
alter table public.workout_exercises enable row level security;
alter table public.workout_sets enable row level security;
alter table public.cardio_entries enable row level security;
alter table public.body_metrics enable row level security;
alter table public.strength_tests enable row level security;
alter table public.weekly_checkins enable row level security;
alter table public.workout_feedback enable row level security;

-- profiles: je ziet jezelf, je cliënten (als trainer) en je eigen trainer (als member).
create policy "profiles: lezen" on public.profiles for select to authenticated
  using (
    id = (select auth.uid())
    or trainer_id = (select auth.uid())
    or id = public.my_trainer_id()
  );
-- Alleen je eigen rij aanpassen. Wélke kolommen bepaalt sectie 6 (enkel full_name).
create policy "profiles: eigen profiel aanpassen" on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));
-- Geen insert-policy: profielen worden enkel door de trigger aangemaakt.

-- exercises: globale oefeningen, je eigen, die van je trainer en die van je cliënten.
create policy "exercises: lezen" on public.exercises for select to authenticated
  using (
    created_by is null
    or created_by = (select auth.uid())
    or created_by = public.my_trainer_id()
    or public.is_trainer_of(created_by)
  );
create policy "exercises: toevoegen" on public.exercises for insert to authenticated
  with check (created_by = (select auth.uid()));
create policy "exercises: eigen aanpassen" on public.exercises for update to authenticated
  using (created_by = (select auth.uid()))
  with check (created_by = (select auth.uid()));
create policy "exercises: eigen verwijderen" on public.exercises for delete to authenticated
  using (created_by = (select auth.uid()));

-- programs: de trainer beheert zijn eigen schema's, een member leest toegewezen schema's.
create policy "programs: lezen" on public.programs for select to authenticated
  using (trainer_id = (select auth.uid()) or public.is_assigned_program(id));
create policy "programs: trainer maakt aan" on public.programs for insert to authenticated
  with check (trainer_id = (select auth.uid()) and public.current_app_role() = 'trainer');
create policy "programs: trainer past aan" on public.programs for update to authenticated
  using (trainer_id = (select auth.uid()))
  with check (trainer_id = (select auth.uid()));
create policy "programs: trainer verwijdert" on public.programs for delete to authenticated
  using (trainer_id = (select auth.uid()));

create policy "program_days: lezen" on public.program_days for select to authenticated
  using (public.can_read_program(program_id));
create policy "program_days: trainer schrijft" on public.program_days for all to authenticated
  using (public.owns_program(program_id))
  with check (public.owns_program(program_id));

create policy "program_exercises: lezen" on public.program_exercises for select to authenticated
  using (public.can_read_program(public.day_program(program_day_id)));
create policy "program_exercises: trainer schrijft" on public.program_exercises for all to authenticated
  using (public.owns_program(public.day_program(program_day_id)))
  with check (public.owns_program(public.day_program(program_day_id)));

create policy "program_assignments: lezen" on public.program_assignments for select to authenticated
  using (member_id = (select auth.uid()) or public.owns_program(program_id));
-- Een trainer kan alleen eigen schema's toewijzen, en alleen aan eigen cliënten.
create policy "program_assignments: trainer schrijft" on public.program_assignments for all to authenticated
  using (public.owns_program(program_id) and public.is_trainer_of(member_id))
  with check (public.owns_program(program_id) and public.is_trainer_of(member_id));

-- import_batches: de member zelf of zijn trainer.
create policy "import_batches: lezen" on public.import_batches for select to authenticated
  using (public.can_access_member(member_id));
create policy "import_batches: toevoegen" on public.import_batches for insert to authenticated
  with check (public.can_access_member(member_id) and imported_by = (select auth.uid()));
-- Verwijderen = herimport. Dankzij "on delete cascade" verdwijnt alles van die batch mee.
create policy "import_batches: verwijderen" on public.import_batches for delete to authenticated
  using (public.can_access_member(member_id));

-- workouts: de member doet alles met zijn eigen trainingen; de trainer leest
-- en mag enkel toevoegen als het een import is (import_batch_id ingevuld).
create policy "workouts: lezen" on public.workouts for select to authenticated
  using (public.can_access_member(member_id));
create policy "workouts: toevoegen" on public.workouts for insert to authenticated
  with check (
    member_id = (select auth.uid())
    or (import_batch_id is not null and public.is_trainer_of(member_id))
  );
create policy "workouts: member past aan" on public.workouts for update to authenticated
  using (member_id = (select auth.uid()))
  with check (member_id = (select auth.uid()));
create policy "workouts: member verwijdert" on public.workouts for delete to authenticated
  using (member_id = (select auth.uid()));

create policy "workout_exercises: lezen" on public.workout_exercises for select to authenticated
  using (public.can_read_workout(workout_id));
create policy "workout_exercises: schrijven" on public.workout_exercises for all to authenticated
  using (public.can_write_workout(workout_id))
  with check (public.can_write_workout(workout_id));

create policy "workout_sets: lezen" on public.workout_sets for select to authenticated
  using (public.can_read_workout(public.workout_of_exercise(workout_exercise_id)));
create policy "workout_sets: schrijven" on public.workout_sets for all to authenticated
  using (public.can_write_workout(public.workout_of_exercise(workout_exercise_id)))
  with check (public.can_write_workout(public.workout_of_exercise(workout_exercise_id)));

create policy "cardio_entries: lezen" on public.cardio_entries for select to authenticated
  using (public.can_read_workout(workout_id));
create policy "cardio_entries: schrijven" on public.cardio_entries for all to authenticated
  using (public.can_write_workout(workout_id))
  with check (public.can_write_workout(workout_id));

-- body_metrics: trainer leest, alleen de member schrijft.
create policy "body_metrics: lezen" on public.body_metrics for select to authenticated
  using (public.can_access_member(member_id));
create policy "body_metrics: member schrijft" on public.body_metrics for all to authenticated
  using (member_id = (select auth.uid()))
  with check (member_id = (select auth.uid()));

-- strength_tests: member schrijft; trainer mag toevoegen via een import.
create policy "strength_tests: lezen" on public.strength_tests for select to authenticated
  using (public.can_access_member(member_id));
create policy "strength_tests: toevoegen" on public.strength_tests for insert to authenticated
  with check (
    member_id = (select auth.uid())
    or (import_batch_id is not null and public.is_trainer_of(member_id))
  );
create policy "strength_tests: member past aan" on public.strength_tests for update to authenticated
  using (member_id = (select auth.uid()))
  with check (member_id = (select auth.uid()));
create policy "strength_tests: member verwijdert" on public.strength_tests for delete to authenticated
  using (member_id = (select auth.uid()));

-- weekly_checkins: member schrijft; trainer mag toevoegen/overschrijven via een import.
create policy "weekly_checkins: lezen" on public.weekly_checkins for select to authenticated
  using (public.can_access_member(member_id));
create policy "weekly_checkins: toevoegen" on public.weekly_checkins for insert to authenticated
  with check (
    member_id = (select auth.uid())
    or (import_batch_id is not null and public.is_trainer_of(member_id))
  );
create policy "weekly_checkins: aanpassen" on public.weekly_checkins for update to authenticated
  using (member_id = (select auth.uid()) or public.is_trainer_of(member_id))
  with check (
    member_id = (select auth.uid())
    or (import_batch_id is not null and public.is_trainer_of(member_id))
  );
create policy "weekly_checkins: member verwijdert" on public.weekly_checkins for delete to authenticated
  using (member_id = (select auth.uid()));

-- workout_feedback: de member leest feedback op eigen trainingen; de trainer
-- schrijft enkel als zichzelf en enkel bij trainingen van eigen cliënten.
create policy "workout_feedback: lezen" on public.workout_feedback for select to authenticated
  using (trainer_id = (select auth.uid()) or public.can_read_workout(workout_id));
create policy "workout_feedback: trainer schrijft" on public.workout_feedback for insert to authenticated
  with check (
    trainer_id = (select auth.uid())
    and public.is_trainer_of(public.workout_member(workout_id))
  );
create policy "workout_feedback: trainer past aan" on public.workout_feedback for update to authenticated
  using (trainer_id = (select auth.uid()))
  with check (trainer_id = (select auth.uid()));
create policy "workout_feedback: trainer verwijdert" on public.workout_feedback for delete to authenticated
  using (trainer_id = (select auth.uid()));

-- View met elke uitgevoerde set + datum: één platte tabel voor progressie-
-- grafieken en "vorige prestatie". Geplande (niet uitgevoerde) rijen vallen weg.
-- security_invoker = true: de view gebruikt de RLS van de onderliggende tabellen
-- (zonder die optie zou een view RLS omzeilen!).
create view public.set_log with (security_invoker = true) as
select
  ws.id,
  ws.set_number,
  ws.reps,
  ws.weight,
  coalesce(ws.rpe, we.actual_rpe) as rpe,
  ws.reps_estimated,
  we.exercise_id,
  we.workout_id,
  w.member_id,
  w.date
from public.workout_sets ws
join public.workout_exercises we on we.id = ws.workout_exercise_id
join public.workouts w on w.id = we.workout_id
where we.performed and w.status = 'completed';

-- Eén rij per member met kerncijfers voor het trainersoverzicht en de homepagina.
-- Ook security_invoker: een trainer ziet enkel rijen van eigen cliënten,
-- een member enkel zijn eigen rij.
create view public.member_activity with (security_invoker = true) as
select
  p.id as member_id,
  p.full_name,
  p.trainer_id,
  (
    select max(w.date) from public.workouts w
    where w.member_id = p.id and w.status = 'completed'
  ) as last_workout_date,
  (
    select count(*)::int from public.workouts w
    where w.member_id = p.id and w.status = 'completed'
      and w.date >= date_trunc('week', (now() at time zone 'Europe/Brussels'))::date
      and w.date <= (now() at time zone 'Europe/Brussels')::date
  ) as workouts_this_week,
  c.week_start as last_checkin_week,
  c.training as last_checkin_training,
  c.motivation as last_checkin_motivation,
  c.pain as last_checkin_pain,
  c.score as last_checkin_score
from public.profiles p
left join lateral (
  select * from public.weekly_checkins wc
  where wc.member_id = p.id
  order by wc.week_start desc
  limit 1
) c on true
where p.role = 'member';


-- 6. RECHTEN ------------------------------------------------------------------
-- RLS bepaalt welke RIJEN. Kolomrechten bepalen welke KOLOMMEN.
-- Supabase geeft standaard alle rechten aan de rollen anon en authenticated;
-- hier zetten we dat strakker.
revoke all on all tables in schema public from anon;

-- Niemand kan zijn eigen rol, trainer of uitnodigingscode aanpassen vanuit de
-- client: authenticated mag enkel full_name updaten. Trainer koppelen en code
-- vernieuwen gaat via de RPC-functies in sectie 8, die zelf controleren.
revoke insert, update, delete on public.profiles from authenticated;
grant update (full_name) on public.profiles to authenticated;

-- Het totaal is een generated column; die mag nooit door de client gezet worden.
revoke insert, update on public.strength_tests from authenticated;
grant insert (member_id, label, squat, bench, deadlift, tested_on, import_batch_id)
  on public.strength_tests to authenticated;
grant update (label, squat, bench, deadlift, tested_on) on public.strength_tests to authenticated;


-- 7. TRIGGERS -----------------------------------------------------------------
create function public.set_updated_at()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger exercises_updated_at before update on public.exercises
  for each row execute function public.set_updated_at();
create trigger programs_updated_at before update on public.programs
  for each row execute function public.set_updated_at();
create trigger workouts_updated_at before update on public.workouts
  for each row execute function public.set_updated_at();
create trigger weekly_checkins_updated_at before update on public.weekly_checkins
  for each row execute function public.set_updated_at();
create trigger workout_feedback_updated_at before update on public.workout_feedback
  for each row execute function public.set_updated_at();

-- Korte, leesbare code zonder verwarrende tekens (geen 0/O, 1/I/L).
create function public.generate_invite_code()
returns text
language plpgsql volatile set search_path = ''
as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  code text;
begin
  loop
    code := '';
    for i in 1..6 loop
      code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.profiles where invite_code = code);
  end loop;
  return code;
end;
$$;

-- Bij registratie maakt Supabase een rij in auth.users. Deze trigger maakt dan
-- automatisch het bijhorende profiel. De rol komt uit de metadata die het
-- registratieformulier meestuurt; alles behalve 'trainer' wordt 'member'.
-- security definer: de trigger moet in public.profiles kunnen schrijven, ook al
-- heeft de (nog niet ingelogde) gebruiker daar geen rechten.
create function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  requested_role public.user_role :=
    case when new.raw_user_meta_data ->> 'role' = 'trainer' then 'trainer' else 'member' end;
  code text := upper(trim(coalesce(new.raw_user_meta_data ->> 'invite_code', '')));
  linked_trainer uuid;
begin
  if requested_role = 'member' and code <> '' then
    select id into linked_trainer
    from public.profiles
    where invite_code = code and role = 'trainer';
  end if;

  insert into public.profiles (id, full_name, role, trainer_id, invite_code)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), split_part(new.email, '@', 1)),
    requested_role,
    linked_trainer,
    case when requested_role = 'trainer' then public.generate_invite_code() end
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- 8. RPC-FUNCTIES -------------------------------------------------------------
-- Aan te roepen vanuit de app met supabase.rpc('naam', { ... }).

-- Member koppelt zich aan een trainer met diens uitnodigingscode.
-- security definer, want een member kan het profiel van een onbekende trainer
-- niet lezen (RLS) en mag zijn eigen trainer_id niet rechtstreeks aanpassen.
create function public.join_trainer(code text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  found_trainer uuid;
begin
  if public.current_app_role() is distinct from 'member' then
    raise exception 'Alleen members kunnen zich aan een trainer koppelen.';
  end if;

  select id into found_trainer
  from public.profiles
  where invite_code = upper(trim(code)) and role = 'trainer';

  if found_trainer is null then
    raise exception 'Deze uitnodigingscode bestaat niet.' using errcode = 'P0002';
  end if;

  -- Wissel je van trainer, dan is het schema van je vorige trainer niet langer actief.
  if public.my_trainer_id() is distinct from found_trainer then
    update public.program_assignments set active = false
    where member_id = (select auth.uid()) and active;
  end if;

  update public.profiles set trainer_id = found_trainer where id = (select auth.uid());
  return found_trainer;
end;
$$;

create function public.leave_trainer()
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  update public.profiles set trainer_id = null where id = (select auth.uid());
  -- Het schema van de oude trainer is niet langer actief.
  update public.program_assignments set active = false
  where member_id = (select auth.uid()) and active;
end;
$$;

create function public.regenerate_invite_code()
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  new_code text;
begin
  if public.current_app_role() is distinct from 'trainer' then
    raise exception 'Alleen trainers hebben een uitnodigingscode.';
  end if;
  new_code := public.generate_invite_code();
  update public.profiles set invite_code = new_code where id = (select auth.uid());
  return new_code;
end;
$$;

-- Schema toewijzen: het vorige actieve schema uitzetten en het nieuwe toevoegen,
-- in één transactie. security invoker (standaard): RLS controleert dat het om
-- een eigen schema en een eigen cliënt gaat.
create function public.assign_program(p_program_id uuid, p_member_id uuid, p_start_date date)
returns uuid
language plpgsql set search_path = ''
as $$
declare
  assignment_id uuid;
begin
  update public.program_assignments set active = false
  where member_id = p_member_id and active;

  insert into public.program_assignments (program_id, member_id, start_date, active)
  values (p_program_id, p_member_id, coalesce(p_start_date, current_date), true)
  returning id into assignment_id;

  return assignment_id;
end;
$$;

-- Een training loggen vanuit de app: workout + oefeningen + sets + cardio in
-- één transactie, zodat je nooit een "halve" training in de database krijgt.
-- security invoker: RLS geldt, de training komt altijd op naam van auth.uid().
--
-- Met payload.workout_id werk je een GEPLANDE training af (bv. uit je sheet):
-- die rij wordt 'completed' en krijgt de gelogde oefeningen in plaats van de
-- planning. Ze komt los van de import (import_batch_id = null), zodat een
-- nieuwe import van die maand je gelogde sets niet wist.
create function public.log_workout(payload jsonb)
returns uuid
language plpgsql set search_path = ''
as $$
declare
  v_workout uuid;
  v_item jsonb;
  v_we uuid;
begin
  if public.current_app_role() is distinct from 'member' then
    raise exception 'Alleen members kunnen trainingen loggen.';
  end if;

  if payload ->> 'workout_id' is not null then
    update public.workouts set
      date = (payload ->> 'date')::date,
      title = nullif(trim(payload ->> 'title'), ''),
      duration_minutes = (payload ->> 'duration_minutes')::int,
      notes = nullif(trim(payload ->> 'notes'), ''),
      status = 'completed',
      import_batch_id = null,
      -- Rechts van "=" staan nog de oude waarden: de planning vóór deze update.
      planned_date = date,
      planned_title = title
    where id = (payload ->> 'workout_id')::uuid
      and member_id = (select auth.uid())
      and status = 'planned'
    returning id into v_workout;

    if v_workout is null then
      raise exception 'Deze geplande training bestaat niet (meer) of is al afgewerkt.';
    end if;

    -- De planning maakt plaats voor wat je echt deed (sets gaan mee via "on delete cascade").
    delete from public.workout_exercises where workout_id = v_workout;
    delete from public.cardio_entries where workout_id = v_workout;
  else
    insert into public.workouts (member_id, date, title, program_day_id, duration_minutes, notes, status)
    values (
      (select auth.uid()),
      (payload ->> 'date')::date,
      nullif(trim(payload ->> 'title'), ''),
      (payload ->> 'program_day_id')::uuid,
      (payload ->> 'duration_minutes')::int,
      nullif(trim(payload ->> 'notes'), ''),
      'completed'
    )
    returning id into v_workout;
  end if;

  for v_item in select * from jsonb_array_elements(coalesce(payload -> 'exercises', '[]'::jsonb)) loop
    insert into public.workout_exercises (
      workout_id, exercise_id, position, target_sets, target_reps, target_intensity, notes, optional, performed
    ) values (
      v_workout,
      (v_item ->> 'exercise_id')::uuid,
      coalesce((v_item ->> 'position')::int, 0),
      (v_item ->> 'target_sets')::smallint,
      v_item ->> 'target_reps',
      v_item ->> 'target_intensity',
      nullif(trim(v_item ->> 'notes'), ''),
      coalesce((v_item ->> 'optional')::boolean, false),
      -- Een oefening zonder ingevulde sets is overgeslagen: bewaren als "niet uitgevoerd".
      jsonb_array_length(coalesce(v_item -> 'sets', '[]'::jsonb)) > 0
    )
    returning id into v_we;

    -- "with ordinality" nummert de elementen: zo krijgt elke set zijn volgnummer.
    insert into public.workout_sets (workout_exercise_id, set_number, reps, weight, rpe)
    select v_we, s.n, (s.value ->> 'reps')::smallint, (s.value ->> 'weight')::numeric, (s.value ->> 'rpe')::numeric
    from jsonb_array_elements(coalesce(v_item -> 'sets', '[]'::jsonb)) with ordinality as s (value, n);
  end loop;

  insert into public.cardio_entries (workout_id, type, duration_minutes)
  select v_workout, trim(c ->> 'type'), (c ->> 'duration_minutes')::int
  from jsonb_array_elements(coalesce(payload -> 'cardio', '[]'::jsonb)) as c;

  return v_workout;
end;
$$;

-- Import van een Google Sheet in ÉÉN transactie.
-- Een functie die via supabase.rpc() wordt aangeroepen draait in één transactie:
-- faalt er iets halverwege (bv. een RLS-check), dan wordt alles teruggedraaid.
-- security invoker: de functie draait met de rechten van de ingelogde gebruiker,
-- dus alle RLS-policies hierboven blijven gelden (een trainer kan zo enkel voor
-- eigen cliënten importeren).
--
-- payload (opgebouwd door de server, zie src/lib/import/build-payload.ts):
-- {
--   member_id, source,
--   new_exercises: [{ key, name, category }],
--   tabs: [{ sheet_tab, block_description,
--            workouts: [{ date, title, status, notes,
--                         exercises: [{ exercise_id | exercise_key, position, target_sets, target_reps,
--                                       target_intensity, actual_rpe, notes, optional, performed, raw,
--                                       sets: [{ set_number, reps, weight, rpe, reps_estimated }] }],
--                         cardio: [{ type, duration_minutes }] }],
--            checkins: [{ week_start, training, motivation, pain, overall_feeling, sessions_done, feedback, raw }] }],
--   strength_tests: [{ label, squat, bench, deadlift }] | null
-- }
create function public.import_sheet(payload jsonb)
returns jsonb
language plpgsql set search_path = ''
as $$
declare
  v_member uuid := (payload ->> 'member_id')::uuid;
  v_source public.import_source := (payload ->> 'source')::public.import_source;
  v_keys jsonb := '{}'::jsonb;    -- tijdelijke sleutel → id van nieuw aangemaakte oefening
  v_exercise jsonb;
  v_exercise_id uuid;
  v_tab jsonb;
  v_batch uuid;
  v_workout jsonb;
  v_workout_id uuid;
  v_item jsonb;
  v_we_id uuid;
  n_workouts int := 0;
  n_exercises int := 0;
  n_sets int := 0;
  n_checkins int := 0;
  n_tests int := 0;
  n_rows int;
begin
  if not public.can_access_member(v_member) then
    raise exception 'Geen toegang tot deze sporter.' using errcode = '42501';
  end if;

  -- 1. Nieuwe oefeningen aanmaken (of een bestaande eigen oefening hergebruiken).
  for v_exercise in select * from jsonb_array_elements(coalesce(payload -> 'new_exercises', '[]'::jsonb)) loop
    select id into v_exercise_id
    from public.exercises
    where created_by = (select auth.uid()) and lower(trim(name)) = lower(trim(v_exercise ->> 'name'));

    if v_exercise_id is null then
      insert into public.exercises (name, category, created_by)
      values (trim(v_exercise ->> 'name'), coalesce(v_exercise ->> 'category', 'Andere'), (select auth.uid()))
      returning id into v_exercise_id;
    end if;
    v_keys := v_keys || jsonb_build_object(v_exercise ->> 'key', v_exercise_id);
  end loop;

  -- 2. Per maandtab: vorige import van die tab vervangen.
  for v_tab in select * from jsonb_array_elements(coalesce(payload -> 'tabs', '[]'::jsonb)) loop
    delete from public.import_batches
    where member_id = v_member and sheet_tab = v_tab ->> 'sheet_tab';

    insert into public.import_batches (member_id, imported_by, source, sheet_tab, block_description)
    values (v_member, (select auth.uid()), v_source, v_tab ->> 'sheet_tab', v_tab ->> 'block_description')
    returning id into v_batch;

    for v_workout in select * from jsonb_array_elements(coalesce(v_tab -> 'workouts', '[]'::jsonb)) loop
      -- Al in de app afgewerkt (zie log_workout)? Dan de planning niet opnieuw toevoegen.
      if v_workout ->> 'status' = 'planned' and exists (
        select 1 from public.workouts w
        where w.member_id = v_member
          and w.planned_date = (v_workout ->> 'date')::date
          and w.planned_title is not distinct from v_workout ->> 'title'
      ) then
        continue;
      end if;

      insert into public.workouts (member_id, date, title, status, notes, import_batch_id)
      values (
        v_member,
        (v_workout ->> 'date')::date,
        v_workout ->> 'title',
        coalesce(v_workout ->> 'status', 'completed')::public.workout_status,
        v_workout ->> 'notes',
        v_batch
      )
      returning id into v_workout_id;
      n_workouts := n_workouts + 1;

      for v_item in select * from jsonb_array_elements(coalesce(v_workout -> 'exercises', '[]'::jsonb)) loop
        v_exercise_id := coalesce(
          (v_item ->> 'exercise_id')::uuid,
          (v_keys ->> (v_item ->> 'exercise_key'))::uuid
        );
        if v_exercise_id is null then
          raise exception 'Oefening zonder koppeling in %: %', v_tab ->> 'sheet_tab', v_item -> 'raw' ->> 'name';
        end if;

        insert into public.workout_exercises (
          workout_id, exercise_id, position, target_sets, target_reps, target_intensity,
          actual_rpe, notes, optional, performed, raw
        ) values (
          v_workout_id,
          v_exercise_id,
          coalesce((v_item ->> 'position')::int, 0),
          (v_item ->> 'target_sets')::smallint,
          v_item ->> 'target_reps',
          v_item ->> 'target_intensity',
          (v_item ->> 'actual_rpe')::numeric,
          v_item ->> 'notes',
          coalesce((v_item ->> 'optional')::boolean, false),
          coalesce((v_item ->> 'performed')::boolean, true),
          v_item -> 'raw'
        )
        returning id into v_we_id;
        n_exercises := n_exercises + 1;

        insert into public.workout_sets (workout_exercise_id, set_number, reps, weight, rpe, reps_estimated)
        select
          v_we_id,
          (s ->> 'set_number')::smallint,
          (s ->> 'reps')::smallint,
          (s ->> 'weight')::numeric,
          (s ->> 'rpe')::numeric,
          coalesce((s ->> 'reps_estimated')::boolean, false)
        from jsonb_array_elements(coalesce(v_item -> 'sets', '[]'::jsonb)) as s;
        get diagnostics n_rows = row_count;
        n_sets := n_sets + n_rows;
      end loop;

      insert into public.cardio_entries (workout_id, type, duration_minutes)
      select v_workout_id, c ->> 'type', (c ->> 'duration_minutes')::int
      from jsonb_array_elements(coalesce(v_workout -> 'cardio', '[]'::jsonb)) as c;
    end loop;

    -- Check-ins: bestaat er al één voor die week, dan overschrijft de import ze.
    insert into public.weekly_checkins (
      member_id, week_start, training, motivation, pain, overall_feeling,
      sessions_done, feedback, raw, import_batch_id
    )
    select
      v_member,
      (c ->> 'week_start')::date,
      (c ->> 'training')::public.rating,
      (c ->> 'motivation')::public.rating,
      (c ->> 'pain')::public.rating,
      (c ->> 'overall_feeling')::public.rating,
      (c ->> 'sessions_done')::smallint,
      c ->> 'feedback',
      c -> 'raw',
      v_batch
    from jsonb_array_elements(coalesce(v_tab -> 'checkins', '[]'::jsonb)) as c
    on conflict (member_id, week_start) do update set
      training = excluded.training,
      motivation = excluded.motivation,
      pain = excluded.pain,
      overall_feeling = excluded.overall_feeling,
      sessions_done = excluded.sessions_done,
      feedback = excluded.feedback,
      raw = excluded.raw,
      import_batch_id = excluded.import_batch_id;
    get diagnostics n_rows = row_count;
    n_checkins := n_checkins + n_rows;
  end loop;

  -- 3. Maxima per blok uit het Info-tabblad (ook als batch, zodat herimport vervangt).
  if jsonb_typeof(payload -> 'strength_tests') = 'array' then
    delete from public.import_batches where member_id = v_member and sheet_tab = 'Info';

    insert into public.import_batches (member_id, imported_by, source, sheet_tab)
    values (v_member, (select auth.uid()), v_source, 'Info')
    returning id into v_batch;

    insert into public.strength_tests (member_id, label, squat, bench, deadlift, import_batch_id)
    select
      v_member,
      t ->> 'label',
      (t ->> 'squat')::numeric,
      (t ->> 'bench')::numeric,
      (t ->> 'deadlift')::numeric,
      v_batch
    from jsonb_array_elements(payload -> 'strength_tests') as t;
    get diagnostics n_tests = row_count;
  end if;

  return jsonb_build_object(
    'workouts', n_workouts,
    'exercises', n_exercises,
    'sets', n_sets,
    'checkins', n_checkins,
    'strength_tests', n_tests,
    'new_exercises', jsonb_array_length(coalesce(payload -> 'new_exercises', '[]'::jsonb))
  );
end;
$$;

-- Functies zijn standaard uitvoerbaar door iedereen (PUBLIC). De RPC's die data
-- wijzigen maken we enkel beschikbaar voor ingelogde gebruikers.
revoke execute on function public.join_trainer(text) from public, anon;
revoke execute on function public.leave_trainer() from public, anon;
revoke execute on function public.regenerate_invite_code() from public, anon;
revoke execute on function public.assign_program(uuid, uuid, date) from public, anon;
revoke execute on function public.import_sheet(jsonb) from public, anon;
revoke execute on function public.log_workout(jsonb) from public, anon;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
grant execute on function public.join_trainer(text) to authenticated;
grant execute on function public.leave_trainer() to authenticated;
grant execute on function public.regenerate_invite_code() to authenticated;
grant execute on function public.assign_program(uuid, uuid, date) to authenticated;
grant execute on function public.import_sheet(jsonb) to authenticated;
grant execute on function public.log_workout(jsonb) to authenticated;


-- 9. STANDAARDGEGEVENS --------------------------------------------------------
-- Een standaardbibliotheek van oefeningen die ELKE gebruiker ziet, ook een
-- trainer die zich net registreerde: de lijst "Beschikbare oefening" uit het
-- Info-tabblad van fixtures/gymSheet.xlsx, aangevuld met de hoofdoefeningen
-- (zelfde schrijfwijze als in de sheet, zodat een import ze herkent).
--
-- created_by = null maakt ze globaal (zie de policy "exercises: lezen").
-- Niemand kan ze vanuit de app aanpassen of verwijderen; trainers voegen zelf
-- eigen oefeningen toe. Dit hoort bij elke installatie, ook in productie.
insert into public.exercises (name, category, equipment, created_by)
select e.name, e.category, e.equipment, null
from (values
  -- Legs
  ('Squat', 'Legs', 'Barbell'),
  ('Beltsquat', 'Legs', 'Machine'),
  ('Leg extension', 'Legs', 'Machine'),
  ('Hamstring curl', 'Legs', 'Machine'),
  ('Legpress', 'Legs', 'Machine'),
  ('Hacksquat', 'Legs', 'Machine'),
  ('Adductor', 'Legs', 'Machine'),
  ('Abductor', 'Legs', 'Machine'),
  ('Calves', 'Legs', 'Machine'),
  -- Bench
  ('Comp bench', 'Bench', 'Barbell'),
  ('Close grip bench', 'Bench', 'Barbell'),
  ('Chest press', 'Bench', 'Machine'),
  ('DB press', 'Bench', 'Dumbbell'),
  ('Incline chest press', 'Bench', 'Machine'),
  ('Pec flies', 'Bench', 'Machine'),
  ('Tricep', 'Bench', 'Cable'),
  -- Deadlift
  ('Comp deadlift', 'Deadlift', 'Barbell'),
  ('Romanian deadlifts', 'Deadlift', 'Barbell'),
  ('Hyperextensions', 'Deadlift', 'Bodyweight'),
  ('T-bar row', 'Deadlift', 'Machine'),
  ('Chest supported row', 'Deadlift', 'Machine'),
  ('Lat pulldown', 'Deadlift', 'Cable'),
  ('Pull ups(weighted)', 'Deadlift', 'Bodyweight'),
  ('High to low row', 'Deadlift', 'Machine'),
  ('Iso lateral high row', 'Deadlift', 'Machine'),
  -- Andere
  ('Bayesian curl', 'Andere', 'Cable'),
  ('Alternating bicep curl', 'Andere', 'Dumbbell'),
  ('Hammer curl', 'Andere', 'Dumbbell'),
  ('Lateral raise', 'Andere', 'Cable')
) as e (name, category, equipment)
on conflict do nothing;
