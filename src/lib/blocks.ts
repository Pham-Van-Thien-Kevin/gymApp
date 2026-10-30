// Maanden en weken zoals in de coachingsheet. Een week hoort bij de maand van
// haar maandag, en week 1 begint op de eerste maandag van de maand: dezelfde
// indeling als de import en de export, zodat "oktober, week 3" overal hetzelfde is.
import { addDays, daysBetween, startOfWeek } from "@/lib/dates";
import { firstMondayOfMonth } from "@/lib/import/dates";
import type { WorkoutStatus } from "@/lib/types";

export const MONTH_TABS = ["JAN", "FEB", "MRT", "APR", "MEI", "JUN", "JUL", "AUG", "SEP", "OKT", "NOV", "DEC"];

/** In welke maandtab en week valt deze datum? */
export function placeWorkout(date: string) {
  const monday = startOfWeek(date);
  const [year, month] = monday.split("-").map(Number);
  const week1 = firstMondayOfMonth(year, month - 1);
  return { tab: `${MONTH_TABS[month - 1]}${year}`, year, month: month - 1, week1, week: daysBetween(week1, monday) / 7 + 1 };
}

export type PlannedState = "missed" | "open" | "locked";

/**
 * Wat kan je met een geplande sessie? Enkel de sessies van DEZE week zijn af te
 * werken ("open"). Uit een voorbije week: gemist, inhalen kan niet (een week is
 * een week, zoals in het schema van je coach). Uit een latere week: op slot tot
 * die maandag om 0:00 (Belgische tijd, want todayISO rekent in Europe/Brussels).
 */
export function plannedState(date: string, today: string): PlannedState {
  const monday = startOfWeek(today);
  if (date < monday) return "missed";
  if (date >= nextMonday(today)) return "locked";
  return "open";
}

/** De maandag van volgende week: dan gaat de volgende week open. */
export const nextMonday = (today: string) => addDays(startOfWeek(today), 7);

export function isMissed(workout: { date: string; status: WorkoutStatus }, today: string) {
  return workout.status === "planned" && plannedState(workout.date, today) === "missed";
}

export type WeekSummary = { week: number; monday: string; done: number; total: number; current: boolean; future: boolean };
export type MonthSummary = { tab: string; year: number; month: number; weeks: WeekSummary[] };

/**
 * Per maand en per week: hoeveel sessies gedaan van hoeveel. "total" telt de
 * afgewerkte plus de geplande (ook de gemiste), dus een gemiste sessie geeft 3/4.
 * Nieuwste maand eerst.
 */
export function summarizeMonths(workouts: { date: string; status: WorkoutStatus }[], today: string): MonthSummary[] {
  const thisWeek = startOfWeek(today);
  const months = new Map<string, MonthSummary>();
  for (const workout of workouts) {
    const place = placeWorkout(workout.date);
    const month = months.get(place.tab) ?? { tab: place.tab, year: place.year, month: place.month, weeks: [] };
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
