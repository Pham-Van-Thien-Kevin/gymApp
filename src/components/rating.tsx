// Server Components voor de check-in-schaal AMAZING / NEUTRAAL / BAD.
// Er is geen rood of groen in het palet: symbolen (▲ ● ▼) en vulling dragen de betekenis.
// "BAD" krijgt een gevulde lime achtergrond zodat het meteen opvalt.
import { cn } from "@/lib/cn";
import { RATINGS, type Rating } from "@/lib/types";

const symbols: Record<Rating, string> = { AMAZING: "▲", NEUTRAAL: "●", BAD: "▼" };

export function RatingBadge({ value, label }: { value: Rating | null; label?: string }) {
  if (!value) return <span className="text-chalk/40">–</span>;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-semibold",
        value === "BAD" ? "bg-lime text-ink" : "border border-chalk/40",
      )}
    >
      <span aria-hidden="true">{symbols[value]}</span>
      {label && <span className="sr-only">{label}: </span>}
      {value}
    </span>
  );
}

/** Drie radioknoppen als één grote, tikbare balk. Werkt zonder JavaScript. */
export function RatingField({ name, legend, defaultValue }: { name: string; legend: string; defaultValue?: Rating | null }) {
  return (
    <fieldset>
      <legend className="label">{legend}</legend>
      <div className="grid grid-cols-3 border border-chalk/30">
        {RATINGS.map((rating) => (
          <label
            key={rating}
            className="flex min-h-12 cursor-pointer items-center justify-center gap-1.5 text-sm font-semibold text-chalk/80 hover:bg-chalk/10 has-[:checked]:bg-lime has-[:checked]:text-ink has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-lime"
          >
            <input type="radio" name={name} value={rating} defaultChecked={defaultValue === rating} required className="sr-only" />
            <span aria-hidden="true">{symbols[rating]}</span>
            {rating}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
