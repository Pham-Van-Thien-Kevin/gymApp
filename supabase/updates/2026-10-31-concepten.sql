-- =============================================================================
-- Liftlog update 2026-10-31: training automatisch opslaan op de server
--
-- Voor een database die al draait (online). Dit script WIST NIETS: het maakt
-- de tabel workout_drafts aan. Veilig om opnieuw uit te voeren.
-- Een nieuwe installatie heeft dit niet nodig: schema.sql bevat het al.
--
-- Uitvoeren: Supabase → SQL Editor → New query → plakken → Run.
-- =============================================================================

begin;

-- >>> CONCEPTEN (dit blok staat letterlijk ook in schema.sql, sectie 8c)
-- Een training die je aan het loggen bent, automatisch bewaard terwijl je logt.
-- Eén concept per sporter: bij opslaan van de training verdwijnt het. Zo verlies
-- je niets als je van toestel wisselt, de app sluit of je batterij leeg is.
create table if not exists public.workout_drafts (
  member_id uuid primary key references public.profiles (id) on delete cascade,
  draft jsonb not null,
  updated_at timestamptz not null default now()
);

-- Enkel jij ziet en schrijft je concept (ook je trainer niet: het is nog niet af).
alter table public.workout_drafts enable row level security;
drop policy if exists "workout_drafts: eigen" on public.workout_drafts;
create policy "workout_drafts: eigen" on public.workout_drafts for all to authenticated
  using (member_id = (select auth.uid()))
  with check (member_id = (select auth.uid()));
revoke all on public.workout_drafts from anon;
-- <<< CONCEPTEN

commit;
