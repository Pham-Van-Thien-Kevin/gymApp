-- =============================================================================
-- Liftlog: demodata, ENKEL VOOR LOKAAL TESTEN
--
-- !! Voer dit NIET uit op je online (productie) Supabase-project. De accounts
-- !! hieronder hebben een publiek gekend wachtwoord: iedereen die deze repo ziet,
-- !! kan er dan mee inloggen. Per ongeluk toch gedaan? Voer remove-demo.sql uit.
--
-- Voer dit uit NA schema.sql (lokaal of in een apart testproject).
-- Je kan het opnieuw uitvoeren: het ruimt eerst de vorige demodata op.
--
-- Demo-accounts (allemaal met wachtwoord: liftlog-demo)
--   trainer@liftlog.test  → trainer "Coach Lien", uitnodigingscode DEMO42
--   noor@liftlog.test     → member, actief, met schema, progressie en check-ins
--   milan@liftlog.test    → member, 10 dagen niet getraind + "BAD" bij pijn
--                            (zo zie je de markering in het trainerdashboard)
--
-- Alle datums zijn relatief t.o.v. vandaag (current_date), zodat de demo
-- altijd "recent" oogt.
-- =============================================================================

-- 0. OPRUIMEN -----------------------------------------------------------------
-- Volgorde is belangrijk: workout_exercises en program_exercises verwijzen met
-- "on delete restrict" naar exercises, dus eerst trainingen en schema's weg.
delete from public.workouts where member_id in (
  '22222222-2222-4222-8222-222222222222', '33333333-3333-4333-8333-333333333333'
);
delete from public.programs where trainer_id = '11111111-1111-4111-8111-111111111111';
-- Oefeningen die de demo-accounts zelf toevoegden (bv. via een import). Eerst
-- verwijderen: exercises.created_by staat op "on delete set null", dus anders
-- zouden ze bij het wissen van het account globaal en voor iedereen zichtbaar
-- worden. De standaardbibliotheek (sectie 9 van schema.sql) blijft staan.
delete from public.exercises where created_by in (
  '11111111-1111-4111-8111-111111111111',
  '22222222-2222-4222-8222-222222222222',
  '33333333-3333-4333-8333-333333333333'
);
delete from auth.users where id in (
  '11111111-1111-4111-8111-111111111111',
  '22222222-2222-4222-8222-222222222222',
  '33333333-3333-4333-8333-333333333333'
);

-- 1. ACCOUNTS -----------------------------------------------------------------
-- Rechtstreeks in auth.users schrijven is enkel voor demodata. In de app maakt
-- supabase.auth.signUp() deze rijen aan. De trigger on_auth_user_created maakt
-- automatisch de profielen (rol uit raw_user_meta_data).
-- De lege strings voor de token-kolommen zijn nodig: Supabase Auth kan niet
-- inloggen als die kolommen NULL zijn.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
select
  '00000000-0000-0000-0000-000000000000',
  u.id,
  'authenticated',
  'authenticated',
  u.email,
  extensions.crypt('liftlog-demo', extensions.gen_salt('bf')),
  now(),
  '{"provider": "email", "providers": ["email"]}'::jsonb,
  jsonb_build_object('full_name', u.full_name, 'role', u.role),
  now() - interval '60 days',
  now(),
  '', '', '', ''
from (values
  ('11111111-1111-4111-8111-111111111111'::uuid, 'trainer@liftlog.test', 'Coach Lien', 'trainer'),
  ('22222222-2222-4222-8222-222222222222'::uuid, 'noor@liftlog.test', 'Noor Janssens', 'member'),
  ('33333333-3333-4333-8333-333333333333'::uuid, 'milan@liftlog.test', 'Milan De Smet', 'member')
) as u (id, email, full_name, role);

insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select
  gen_random_uuid(),
  u.id,
  u.id::text,
  jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
  'email',
  now(), now(), now()
from auth.users u
where u.id in (
  '11111111-1111-4111-8111-111111111111',
  '22222222-2222-4222-8222-222222222222',
  '33333333-3333-4333-8333-333333333333'
);

-- Vaste uitnodigingscode voor de demo, en beide members koppelen.
update public.profiles set invite_code = 'DEMO42'
where id = '11111111-1111-4111-8111-111111111111';
update public.profiles set trainer_id = '11111111-1111-4111-8111-111111111111'
where id in ('22222222-2222-4222-8222-222222222222', '33333333-3333-4333-8333-333333333333');

-- 2. CONTROLE ------------------------------------------------------------------
-- Het demoschema gebruikt de standaardbibliotheek uit schema.sql (sectie 9).
do $$
begin
  if not exists (select 1 from public.exercises where created_by is null) then
    raise exception 'Voer eerst supabase/schema.sql uit: de standaardbibliotheek ontbreekt.';
  end if;
end;
$$;

-- 3. SCHEMA -------------------------------------------------------------------
do $$
declare
  trainer constant uuid := '11111111-1111-4111-8111-111111111111';
  program uuid;
  day_id uuid;
  d record;
  ex record;
begin
  insert into public.programs (trainer_id, name, description)
  values (trainer, 'Blok 3 · Kracht', 'Vier dagen per week. Compounds tot RPE 8-9, accessoires op RPE 8.')
  returning id into program;

  for d in
    select * from (values
      (0, 'Dag 1 · Squat & close grip', 0),
      (1, 'Dag 2 · Deadlift & bench', 1),
      (2, 'Dag 3 · Upper volume', 3),
      (3, 'Dag 4 · Bench & rug', 5)
    ) as t (position, name, weekday)
  loop
    insert into public.program_days (program_id, position, name, weekday)
    values (program, d.position, d.name, d.weekday)
    returning id into day_id;

    for ex in
      select * from (values
        (0, 0, 'Squat', 4, '5', '7', false),
        (0, 1, 'Close grip bench', 4, '5', '7', false),
        (0, 2, 'Leg extension', 3, '8-10', '8', false),
        (0, 3, 'Chest supported row', 3, '6-8', '8', false),
        (0, 4, 'Bayesian curl', 3, '10-12', '8', false),
        (1, 0, 'Comp deadlift', 3, '4', '7-8', false),
        (1, 1, 'Comp bench', 3, '4', '7-8', false),
        (1, 2, 'Hamstring curl', 3, '10-12', '8', false),
        (1, 3, 'Incline chest press', 3, '10', '8', false),
        (1, 4, 'Hammer curl', 3, '10-12', '8', true),
        (2, 0, 'DB press', 3, '8-10', '8', false),
        (2, 1, 'T-bar row', 3, '6-8', '8', false),
        (2, 2, 'Hyperextensions', 3, '8-10', '8', false),
        (2, 3, 'Tricep', 3, '12-15', '8', false),
        (2, 4, 'Alternating bicep curl', 3, '10-12', '8', false),
        (3, 0, 'Comp bench', 3, '6', '7', false),
        (3, 1, 'Lat pulldown', 3, '10', '8', false),
        (3, 2, 'Pull ups(weighted)', 3, '6-8', '8-8,5', false),
        (3, 3, 'Pec flies', 3, '10-12', '8', false),
        (3, 4, 'Lateral raise', 3, '12-15', '7', false)
      ) as t (day_position, position, exercise_name, sets, reps, rpe, optional)
      where t.day_position = d.position
    loop
      insert into public.program_exercises
        (program_day_id, exercise_id, position, target_sets, target_reps, target_rpe, optional)
      select day_id, e.id, ex.position, ex.sets, ex.reps, ex.rpe, ex.optional
      from public.exercises e
      where e.created_by is null and e.name = ex.exercise_name;
    end loop;
  end loop;

  insert into public.program_assignments (program_id, member_id, start_date, active)
  values
    (program, '22222222-2222-4222-8222-222222222222', current_date - 28, true),
    (program, '33333333-3333-4333-8333-333333333333', current_date - 28, true);
end;
$$;

-- 4. TRAININGEN ---------------------------------------------------------------
-- Voor elke datum waarop het schema een dag heeft, maken we een training aan met
-- de oefeningen van die dag. Het gewicht stijgt elke week een beetje, zodat de
-- progressiegrafieken iets tonen.
do $$
declare
  program uuid := (select id from public.programs where trainer_id = '11111111-1111-4111-8111-111111111111' limit 1);
  mem record;
  on_date date;
  pday record;
  pex record;
  workout uuid;
  we uuid;
  week_index int;
  base numeric;
  reps int;
  target numeric;
  set_no int;
begin
  for mem in
    select * from (values
      -- Noor traint 4 weken tot gisteren; Milan stopte 10 dagen geleden.
      ('22222222-2222-4222-8222-222222222222'::uuid, current_date - 27, current_date - 1, 1.0),
      ('33333333-3333-4333-8333-333333333333'::uuid, current_date - 27, current_date - 10, 0.8)
    ) as t (id, first_day, last_day, strength)
  loop
    for on_date in select generate_series(mem.first_day, mem.last_day, interval '1 day')::date loop
      select * into pday
      from public.program_days
      where program_id = program and weekday = extract(isodow from on_date)::int - 1;
      continue when not found;

      week_index := (on_date - mem.first_day) / 7;

      insert into public.workouts (member_id, date, title, program_day_id, duration_minutes, status)
      values (mem.id, on_date, pday.name, pday.id, 60 + (week_index * 5), 'completed')
      returning id into workout;

      for pex in
        select pe.*, e.name as exercise_name
        from public.program_exercises pe
        join public.exercises e on e.id = pe.exercise_id
        where pe.program_day_id = pday.id
        order by pe.position
      loop
        -- Startgewicht per oefening (kg) voor de "sterkste" demo-member.
        base := case pex.exercise_name
          when 'Squat' then 110
          when 'Comp bench' then 85
          when 'Close grip bench' then 75
          when 'Comp deadlift' then 135
          when 'DB press' then 26
          when 'Incline chest press' then 50
          when 'Leg extension' then 60
          when 'Hamstring curl' then 50
          when 'Chest supported row' then 60
          when 'T-bar row' then 40
          when 'Lat pulldown' then 60
          when 'Pull ups(weighted)' then 5
          when 'Pec flies' then 45
          when 'Tricep' then 30
          when 'Hyperextensions' then 15
          else 14
        end;
        -- 2,5% per week, afgerond op 2,5 kg (zoals echte schijven).
        target := round(base * mem.strength * (1 + 0.025 * week_index) / 2.5) * 2.5;
        reps := split_part(pex.target_reps, '-', 1)::int;

        insert into public.workout_exercises
          (workout_id, exercise_id, position, target_sets, target_reps, target_intensity, actual_rpe, performed)
        values (
          workout, pex.exercise_id, pex.position, pex.target_sets, pex.target_reps,
          'RPE ' || pex.target_rpe,
          least(10, split_part(replace(pex.target_rpe, ',', '.'), '-', 1)::numeric + (week_index % 2) * 0.5),
          true
        )
        returning id into we;

        for set_no in 1..pex.target_sets loop
          insert into public.workout_sets (workout_exercise_id, set_number, reps, weight, rpe)
          values (
            we, set_no, reps, target,
            least(10, split_part(replace(pex.target_rpe, ',', '.'), '-', 1)::numeric + (set_no - 1) * 0.5)
          );
        end loop;
      end loop;

      -- Op dag 3 nog wat cardio.
      if pday.position = 2 then
        insert into public.cardio_entries (workout_id, type, duration_minutes)
        values (workout, 'Loopband (wandelen)', 20);
      end if;
    end loop;
  end loop;
end;
$$;

-- Trainersfeedback op de laatste training van Noor.
insert into public.workout_feedback (workout_id, trainer_id, message)
select id, '11111111-1111-4111-8111-111111111111', 'Sterke sessie! Volgende week mag de squat +2,5 kg. Let op je tempo bij de close grip.'
from public.workouts
where member_id = '22222222-2222-4222-8222-222222222222'
order by date desc
limit 1;

-- 5. CHECK-INS, LICHAAMSGEWICHT, MAXIMA ---------------------------------------
-- week_start moet een maandag zijn: date_trunc('week', ...) geeft altijd de maandag.
insert into public.weekly_checkins
  (member_id, week_start, training, motivation, pain, score, feedback)
values
  ('22222222-2222-4222-8222-222222222222', date_trunc('week', current_date - 21)::date, 'NEUTRAAL', 'AMAZING', 'BAD', 6,
   'Rechterknie wat gevoelig bij diepe squats.'),
  ('22222222-2222-4222-8222-222222222222', date_trunc('week', current_date - 14)::date, 'AMAZING', 'AMAZING', 'NEUTRAAL', 8,
   'Knie voelt beter, bench ging vlot.'),
  ('22222222-2222-4222-8222-222222222222', date_trunc('week', current_date - 7)::date, 'AMAZING', 'NEUTRAAL', 'NEUTRAAL', 7,
   'Drukke week op het werk, maar alle sessies gedaan.'),
  ('33333333-3333-4333-8333-333333333333', date_trunc('week', current_date - 14)::date, 'NEUTRAAL', 'BAD', 'BAD', 4,
   'Onderrug trekt bij deadlifts. Even rust genomen.');

insert into public.body_metrics (member_id, date, weight)
values
  ('22222222-2222-4222-8222-222222222222', current_date - 28, 63.8),
  ('22222222-2222-4222-8222-222222222222', current_date - 21, 63.5),
  ('22222222-2222-4222-8222-222222222222', current_date - 14, 63.6),
  ('22222222-2222-4222-8222-222222222222', current_date - 7, 63.1),
  ('22222222-2222-4222-8222-222222222222', current_date - 1, 62.9),
  ('33333333-3333-4333-8333-333333333333', current_date - 25, 82.4),
  ('33333333-3333-4333-8333-333333333333', current_date - 11, 82.9);

-- Maxima per blok (Blok 1 en 2 komen uit het Info-tabblad van de voorbeeldsheet).
insert into public.strength_tests (member_id, label, squat, bench, deadlift, tested_on)
values
  ('22222222-2222-4222-8222-222222222222', 'Blok 1', 100, 105, 150, current_date - 90),
  ('22222222-2222-4222-8222-222222222222', 'Blok 2', 135, 105, 160, current_date - 35),
  ('33333333-3333-4333-8333-333333333333', 'Blok 1', 120, 90, 170, current_date - 40);
