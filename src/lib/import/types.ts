// Types van de import. Alles is "plain data" (geen klassen, geen Dates), zodat
// het van de server naar de browser kan voor de preview.
import type { Rating } from "@/lib/types";

/** Een celwaarde zoals ze in de sheet stond: tekst, getal of leeg. */
export type CellValue = string | number | null;

export type ImportWarning = {
  sheet: string;
  cell?: string; // bv. "G9"
  message: string;
};

export type ParsedSet = {
  setNumber: number;
  reps: number | null;
  weight: number | null;
  repsEstimated: boolean;
};

export type ParsedExercise = {
  cell: string; // cel van de oefeningnaam, bv. "B9"
  name: string; // zonder haakjes
  optional: boolean;
  comment: string | null; // kolom "opmerking"
  suggestedLoad: string | null; // voorstel van de coach uit de gewichtkolom, bv. "120-122,5"
  targetSets: number | null;
  targetReps: string | null;
  targetIntensity: string | null;
  actualRpe: number | null;
  notes: string | null;
  performed: boolean; // false = gepland (geen gewicht én geen echte RPE)
  sets: ParsedSet[];
  extraFrom: number | null; // uit een blok "EXTRA OEFENING VAN SESSIE n"
  raw: Record<string, CellValue>;
};

export type ParsedCardio = { type: string; durationMinutes: number | null; raw: Record<string, CellValue> };

export type ParsedSession = {
  number: number;
  weekday: number | null; // 0 = maandag, uit de kopregel
  dayOffset: number; // dagen na de start van de week
  exercises: ParsedExercise[];
  cardio: ParsedCardio[];
};

export type ParsedCheckin = {
  training: Rating | null;
  motivation: Rating | null;
  pain: Rating | null;
  overallFeeling: Rating | null;
  score: number | null;
  sessionsDone: number | null;
  feedback: string | null;
  raw: Record<string, CellValue>;
};

export type ParsedWeek = {
  number: number;
  sessions: ParsedSession[];
  checkin: ParsedCheckin | null;
};

export type ParsedMonth = {
  tab: string; // "JUL2026"
  year: number;
  month: number; // 0 = januari
  description: string | null;
  weeks: ParsedWeek[];
};

export type ParsedInfo = {
  startDate: string | null;
  exercises: { name: string; category: string }[];
  strengthTests: { label: string; squat: number | null; bench: number | null; deadlift: number | null }[];
};

export type ParsedWorkbook = {
  info: ParsedInfo | null;
  months: ParsedMonth[];
  skippedTabs: string[];
  warnings: ImportWarning[];
};
