// Kleine presentatie-onderdelen van de logger (geen eigen state, geen hooks).
// Ze worden gebruikt binnen de Client Component WorkoutLogger, maar hebben zelf
// geen "use client" nodig: wat een Client Component importeert, draait mee in de browser.
import { formatDate } from "@/lib/dates";
import { BAR_WEIGHT, MAX_TABLE_REPS, RPE_TABLE, platesPerSide } from "@/lib/rpe";
import { formatLoad, formatNumber } from "@/lib/stats";

export type Suggestion = {
  weight: number;
  reps: number;
  rpe: number;
  reference: { e1rm: number; date: string };
};

/** "Voorstel 85 kg voor 5 @ RPE 7 · je geschat 1RM: 107 kg (19 okt)" + knop om in te vullen. */
export function SuggestionLine({ suggestion, exerciseName, onFill }: { suggestion: Suggestion; exerciseName: string; onFill: () => void }) {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
      <p className="text-sm">
        <span className="text-chalk/60">Voorstel </span>
        <span className="font-bold tabular-nums">{formatNumber(suggestion.weight, 2)} kg</span>
        <span className="text-chalk/60">
          {" "}
          voor {suggestion.reps} @ RPE {formatNumber(suggestion.rpe)} · je geschat 1RM: {formatLoad(suggestion.reference.e1rm)} (
          {formatDate(suggestion.reference.date)})
        </span>
      </p>
      <button
        type="button"
        onClick={onFill}
        aria-label={`Voorstel van ${formatNumber(suggestion.weight, 2)} kg invullen bij ${exerciseName}`}
        className="min-h-9 rounded-md border border-chalk/40 px-2 text-xs font-semibold hover:border-chalk hover:bg-chalk/10"
      >
        Invullen
      </button>
    </div>
  );
}

/** Schijven per kant van de stang voor het gewicht dat je nu gaat laden. */
export function PlatesLine({ weight }: { weight: number }) {
  const result = platesPerSide(weight);
  return (
    <p className="text-sm text-chalk/70">
      <span className="text-chalk/60">Schijven per kant voor {formatNumber(weight, 2)} kg: </span>
      {!result ? (
        <span>lichter dan de stang ({BAR_WEIGHT} kg)</span>
      ) : result.plates.length === 0 ? (
        <span className="font-semibold text-chalk">enkel de stang</span>
      ) : (
        <span className="font-semibold tabular-nums text-chalk">{result.plates.map((plate) => formatNumber(plate, 2)).join(" · ")}</span>
      )}
      {result && result.rest > 0 && <span> (+ {formatNumber(result.rest, 2)} kg past niet met schijven)</span>}
      <span className="text-chalk/50"> · stang {BAR_WEIGHT} kg</span>
    </p>
  );
}

/** Meldt een persoonlijk record: lime, want dit is een moment om te vieren. */
export function PrLine({ e1rm, previousBest }: { e1rm: number; previousBest: number }) {
  return (
    <p role="status" className="text-sm font-semibold text-accent">
      <span aria-hidden="true">▲ </span>
      Nieuw record! Geschat 1RM {formatLoad(e1rm)}
      <span className="font-normal text-chalk/70"> (vorige beste {formatNumber(previousBest, 1)} kg)</span>
    </p>
  );
}

const REP_OPTIONS = Array.from({ length: MAX_TABLE_REPS }, (_, i) => i + 1);
const RPE_OPTIONS = Object.keys(RPE_TABLE)
  .map(Number)
  .sort((a, b) => b - a);

/** "Doel [5] reps @ RPE [8]": voor oefeningen zonder doel uit het schema. */
export function TargetPicker({
  exerciseName,
  reps,
  rpe,
  onChange,
}: {
  exerciseName: string;
  reps: number;
  rpe: number;
  onChange: (reps: number, rpe: number) => void;
}) {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
      <span className="text-chalk/60">Doel</span>
      <select
        aria-label={`Aantal reps voor het voorstel bij ${exerciseName}`}
        className="min-h-9 rounded-md border border-chalk/30 px-1 tabular-nums"
        value={reps}
        onChange={(event) => onChange(Number(event.target.value), rpe)}
      >
        {REP_OPTIONS.map((value) => (
          <option key={value} value={value}>
            {value}
          </option>
        ))}
      </select>
      <span className="text-chalk/60">reps @ RPE</span>
      <select
        aria-label={`RPE voor het voorstel bij ${exerciseName}`}
        className="min-h-9 rounded-md border border-chalk/30 px-1 tabular-nums"
        value={rpe}
        onChange={(event) => onChange(reps, Number(event.target.value))}
      >
        {RPE_OPTIONS.map((value) => (
          <option key={value} value={value}>
            {formatNumber(value)}
          </option>
        ))}
      </select>
    </div>
  );
}
