// Kleine, pure functies die één celwaarde omzetten. Apart gehouden zodat ze
// los te testen zijn en de parser leesbaar blijft.
import type { Rating } from "@/lib/types";
import type { CellValue } from "./types";

/** Lege cel, of een cel met enkel "/" (zo duidt de sheet "niets" aan). */
export function isBlank(value: CellValue): boolean {
  return value === null || (typeof value === "string" && (value.trim() === "" || value.trim() === "/"));
}

export function cellText(value: CellValue): string {
  if (value === null) return "";
  return String(value).replace(/\s+/g, " ").trim();
}

/** Getal met decimale komma of punt: "102,5" → 102.5. Geen getal → null. */
export function parseNumber(value: CellValue): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (value === null) return null;
  const text = value.trim().replace(",", ".");
  return /^-?\d+(\.\d+)?$/.test(text) ? Number(text) : null;
}

/** Alle getallen in een tekst, met komma of punt: "6 - 6,5" → [6, 6.5]. */
function numbersIn(text: string): number[] {
  return [...text.matchAll(/\d+(?:[.,]\d+)?/g)].map((match) => Number(match[0].replace(",", ".")));
}

/** "8" → 8, "8-10" → 8 (ondergrens, geschat). */
export function parseReps(value: CellValue): { reps: number | null; estimated: boolean; ok: boolean } {
  if (isBlank(value)) return { reps: null, estimated: false, ok: true };
  if (typeof value === "number") return { reps: Math.round(value), estimated: false, ok: true };
  const text = String(value).trim();
  const range = text.match(/^(\d+)\s*[-–]\s*(\d+)$/);
  if (range) return { reps: Number(range[1]), estimated: true, ok: true };
  if (/^\d+$/.test(text)) return { reps: Number(text), estimated: false, ok: true };
  return { reps: null, estimated: false, ok: false };
}

/** "6-7" → 6.5 (gemiddelde), "7,5" → 7.5. */
export function parseRpe(value: CellValue): { rpe: number | null; ok: boolean } {
  if (isBlank(value)) return { rpe: null, ok: true };
  if (typeof value === "number") return value >= 0 && value <= 10 ? { rpe: value, ok: true } : { rpe: null, ok: false };
  const text = String(value).trim();
  if (!/^\d+([.,]\d+)?(\s*[-–]\s*\d+([.,]\d+)?)?$/.test(text)) return { rpe: null, ok: false };
  const numbers = numbersIn(text);
  const average = numbers.reduce((sum, n) => sum + n, 0) / numbers.length;
  return average >= 0 && average <= 10 ? { rpe: Math.round(average * 100) / 100, ok: true } : { rpe: null, ok: false };
}

/**
 * Gewicht: getal, "102,5" of een bereik "85-80" (dan de eerste waarde, met
 * waarschuwing). Tekst zoals "Error" of "20i" → null, ook met waarschuwing.
 */
/**
 * De coach zet soms een voorstel in de gewichtkolom: "suggested load 120-122,5"
 * (nog niet gedaan) of "(suggested load 140-145) 150" (voorstel + wat je echt
 * deed). We halen het voorstel eruit; wat overblijft is het echte gewicht.
 * Zonder voorstel blijft de cel ongewijzigd.
 */
const SUGGESTED_LOAD = /\(?\s*(?:sugg?este?d\s*load|voorgesteld(?:\s*gewicht)?|suggestie)\s*:?\s*([\d.,]+(?:\s*[-–]\s*[\d.,]+)?)?\s*(?:kg)?\s*\)?/i;

export function splitSuggestedLoad(value: CellValue): { value: CellValue; suggestion: string | null } {
  if (typeof value !== "string") return { value, suggestion: null };
  const match = value.match(SUGGESTED_LOAD);
  if (!match) return { value, suggestion: null };
  const rest = value.replace(match[0], "").trim();
  return { value: rest === "" ? null : rest, suggestion: match[1]?.replace(/\s+/g, "") ?? null };
}

export function parseWeight(value: CellValue): { weight: number | null; warning: string | null } {
  if (isBlank(value)) return { weight: null, warning: null };
  const number = parseNumber(value);
  if (number !== null) {
    return number >= 0 && number <= 1000 ? { weight: number, warning: null } : { weight: null, warning: `Gewicht ${number} valt buiten 0-1000 kg.` };
  }
  const text = String(value).trim();
  const range = text.match(/^(\d+(?:[.,]\d+)?)\s*[-–]\s*\d+(?:[.,]\d+)?$/);
  if (range) return { weight: Number(range[1].replace(",", ".")), warning: `Gewicht "${text}" is een bereik: ${range[1]} gebruikt.` };
  return { weight: null, warning: `Gewicht "${text}" niet herkend.` };
}

/** Cardio-duur in minuten: 20, "20", "30\"" of "20 min". */
export function parseDuration(value: CellValue): number | null {
  if (isBlank(value)) return null;
  if (typeof value === "number") return Math.round(value);
  const match = String(value).match(/\d+/);
  return match ? Number(match[0]) : null;
}

/**
 * De sheet gebruikt AMAZING / NEUTRAAL / BAD, maar soms ook GOOD. Op een schaal
 * van drie is GOOD positief, dus → AMAZING. Al de rest wordt null (en de
 * originele waarde blijft bewaard in het raw-veld).
 */
export function normalizeRating(value: CellValue): { rating: Rating | null; note: string | null } {
  const text = cellText(value).toUpperCase();
  if (!text || text === "/") return { rating: null, note: null };
  if (text === "AMAZING" || text === "NEUTRAAL" || text === "BAD") return { rating: text, note: null };
  if (text === "NEUTRAL") return { rating: "NEUTRAAL", note: null };
  if (text === "GOOD" || text === "GOED") return { rating: "AMAZING", note: `"${cellText(value)}" omgezet naar AMAZING.` };
  return { rating: null, note: `"${cellText(value)}" is geen geldige score (AMAZING / NEUTRAAL / BAD).` };
}

const WEEKDAY_NAMES = ["maandag", "dinsdag", "woensdag", "donderdag", "vrijdag", "zaterdag", "zondag"];

/** "Maandag" → 0. Geen weekdag → null. */
export function parseWeekday(value: CellValue): number | null {
  const index = WEEKDAY_NAMES.indexOf(cellText(value).toLowerCase());
  return index === -1 ? null : index;
}

/** "(Hammer curls)" → optioneel, naam "Hammer curls". */
export function parseExerciseName(value: CellValue): { name: string; optional: boolean } {
  const text = cellText(value);
  const optional = /^\(.*\)$/.test(text);
  return { name: optional ? text.slice(1, -1).trim() : text, optional };
}

/** Tabbladen zoals JUL2026 of AUG2026 (Nederlands of Engels). */
const MONTHS: Record<string, number> = {
  JAN: 0, FEB: 1, MRT: 2, MAR: 2, APR: 3, MEI: 4, MAY: 4, JUN: 5,
  JUL: 6, AUG: 7, SEP: 8, OKT: 9, OCT: 9, NOV: 10, DEC: 11,
};

export function parseMonthTab(name: string): { year: number; month: number } | null {
  const match = name.trim().toUpperCase().match(/^([A-Z]{3})(\d{4})$/);
  if (!match || !(match[1] in MONTHS)) return null;
  return { year: Number(match[2]), month: MONTHS[match[1]] };
}
