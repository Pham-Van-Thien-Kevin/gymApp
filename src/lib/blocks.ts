// Maanden en weken zoals in de coachingsheet. Een week hoort bij de maand van
// haar maandag, en week 1 begint op de eerste maandag van de maand: dezelfde
// indeling als de import en de export, zodat "oktober, week 3" overal hetzelfde is.
import { addDays, daysBetween, startOfWeek } from "@/lib/dates";
import { firstMondayOfMonth } from "@/lib/import/dates";
import { parseMonthTab } from "@/lib/import/values";
import type { WorkoutStatus } from "@/lib/types";

export const MONTH_TABS = ["JAN", "FEB", "MRT", "APR", "MEI", "JUN", "JUL", "AUG", "SEP", "OKT", "NOV", "DEC"];

/** In welke maandtab en week valt deze datum? */
export function placeWorkout(date: string) {
  const monday = startOfWeek(date);
  const [year, month] = monday.split("-").map(Number);
  const week1 = firstMondayOfMonth(year, month - 1);
  return { tab: `${MONTH_TABS[month - 1]}${year}`, year, month: month - 1, week1, week: daysBetween(week1, monday) / 7 + 1 };
}

/** De maandag van volgende week (einde van "deze week" voor de teller op Home). */
export const nextMonday = (today: string) => addDays(startOfWeek(today), 7);

export type WeekSummary = { week: number; monday: string; done: number; total: number; current: boolean; future: boolean };
/** importTab: de maandtab uit de sheet ("OCT2026") als de sessies uit een import komen; dan kan je ze opschuiven. */
export type MonthSummary = { tab: string; year: number; month: number; importTab: string | null; weeks: WeekSummary[] };

export type StatusRow = { date: string; status: WorkoutStatus; title?: string | null; sheetTab?: string | null };

/**
 * Bij welke maand en week hoort een sessie? Komt ze uit een import ("Week 3 ·
 * Sessie 4" uit tab OCT2026), dan precies die maand en week uit de sheet, ook
 * als het blok opgeschoven is. Anders volgens de kalender (placeWorkout).
 */
function placeRow(row: StatusRow) {
  const fromSheet = row.sheetTab ? parseMonthTab(row.sheetTab) : null;
  const week = Number(row.title?.match(/^Week\s+(\d+)/)?.[1]);
  if (fromSheet && week) return { tab: `${MONTH_TABS[fromSheet.month]}${fromSheet.year}`, year: fromSheet.year, month: fromSheet.month, week, importTab: row.sheetTab! };
  return { ...placeWorkout(row.date), importTab: null };
}

/**
 * Per maand en per week: hoeveel sessies gedaan van hoeveel. "total" telt de
 * afgewerkte plus de geplande (ook de gemiste), dus een gemiste sessie geeft 3/4.
 * Nieuwste maand eerst.
 */
export function summarizeMonths(workouts: StatusRow[], today: string): MonthSummary[] {
  const thisWeek = startOfWeek(today);
  const months = new Map<string, MonthSummary>();
  for (const workout of workouts) {
    const place = placeRow(workout);
    const month = months.get(place.tab) ?? { tab: place.tab, year: place.year, month: place.month, importTab: place.importTab, weeks: [] };
    month.importTab ??= place.importTab;
    let week = month.weeks.find((w) => w.week === place.week);
    if (!week) {
      const monday = startOfWeek(workout.date);
      week = { week: place.week, monday, done: 0, total: 0, current: monday === thisWeek, future: monday > thisWeek };
      month.weeks.push(week);
    }
    week.total++;
    if (workout.status === "completed") week.done++;
    months.set(place.tab, month);
  }
  return [...months.values()]
    .map((month) => ({ ...month, weeks: month.weeks.sort((a, b) => a.week - b.week) }))
    .sort((a, b) => b.year - a.year || b.month - a.month);
}

// --- Welke blokken zijn nog open? --------------------------------------------
// Een blok = een maandtab uit je sheet ("OCT2026"). Het is "begonnen" zodra je er
// één sessie van afwerkte. Je huidige blok is het nieuwste begonnen blok; oudere
// blokken zijn verlopen: daar hoef (en kan) je niets meer af te werken. Nieuwere,
// nog niet begonnen blokken blijven open.

const tabOrder = (tab: string) => {
  const parsed = parseMonthTab(tab);
  return parsed ? parsed.year * 12 + parsed.month : null;
};

/** Je huidige blok: het nieuwste blok met minstens één afgewerkte sessie. */
export function currentBlockTab(rows: { sheetTab?: string | null; status: WorkoutStatus }[]): string | null {
  let best: { tab: string; order: number } | null = null;
  for (const row of rows) {
    if (row.status !== "completed" || !row.sheetTab) continue;
    const order = tabOrder(row.sheetTab);
    if (order !== null && (!best || order > best.order)) best = { tab: row.sheetTab, order };
  }
  return best?.tab ?? null;
}

/** Is dit blok verlopen (ouder dan je huidige blok)? Sessies zonder blok verlopen nooit. */
export function isExpiredBlock(tab: string | null | undefined, current: string | null): boolean {
  if (!tab || !current) return false;
  const order = tabOrder(tab);
  const currentOrder = tabOrder(current);
  return order !== null && currentOrder !== null && order < currentOrder;
}
