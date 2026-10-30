// Oefeningnamen uit de sheet koppelen aan de bibliotheek, plus de keuzes die
// de gebruiker in de preview maakt. Gedeeld door server (actions) en browser (preview).
import type { ParsedWorkbook } from "./types";
import { firstMondayOfMonth } from "./dates";

export type LibraryExercise = { id: string; name: string; category: string };

/** Hoofdletterongevoelig, spaties genormaliseerd: "  Hamstring curl " → "hamstring curl". */
export const nameKey = (name: string) => name.trim().replace(/\s+/g, " ").toLowerCase();

/** Losser, enkel voor suggesties: "Leg extensions" ≈ "Leg extension", "Belt squat" ≈ "Beltsquat". */
export const looseKey = (name: string) => nameKey(name).replace(/[^a-z0-9]/g, "").replace(/s$/, "");

export type NameChoice =
  | { kind: "existing"; exerciseId: string }
  | { kind: "new"; name: string; category: string };

export type UnknownName = {
  key: string;
  name: string;
  count: number;
  suggestion: NameChoice; // wat de preview standaard voorstelt
};

export type ImportChoices = {
  tabs: Record<string, { include: boolean; week1: string }>;
  includeInfo: boolean;
  names: Record<string, NameChoice>;
};

/** Alle oefeningnamen in de sheet die niet exact (hoofdletterongevoelig) in de bibliotheek staan. */
export function findUnknownNames(workbook: ParsedWorkbook, library: LibraryExercise[]): UnknownName[] {
  const exact = new Set(library.map((exercise) => nameKey(exercise.name)));
  const counts = new Map<string, { name: string; count: number }>();
  for (const month of workbook.months)
    for (const week of month.weeks)
      for (const session of week.sessions)
        for (const exercise of session.exercises) {
          const key = nameKey(exercise.name);
          if (exact.has(key)) continue;
          const entry = counts.get(key) ?? { name: exercise.name, count: 0 };
          entry.count += 1;
          counts.set(key, entry);
        }

  const infoExercises = workbook.info?.exercises ?? [];
  return [...counts.entries()]
    .map(([key, { name, count }]) => {
      const libraryMatch = library.find((exercise) => looseKey(exercise.name) === looseKey(name));
      const infoMatch = infoExercises.find((exercise) => looseKey(exercise.name) === looseKey(name));
      const suggestion: NameChoice = libraryMatch
        ? { kind: "existing", exerciseId: libraryMatch.id }
        : { kind: "new", name: infoMatch?.name ?? name, category: infoMatch?.category ?? "Andere" };
      return { key, name, count, suggestion };
    })
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

/**
 * Standaardkeuzes voor de preview. Startdatum van week 1: die van de vorige
 * import van dezelfde maandtab (ook als je dat blok opschoof), anders de eerste
 * maandag van de maand.
 */
export function defaultChoices(workbook: ParsedWorkbook, unknown: UnknownName[], previousWeek1: Record<string, string> = {}): ImportChoices {
  return {
    tabs: Object.fromEntries(
      workbook.months.map((month) => [month.tab, { include: true, week1: previousWeek1[month.tab] ?? firstMondayOfMonth(month.year, month.month) }]),
    ),
    includeInfo: workbook.info !== null,
    names: Object.fromEntries(unknown.map((name) => [name.key, name.suggestion])),
  };
}
