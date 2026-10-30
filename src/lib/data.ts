import "server-only";
// Leesfuncties voor de database, gedeeld door de gebruikersapp en het
// trainerdashboard. Geen enkele functie controleert zelf "mag dit?": dat doet
// RLS in Postgres. Vraagt een trainer data van iemand die niet zijn cliënt is,
// dan krijgt hij gewoon niets terug.
import { createClient } from "@/lib/supabase/server";
import type { ExportData, ExportWorkout } from "@/lib/export";
import { suggestFromTarget } from "@/lib/rpe";
import { buildProgressSeries, pickReferenceE1rm } from "@/lib/stats";
import type {
  ActiveAssignment,
  BodyMetric,
  Checkin,
  Exercise,
  LiftStats,
  MemberActivity,
  PreviousPerformance,
  ProgramDay,
  ProgramExercise,
  SetLogRow,
  StrengthTest,
  WorkoutDetail,
  WorkoutListItem,
} from "@/lib/types";

/** Gooit een duidelijke fout zodat error.tsx die kan tonen. */
function fail(context: string, error: { message: string }): never {
  throw new Error(`${context}: ${error.message}`);
}

const PROGRAM_SELECT = `
  id, name, description,
  program_days (
    id, name, position, weekday,
    program_exercises (
      id, position, target_sets, target_reps, target_rpe, notes, optional,
      exercise:exercises ( id, name, category, equipment )
    )
  )`;

/** Sorteer dagen en oefeningen op hun positie (PostgREST garandeert geen volgorde). */
export function sortProgramDays(days: ProgramDay[]): ProgramDay[] {
  return [...days]
    .sort((a, b) => a.position - b.position)
    .map((day) => ({
      ...day,
      program_exercises: [...day.program_exercises].sort((a, b) => a.position - b.position),
    }));
}

export async function getExercises(): Promise<Exercise[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("exercises")
    .select("id, name, category, equipment, created_by")
    .order("name");
  if (error) fail("Oefeningen laden", error);
  return data;
}

export async function getActiveAssignment(memberId: string): Promise<ActiveAssignment | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("program_assignments")
    .select(`id, start_date, program:programs ( ${PROGRAM_SELECT} )`)
    .eq("member_id", memberId)
    .eq("active", true)
    .maybeSingle();
  if (error) fail("Schema laden", error);
  if (!data?.program) return null;
  const assignment = data as unknown as ActiveAssignment;
  return { ...assignment, program: { ...assignment.program, program_days: sortProgramDays(assignment.program.program_days) } };
}

export async function getProgramDay(dayId: string): Promise<ProgramDay | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("program_days")
    .select(
      `id, name, position, weekday,
       program_exercises ( id, position, target_sets, target_reps, target_rpe, notes, optional,
         exercise:exercises ( id, name, category, equipment ) )`,
    )
    .eq("id", dayId)
    .maybeSingle();
  if (error) fail("Schemadag laden", error);
  return data ? sortProgramDays([data as unknown as ProgramDay])[0] : null;
}

export async function getMemberActivity(memberId?: string): Promise<MemberActivity[]> {
  const supabase = await createClient();
  let query = supabase.from("member_activity").select("*").order("full_name");
  if (memberId) query = query.eq("member_id", memberId);
  const { data, error } = await query;
  if (error) fail("Activiteit laden", error);
  return data;
}

export async function getWorkoutDates(memberId: string, since: string): Promise<{ date: string; program_day_id: string | null }[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("workouts")
    .select("date, program_day_id")
    .eq("member_id", memberId)
    .eq("status", "completed")
    .gte("date", since)
    .order("date", { ascending: false });
  if (error) fail("Trainingen laden", error);
  return data;
}

export async function getWorkouts(
  memberId: string,
  { limit = 20, offset = 0 }: { limit?: number; offset?: number } = {},
): Promise<{ items: WorkoutListItem[]; total: number }> {
  const supabase = await createClient();
  // "workout_exercises(count)" laat PostgREST tellen in plaats van alle rijen op te halen.
  const { data, error, count } = await supabase
    .from("workouts")
    .select("id, date, title, status, duration_minutes, import_batch_id, workout_exercises(count), workout_feedback(count)", {
      count: "exact",
    })
    .eq("member_id", memberId)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) fail("Historiek laden", error);

  const items = data.map((row) => ({
    id: row.id,
    date: row.date,
    title: row.title,
    status: row.status,
    duration_minutes: row.duration_minutes,
    import_batch_id: row.import_batch_id,
    exercise_count: row.workout_exercises?.[0]?.count ?? 0,
    feedback_count: row.workout_feedback?.[0]?.count ?? 0,
  }));
  return { items, total: count ?? items.length };
}

/** Geplande (nog niet afgewerkte) trainingen, vroegste eerst. */
export async function getPlannedWorkouts(memberId: string, limit = 8): Promise<{ items: WorkoutListItem[]; total: number }> {
  const supabase = await createClient();
  const { data, error, count } = await supabase
    .from("workouts")
    .select("id, date, title, status, duration_minutes, import_batch_id, workout_exercises(count)", { count: "exact" })
    .eq("member_id", memberId)
    .eq("status", "planned")
    .order("date")
    .limit(limit);
  if (error) fail("Geplande trainingen laden", error);

  const items = data.map((row) => ({
    id: row.id,
    date: row.date,
    title: row.title,
    status: row.status,
    duration_minutes: row.duration_minutes,
    import_batch_id: row.import_batch_id,
    exercise_count: row.workout_exercises?.[0]?.count ?? 0,
    feedback_count: 0,
  }));
  return { items, total: count ?? items.length };
}

export async function getWorkoutDetail(workoutId: string): Promise<WorkoutDetail | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("workouts")
    .select(
      `id, member_id, date, title, status, duration_minutes, notes,
       workout_exercises ( id, position, target_sets, target_reps, target_intensity, actual_rpe, notes, optional, performed, raw,
         exercise:exercises ( id, name ),
         workout_sets ( id, set_number, reps, weight, rpe, reps_estimated ) ),
       cardio_entries ( id, type, duration_minutes ),
       workout_feedback ( id, message, created_at, trainer_id, trainer:profiles ( full_name ) ),
       import_batch:import_batches ( sheet_tab, block_description )`,
    )
    .eq("id", workoutId)
    .maybeSingle();
  if (error) fail("Training laden", error);
  if (!data) return null;

  const workout = data as unknown as WorkoutDetail;
  workout.workout_exercises.sort((a, b) => a.position - b.position);
  workout.workout_exercises.forEach((we) => we.workout_sets.sort((a, b) => a.set_number - b.set_number));
  workout.workout_feedback.sort((a, b) => a.created_at.localeCompare(b.created_at));
  return workout;
}

export async function getSetLog(memberId: string, exerciseId: string): Promise<SetLogRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("set_log")
    .select("exercise_id, workout_id, date, set_number, reps, weight, rpe, reps_estimated")
    .eq("member_id", memberId)
    .eq("exercise_id", exerciseId)
    .order("date");
  if (error) fail("Progressie laden", error);
  return data;
}

/** Zoals getSetLog, maar voor meerdere oefeningen tegelijk (één query met "in"). */
export async function getSetLogs(memberId: string, exerciseIds: string[]): Promise<SetLogRow[]> {
  if (exerciseIds.length === 0) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("set_log")
    .select("exercise_id, workout_id, date, set_number, reps, weight, rpe, reps_estimated")
    .eq("member_id", memberId)
    .in("exercise_id", exerciseIds)
    .order("date");
  if (error) fail("Progressie laden", error);
  return data;
}

/** Oefeningen die deze member ooit uitvoerde, meest gelogde eerst. */
export async function getLoggedExercises(memberId: string): Promise<{ id: string; name: string; count: number }[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("workout_exercises")
    .select("exercise:exercises ( id, name ), workouts!inner ( member_id, status )")
    .eq("workouts.member_id", memberId)
    .eq("workouts.status", "completed")
    .eq("performed", true)
    .limit(5000);
  if (error) fail("Oefeningen laden", error);

  const counts = new Map<string, { id: string; name: string; count: number }>();
  for (const row of data as unknown as { exercise: { id: string; name: string } | null }[]) {
    if (!row.exercise) continue;
    const entry = counts.get(row.exercise.id) ?? { ...row.exercise, count: 0 };
    entry.count += 1;
    counts.set(row.exercise.id, entry);
  }
  return [...counts.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

/** Per oefening de sets van de meest recente training waarin ze voorkwam. */
export async function getPreviousPerformances(
  memberId: string,
  exerciseIds: string[],
  beforeDate?: string,
): Promise<Record<string, PreviousPerformance>> {
  if (exerciseIds.length === 0) return {};
  const supabase = await createClient();
  let query = supabase
    .from("set_log")
    .select("exercise_id, workout_id, date, set_number, reps, weight, rpe")
    .eq("member_id", memberId)
    .in("exercise_id", exerciseIds)
    .order("date", { ascending: false })
    .order("set_number")
    .limit(1000);
  if (beforeDate) query = query.lte("date", beforeDate);
  const { data, error } = await query;
  if (error) fail("Vorige prestaties laden", error);

  const result: Record<string, PreviousPerformance & { workoutId: string }> = {};
  for (const row of data as SetLogRow[]) {
    const current = result[row.exercise_id];
    if (!current) {
      result[row.exercise_id] = { date: row.date, workoutId: row.workout_id, sets: [] };
    } else if (current.workoutId !== row.workout_id) {
      continue; // ouder: we tonen enkel de laatste training
    }
    result[row.exercise_id].sets.push({ reps: row.reps, weight: row.weight, rpe: row.rpe });
  }
  return Object.fromEntries(
    Object.entries(result).map(([id, { date, sets }]) => [id, { date, sets }]),
  );
}

/**
 * Per oefening: het referentie-1RM (voor het voorgestelde gewicht) en het beste
 * geschatte 1RM ooit (voor PR-meldingen). Eén query op set_log voor alle
 * oefeningen samen; het rekenwerk gebeurt in pure functies uit lib/stats.
 */
export async function getLiftStats(memberId: string, exerciseIds: string[], today: string): Promise<Record<string, LiftStats>> {
  if (exerciseIds.length === 0) return {};
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("set_log")
    .select("exercise_id, workout_id, date, set_number, reps, weight, rpe, reps_estimated")
    .eq("member_id", memberId)
    .in("exercise_id", exerciseIds)
    .not("weight", "is", null)
    .order("date");
  if (error) fail("Krachtgegevens laden", error);

  const byExercise = new Map<string, SetLogRow[]>();
  for (const row of data as SetLogRow[]) {
    byExercise.set(row.exercise_id, [...(byExercise.get(row.exercise_id) ?? []), row]);
  }

  const result: Record<string, LiftStats> = {};
  for (const [exerciseId, rows] of byExercise) {
    const history = buildProgressSeries(rows).map(({ date, e1rm }) => ({ date, e1rm }));
    const best = Math.max(0, ...history.map((point) => point.e1rm));
    result[exerciseId] = { reference: pickReferenceE1rm(history, today), best: best || null };
  }
  return result;
}

/**
 * Voorgesteld gewicht per schema-oefening (sleutel = program_exercise.id) voor
 * deze member: zijn geschat 1RM × het percentage voor het doel. Oefeningen
 * zonder geschiedenis of zonder doel-RPE krijgen geen gewicht.
 */
export async function getProgramLoads(
  memberId: string,
  programExercises: ProgramExercise[],
  today: string,
): Promise<Record<string, number>> {
  const exerciseIds = [...new Set(programExercises.flatMap((pe) => (pe.exercise ? [pe.exercise.id] : [])))];
  const stats = await getLiftStats(memberId, exerciseIds, today);
  const loads: Record<string, number> = {};
  for (const pe of programExercises) {
    const suggestion = pe.exercise ? suggestFromTarget(stats[pe.exercise.id]?.reference?.e1rm, pe.target_reps, pe.target_rpe) : null;
    if (suggestion) loads[pe.id] = suggestion.weight;
  }
  return loads;
}

export async function getStrengthTests(memberId: string): Promise<StrengthTest[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("strength_tests")
    .select("id, label, squat, bench, deadlift, total, tested_on")
    .eq("member_id", memberId);
  if (error) fail("Maxima laden", error);
  // "Blok 2" vóór "Blok 10": sorteer op het getal in het label.
  const blockNumber = (label: string) => Number(label.match(/\d+/)?.[0] ?? Number.MAX_SAFE_INTEGER);
  return [...data].sort(
    (a, b) => blockNumber(a.label) - blockNumber(b.label) || (a.tested_on ?? "").localeCompare(b.tested_on ?? ""),
  );
}

export async function getBodyMetrics(memberId: string): Promise<BodyMetric[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("body_metrics")
    .select("id, date, weight")
    .eq("member_id", memberId)
    .order("date");
  if (error) fail("Lichaamsgewicht laden", error);
  return data;
}

export async function getCheckins(memberId: string, limit = 12): Promise<Checkin[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("weekly_checkins")
    .select("id, week_start, training, motivation, pain, overall_feeling, score, sessions_done, feedback, import_batch_id")
    .eq("member_id", memberId)
    .order("week_start", { ascending: false })
    .limit(limit);
  if (error) fail("Check-ins laden", error);
  return data;
}

export async function getImportBatches(memberId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("import_batches")
    .select("id, sheet_tab, source, block_description, created_at, workouts(count)")
    .eq("member_id", memberId)
    .order("created_at", { ascending: false });
  if (error) fail("Imports laden", error);
  return data.map((batch) => ({
    id: batch.id as string,
    sheet_tab: batch.sheet_tab as string,
    source: batch.source as string,
    block_description: batch.block_description as string | null,
    created_at: batch.created_at as string,
    workout_count: (batch.workouts?.[0]?.count ?? 0) as number,
  }));
}

/**
 * Alles voor de Excel-export van één sporter. Trainingen in blokken van 200:
 * Supabase geeft standaard maximaal 1000 rijen per verzoek terug.
 */
export async function getExportData(memberId: string, name: string): Promise<ExportData> {
  const supabase = await createClient();
  const workouts: ExportWorkout[] = [];
  for (let from = 0; ; from += 200) {
    const { data, error } = await supabase
      .from("workouts")
      .select(
        `date, title, status, duration_minutes, notes,
         workout_exercises ( position, target_sets, target_reps, target_intensity, actual_rpe, notes, optional, performed,
           exercise:exercises ( id, name ),
           workout_sets ( set_number, reps, weight, rpe ) ),
         cardio_entries ( type, duration_minutes )`,
      )
      .eq("member_id", memberId)
      .order("date")
      .order("created_at")
      .range(from, from + 199);
    if (error) fail("Export laden", error);
    for (const workout of data as unknown as ExportWorkout[]) {
      workout.workout_exercises.sort((a, b) => a.position - b.position);
      workout.workout_exercises.forEach((we) => we.workout_sets.sort((a, b) => a.set_number - b.set_number));
      workouts.push(workout);
    }
    if (data.length < 200) break;
  }

  const [strengthTests, bodyMetrics, checkins] = await Promise.all([
    getStrengthTests(memberId),
    getBodyMetrics(memberId),
    getCheckins(memberId, 1000),
  ]);
  // Oud → nieuw, net zoals de trainingen.
  return { name, workouts, strengthTests, bodyMetrics: [...bodyMetrics].sort((a, b) => a.date.localeCompare(b.date)), checkins: [...checkins].reverse() };
}
