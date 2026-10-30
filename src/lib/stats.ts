// Pure rekenfuncties (geen database, geen React): makkelijk te testen en te
// hergebruiken op de server én in de browser.
import { addDays, daysBetween, startOfWeek } from "@/lib/dates";
import { estimateOneRepMax, roundToIncrement } from "@/lib/rpe";
import type { SetLogRow } from "@/lib/types";

/**
 * Streak = aantal opeenvolgende weken (maandag-zondag) met minstens één training.
 * Een krachtsporter traint niet elke dag, dus een dag-streak zou na elke
 * rustdag op 0 vallen. De lopende week telt mee zodra je erin getraind hebt;
 * heb je deze week nog niet getraind, dan breekt de streak pas na zondag.
 */
export function weeklyStreak(workoutDates: string[], today: string): number {
  const weeks = new Set(workoutDates.map(startOfWeek));
  let week = startOfWeek(today);
  if (!weeks.has(week)) week = addDays(week, -7);
  let streak = 0;
  while (weeks.has(week)) {
    streak += 1;
    week = addDays(week, -7);
  }
  return streak;
}

export type ProgressPoint = {
  date: string;
  heaviest: number; // zwaarste set (kg): wat je echt op de stang had
  heaviestSet: string; // die set, bv. "140 kg × 3 @ RPE 9"
  e1rm: number; // beste geschatte 1RM die dag (kg)
  bestSet: string; // de set waarop dat 1RM gebaseerd is
};

const describeSet = (row: SetLogRow) => `${formatKg(row.weight)} × ${row.reps ?? "?"}${row.rpe !== null ? ` @ RPE ${formatNumber(row.rpe)}` : ""}`;

/** Groepeer sets per dag: zwaarste set en beste geschatte 1RM. */
export function buildProgressSeries(rows: SetLogRow[]): ProgressPoint[] {
  const byDate = new Map<string, ProgressPoint & { heaviestReps: number }>();
  for (const row of rows) {
    if (row.weight === null || row.weight <= 0) continue;
    const e1rm = row.reps ? estimateOneRepMax(row.weight, row.reps, row.rpe) : 0;
    const point = byDate.get(row.date) ?? { date: row.date, heaviest: 0, heaviestSet: "", heaviestReps: -1, e1rm: 0, bestSet: "" };
    // Zelfde gewicht? Dan telt de set met de meeste reps (140 × 3 zegt meer dan 140 × 1).
    const reps = row.reps ?? 0;
    if (row.weight > point.heaviest || (row.weight === point.heaviest && reps > point.heaviestReps)) {
      point.heaviest = row.weight;
      point.heaviestReps = reps;
      point.heaviestSet = describeSet(row);
    }
    if (e1rm > point.e1rm) {
      point.e1rm = e1rm;
      point.bestSet = describeSet(row);
    }
    byDate.set(row.date, point);
  }
  return [...byDate.values()]
    .map((point) => ({
      date: point.date,
      heaviest: point.heaviest,
      heaviestSet: point.heaviestSet,
      e1rm: Math.round(point.e1rm * 10) / 10,
      bestSet: point.bestSet,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Tonnage per week (maandag als datum): Σ gewicht × reps van alle sets.
 * Zo zie je of een zwaar blok ook echt meer werk was.
 */
export function weeklyTonnage(rows: SetLogRow[]): { date: string; value: number }[] {
  const byWeek = new Map<string, number>();
  for (const row of rows) {
    if (!row.weight || !row.reps) continue;
    const week = startOfWeek(row.date);
    byWeek.set(week, (byWeek.get(week) ?? 0) + row.weight * row.reps);
  }
  return [...byWeek.entries()].map(([date, value]) => ({ date, value: Math.round(value) })).sort((a, b) => a.date.localeCompare(b.date));
}

type SeriesPoint = { date: string; value: number; detail?: string };

/**
 * Leg meerdere reeksen naast elkaar op één tijd-as: één rij per datum met per
 * reeks een waarde (en eventueel `<reeks>Detail`, bv. de set voor de tooltip).
 * Werd een lift die dag niet getraind, dan ontbreekt de sleutel.
 */
export function combineByDate<K extends string>(series: Record<K, SeriesPoint[]>) {
  const byDate = new Map<string, Record<string, number | string>>();
  for (const [key, points] of Object.entries(series) as [K, SeriesPoint[]][]) {
    for (const { date, value, detail } of points) {
      byDate.set(date, { ...byDate.get(date), date, [key]: value, ...(detail ? { [`${key}Detail`]: detail } : {}) });
    }
  }
  return [...byDate.values()].sort((a, b) => String(a.date).localeCompare(String(b.date))) as ({ date: string } & Record<string, number | string | undefined>)[];
}

export type ReferenceMax = { e1rm: number; date: string };

/**
 * Op welk geschat 1RM baseren we het voorgestelde gewicht? We krijgen per
 * trainingsdag het beste geschatte 1RM (oud → nieuw) en kiezen er één referentie.
 * Geen bruikbare data → null, en dan toont de logger geen voorstel.
 */
export function pickReferenceE1rm(history: ReferenceMax[], today: string): ReferenceMax | null {
  // Enkel recente trainingen: kracht van een half jaar geleden zegt weinig over vandaag.
  const recent = history.filter((point) => point.e1rm > 0 && daysBetween(point.date, today) <= 56);
  if (recent.length === 0) return null;

  // TODO(human): kies welk geschat 1RM de basis van het voorstel wordt (zie de opdracht in de chat).
  // Tijdelijke keuze: gewoon de meest recente sessie.
  return recent.at(-1)!;
}

export function formatNumber(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined) return "–";
  return new Intl.NumberFormat("nl-BE", { maximumFractionDigits: digits }).format(value);
}

export function formatKg(value: number | null | undefined): string {
  return value === null || value === undefined ? "–" : `${formatNumber(value, 2)} kg`;
}

/**
 * Een GESCHAT gewicht (1RM, voorstel) zoals je het op de stang kan leggen:
 * afgerond op 2,5 kg, de kleinste sprong met IPF-schijven (1,25 kg per kant).
 * Gelogde sets en lichaamsgewicht tonen we exact, met formatKg.
 */
export function formatLoad(value: number | null | undefined): string {
  return value === null || value === undefined ? "–" : formatKg(roundToIncrement(value));
}

export type TestedMax = { kg: number; label: string; date: string | null };

/**
 * Je beste GETESTE max per lift uit "Maxima per blok" (je echte 1RM's). Die
 * gaan voor op een schatting: een getest 1RM is wat je echt deed.
 */
export function bestTestedMaxes(tests: { label: string; squat: number | null; bench: number | null; deadlift: number | null; tested_on: string | null }[]) {
  const best = (lift: "squat" | "bench" | "deadlift"): TestedMax | null =>
    tests.reduce<TestedMax | null>((top, test) => {
      const kg = test[lift] === null ? null : Number(test[lift]);
      return kg && kg > (top?.kg ?? 0) ? { kg, label: test.label, date: test.tested_on } : top;
    }, null);
  return { squat: best("squat"), bench: best("bench"), deadlift: best("deadlift") };
}
