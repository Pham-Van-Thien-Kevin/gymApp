// Pure rekenfuncties (geen database, geen React): makkelijk te testen en te
// hergebruiken op de server én in de browser.
import { addDays, daysBetween, startOfWeek } from "@/lib/dates";
import { estimateOneRepMax } from "@/lib/rpe";
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

export function countInWeek(workoutDates: string[], today: string): number {
  const weekStart = startOfWeek(today);
  return workoutDates.filter((date) => date >= weekStart && date <= today).length;
}

export type ProgressPoint = {
  date: string;
  heaviest: number; // zwaarste set (kg)
  e1rm: number; // beste geschatte 1RM die dag (kg)
  bestSet: string; // bv. "100 kg × 5 @ RPE 8"
};

/** Groepeer sets per dag: zwaarste gewicht en beste geschatte 1RM. */
export function buildProgressSeries(rows: SetLogRow[]): ProgressPoint[] {
  const byDate = new Map<string, ProgressPoint>();
  for (const row of rows) {
    if (row.weight === null || row.weight <= 0) continue;
    const e1rm = row.reps ? estimateOneRepMax(row.weight, row.reps, row.rpe) : 0;
    const point = byDate.get(row.date) ?? { date: row.date, heaviest: 0, e1rm: 0, bestSet: "" };
    if (row.weight > point.heaviest) point.heaviest = row.weight;
    if (e1rm > point.e1rm) {
      point.e1rm = e1rm;
      point.bestSet = `${formatKg(row.weight)} × ${row.reps}${row.rpe !== null ? ` @ RPE ${formatNumber(row.rpe)}` : ""}`;
    }
    byDate.set(row.date, point);
  }
  return [...byDate.values()]
    .map((point) => ({ ...point, e1rm: Math.round(point.e1rm * 10) / 10 }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Leg meerdere reeksen naast elkaar op één tijd-as: één rij per datum met per
 * reeks een waarde. Werd een lift die dag niet getraind, dan ontbreekt de sleutel.
 */
export function combineByDate<K extends string>(series: Record<K, { date: string; value: number }[]>) {
  const byDate = new Map<string, Record<string, number | string>>();
  for (const [key, points] of Object.entries(series) as [K, { date: string; value: number }[]][]) {
    for (const { date, value } of points) byDate.set(date, { ...byDate.get(date), date, [key]: value });
  }
  return [...byDate.values()].sort((a, b) => String(a.date).localeCompare(String(b.date))) as ({ date: string } & Partial<Record<K, number>>)[];
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
