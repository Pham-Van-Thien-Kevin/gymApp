"use client";
// Client Component (verplicht): vangt fouten in de root layout zelf op. Deze
// pagina vervangt de hele root layout, dus ook globals.css en het lettertype
// zijn er niet: daarom staan de merkkleuren hier inline (ink, chalk, lime als accent).
export default function GlobalError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <html lang="nl">
      <body style={{ margin: 0, minHeight: "100vh", background: "#0f0f0f", color: "#ecece4", fontFamily: "system-ui, sans-serif" }}>
        <main style={{ maxWidth: 560, margin: "0 auto", padding: "64px 20px" }}>
          <p style={{ fontWeight: 600, letterSpacing: "0.1em", color: "#d7ff3a" }}>✕ FOUT</p>
          <h1 style={{ fontSize: 32, margin: "8px 0" }}>De app kon niet laden.</h1>
          <p style={{ opacity: 0.75 }}>Probeer het opnieuw. Blijft het fout gaan, controleer dan de Supabase-instellingen.</p>
          <button
            type="button"
            onClick={() => retry()}
            style={{ marginTop: 24, minHeight: 48, padding: "0 20px", border: 0, background: "#d7ff3a", color: "#0f0f0f", fontWeight: 700, cursor: "pointer" }}
          >
            Opnieuw proberen
          </button>
        </main>
      </body>
    </html>
  );
}
