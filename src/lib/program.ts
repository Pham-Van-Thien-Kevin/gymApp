import { WEEKDAYS, daysBetween, startOfWeek, weekdayIndex } from "@/lib/dates";
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

// --- Blokopbouw ---------------------------------------------------------------
// Een schema kan een "blok" zijn: elke week gaat de RPE van alle oefeningen
// omhoog, bv. 4 weken van RPE 6 naar 9 (6, 7, 8, 9). Week 1 is de week waarin
// het schema toegewezen werd; zo zit elke cliënt in zijn eigen week.

export type BlockSettings = { block_weeks: number | null; rpe_start: number | null; rpe_end: number | null };

export type BlockStatus = { week: number; weeks: number; rpe: number; finished: boolean };

/** De RPE van een week: gelijke stappen van start naar eind, afgerond op 0,5 (zoals de RPE-tabel). */
export function blockRpe(settings: BlockSettings, week: number): number | null {
  const { block_weeks: weeks, rpe_start: start, rpe_end: end } = settings;
  if (!weeks || start === null || end === null) return null;
  const capped = Math.min(Math.max(week, 1), weeks);
  const exact = start + ((end - start) * (capped - 1)) / (weeks - 1);
  return Math.round(exact * 2) / 2;
}

/** In welke week van het blok zit je vandaag? Null als het schema geen blok is. */
export function currentBlock(settings: BlockSettings, startDate: string, today: string): BlockStatus | null {
  if (!settings.block_weeks) return null;
  const week = Math.floor(daysBetween(startOfWeek(startDate), startOfWeek(today)) / 7) + 1;
  const rpe = blockRpe(settings, week);
  if (rpe === null) return null;
  return { week: Math.min(Math.max(week, 1), settings.block_weeks), weeks: settings.block_weeks, rpe, finished: week > settings.block_weeks };
}

/** "7" of "7,5": zelfde notatie als een ingetypt RPE-doel. */
export const formatRpeTarget = (rpe: number) => String(rpe).replace(".", ",");

/** De schemadagen met de RPE van deze blokweek in plaats van de vaste RPE. */
export function withBlockRpe(days: ProgramDay[], block: BlockStatus | null): ProgramDay[] {
  if (!block) return days;
  const target = formatRpeTarget(block.rpe);
  return days.map((day) => ({
    ...day,
    program_exercises: day.program_exercises.map((pe) => ({ ...pe, target_rpe: target })),
  }));
}
