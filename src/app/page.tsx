// Server Component zonder data: de publieke startpagina. Ze heeft geen login
// nodig, dus Next.js rendert ze één keer tijdens de build (statisch) en het CDN
// serveert ze meteen. Ben je ingelogd, dan stuurt de proxy je al door naar je
// eigen startpagina (zie src/lib/supabase/proxy.ts).
//
// Dit is ook de pagina die Google indexeert: echte tekst, één <h1>, koppen in
// volgorde en beschrijvende links.
import type { Metadata } from "next";
import Link from "next/link";
import { buttonClasses } from "@/components/ui/button";
import { APP_NAME } from "@/lib/config";

// Canonical enkel hier: in de root layout zou elke pagina zeggen "ik ben de homepage".
export const metadata: Metadata = { alternates: { canonical: "/" } };

const FEATURES = [
  {
    title: "Loggen met RPE-voorstellen",
    text: "Vink je set af en je doel staat ingevuld. Het voorgestelde gewicht komt uit je geschat 1RM en de RPE-tabel, afgerond op 2,5 kg.",
  },
  {
    title: "Schijvencalculator",
    text: "Per set zie je welke schijven je per kant op de stang legt. Geen hoofdrekenen tussen je sets.",
  },
  {
    title: "Squat, bench en deadlift in één oogopslag",
    text: "Je zwaarste set per training in één grafiek, met bovenaan je geschat 1RM en je total.",
  },
  {
    title: "Het schema van je coach",
    text: "Je trainer zet je schema online. Loggen opent meteen de sessie van vandaag.",
  },
  {
    title: "Google Sheets in en uit",
    text: "Importeer je coachingsheet met één link en exporteer alles terug naar hetzelfde template.",
  },
  {
    title: "Dashboard voor coaches",
    text: "Wie traint, wie niet, wie pijn meldt: je ziet meteen wie aandacht nodig heeft en geeft feedback per training.",
  },
];

export default function LandingPage() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-5">
      <header className="flex h-16 items-center justify-between">
        <p className="text-sm font-bold uppercase tracking-[0.3em]">
          <span aria-hidden="true" className="mr-2 inline-block size-2.5 rounded-[3px] bg-accent align-middle" />
          {APP_NAME}
        </p>
        <Link href="/login" className="text-sm font-semibold underline underline-offset-4">
          Inloggen
        </Link>
      </header>

      <main id="main" className="flex-1">
        <section className="py-16 sm:py-24">
          <p className="mb-4 text-sm font-semibold uppercase tracking-widest text-accent">Powerlift tracker</p>
          <h1 className="max-w-3xl text-4xl font-bold tracking-tight sm:text-6xl">Train volgens schema. Zie wat je echt kan.</h1>
          <p className="mt-6 max-w-2xl text-lg text-chalk/75">
            {APP_NAME} is het trainingslogboek voor powerlifters en hun coach: sets loggen met RPE, voorgestelde gewichten,
            progressie op squat, bench en deadlift, en het schema van je trainer altijd bij de hand.
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            <Link href="/register" className={buttonClasses("primary", "lg")}>
              Gratis account maken
            </Link>
            <Link href="/login" className={buttonClasses("secondary", "lg")}>
              Ik heb al een account
            </Link>
          </div>
        </section>

        <section aria-labelledby="features-title" className="border-t border-chalk/15 py-16">
          <h2 id="features-title" className="text-2xl font-bold tracking-tight sm:text-3xl">
            Gemaakt voor de grote drie
          </h2>
          <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature) => (
              <li key={feature.title} className="rounded-xl border border-chalk/15 p-5">
                <h3 className="font-semibold">{feature.title}</h3>
                <p className="mt-2 text-sm text-chalk/70">{feature.text}</p>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="coach-title" className="mb-16 rounded-xl bg-lime p-8 text-on-lime sm:p-12">
          <h2 id="coach-title" className="text-2xl font-bold tracking-tight sm:text-3xl">
            Coach je sporters?
          </h2>
          <p className="mt-3 max-w-2xl">
            Maak een trainersaccount, deel je uitnodigingscode en je sporters verschijnen in je dashboard, met hun trainingen,
            check-ins en progressie.
          </p>
          <Link
            href="/register"
            className="mt-6 inline-flex min-h-12 items-center rounded-lg bg-on-lime px-5 font-semibold text-lime hover:opacity-90"
          >
            Start als trainer
          </Link>
        </section>
      </main>

      <footer className="border-t border-chalk/15 py-6 text-sm text-chalk/60">
        © {APP_NAME} · Gemaakt voor powerlifters en hun coaches
      </footer>
    </div>
  );
}
