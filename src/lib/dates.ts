// Datumhulpjes. We werken overal met ISO-datums als tekst ("2026-07-06"), net
// zoals Postgres ze teruggeeft voor het type `date`. Rekenen gebeurt in UTC,
// zodat zomer-/wintertijd nooit een dag doet verspringen.

/** De app rekent "vandaag" en "deze week" in Belgische tijd, ook op een server in de VS. */
export const TIME_ZONE = "Europe/Brussels";

export const WEEKDAYS = ["Maandag", "Dinsdag", "Woensdag", "Donderdag", "Vrijdag", "Zaterdag", "Zondag"];

const DAY_MS = 24 * 60 * 60 * 1000;

export function todayISO(now: Date = new Date()): string {
  // en-CA formatteert als YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }).format(now);
}

export function parseISODate(iso: string): Date {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

export function toISODate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number): string {
  return toISODate(new Date(parseISODate(iso).getTime() + days * DAY_MS));
}

/** 0 = maandag … 6 = zondag (JavaScript zelf begint bij zondag = 0). */
export function weekdayIndex(iso: string): number {
  return (parseISODate(iso).getUTCDay() + 6) % 7;
}

/** De maandag van de week waarin deze datum valt. */
export function startOfWeek(iso: string): string {
  return addDays(iso, -weekdayIndex(iso));
}

export function daysBetween(from: string, to: string): number {
  return Math.round((parseISODate(to).getTime() - parseISODate(from).getTime()) / DAY_MS);
}

export function isValidISODate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && toISODate(parseISODate(value)) === value;
}

export function formatDate(iso: string, options: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" }) {
  return new Intl.DateTimeFormat("nl-BE", { timeZone: "UTC", ...options }).format(parseISODate(iso));
}

export function formatLongDate(iso: string) {
  return formatDate(iso, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

export function formatWeek(weekStart: string) {
  return `week van ${formatDate(weekStart, { day: "numeric", month: "long" })}`;
}

export function relativeDays(iso: string, today: string = todayISO()): string {
  const diff = daysBetween(iso, today);
  if (diff === 0) return "vandaag";
  if (diff === 1) return "gisteren";
  if (diff < 0) return `over ${-diff} dagen`;
  return `${diff} dagen geleden`;
}
