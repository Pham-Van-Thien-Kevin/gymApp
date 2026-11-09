-- =============================================================================
-- Liftlog update 2026-11-09: blokken per cliënt en gewichten van de coach
--
-- Voor een database die al draait (online). Dit script WIST NIETS: het voegt
-- de tabel training_blocks, de kolom workout_exercises.coach_weight en de
-- functie set_coach_weights toe. Veilig om opnieuw uit te voeren.
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

commit;
