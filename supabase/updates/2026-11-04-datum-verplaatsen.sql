-- =============================================================================
-- Liftlog update 2026-11-04: de trainer verplaatst een training naar een andere dag
--
-- Voor een database die al draait (online). Dit script WIST NIETS: het voegt
-- de functie move_workout toe. Veilig om opnieuw uit te voeren.
-- Een nieuwe installatie heeft dit niet nodig: schema.sql bevat het al.
--
-- Uitvoeren: Supabase → SQL Editor → New query → plakken → Run.
-- =============================================================================

begin;

-- >>> DATUM VERPLAATSEN (dit blok staat letterlijk ook in supabase/updates/2026-11-04-datum-verplaatsen.sql)
-- De trainer zet een training van een cliënt op een andere dag: een geplande
-- sessie verplaatsen, of de datum van een gelogde training corrigeren.
-- security definer: een trainer mag trainingen niet zelf aanpassen (zie de
-- policy "workouts: member past aan"). Deze functie laat hem enkel de datum
-- veranderen, en enkel bij een eigen cliënt (is_trainer_of).
create or replace function public.move_workout(p_workout_id uuid, p_date date)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if p_date is null or p_date < date '2000-01-01' or p_date > current_date + 365 then
    raise exception 'Kies een geldige datum.';
  end if;

  update public.workouts set date = p_date
  where id = p_workout_id
    and public.is_trainer_of(member_id)
    -- Een gelogde training kan niet in de toekomst liggen; een geplande wel.
    and (status = 'planned' or p_date <= current_date);

  if not found then
    raise exception 'Deze training bestaat niet, is niet van jouw cliënt, of een gelogde training kan niet in de toekomst.';
  end if;
end;
$$;
revoke execute on function public.move_workout(uuid, date) from public, anon;
grant execute on function public.move_workout(uuid, date) to authenticated;
-- <<< DATUM VERPLAATSEN

commit;
