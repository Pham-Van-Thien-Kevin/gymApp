# Liftlog: powerlift tracker

Gym-tracking webapp met twee kanten:

- **Gebruikersapp** (`/app`, mobile-first) voor sporters: training van vandaag volgens het schema, trainingen loggen met doelen, vorige prestatie, **voorgesteld gewicht**, schijvencalculator, PR-meldingen en rusttimer, progressiegrafieken, maxima per blok, lichaamsgewicht, wekelijkse check-in, historiek met trainersfeedback en import uit Google Sheets.
- **Trainerdashboard** (`/trainer`, desktop-first) voor coaches: overzicht van alle cliënten (met markering bij 7+ dagen inactief of pijn "BAD"), cliëntdetail, schema's bouwen en toewijzen, oefeningenbibliotheek, feedback op trainingen en import voor een cliënt.

De naam "Liftlog" is een voorlopige naam. Je past hem op één plek aan: [`src/lib/config.ts`](src/lib/config.ts).

## Tech stack

| Onderdeel | Keuze |
| --- | --- |
| Framework | Next.js 16 (App Router, Server Components, Server Actions) + React 19 + TypeScript |
| Styling | Tailwind CSS v4, met design tokens (`ink`, `chalk`, `lime`) in [`src/app/globals.css`](src/app/globals.css) |
| Database en auth | Supabase (Postgres, Supabase Auth, Row Level Security) via `@supabase/ssr` |
| Grafieken | Recharts |
| Excel inlezen | SheetJS 0.20.3, geïnstalleerd van `cdn.sheetjs.com` (niet de verouderde npm-versie) |
| Tests | Vitest |
| Hosting | Vercel (Hobby) + Supabase (Free) |

## Aan de slag

### 1. Supabase-project aanmaken

1. Maak een gratis account op [supabase.com](https://supabase.com) en klik **New project**.
2. Kies een naam, een sterk databasewachtwoord en een regio dicht bij je gebruikers (bv. *Central EU (Frankfurt)*).
3. Wacht tot het project klaar is (±1 minuut).

### 2. SQL uitvoeren

1. Open in je project **SQL Editor → New query**.
2. Plak de volledige inhoud van [`supabase/schema.sql`](supabase/schema.sql) en klik **Run**. Dit maakt alle tabellen, RLS-policies, triggers en functies aan, plus een **standaardbibliotheek van 29 oefeningen** die elke gebruiker ziet (ook een nieuwe trainer).
3. **Enkel lokaal of in een apart testproject:** voer daarna [`supabase/seed.sql`](supabase/seed.sql) uit voor demo-accounts en voorbeeldtrainingen.

> **Online (productie) voer je enkel `schema.sql` uit.** De demo-accounts in `seed.sql` hebben een publiek gekend wachtwoord: iedereen die je repo ziet, zou ermee kunnen inloggen. Toch per ongeluk uitgevoerd? Draai dan [`supabase/remove-demo.sql`](supabase/remove-demo.sql). Dat verwijdert enkel de drie demo-accounts en hun data.

> `schema.sql` begint met het opruimen van bestaande tabellen. Opnieuw uitvoeren wist dus alle app-data. Handig tijdens development, niet in productie.

**Demo-accounts uit `seed.sql`** (wachtwoord voor alle drie: `liftlog-demo`, enkel voor lokaal testen):

| E-mail | Rol | Wat zie je |
| --- | --- | --- |
| `trainer@liftlog.test` | trainer | uitnodigingscode `DEMO42`, twee cliënten, een schema |
| `noor@liftlog.test` | member | 4 weken trainingen, progressie, check-ins, feedback |
| `milan@liftlog.test` | member | 10 dagen niet getraind en pijn "BAD": gemarkeerd bij de trainer |

### 3. Auth instellen

In **Authentication**:

- **Sign In / Providers → Email**: laat Email aan. Wil je lokaal snel testen zonder mailbox, zet dan **Confirm email** uit. Nieuwe accounts kunnen dan meteen inloggen.
- **URL Configuration**:
  - *Site URL*: `http://localhost:3000` (later je Vercel-URL).
  - *Redirect URLs*: voeg `http://localhost:3000/**` toe (en later `https://jouw-app.vercel.app/**`).
- **Emails → Confirm signup** (aanbevolen als Confirm email aan staat): vervang de link door
  ```
  {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email
  ```
  Zo werkt de bevestigingslink ook als je hem in een andere browser opent. De standaardlink werkt ook: [`src/app/auth/confirm/route.ts`](src/app/auth/confirm/route.ts) ondersteunt beide.

### 4. Omgevingsvariabelen

```bash
cp .env.example .env.local
```

Vul in `.env.local` in (je vindt beide in **Project Settings → API Keys**):

- `NEXT_PUBLIC_SUPABASE_URL`: de project-URL, bv. `https://abcdefgh.supabase.co`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: de *publishable* key (`sb_publishable_…`). Een oudere *anon* key werkt ook.

Deze key mag publiek zijn: de beveiliging zit in Row Level Security, niet in het geheimhouden van de key. Gebruik in deze app **nooit** de *secret* of *service_role* key.

### 5. Lokaal draaien

```bash
npm install
```

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) en log in met een demo-account, of registreer een nieuw account (kies sporter of trainer).

### 6. Deployen op Vercel

1. Push de repository naar GitHub.
2. Ga naar [vercel.com/new](https://vercel.com/new), importeer de repository (Framework: Next.js wordt automatisch herkend).
3. Voeg bij **Environment Variables** `NEXT_PUBLIC_SUPABASE_URL` en `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` toe.
4. Klik **Deploy**.
5. Zet in Supabase (**Authentication → URL Configuration**) de *Site URL* op je Vercel-URL en voeg `https://jouw-app.vercel.app/**` toe aan de *Redirect URLs*.

> Een gratis Supabase-project pauzeert na een week zonder activiteit. Je zet het weer aan via het dashboard.

## Scripts

| Commando | Wat het doet |
| --- | --- |
| `npm run dev` | Development-server op poort 3000 |
| `npm run build` | Productiebuild (controleert ook TypeScript) |
| `npm start` | Productiebuild draaien |
| `npm run lint` | ESLint |
| `npm test` | Unit tests (Vitest) |

### Tests

- [`tests/import-parser.test.ts`](tests/import-parser.test.ts) test de import op de echte voorbeeldsheet [`fixtures/gymSheet.xlsx`](fixtures/gymSheet.xlsx) en op een kleine synthetische sheet voor varianten die niet in de fixture zitten.
- [`tests/import-integration.test.ts`](tests/import-integration.test.ts) importeert de fixture écht in Supabase (als `noor@liftlog.test`), twee keer, en controleert dat er geen dubbels ontstaan. Hij wordt overgeslagen tenzij je een database opgeeft:

```bash
SUPABASE_TEST_URL=http://127.0.0.1:54321 SUPABASE_TEST_KEY=sb_publishable_... npm test
```

Gebruik daarvoor een lokale Supabase (`npx supabase start`, met Docker) of een testproject, nooit productie: de test maakt en verwijdert data.

## Projectstructuur

```
src/
  proxy.ts                      Next 16-naam voor "middleware": sessie verversen + routes afschermen
  app/
    (auth)/login, register      Inloggen en registreren (+ Server Actions in actions.ts)
    auth/confirm/route.ts       Bevestigingslink uit de e-mail
    app/                        URL /app: gebruikersapp (layout controleert rol "member")
      log/                      Training loggen: logger, rusttimer, Server Actions
      schema/ progress/ checkin/ history/ import/ profile/
    trainer/                    URL /trainer: dashboard (layout controleert rol "trainer")
      clients/[id]/             Cliëntdetail, trainingen + feedback, import
      programs/ exercises/      Schema-editor en oefeningenbibliotheek
  components/                   Gedeelde UI (ui/, charts/, progress/, import/)
  lib/
    supabase/                   Supabase-clients (server en proxy)
    auth.ts                     getCurrentProfile() en requireRole()
    data.ts                     Leesfuncties voor de database
    import/                     Parser, datums, naamkoppeling, payload, Server Actions
supabase/schema.sql             Structuur + RLS + standaardbibliotheek (ook online)
supabase/seed.sql               Demo-accounts en -trainingen (enkel lokaal)
supabase/remove-demo.sql        Demo-accounts weer verwijderen
fixtures/gymSheet.xlsx
tests/
```

**Server of Client Component?** Standaard is alles een Server Component: data wordt op de server opgehaald en er gaat enkel HTML naar de browser. Een bestand begint pas met `"use client"` als het state, effects of browser-API's nodig heeft (formulieren met directe feedback, de logger, de rusttimer, grafieken). Elk bestand legt bovenaan uit waarom het het een of het ander is.

## Powerlifting-functies

Alles staat in [`src/lib/rpe.ts`](src/lib/rpe.ts) (pure functies, getest in [`tests/powerlifting.test.ts`](tests/powerlifting.test.ts)).

- **RPE-tabel**: het percentage van je 1RM per RPE (10 tot 5) en aantal reps (1 tot 12), overgenomen uit het tabblad `RPE` van de coaching-sheet. In de logger kan je de tabel openklappen, met de betekenis van elke RPE in "reps in reserve".
- **Geschat 1RM (e1RM)**: gewicht ÷ percentage uit de tabel (100 kg × 5 @ RPE 8 → 100 / 0,81 = 123,5 kg). Zonder RPE, of buiten de tabel, valt de app terug op de Epley-formule. Dit voedt ook de progressiegrafieken.
- **Voorgesteld gewicht**: geschat 1RM × percentage voor het doel uit het schema, afgerond op 2,5 kg, net als de rekenmachine onder de RPE-tabel in de sheet (bench 105 kg, 4 @ RPE 7 → 85 kg). Bij een bereik zoals "RPE 7-8" rekent de app met de ondergrens.
  - Je ziet het gewicht al vooraf bij de training van vandaag (Home), in je schema en in het schema van een cliënt (trainer).
  - In de logger zet "Invullen" het voorstel in alle lege sets; een set afvinken zonder gewicht gebruikt ook het voorstel.
  - Bij een vrije oefening zonder doel kies je zelf "reps @ RPE" (standaard 5 @ RPE 8).
- **Schijvencalculator**: voor oefeningen met materiaal "Barbell" toont de logger welke schijven je per kant legt (stang 20 kg, schijven 25 tot 1,25 kg).
- **PR-melding**: verslaat een afgevinkte set je beste geschatte 1RM ooit, dan krijg je een lime "PR" en "Nieuw record!".
- **RPE-calculator** (`/app/rpe` voor sporters, `/trainer/rpe` voor trainers), met drie standen:
  - *Gewicht*: 1RM + reps + RPE → gewicht (afgerond op 2,5 kg) en schijven per kant, plus een tabel met alle gewichten voor dat 1RM. Sporters vullen hun 1RM in met één keuze uit hun eigen oefeningen.
  - *1RM*: gewicht + reps + RPE → geschat 1RM.
  - *RPE*: 1RM + gewicht + reps → hoe zwaar dat ongeveer is (bv. "≈ RPE 8 · nog 2 reps in reserve").

## Beveiliging in drie lagen

1. **Proxy** ([`src/lib/supabase/proxy.ts`](src/lib/supabase/proxy.ts)): niet ingelogd → `/login`; een trainer op `/app` of een member op `/trainer` → eigen startpagina.
2. **Layouts en Server Actions** ([`src/lib/auth.ts`](src/lib/auth.ts)): elke sectie-layout, pagina en Server Action roept `requireRole()` aan. Een Server Action is een publiek endpoint, ook als de knop verborgen is.
3. **Row Level Security** ([`supabase/schema.sql`](supabase/schema.sql)): de database zelf bepaalt welke rijen je ziet. Een member ziet enkel eigen data; een trainer ziet de data van zijn gekoppelde cliënten, mag voor hen importeren en beheert eigen schema's, oefeningen en feedback.

Extra:

- Niemand kan zijn eigen rol aanpassen. RLS bepaalt welke *rijen*, kolomrechten welke *kolommen*: `authenticated` mag in `profiles` enkel `full_name` wijzigen.
- Een trainer koppelen (`join_trainer`) en een uitnodigingscode vernieuwen (`regenerate_invite_code`) gaan via databasefuncties die zelf controleren wie wat mag.
- Bij registratie kies je zelf "sporter" of "trainer". Dat is veilig: een trainer ziet enkel data van sporters die zelf zijn code invulden.

## Import uit Google Sheets

**Invoer**: plak de deellink (de sheet moet gedeeld zijn met "Iedereen met de link"), of upload een `.xlsx` (Bestand → Downloaden → Microsoft Excel). De server haalt de sheet op als `.xlsx` via `https://docs.google.com/spreadsheets/d/{ID}/export?format=xlsx`.

**Flow**: bron kiezen → preview (tabs, weken, sessies, oefeningen, waarschuwingen; startdatum per maandtab en oefeningkoppelingen aanpasbaar) → bevestigen. De server parset het bestand bij het bevestigen opnieuw en vertrouwt enkel de keuzes uit de browser. Alles gaat in één transactie naar de databasefunctie `import_sheet`. Een herimport van dezelfde tab vervangt de vorige import (geen dubbels).

**Hoe de parser de sheet leest** ([`src/lib/import/parser.ts`](src/lib/import/parser.ts)):

- Maandtabs herkent hij aan `MMMYYYY` (`JUL2026`, ook `OKT`/`OCT`). `RPE` en `Externals` worden overgeslagen. Van `Info` neemt hij enkel de startdatum, de lijst "Beschikbare oefening" en de maxima per blok.
- Weken zoekt hij via `WEEK n`-koppen, of via de `SESSIE 1`-koppen als die er niet zijn. Kolommen zoekt hij op kopteksten (`SETS`, `REPS`, …), met de standaardvolgorde enkel als terugvaloptie.
- Een rij zonder gewicht én zonder echte RPE is "gepland": ze wordt bewaard, maar telt niet mee in de progressie. Bij een rep-bereik neemt hij de ondergrens (`reps_estimated`), bij een RPE-bereik het gemiddelde. De originele celwaarden staan altijd in het `raw`-veld.
- Sessiedatum = startdatum week 1 + (week − 1) × 7 + weekdag uit de kopregel (of de dag na de vorige sessie). Staat een weekdag vóór de vorige sessie (bv. sessie 4 op "Maandag" na een woensdag), dan wordt het de dag erna, met een waarschuwing.
- Recap-scores: `GOOD` wordt `AMAZING` (positief op een schaal van drie). Andere waarden worden leeg, met een waarschuwing.

**Valkuil in de echte sheet**: Google Sheets zet tekst als `10-12` (reps) of `6-7` (RPE) automatisch om naar een datum. In de cel staat dan intern een getal (46366), op het scherm "10-12". De parser leest bij zulke datumcellen daarom de getoonde tekst.

## Afwijkingen van de opdracht

- **Cache Components staan uit** (`cacheComponents: false` in [`next.config.ts`](next.config.ts)). Elke pagina hangt af van de ingelogde gebruiker, dus er valt niets statisch te prerenderen. Het klassieke dynamische model is hier eenvoudiger te volgen.
- **Tailwind v4 heeft geen `tailwind.config.js`**: de configuratie (en dus de kleurtokens) staat in CSS onder `@theme`. Het standaardpalet is gewist, zodat er geen andere kleuren kunnen insluipen.
- **Drie kleuren in plaats van exact twee.** Met lime als tekstkleur overal was het geheel te fel. Daarom kwam er een neutraal gebroken wit bij (`chalk`, `#ECECE4`) voor tekst en 1px-lijnen. Lime (`#D7FF3A`) is nu enkel nog een accent: primaire knoppen, de actieve tab, markeringen ("aandacht nodig", pijn "BAD"), afgevinkte sets, persoonlijke records, focus en de lijnen in grafieken. Variatie gebeurt nog altijd via opacity, nooit via extra tinten.
- **`proxy.ts` in plaats van `middleware.ts`**: zo heet het bestand sinds Next.js 16.
- **Extra kolommen** die de echte sheet nodig had: `workouts.status` (gepland/uitgevoerd), `workout_exercises.performed`, en in `weekly_checkins` ook `overall_feeling`, `sessions_done` en `raw`.
- **De oefeningen uit de Info-tab staan in `schema.sql`, niet in `seed.sql`.** Zo krijgt ook een online installatie zonder demodata meteen een bruikbare bibliotheek.
- **Twee databasefuncties voor atomaire writes**: `log_workout` (een training loggen) en `import_sheet` (de import), zodat er nooit een halve training in de database belandt.
