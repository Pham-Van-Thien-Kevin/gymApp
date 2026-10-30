"use server";
// Server Actions van de logger. Elke actie controleert opnieuw de rol: een
// Server Action is een publiek POST-endpoint, ook als de knop verborgen is.
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { plannedState } from "@/lib/blocks";
import { getLiftStats, getPreviousPerformances } from "@/lib/data";
import { isValidISODate, todayISO } from "@/lib/dates";
import { inRange, isUuid, parseDecimal, parseInteger, text } from "@/lib/parse";
import { createClient } from "@/lib/supabase/server";
import { EXERCISE_CATEGORIES, type Exercise, type LiftStats, type PreviousPerformance } from "@/lib/types";
import type { WorkoutDraft } from "./types";

type SaveResult = { ok: true; workoutId: string } | { ok: false; error: string };

export async function saveWorkout(draft: WorkoutDraft): Promise<SaveResult> {
  await requireRole("member");

  // Vertrouw nooit wat de browser stuurt: alles opnieuw valideren.
  if (!isValidISODate(draft?.date ?? "")) return { ok: false, error: "Kies een geldige datum." };
  const duration = draft.duration.trim() ? parseInteger(draft.duration) : null;
  if (draft.duration.trim() && !inRange(duration, 0, 600)) {
    return { ok: false, error: "Duur moet tussen 0 en 600 minuten liggen." };
  }

  const exercises = [];
  for (const [position, exercise] of (draft.exercises ?? []).slice(0, 60).entries()) {
    if (!isUuid(exercise.exerciseId)) return { ok: false, error: "Er zit een ongeldige oefening in je training." };
    const sets = [];
    for (const set of exercise.sets ?? []) {
      if (!set.reps.trim() && !set.weight.trim()) continue; // lege rij = niet gedaan
      const reps = parseInteger(set.reps);
      const weight = set.weight.trim() ? parseDecimal(set.weight) : null;
      const rpe = set.rpe.trim() ? parseDecimal(set.rpe) : null;
      if (!inRange(reps, 0, 999)) return { ok: false, error: `${exercise.name}: vul bij elke set het aantal reps in.` };
      if (set.weight.trim() && !inRange(weight, 0, 1000)) return { ok: false, error: `${exercise.name}: ongeldig gewicht.` };
      if (set.rpe.trim() && !inRange(rpe, 0, 10)) return { ok: false, error: `${exercise.name}: RPE ligt tussen 0 en 10.` };
      sets.push({ reps, weight, rpe });
    }
    exercises.push({
      exercise_id: exercise.exerciseId,
      position,
      target_sets: exercise.targetSets,
      target_reps: exercise.targetReps,
      target_intensity: exercise.targetIntensity,
      optional: exercise.optional,
      notes: text(exercise.notes, 500),
      sets,
    });
  }

  const cardio = [];
  for (const entry of draft.cardio ?? []) {
    const type = text(entry.type, 60);
    if (!type) continue;
    const minutes = entry.minutes.trim() ? parseInteger(entry.minutes) : null;
    if (entry.minutes.trim() && !inRange(minutes, 0, 600)) return { ok: false, error: "Cardio: ongeldige duur." };
    cardio.push({ type, duration_minutes: minutes });
  }

  const hasSets = exercises.some((exercise) => exercise.sets.length > 0);
  if (!hasSets && cardio.length === 0) {
    return { ok: false, error: "Vul minstens één set of cardio in voor je opslaat." };
  }

  const supabase = await createClient();

  // Een geplande sessie afwerken mag enkel in haar eigen week (zie plannedState).
  if (isUuid(draft.plannedWorkoutId)) {
    const { data: planned } = await supabase.from("workouts").select("date, status").eq("id", draft.plannedWorkoutId).maybeSingle();
    const state = planned ? plannedState(planned.date, todayISO()) : null;
    if (!planned || planned.status !== "planned") return { ok: false, error: "Deze sessie is al afgewerkt of bestaat niet meer." };
    if (state === "missed") return { ok: false, error: "Deze sessie hoort bij een voorbije week en kan niet meer afgewerkt worden." };
    if (state === "locked") return { ok: false, error: "Deze sessie gaat pas maandag om 0:00 open." };
  }

  // Eén RPC-call = één transactie (zie log_workout in supabase/schema.sql).
  const { data, error } = await supabase.rpc("log_workout", {
    payload: {
      date: draft.date,
      title: text(draft.title, 120) || "Training",
      program_day_id: isUuid(draft.programDayId) ? draft.programDayId : null,
      // Afwerken van een geplande training; de database controleert of ze echt van jou en nog gepland is.
      workout_id: isUuid(draft.plannedWorkoutId) ? draft.plannedWorkoutId : null,
      duration_minutes: duration,
      notes: text(draft.notes, 2000),
      exercises,
      cardio,
    },
  });
  if (error) return { ok: false, error: `Opslaan lukte niet: ${error.message}` };

  // De homepagina, historiek en progressie tonen nu verouderde data: vernieuwen.
  revalidatePath("/app", "layout");
  return { ok: true, workoutId: data as string };
}

export async function createExercise(
  name: string,
  category: string,
): Promise<{ exercise?: Exercise; error?: string }> {
  const profile = await requireRole("member");
  const cleanName = text(name, 80);
  if (!cleanName) return { error: "Geef de oefening een naam." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("exercises")
    .insert({
      name: cleanName,
      category: EXERCISE_CATEGORIES.includes(category) ? category : "Andere",
      created_by: profile.id,
    })
    .select("id, name, category, equipment, created_by")
    .single();
  if (error) {
    return { error: error.code === "23505" ? "Je hebt al een oefening met deze naam." : error.message };
  }
  return { exercise: data };
}

/** Voor een oefening die je tijdens het loggen toevoegt: vorige prestatie + geschatte maxima. */
export async function fetchExerciseHistory(
  exerciseId: string,
): Promise<{ previous: PreviousPerformance | null; stats: LiftStats | null }> {
  const profile = await requireRole("member");
  if (!isUuid(exerciseId)) return { previous: null, stats: null };
  const [previous, stats] = await Promise.all([
    getPreviousPerformances(profile.id, [exerciseId]),
    getLiftStats(profile.id, [exerciseId], todayISO()),
  ]);
  return { previous: previous[exerciseId] ?? null, stats: stats[exerciseId] ?? null };
}
