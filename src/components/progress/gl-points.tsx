"use client";
// Client Component: de GL-score met een keuze M/V. Het geslacht staat niet in
// je profiel; je keuze bewaren we in een cookie. Zo kent de SERVER je keuze al
// bij het renderen (initialSex), en tonen server en browser meteen hetzelfde.
import { useState } from "react";
import { GL_SEX_COOKIE, glPoints, type Sex } from "@/lib/gl";
import { formatNumber } from "@/lib/stats";

/** Buiten de component: een cookie schrijven is een neveneffect, geen onderdeel van het renderen. */
function saveSex(sex: Sex) {
  // Een jaar bewaren; path=/ zodat de progressiepagina van sporter én trainer hem leest.
  document.cookie = `${GL_SEX_COOKIE}=${sex}; path=/; max-age=31536000; samesite=lax`;
}

export function GlPoints({ total, bodyweight, initialSex }: { total: number; bodyweight: number | null; initialSex: Sex }) {
  const [sex, setSex] = useState<Sex>(initialSex);
  const points = glPoints(total, bodyweight, sex);

  function choose(next: Sex) {
    setSex(next);
    saveSex(next);
  }

  return (
    <div className="rounded-xl border border-chalk/15 p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-chalk/60">GL-punten</p>
        <div role="radiogroup" aria-label="Categorie voor GL-punten" className="flex overflow-hidden rounded-md border border-chalk/30 text-xs font-semibold">
          {(["M", "V"] as const).map((option) => (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={sex === option}
              aria-label={option === "M" ? "Mannen" : "Vrouwen"}
              onClick={() => choose(option)}
              className={sex === option ? "bg-lime px-2 py-1 text-on-lime" : "px-2 py-1 text-chalk/70 hover:bg-chalk/10"}
            >
              {option}
            </button>
          ))}
        </div>
      </div>
      <p className="mt-1 text-3xl font-bold tabular-nums tracking-tight">{points === null ? "–" : formatNumber(points, 1)}</p>
      <p className="mt-1 text-sm text-chalk/60">
        {bodyweight ? `IPF classic · ${formatNumber(bodyweight, 1)} kg lichaamsgewicht` : "Log je lichaamsgewicht om je GL te zien"}
      </p>
    </div>
  );
}
