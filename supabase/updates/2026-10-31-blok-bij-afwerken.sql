-- =============================================================================
-- Liftlog update 2026-10-31: een afgewerkte sessie blijft bij haar blok
--
-- Voor een database die al draait (online). Dit script WIST NIETS: het voegt
-- een kolom toe en vervangt log_workout. Veilig om opnieuw uit te voeren.
-- Een nieuwe installatie heeft dit niet nodig: schema.sql bevat het al.
--
-- Uitvoeren: Supabase → SQL Editor → New query → plakken → Run.
-- =============================================================================

begin;

alter table public.workouts add column if not exists planned_tab text;

-- Sessies die al eerder in de app afgewerkt werden: hun blok achteraf invullen
-- is niet mogelijk (de import is losgekoppeld), dus enkel nieuwe afwerkingen.

create or replace function public.log_workout(payload jsonb)
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
      planned_title = title,
      planned_tab = (select b.sheet_tab from public.import_batches b where b.id = import_batch_id)
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

commit;
