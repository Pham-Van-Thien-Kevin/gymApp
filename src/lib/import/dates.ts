// De sheet heeft geen echte datums. In de preview kies je per maandtab de
// startdatum van week 1; elke sessiedatum volgt daaruit.
import { addDays, startOfWeek, toISODate } from "@/lib/dates";

/** Standaard voor week 1: de eerste maandag van de maand. */
export function firstMondayOfMonth(year: number, month: number): string {
  const first = new Date(Date.UTC(year, month, 1));
  const daysUntilMonday = (8 - first.getUTCDay()) % 7; // getUTCDay: 0 = zondag, 1 = maandag
  return toISODate(new Date(Date.UTC(year, month, 1 + daysUntilMonday)));
}

/** Week 1 begint op week1Date; sessie = start van haar week + dag-offset (zie parser). */
export function sessionDate(week1Date: string, weekNumber: number, dayOffset: number): string {
  return addDays(week1Date, (weekNumber - 1) * 7 + dayOffset);
}

/** Check-ins horen bij een week die op maandag begint (zo staat het in de database). */
export function checkinWeekStart(week1Date: string, weekNumber: number): string {
  return startOfWeek(sessionDate(week1Date, weekNumber, 0));
}
