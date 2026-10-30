// Domeintypes die overeenkomen met de kolommen in supabase/schema.sql.
// Tip: met `npx supabase gen types typescript` kan je deze ook laten genereren.

export type Rating = "AMAZING" | "NEUTRAAL" | "BAD";
export const RATINGS: Rating[] = ["AMAZING", "NEUTRAAL", "BAD"];

export type Exercise = {
  id: string;
  name: string;
  category: string;
  equipment: string | null;
  created_by: string | null;
};

export const EXERCISE_CATEGORIES = ["Legs", "Bench", "Deadlift", "Andere"];

export type ProgramExercise = {
  id: string;
  position: number;
  target_sets: number | null;
  target_reps: string | null;
  target_rpe: string | null;
  notes: string | null;
  optional: boolean;
  exercise: Pick<Exercise, "id" | "name" | "category" | "equipment"> | null;
};

export type ProgramDay = {
  id: string;
  name: string;
  position: number;
  weekday: number | null;
  program_exercises: ProgramExercise[];
};

export type Program = {
  id: string;
  name: string;
  description: string | null;
  /** Blokopbouw: RPE van rpe_start naar rpe_end over block_weeks weken (alle drie null = geen blok). */
  block_weeks: number | null;
  rpe_start: number | null;
  rpe_end: number | null;
  program_days: ProgramDay[];
};

export type ActiveAssignment = {
  id: string;
  start_date: string;
  program: Program;
  /** Welke blokweek het vandaag is (null als het schema geen blok is). */
  block: { week: number; weeks: number; rpe: number; finished: boolean } | null;
};

export type WorkoutStatus = "completed" | "planned";

export type WorkoutListItem = {
  id: string;
  date: string;
  title: string | null;
  status: WorkoutStatus;
  duration_minutes: number | null;
  import_batch_id: string | null;
  /** Maandtab van de import ("OCT2026"), om te weten of het blok verlopen is. */
  sheet_tab: string | null;
  exercise_count: number;
  feedback_count: number;
};

export type WorkoutSet = {
  id: string;
  set_number: number;
  reps: number | null;
  weight: number | null;
  rpe: number | null;
  reps_estimated: boolean;
};

export type WorkoutExerciseDetail = {
  id: string;
  position: number;
  target_sets: number | null;
  target_reps: string | null;
  target_intensity: string | null;
  actual_rpe: number | null;
  notes: string | null;
  optional: boolean;
  performed: boolean;
  raw: Record<string, unknown> | null;
  exercise: { id: string; name: string } | null;
  workout_sets: WorkoutSet[];
};

export type Feedback = {
  id: string;
  message: string;
  created_at: string;
  trainer_id: string;
  trainer: { full_name: string } | null;
};

export type WorkoutDetail = {
  id: string;
  member_id: string;
  date: string;
  title: string | null;
  status: WorkoutStatus;
  duration_minutes: number | null;
  notes: string | null;
  workout_exercises: WorkoutExerciseDetail[];
  cardio_entries: { id: string; type: string; duration_minutes: number | null }[];
  workout_feedback: Feedback[];
  import_batch: { sheet_tab: string; block_description: string | null } | null;
};

/** Eén rij uit de view set_log. */
export type SetLogRow = {
  exercise_id: string;
  workout_id: string;
  date: string;
  set_number: number;
  reps: number | null;
  weight: number | null;
  rpe: number | null;
  reps_estimated: boolean;
};

export type StrengthTest = {
  id: string;
  label: string;
  squat: number | null;
  bench: number | null;
  deadlift: number | null;
  total: number;
  tested_on: string | null;
};

export type BodyMetric = { id: string; date: string; weight: number };

export type Checkin = {
  id: string;
  week_start: string;
  training: Rating | null;
  motivation: Rating | null;
  pain: Rating | null;
  overall_feeling: Rating | null;
  score: number | null;
  sessions_done: number | null;
  feedback: string | null;
  import_batch_id: string | null;
};

export type MemberActivity = {
  member_id: string;
  full_name: string;
  trainer_id: string | null;
  last_workout_date: string | null;
  workouts_this_week: number;
  last_checkin_week: string | null;
  last_checkin_training: Rating | null;
  last_checkin_motivation: Rating | null;
  last_checkin_pain: Rating | null;
  last_checkin_score: number | null;
};

/**
 * Kerncijfers per oefening tijdens het loggen:
 * - reference: geschat 1RM waarop het voorgestelde gewicht gebaseerd is;
 * - best: beste geschatte 1RM ooit, om een PR (persoonlijk record) te herkennen.
 */
export type LiftStats = {
  reference: { e1rm: number; date: string } | null;
  best: number | null;
};

/** Vorige prestatie op een oefening, getoond tijdens het loggen. */
export type PreviousPerformance = {
  date: string;
  sets: { reps: number | null; weight: number | null; rpe: number | null }[];
};

export type NotificationKind = "workout_completed" | "program_assigned" | "feedback";

export type AppNotification = {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
};
