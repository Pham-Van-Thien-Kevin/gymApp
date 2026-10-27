// Powerlifting-rekenwerk op basis van RPE (Rate of Perceived Exertion).
// Pure functies: geen database, geen React. Bruikbaar op de server, in de
// browser en in tests.

/**
 * Percentage van je 1RM per RPE (rij) en aantal reps (kolom 1 t.e.m. 12).
 * Overgenomen uit het tabblad "RPE" van de coaching-sheet (fixtures/gymSheet.xlsx).
 * Lees: 5 reps op RPE 8 = 81% van je 1RM.
 */
export const RPE_TABLE: Record<number, number[]> = {
  10: [100, 96, 92, 89, 86, 84, 79, 77, 74, 72, 69, 66],
  9.5: [98, 94, 91, 88, 85, 82, 78, 75, 73, 70, 67, 65],
  9: [96, 92, 89, 86, 84, 81, 77, 74, 72, 69, 66, 63],
  8.5: [94, 91, 88, 85, 82, 80, 75, 73, 70, 67, 65, 62],
  8: [92, 89, 86, 84, 81, 79, 74, 72, 69, 66, 63, 61],
  7.5: [91, 88, 85, 82, 80, 77, 73, 70, 67, 65, 62, 59],
  7: [89, 86, 84, 81, 79, 76, 72, 69, 66, 63, 61, 58],
  6.5: [88, 85, 82, 80, 77, 75, 70, 67, 65, 62, 59, 57],
  6: [86, 84, 81, 79, 76, 74, 69, 66, 63, 61, 58, 55],
  5.5: [85, 82, 80, 77, 75, 72, 67, 65, 62, 59, 57, 54],
  5: [84, 81, 79, 76, 74, 71, 66, 63, 61, 58, 55, 53],
};

/** Wat een RPE betekent in "reps in reserve" (RIR), zoals in de sheet. */
export const RPE_MEANING: [string, string][] = [
  ["10", "Maximale inspanning"],
  ["9,5", "Geen rep meer, wel iets meer gewicht"],
  ["9", "Nog 1 rep in reserve"],
  ["8,5", "Zeker 1, misschien 2 reps in reserve"],
  ["8", "Nog 2 reps in reserve"],
  ["7,5", "Zeker 2, misschien 3 reps in reserve"],
  ["7", "Nog 3 reps in reserve"],
  ["5-6", "Nog 4 à 6 reps in reserve"],
];

export const MIN_TABLE_RPE = 5;
export const MAX_TABLE_REPS = 12;

/**
 * Percentage van het 1RM (0-1) voor dit aantal reps op deze RPE, of null als
 * de combinatie buiten de tabel valt. Een RPE tussen twee rijen (bv. 8,25 als
 * gemiddelde van "8-8,5") interpoleren we lineair tussen die twee rijen.
 */
export function percentageOf1RM(reps: number, rpe: number): number | null {
  if (!Number.isInteger(reps) || reps < 1 || reps > MAX_TABLE_REPS) return null;
  if (rpe < MIN_TABLE_RPE || rpe > 10) return null;
  const lower = Math.floor(rpe * 2) / 2;
  const upper = Math.ceil(rpe * 2) / 2;
  const low = RPE_TABLE[lower][reps - 1];
  const high = RPE_TABLE[upper][reps - 1];
  const fraction = upper === lower ? 0 : (rpe - lower) / (upper - lower);
  return (low + (high - low) * fraction) / 100;
}

/**
 * Geschat 1RM uit één set. Met een RPE in de tabel: gewicht ÷ percentage
 * (100 kg × 5 @ RPE 8 → 100 / 0,81 = 123,5 kg). Zonder bruikbare RPE vallen we
 * terug op de Epley-formule: gewicht × (1 + reps / 30).
 */
export function estimateOneRepMax(weight: number, reps: number, rpe: number | null): number {
  if (reps <= 0 || weight <= 0) return 0;
  const percentage = rpe === null ? null : percentageOf1RM(reps, rpe);
  if (percentage) return weight / percentage;
  return reps === 1 ? weight : weight * (1 + reps / 30);
}

/** Afronden op de kleinste sprong die je met schijven kan maken (standaard 2,5 kg). */
export function roundToIncrement(weight: number, increment = 2.5): number {
  return Math.round(weight / increment) * increment;
}

/**
 * Voorgesteld gewicht voor "reps @ RPE", net als de rekenmachine onder de
 * RPE-tabel in de sheet: 1RM × percentage, afgerond op 2,5 kg.
 * (Bench 105 kg, 4 reps @ RPE 7 → 105 × 0,81 = 85,05 → 85 kg.)
 */
export function suggestLoad(oneRepMax: number, reps: number, rpe: number, increment = 2.5): number | null {
  const percentage = percentageOf1RM(reps, rpe);
  if (!percentage || oneRepMax <= 0) return null;
  return roundToIncrement(oneRepMax * percentage, increment);
}

/**
 * Omgekeerd: hoe zwaar (RPE) is "gewicht × reps" voor iemand met dit 1RM?
 * We zoeken in de kolom van dat aantal reps tussen welke twee RPE-rijen het
 * percentage valt en interpoleren. Buiten de tabel geven we aan aan welke kant:
 * "above" = zwaarder dan RPE 10 (je 1RM-schatting is te laag), "below" = lichter dan RPE 5.
 */
export function estimateRpe(
  weight: number,
  reps: number,
  oneRepMax: number,
): { rpe: number } | { outOfRange: "above" | "below" } | null {
  if (!Number.isInteger(reps) || reps < 1 || reps > MAX_TABLE_REPS || weight <= 0 || oneRepMax <= 0) return null;
  const percentage = (weight / oneRepMax) * 100;
  const rows = Object.keys(RPE_TABLE)
    .map(Number)
    .sort((a, b) => a - b); // 5, 5.5, … 10
  const at = (rpe: number) => RPE_TABLE[rpe][reps - 1];

  if (percentage > at(10)) return { outOfRange: "above" };
  if (percentage < at(MIN_TABLE_RPE)) return { outOfRange: "below" };
  for (let i = 0; i < rows.length - 1; i++) {
    const [low, high] = [rows[i], rows[i + 1]];
    if (percentage <= at(high)) {
      const span = at(high) - at(low);
      const fraction = span === 0 ? 0 : (percentage - at(low)) / span;
      return { rpe: low + (high - low) * fraction };
    }
  }
  return { rpe: 10 };
}

/** "RPE 8-8,5" → 8 (de ondergrens: bij een bereik stellen we voorzichtig voor). */
export function targetRpeFrom(intensity: string | null): number | null {
  const text = intensity?.trim() ?? "";
  // "RPE 8-8,5" (logger, import) of gewoon "8-8,5" (doel-RPE in een schema).
  const match = text.match(/rpe\s*(\d+(?:[.,]\d+)?)/i) ?? text.match(/^(\d+(?:[.,]\d+)?)/);
  return match ? Number(match[1].replace(",", ".")) : null;
}

/**
 * Voorgesteld gewicht voor een doel zoals het in een schema staat
 * (reps "8-10", RPE "7-8"): de ondergrens van beide, en dan suggestLoad().
 * Gedeeld door de logger, Home, Schema en het trainerdashboard.
 */
export function suggestFromTarget(
  oneRepMax: number | null | undefined,
  targetReps: string | null,
  targetRpe: string | null,
): { weight: number; reps: number; rpe: number } | null {
  const reps = Number(targetReps?.match(/\d+/)?.[0]);
  const rpe = targetRpeFrom(targetRpe);
  if (!oneRepMax || !reps || rpe === null) return null;
  const weight = suggestLoad(oneRepMax, reps, rpe);
  return weight === null ? null : { weight, reps, rpe };
}

export const BAR_WEIGHT = 20;
/** Wedstrijdschijven (IPF), zwaarste eerst. */
export const PLATES = [25, 20, 15, 10, 5, 2.5, 1.25];

/**
 * Welke schijven leg je aan elke kant van de stang? We nemen telkens de
 * zwaarste schijf die nog past. Met deze schijvenreeks geeft dat altijd de
 * kleinste stapel. "rest" is wat je met deze schijven niet precies haalt.
 */
export function platesPerSide(total: number, bar = BAR_WEIGHT): { plates: number[]; rest: number } | null {
  if (total < bar) return null;
  let perSide = (total - bar) / 2;
  const plates: number[] = [];
  for (const plate of PLATES) {
    while (perSide >= plate - 1e-9) {
      plates.push(plate);
      perSide -= plate;
    }
  }
  return { plates, rest: Math.round(perSide * 2 * 100) / 100 };
}
