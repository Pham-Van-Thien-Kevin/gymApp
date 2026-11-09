-- =============================================================================
-- Liftlog update 2026-11-09: blokken per cliënt en gewichten van de coach
--
-- Voor een database die al draait (online). Dit script WIST NIETS: het voegt
-- de tabel training_blocks, de kolom workout_exercises.coach_weight en de
-- functie set_coach_weights toe, en vervangt log_workout en import_sheet. Veilig om opnieuw uit te voeren.
-- Een nieuwe installatie heeft dit niet nodig: schema.sql bevat het al.
--
-- Uitvoeren: Supabase → SQL Editor → New query → plakken → Run.
-- =============================================================================

begin;

-- >>> BLOKKEN EN GEWICHTEN (dit blok staat letterlijk ook in supabase/updates/2026-11-09-blokken-en-gewichten.sql)
-- Een blok van een cliënt: "Blok 1" begint op een maandag en duurt een aantal
-- weken. Elke training die in die weken valt, toont de app als "Blok 1 · Week 2".
create table if not exists public.training_blocks (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.profiles (id) on delete cascade,
  number smallint not null check (number between 1 and 99),
  -- isodow 1 = maandag: een blokweek loopt van maandag tot zondag.
  start_date date not null check (extract(isodow from start_date) = 1),
  weeks smallint not null check (weeks between 1 and 16),
  created_at timestamptz not null default now(),
  unique (member_id, number)
);
create index if not exists training_blocks_member_idx on public.training_blocks (member_id, start_date);

alter table public.training_blocks enable row level security;
revoke all on public.training_blocks from anon;
-- De sporter en zijn trainer lezen; enkel de trainer maakt blokken aan of verwijdert ze.
drop policy if exists "training_blocks: lezen" on public.training_blocks;
create policy "training_blocks: lezen" on public.training_blocks for select to authenticated
  using (public.can_access_member(member_id));
drop policy if exists "training_blocks: trainer schrijft" on public.training_blocks;
create policy "training_blocks: trainer schrijft" on public.training_blocks for all to authenticated
  using (public.is_trainer_of(member_id))
  with check (public.is_trainer_of(member_id));

-- Voorgesteld gewicht van de coach voor een geplande oefening (kg). Leeg = de
-- app rekent zelf een voorstel uit op basis van het geschatte 1RM.
alter table public.workout_exercises add column if not exists coach_weight numeric(6, 2)
  check (coach_weight >= 0 and coach_weight < 1000);

-- De trainer zet de gewichten van een geplande sessie van een cliënt.
-- p_weights: { "<workout_exercise_id>": 85, "<ander id>": null }
-- security definer: een trainer mag workout_exercises niet zelf aanpassen
-- (zie can_write_workout). Deze functie laat hem enkel coach_weight zetten,
-- enkel bij een geplande sessie van een eigen cliënt.
create or replace function public.set_coach_weights(p_workout_id uuid, p_weights jsonb)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.workouts
    where id = p_workout_id and status = 'planned' and public.is_trainer_of(member_id)
  ) then
    raise exception 'Deze sessie bestaat niet, is niet van jouw cliënt of is al afgewerkt.';
  end if;

  -- "?" = bestaat deze sleutel in het JSON-object? Enkel meegestuurde oefeningen veranderen.
  update public.workout_exercises we
  set coach_weight = (p_weights ->> we.id::text)::numeric
  where we.workout_id = p_workout_id and p_weights ? we.id::text;
end;
$$;
revoke execute on function public.set_coach_weights(uuid, jsonb) from public, anon;
grant execute on function public.set_coach_weights(uuid, jsonb) to authenticated;
-- <<< BLOKKEN EN GEWICHTEN

-- Gewichten van de coach gaan niet verloren: log_workout neemt ze mee als de
-- sporter een geplande sessie afwerkt, import_sheet zet ze terug bij een herimport.
-- (Dezelfde functies als in schema.sql, met enkel die toevoeging.)
create or replace function public.log_workout(payload jsonb)
returns uuid
language plpgsql set search_path = ''
as $$
declare
  v_workout uuid;
  v_item jsonb;
  v_we uuid;
  v_coach jsonb := '{}'::jsonb;  -- oefening-id → gewicht dat de coach voorstelde
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
      planned_title = title,
      planned_tab = (select b.sheet_tab from public.import_batches b where b.id = import_batch_id)
    where id = (payload ->> 'workout_id')::uuid
      and member_id = (select auth.uid())
      and status = 'planned'
    returning id into v_workout;

    if v_workout is null then
      raise exception 'Deze geplande training bestaat niet (meer) of is al afgewerkt.';
    end if;

    -- Gewichten van de coach onthouden: ze blijven bij de oefening, zodat de
    -- coach achteraf ziet wat hij voorstelde en wat je echt deed.
    select coalesce(jsonb_object_agg(exercise_id, coach_weight), '{}'::jsonb) into v_coach
    from public.workout_exercises
    where workout_id = v_workout and coach_weight is not null;

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
      workout_id, exercise_id, position, target_sets, target_reps, target_intensity, notes, optional, performed, coach_weight
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
      jsonb_array_length(coalesce(v_item -> 'sets', '[]'::jsonb)) > 0,
      (v_coach ->> (v_item ->> 'exercise_id'))::numeric
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

create or replace function public.import_sheet(payload jsonb)
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
  v_coach jsonb;  -- "titel|oefening-id|positie" → gewicht van de coach (zie stap 2)
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
    -- Gewichten die de coach bij geplande sessies van deze tab zette, onthouden
    -- vóór het verwijderen. Dezelfde sessie (titel) met dezelfde oefening op
    -- dezelfde plaats krijgt ze straks terug: een herimport wist ze niet.
    select coalesce(jsonb_object_agg(w.title || '|' || we.exercise_id || '|' || we.position, we.coach_weight), '{}'::jsonb)
    into v_coach
    from public.import_batches b
    join public.workouts w on w.import_batch_id = b.id
    join public.workout_exercises we on we.workout_id = w.id
    where b.member_id = v_member and b.sheet_tab = v_tab ->> 'sheet_tab'
      and w.title is not null and we.coach_weight is not null;

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
          actual_rpe, notes, optional, performed, raw, coach_weight
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
          v_item -> 'raw',
          (v_coach ->> ((v_workout ->> 'title') || '|' || v_exercise_id || '|' || coalesce((v_item ->> 'position')::int, 0)))::numeric
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

commit;
