import { daysBetween } from "@/lib/dates";
import type { MemberActivity } from "@/lib/types";

/** Na zoveel dagen zonder training markeert het dashboard een cliënt. */
export const INACTIVE_AFTER_DAYS = 7;

export type ClientFlags = {
  daysSinceWorkout: number | null;
  inactive: boolean;
  pain: boolean;
  needsAttention: boolean;
};

/** Waarom verdient deze cliënt aandacht? 7+ dagen niet getraind of "BAD" bij pijn/klachten. */
export function clientFlags(activity: MemberActivity, today: string): ClientFlags {
  const daysSinceWorkout = activity.last_workout_date ? daysBetween(activity.last_workout_date, today) : null;
  const inactive = daysSinceWorkout === null || daysSinceWorkout >= INACTIVE_AFTER_DAYS;
  const pain = activity.last_checkin_pain === "BAD";
  return { daysSinceWorkout, inactive, pain, needsAttention: inactive || pain };
}
