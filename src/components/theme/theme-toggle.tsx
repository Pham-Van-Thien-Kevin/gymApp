"use client";
// Client Component: wisselt tussen licht en donker en onthoudt je keuze in
// localStorage (enkel op dit toestel). Het thema zelf zit volledig in CSS
// (globals.css); deze knop zet alleen data-theme op <html>.
import { useSyncExternalStore } from "react";
import { cn } from "@/lib/cn";
import { THEME_KEY, type Theme } from "./theme";

const listeners = new Set<() => void>();

function subscribe(callback: () => void) {
  listeners.add(callback);
  // Ook als je systeem wisselt (bv. automatisch donker 's avonds) en je niets koos.
  const media = window.matchMedia("(prefers-color-scheme: light)");
  media.addEventListener("change", callback);
  return () => {
    listeners.delete(callback);
    media.removeEventListener("change", callback);
  };
}

/** Het thema dat je nu ziet: je eigen keuze, of anders dat van het systeem. */
function currentTheme(): Theme {
  const chosen = document.documentElement.dataset.theme;
  if (chosen === "light" || chosen === "dark") return chosen;
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

export function ThemeToggle({ className }: { className?: string }) {
  // Op de server bestaat er geen thema (null): dan tonen we een neutrale knop,
  // zodat de HTML van server en browser overeenkomt (geen hydration-fout).
  const theme = useSyncExternalStore(subscribe, currentTheme, () => null);
  const next: Theme = theme === "light" ? "dark" : "light";

  function toggle() {
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      // Geen opslag (privévenster): het thema geldt dan enkel voor deze pagina.
    }
    listeners.forEach((listener) => listener());
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={theme ? `Schakel naar ${next === "light" ? "licht" : "donker"} thema` : "Wissel thema"}
      className={cn("inline-flex size-10 items-center justify-center rounded-lg text-chalk/70 hover:bg-chalk/10 hover:text-chalk", className)}
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        {theme === "light" ? (
          // Maan: klik voor donker
          <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" />
        ) : (
          // Zon: klik voor licht
          <>
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
          </>
        )}
      </svg>
    </button>
  );
}
