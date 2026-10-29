// Gedeelde types tussen de logger (browser) en de Server Action (server).
// Alles is tekst, net zoals het in de invoervelden staat; de server valideert.

export type DraftSet = { key: string; reps: string; weight: string; rpe: string; done: boolean };

export type DraftExercise = {
  key: string;
  exerciseId: string;
  name: string;
  targetSets: number | null;
  targetReps: string | null;
  targetIntensity: string | null;
  optional: boolean;
  /** Stang-oefening (materiaal "Barbell"): dan tonen we de schijvencalculator. */
  barbell?: boolean;
  /** Het doel (reps @ RPE) is zelf gekozen in de logger, niet uit het schema. */
  customTarget?: boolean;
  notes: string;
  sets: DraftSet[];
};

export type DraftCardio = { key: string; type: string; minutes: string };

export type WorkoutDraft = {
  version: 1;
  programDayId: string | null;
  /** Een geplande training (bv. uit je sheet) die je nu afwerkt: die rij wordt bijgewerkt. */
  plannedWorkoutId?: string | null;
  savedAt: number;
  date: string;
  title: string;
  duration: string;
  notes: string;
  exercises: DraftExercise[];
  cardio: DraftCardio[];
};
