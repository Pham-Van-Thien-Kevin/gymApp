-- =============================================================================
-- Liftlog update 2026-10-31: blokopbouw en een geïmporteerde maand opschuiven
--
-- Voor een database die al draait (online). Dit script WIST NIETS: het voegt
-- drie kolommen toe aan programs en één functie. Veilig om opnieuw uit te voeren.
-- Een nieuwe installatie heeft dit niet nodig: schema.sql bevat het al.
--
-- Uitvoeren: Supabase → SQL Editor → New query → plakken → Run.
-- =============================================================================

begin;

alter table public.programs add column if not exists block_weeks smallint check (block_weeks between 2 and 12);
alter table public.programs add column if not exists rpe_start numeric(3, 1) check (rpe_start between 5 and 10);
alter table public.programs add column if not exists rpe_end numeric(3, 1) check (rpe_end between 5 and 10);

-- Een geïmporteerde maand een of meer weken opschuiven, als week 1 in de sheet
-- later (of vroeger) begon dan de import aannam. Alles van die maandtab schuift
-- mee: de sessies (ook al afgewerkte) en de check-ins. Eén transactie.
-- security invoker: RLS geldt; enkel de sporter zelf, enkel hele weken.
create or replace function public.shift_import_block(p_sheet_tab text, p_days integer)
returns integer
language plpgsql set search_path = ''
as $$
declare
  n integer;
begin
  if public.current_app_role() is distinct from 'member' then
    raise exception 'Enkel de sporter kan zijn eigen blok opschuiven.';
  end if;
  if p_days = 0 or p_days % 7 <> 0 or abs(p_days) > 28 then
    raise exception 'Schuif per hele week, maximaal 4 weken.';
  end if;

  update public.workouts w set date = w.date + p_days
  from public.import_batches b
  where b.id = w.import_batch_id and b.member_id = (select auth.uid()) and b.sheet_tab = p_sheet_tab;
  get diagnostics n = row_count;

  update public.weekly_checkins c set week_start = c.week_start + p_days
  from public.import_batches b
  where b.id = c.import_batch_id and b.member_id = (select auth.uid()) and b.sheet_tab = p_sheet_tab;

  return n;
end;
$$;

grant execute on function public.shift_import_block(text, integer) to authenticated;

commit;
