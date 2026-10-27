"use server";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { isUuid, text } from "@/lib/parse";
import { createClient } from "@/lib/supabase/server";
import { EXERCISE_CATEGORIES } from "@/lib/types";
import type { ActionState } from "@/components/ui/form";

function readExercise(formData: FormData) {
  const category = String(formData.get("category"));
  return {
    name: text(formData.get("name"), 80),
    category: EXERCISE_CATEGORIES.includes(category) ? category : "Andere",
    equipment: text(formData.get("equipment"), 60) || null,
  };
}

// Postgres-foutcodes vertaald naar begrijpelijke taal.
function explain(code: string | undefined, message: string) {
  if (code === "23505") return "Je hebt al een oefening met deze naam.";
  if (code === "23503") return "Deze oefening wordt nog gebruikt in een schema of training en kan niet weg.";
  return message;
}

export async function createExercise(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const trainer = await requireRole("trainer");
  const values = readExercise(formData);
  if (!values.name) return { error: "Geef de oefening een naam." };

  const supabase = await createClient();
  const { error } = await supabase.from("exercises").insert({ ...values, created_by: trainer.id });
  if (error) return { error: explain(error.code, error.message) };
  revalidatePath("/trainer/exercises");
  return { success: `${values.name} toegevoegd.` };
}

export async function updateExercise(exerciseId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireRole("trainer");
  const values = readExercise(formData);
  if (!isUuid(exerciseId) || !values.name) return { error: "Geef de oefening een naam." };

  const supabase = await createClient();
  // RLS: enkel eigen oefeningen (created_by = jij) kunnen aangepast worden.
  const { data, error } = await supabase.from("exercises").update(values).eq("id", exerciseId).select("id");
  if (error) return { error: explain(error.code, error.message) };
  if (!data.length) return { error: "Deze oefening is niet van jou en kan je niet aanpassen." };
  revalidatePath("/trainer", "layout");
  return { success: "Opgeslagen." };
}

export async function deleteExercise(exerciseId: string): Promise<ActionState> {
  await requireRole("trainer");
  if (!isUuid(exerciseId)) return { error: "Onbekende oefening." };
  const supabase = await createClient();
  const { error } = await supabase.from("exercises").delete().eq("id", exerciseId);
  if (error) return { error: explain(error.code, error.message) };
  revalidatePath("/trainer/exercises");
  return { success: "Verwijderd." };
}
