-- =============================================================================
-- Liftlog: demo-accounts verwijderen
--
-- Heb je seed.sql per ongeluk op je online project uitgevoerd? Voer dan dit
-- bestand uit in de Supabase SQL Editor. Het verwijdert de drie demo-accounts
-- (trainer@, noor@ en milan@liftlog.test) met al hun data. Echte gebruikers en
-- de standaardbibliotheek blijven staan.
--
-- Alles staat in één transactie (begin … commit): lukt één stap niet, dan
-- wordt er niets verwijderd.
-- =============================================================================

begin;

-- Eerst trainingen en schema's: die verwijzen met "on delete restrict" naar oefeningen.
delete from public.workouts where member_id in (
  '22222222-2222-4222-8222-222222222222', '33333333-3333-4333-8333-333333333333'
);
delete from public.programs where trainer_id = '11111111-1111-4111-8111-111111111111';

-- Eigen oefeningen van de demo-accounts (anders worden ze globaal, zie seed.sql).
delete from public.exercises where created_by in (
  '11111111-1111-4111-8111-111111111111',
  '22222222-2222-4222-8222-222222222222',
  '33333333-3333-4333-8333-333333333333'
);

-- De accounts zelf. Profielen, check-ins, maxima, … gaan mee via "on delete cascade".
-- Een echte sporter die de code DEMO42 gebruikte, blijft bestaan, maar zonder trainer.
delete from auth.users where id in (
  '11111111-1111-4111-8111-111111111111',
  '22222222-2222-4222-8222-222222222222',
  '33333333-3333-4333-8333-333333333333'
);

commit;
