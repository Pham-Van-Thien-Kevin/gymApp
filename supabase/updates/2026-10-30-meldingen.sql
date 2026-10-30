-- =============================================================================
-- Liftlog update 2026-10-30: meldingen
--
-- Voor een database die al draait (online). Dit script WIST NIETS: het maakt
-- de tabel notifications aan met haar triggers. Veilig om opnieuw uit te voeren.
-- Een nieuwe installatie heeft dit niet nodig: schema.sql bevat het al.
--
-- Uitvoeren: Supabase → SQL Editor → New query → plakken → Run.
-- =============================================================================

begin;

-- >>> MELDINGEN (dit blok staat letterlijk ook in supabase/updates/2026-10-30-meldingen.sql)
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('workout_completed', 'program_assigned', 'feedback')),
  title text not null,
  body text,
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);

-- Iedereen ziet enkel zijn eigen meldingen. Aanmaken doen enkel de triggers;
-- de client mag alleen read_at zetten (gelezen markeren) of een melding wissen.
alter table public.notifications enable row level security;
drop policy if exists "notifications: eigen lezen" on public.notifications;
create policy "notifications: eigen lezen" on public.notifications for select to authenticated
  using (user_id = (select auth.uid()));
drop policy if exists "notifications: eigen gelezen markeren" on public.notifications;
create policy "notifications: eigen gelezen markeren" on public.notifications for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
drop policy if exists "notifications: eigen verwijderen" on public.notifications;
create policy "notifications: eigen verwijderen" on public.notifications for delete to authenticated
  using (user_id = (select auth.uid()));
revoke all on public.notifications from anon;
revoke insert, update on public.notifications from authenticated;
grant update (read_at) on public.notifications to authenticated;

-- security definer: een member maakt een melding voor zijn TRAINER aan, iets
-- wat RLS hem terecht niet laat doen. De functie zelf bepaalt dus de ontvanger,
-- nooit de client. search_path = '' tegen het kapen van objectnamen.
create or replace function public.notify_workout_completed()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_trainer uuid;
  v_name text;
begin
  -- Enkel een training die NU afgewerkt wordt, en niet bij een import (anders
  -- zou één import tientallen meldingen geven).
  if new.status <> 'completed' or new.import_batch_id is not null then return new; end if;
  if tg_op = 'UPDATE' and old.status = 'completed' then return new; end if;

  select trainer_id, full_name into v_trainer, v_name from public.profiles where id = new.member_id;
  if v_trainer is null then return new; end if;

  insert into public.notifications (user_id, kind, title, body, link)
  values (
    v_trainer,
    'workout_completed',
    v_name || ' heeft een training afgewerkt',
    coalesce(new.title, 'Training') || ' · ' || to_char(new.date, 'DD/MM'),
    '/trainer/clients/' || new.member_id || '/workouts/' || new.id
  );
  return new;
end;
$$;
drop trigger if exists workouts_notify on public.workouts;
create trigger workouts_notify
  after insert or update of status on public.workouts
  for each row execute function public.notify_workout_completed();

create or replace function public.notify_program_assigned()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if not new.active then return new; end if;
  insert into public.notifications (user_id, kind, title, body, link)
  select new.member_id, 'program_assigned', 'Nieuw schema van je trainer', p.name, '/app/schema'
  from public.programs p
  where p.id = new.program_id;
  return new;
end;
$$;
drop trigger if exists program_assignments_notify on public.program_assignments;
create trigger program_assignments_notify
  after insert on public.program_assignments
  for each row execute function public.notify_program_assigned();

create or replace function public.notify_feedback()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.notifications (user_id, kind, title, body, link)
  select w.member_id, 'feedback', t.full_name || ' gaf feedback op ' || coalesce(w.title, 'je training'),
         left(new.message, 140), '/app/history/' || w.id
  from public.workouts w
  join public.profiles t on t.id = new.trainer_id
  where w.id = new.workout_id;
  return new;
end;
$$;
drop trigger if exists workout_feedback_notify on public.workout_feedback;
create trigger workout_feedback_notify
  after insert on public.workout_feedback
  for each row execute function public.notify_feedback();

-- Realtime: de bel in de app hoort nieuwe meldingen meteen (RLS geldt ook hier).
-- In een gewone Postgres zonder Supabase bestaat de publicatie niet: dan overslaan.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'
     ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end;
$$;
-- <<< MELDINGEN

commit;
