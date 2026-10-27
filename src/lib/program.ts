import { WEEKDAYS, weekdayIndex } from "@/lib/dates";
import type { ProgramDay, ProgramExercise } from "@/lib/types";

export type TodayPlan =
  | { kind: "none" } // geen schema toegewezen of schema zonder dagen
  | { kind: "training"; day: ProgramDay }
  | { kind: "rest"; next: ProgramDay };

/**
 * Welke schemadag is het vandaag?
 * - Hebben de dagen een weekdag (bv. "Dag 1 = maandag"), dan volgen we de kalender.
 * - Zonder weekdagen volgen we de volgorde: de dag na je laatst gelogde schemadag.
 */
export function pickTodaysDay(days: ProgramDay[], today: string, lastProgramDayId: string | null): TodayPlan {
  if (days.length === 0) return { kind: "none" };

  const planned = days.filter((day) => day.weekday !== null);
  if (planned.length > 0) {
    const todayIndex = weekdayIndex(today);
    const match = planned.find((day) => day.weekday === todayIndex);
    if (match) return { kind: "training", day: match };
    const sorted = [...planned].sort((a, b) => a.weekday! - b.weekday!);
    const next = sorted.find((day) => day.weekday! > todayIndex) ?? sorted[0];
    return { kind: "rest", next };
  }

  const lastIndex = days.findIndex((day) => day.id === lastProgramDayId);
  return { kind: "training", day: days[(lastIndex + 1) % days.length] };
}

export function weekdayLabel(weekday: number | null) {
  return weekday === null ? null : WEEKDAYS[weekday];
}

/** "3 × 8-10 @ RPE 8" */
export function formatTarget(exercise: Pick<ProgramExercise, "target_sets" | "target_reps" | "target_rpe">) {
  const parts = [];
  if (exercise.target_sets || exercise.target_reps) {
    parts.push(`${exercise.target_sets ?? "?"} × ${exercise.target_reps ?? "?"}`);
  }
  if (exercise.target_rpe) parts.push(`RPE ${exercise.target_rpe}`);
  return parts.join(" @ ") || "Geen doel";
}
