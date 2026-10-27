"use client";
// Client Component: error.tsx-bestanden moeten Client Components zijn, omdat een
// React Error Boundary in de browser draait (en retry() een browserfunctie is).
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export function ErrorView({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  // In productie verbergt Next.js de echte foutmelding van de server (die kan
  // gevoelige info bevatten); je krijgt dan enkel een "digest" om in de logs te zoeken.
  const digest = error instanceof Error && "digest" in error ? String(error.digest) : null;

  return (
    <div role="alert" className="border-2 border-lime p-6 sm:p-8">
      <p className="text-sm font-semibold uppercase tracking-widest">✕ Fout</p>
      <h2 className="mt-2 text-2xl font-bold">Er ging iets mis bij het laden.</h2>
      <p className="mt-2 max-w-prose text-chalk/70">
        Controleer je internetverbinding en probeer opnieuw. Blijft het fout gaan, kijk dan of Supabase bereikbaar is.
      </p>
      {process.env.NODE_ENV === "development" && error instanceof Error && (
        <pre className="mt-4 overflow-x-auto border border-chalk/20 p-3 text-sm whitespace-pre-wrap text-chalk/80">{error.message}</pre>
      )}
      {digest && <p className="mt-2 text-sm text-chalk/50">Code: {digest}</p>}
      <Button className="mt-6" onClick={() => retry()}>
        Opnieuw proberen
      </Button>
    </div>
  );
}
