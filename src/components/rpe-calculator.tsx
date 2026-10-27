"use client";
// Client Component: de calculator rekent live mee terwijl je typt. Dat is
// pure state in de browser; er is geen server of database voor nodig.
// Al het rekenwerk komt uit src/lib/rpe.ts (dezelfde functies als de logger).
import { useState } from "react";
import { cn } from "@/lib/cn";
import { parseDecimal } from "@/lib/parse";
import {
  BAR_WEIGHT,
  MAX_TABLE_REPS,
  RPE_MEANING,
  RPE_TABLE,
  estimateOneRepMax,
  estimateRpe,
  percentageOf1RM,
  platesPerSide,
  suggestLoad,
} from "@/lib/rpe";
import { formatNumber } from "@/lib/stats";

type Mode = "load" | "max" | "rpe";
export type OneRepMaxPreset = { name: string; e1rm: number; note: string };

const MODES: { id: Mode; label: string; help: string }[] = [
  { id: "load", label: "Gewicht", help: "Welk gewicht neem ik voor dit aantal reps op deze RPE?" },
  { id: "max", label: "1RM", help: "Wat is mijn geschat 1RM uit deze set?" },
  { id: "rpe", label: "RPE", help: "Hoe zwaar is dit gewicht voor mij?" },
];
const RPES = Object.keys(RPE_TABLE)
  .map(Number)
  .sort((a, b) => b - a);
const REPS = Array.from({ length: MAX_TABLE_REPS }, (_, i) => i + 1);

export function RpeCalculator({ presets = [] }: { presets?: OneRepMaxPreset[] }) {
  const [mode, setMode] = useState<Mode>("load");
  const [oneRepMax, setOneRepMax] = useState("");
  const [weight, setWeight] = useState("");
  const [reps, setReps] = useState(5);
  const [rpe, setRpe] = useState(8);

  const max = parseDecimal(oneRepMax);
  const load = parseDecimal(weight);

  return (
    <div className="flex flex-col gap-6">
      <div role="radiogroup" aria-label="Wat wil je berekenen?" className="grid grid-cols-3 border border-chalk/30">
        {MODES.map((option) => (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={mode === option.id}
            onClick={() => setMode(option.id)}
            className={cn("min-h-12 font-semibold", mode === option.id ? "bg-lime text-ink" : "text-chalk/80 hover:bg-chalk/10")}
          >
            {option.label}
          </button>
        ))}
      </div>
      <p className="-mt-3 text-sm text-chalk/70">{MODES.find((option) => option.id === mode)!.help}</p>

      <div className="grid gap-4 sm:grid-cols-3">
        {mode !== "max" && (
          <NumberField id="calc-1rm" label="Je 1RM (kg)" value={oneRepMax} onChange={setOneRepMax} />
        )}
        {mode !== "load" && <NumberField id="calc-weight" label="Gewicht (kg)" value={weight} onChange={setWeight} />}
        <div>
          <label htmlFor="calc-reps" className="label">
            Reps
          </label>
          <select id="calc-reps" className="field" value={reps} onChange={(event) => setReps(Number(event.target.value))}>
            {REPS.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </div>
        {mode !== "rpe" && (
          <div>
            <label htmlFor="calc-rpe" className="label">
              RPE
            </label>
            <select id="calc-rpe" className="field" value={rpe} onChange={(event) => setRpe(Number(event.target.value))}>
              {RPES.map((value) => (
                <option key={value} value={value}>
                  {formatNumber(value)}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {mode !== "max" && presets.length > 0 && (
        <div>
          <label htmlFor="calc-preset" className="label">
            Of neem je geschat 1RM van een oefening
          </label>
          <select
            id="calc-preset"
            className="field"
            value=""
            onChange={(event) => {
              const preset = presets[Number(event.target.value)];
              if (preset) setOneRepMax(String(Math.round(preset.e1rm * 10) / 10).replace(".", ","));
            }}
          >
            <option value="">Kies een oefening…</option>
            {presets.map((preset, index) => (
              <option key={preset.name} value={index}>
                {preset.name}: {formatNumber(preset.e1rm, 1)} kg ({preset.note})
              </option>
            ))}
          </select>
        </div>
      )}

      {/* aria-live: een schermlezer leest het nieuwe resultaat voor zodra je iets aanpast. */}
      <section aria-live="polite" aria-label="Resultaat" className="border border-chalk/20 p-5">
        {mode === "load" && <LoadResult max={max} reps={reps} rpe={rpe} />}
        {mode === "max" && <MaxResult weight={load} reps={reps} rpe={rpe} />}
        {mode === "rpe" && <RpeResult max={max} weight={load} reps={reps} />}
      </section>

      {mode === "load" && max !== null && max > 0 && <LoadChart max={max} reps={reps} rpe={rpe} />}
    </div>
  );
}

function NumberField({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (value: string) => void }) {
  return (
    <div>
      <label htmlFor={id} className="label">
        {label}
      </label>
      <input id={id} inputMode="decimal" className="field tabular-nums" value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

function Empty({ children }: { children: string }) {
  return <p className="text-chalk/60">{children}</p>;
}

function LoadResult({ max, reps, rpe }: { max: number | null; reps: number; rpe: number }) {
  if (!max || max <= 0) return <Empty>Vul je 1RM in.</Empty>;
  const percentage = percentageOf1RM(reps, rpe)!;
  const suggested = suggestLoad(max, reps, rpe)!;
  const plates = platesPerSide(suggested);
  return (
    <>
      <p className="text-sm text-chalk/60">
        {reps} reps @ RPE {formatNumber(rpe)}
      </p>
      <p className="text-5xl font-bold tabular-nums">{formatNumber(suggested, 2)} kg</p>
      <p className="mt-1 text-sm text-chalk/70">
        {formatNumber(max * percentage, 2)} kg exact · {formatNumber(percentage * 100, 1)}% van {formatNumber(max, 2)} kg · afgerond op 2,5 kg
      </p>
      <p className="mt-3 text-sm">
        <span className="text-chalk/60">Schijven per kant (stang {BAR_WEIGHT} kg): </span>
        <span className="font-semibold tabular-nums">
          {!plates ? "lichter dan de stang" : plates.plates.length === 0 ? "enkel de stang" : plates.plates.map((p) => formatNumber(p, 2)).join(" · ")}
        </span>
      </p>
    </>
  );
}

function MaxResult({ weight, reps, rpe }: { weight: number | null; reps: number; rpe: number }) {
  if (!weight || weight <= 0) return <Empty>Vul het gewicht van je set in.</Empty>;
  const percentage = percentageOf1RM(reps, rpe);
  const max = estimateOneRepMax(weight, reps, rpe);
  return (
    <>
      <p className="text-sm text-chalk/60">
        {formatNumber(weight, 2)} kg × {reps} @ RPE {formatNumber(rpe)}
      </p>
      <p className="text-5xl font-bold tabular-nums">{formatNumber(max, 1)} kg</p>
      <p className="mt-1 text-sm text-chalk/70">
        Geschat 1RM: {formatNumber(weight, 2)} kg ÷ {formatNumber((percentage ?? 0) * 100, 1)}% uit de RPE-tabel
      </p>
    </>
  );
}

function RpeResult({ max, weight, reps }: { max: number | null; weight: number | null; reps: number }) {
  if (!max || max <= 0 || !weight || weight <= 0) return <Empty>Vul je 1RM en het gewicht in.</Empty>;
  const result = estimateRpe(weight, reps, max);
  if (!result) return <Empty>Dat valt buiten de RPE-tabel.</Empty>;
  if ("outOfRange" in result) {
    return (
      <p className="font-semibold">
        <span aria-hidden="true">▲ </span>
        {result.outOfRange === "above"
          ? `Zwaarder dan RPE 10: ${formatNumber(weight, 2)} kg × ${reps} past niet bij een 1RM van ${formatNumber(max, 2)} kg. Je 1RM ligt waarschijnlijk hoger.`
          : "Lichter dan RPE 5: dit is een opwarming of herstelset."}
      </p>
    );
  }
  const rounded = Math.round(result.rpe * 2) / 2;
  const meaning = RPE_MEANING.find(([label]) => label === formatNumber(rounded))?.[1] ?? "Nog 4 à 6 reps in reserve";
  return (
    <>
      <p className="text-sm text-chalk/60">
        {formatNumber(weight, 2)} kg × {reps} met een 1RM van {formatNumber(max, 2)} kg
      </p>
      <p className="text-5xl font-bold tabular-nums">≈ RPE {formatNumber(rounded)}</p>
      <p className="mt-1 text-sm text-chalk/70">
        {meaning} · exact {formatNumber(result.rpe, 2)}
      </p>
    </>
  );
}

/** Alle gewichten voor dit 1RM in één oogopslag; de gekozen combinatie in lime. */
function LoadChart({ max, reps, rpe }: { max: number; reps: number; rpe: number }) {
  return (
    <details className="border border-chalk/15">
      <summary className="flex min-h-12 cursor-pointer items-center px-4 font-semibold hover:bg-chalk/5">
        Alle gewichten voor een 1RM van {formatNumber(max, 2)} kg
      </summary>
      <div className="overflow-x-auto px-4 pb-4">
        <table className="w-full min-w-2xl text-right text-sm tabular-nums">
          <caption className="sr-only">Gewicht in kg per RPE en aantal reps, afgerond op 2,5 kg</caption>
          <thead className="text-chalk/60">
            <tr>
              <th scope="col" className="py-1 pr-2 text-left font-medium">
                RPE \ reps
              </th>
              {REPS.map((value) => (
                <th key={value} scope="col" className="px-1 font-medium">
                  {value}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {RPES.map((rowRpe) => (
              <tr key={rowRpe} className="border-t border-chalk/10">
                <th scope="row" className="py-1 pr-2 text-left font-semibold">
                  {formatNumber(rowRpe)}
                </th>
                {REPS.map((value) => {
                  const selected = value === reps && rowRpe === rpe;
                  return (
                    <td key={value} className={cn("px-1", selected ? "bg-lime font-bold text-ink" : "text-chalk/80")}>
                      {formatNumber(suggestLoad(max, value, rowRpe), 2)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
