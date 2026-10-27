"use server";
// Server Actions om schema's te bewerken: programma → dagen → oefeningen.
// RLS (owns_program) garandeert dat een trainer enkel eigen schema's wijzigt;
// requireRole houdt members buiten.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { inRange, isUuid, parseInteger, text } from "@/lib/parse";
import { createClient } from "@/lib/supabase/server";
import type { ActionState } from "@/components/ui/form";

const refresh = (programId: string) => {
  revalidatePath(`/trainer/programs/${programId}`);
  revalidatePath("/trainer/programs");
};

function readWeekday(formData: FormData) {
  const value = parseInteger(formData.get("weekday"));
  return inRange(value, 0, 6) ? value : null;
}

/** Doelen uit een formulier: sets (1-20), reps en RPE als korte tekst ("8-10", "8-8,5"). */
function readTargets(formData: FormData) {
  const sets = formData.get("target_sets") ? parseInteger(formData.get("target_sets")) : null;
  return {
    valid: sets === null || inRange(sets, 1, 20),
    values: {
      target_sets: sets,
      target_reps: text(formData.get("target_reps"), 20) || null,
      target_rpe: text(formData.get("target_rpe"), 20).replace(/^rpe\s*/i, "") || null,
      notes: text(formData.get("notes"), 300) || null,
      optional: formData.get("optional") === "on",
    },
  };
}

export async function createProgram(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const trainer = await requireRole("trainer");
  const name = text(formData.get("name"), 100);
  if (!name) return { error: "Geef het schema een naam." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("programs")
    .insert({ trainer_id: trainer.id, name, description: text(formData.get("description"), 1000) || null })
    .select("id")
    .single();
  if (error) return { error: error.message };

  // Een eerste dag, zodat de trainer meteen oefeningen kan toevoegen.
  await supabase.from("program_days").insert({ program_id: data.id, position: 0, name: "Dag 1" });
  redirect(`/trainer/programs/${data.id}`);
}

export async function updateProgram(programId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireRole("trainer");
  const name = text(formData.get("name"), 100);
  if (!isUuid(programId) || !name) return { error: "Geef het schema een naam." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("programs")
    .update({ name, description: text(formData.get("description"), 1000) || null })
    .eq("id", programId);
  if (error) return { error: error.message };
  refresh(programId);
  return { success: "Opgeslagen." };
}

export async function deleteProgram(programId: string): Promise<ActionState> {
  await requireRole("trainer");
  if (!isUuid(programId)) return { error: "Onbekend schema." };
  const supabase = await createClient();
  // Dagen, oefeningen en toewijzingen gaan mee (on delete cascade). Gelogde
  // trainingen blijven bestaan; hun program_day_id wordt null.
  const { error } = await supabase.from("programs").delete().eq("id", programId);
  if (error) return { error: error.message };
  revalidatePath("/trainer", "layout");
  redirect("/trainer/programs");
}

export async function addDay(programId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireRole("trainer");
  const name = text(formData.get("name"), 80);
  if (!isUuid(programId) || !name) return { error: "Geef de dag een naam." };

  const supabase = await createClient();
  const { count } = await supabase.from("program_days").select("id", { count: "exact", head: true }).eq("program_id", programId);
  const { error } = await supabase
    .from("program_days")
    .insert({ program_id: programId, name, weekday: readWeekday(formData), position: count ?? 0 });
  if (error) return { error: error.message };
  refresh(programId);
  return { success: `${name} toegevoegd.` };
}

export async function updateDay(programId: string, dayId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireRole("trainer");
  const name = text(formData.get("name"), 80);
  if (!isUuid(dayId) || !name) return { error: "Geef de dag een naam." };

  const supabase = await createClient();
  const { error } = await supabase.from("program_days").update({ name, weekday: readWeekday(formData) }).eq("id", dayId);
  if (error) return { error: error.message };
  refresh(programId);
  return { success: "Dag opgeslagen." };
}

export async function deleteDay(programId: string, dayId: string): Promise<void> {
  await requireRole("trainer");
  if (!isUuid(dayId)) return;
  const supabase = await createClient();
  await supabase.from("program_days").delete().eq("id", dayId);
  refresh(programId);
}

export async function addProgramExercise(programId: string, dayId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireRole("trainer");
  const exerciseId = formData.get("exercise_id");
  if (!isUuid(dayId) || !isUuid(exerciseId)) return { error: "Kies een oefening." };
  const { valid, values } = readTargets(formData);
  if (!valid) return { error: "Sets moet tussen 1 en 20 liggen." };

  const supabase = await createClient();
  const { count } = await supabase.from("program_exercises").select("id", { count: "exact", head: true }).eq("program_day_id", dayId);
  const { error } = await supabase
    .from("program_exercises")
    .insert({ program_day_id: dayId, exercise_id: exerciseId, position: count ?? 0, ...values });
  if (error) return { error: error.message };
  refresh(programId);
  return { success: "Oefening toegevoegd." };
}

export async function updateProgramExercise(programId: string, rowId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireRole("trainer");
  if (!isUuid(rowId)) return { error: "Onbekende oefening." };
  const { valid, values } = readTargets(formData);
  if (!valid) return { error: "Sets moet tussen 1 en 20 liggen." };

  const supabase = await createClient();
  const { error } = await supabase.from("program_exercises").update(values).eq("id", rowId);
  if (error) return { error: error.message };
  refresh(programId);
  return { success: "Opgeslagen." };
}

export async function deleteProgramExercise(programId: string, rowId: string): Promise<void> {
  await requireRole("trainer");
  if (!isUuid(rowId)) return;
  const supabase = await createClient();
  await supabase.from("program_exercises").delete().eq("id", rowId);
  refresh(programId);
}

/**
 * Verplaats een dag of oefening één plaats omhoog/omlaag. We halen alle
 * "broertjes" op in volgorde, wisselen er twee om en nummeren daarna alles
 * opnieuw 0, 1, 2, … zodat er nooit gaten of dubbele posities ontstaan.
 */
export async function move(
  programId: string,
  table: "program_days" | "program_exercises",
  rowId: string,
  direction: "up" | "down",
): Promise<void> {
  await requireRole("trainer");
  if (!isUuid(rowId) || (table !== "program_days" && table !== "program_exercises")) return;
  const parentColumn = table === "program_days" ? "program_id" : "program_day_id";

  const supabase = await createClient();
  const { data: row } = await supabase.from(table).select(parentColumn).eq("id", rowId).single();
  if (!row) return;
  const parentId = (row as Record<string, string>)[parentColumn];
  const { data: siblings } = await supabase.from(table).select("id").eq(parentColumn, parentId).order("position").order("created_at");
  if (!siblings) return;

  const ids = siblings.map((sibling) => sibling.id as string);
  const index = ids.indexOf(rowId);
  const target = direction === "up" ? index - 1 : index + 1;
  if (index < 0 || target < 0 || target >= ids.length) return;
  [ids[index], ids[target]] = [ids[target], ids[index]];

  await Promise.all(ids.map((id, position) => supabase.from(table).update({ position }).eq("id", id)));
  refresh(programId);
}
