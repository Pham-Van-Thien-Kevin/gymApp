"use server";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { text } from "@/lib/parse";
import { createClient } from "@/lib/supabase/server";
import type { ActionState } from "@/components/ui/form";

export async function updateName(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const profile = await requireRole("member");
  const fullName = text(formData.get("full_name"), 80);
  if (!fullName) return { fieldErrors: { full_name: "Vul je naam in." } };

  const supabase = await createClient();
  // Enkel full_name: de kolomrechten in schema.sql laten niets anders toe.
  const { error } = await supabase.from("profiles").update({ full_name: fullName }).eq("id", profile.id);
  if (error) return { error: error.message };

  revalidatePath("/app", "layout");
  return { success: "Naam opgeslagen." };
}

export async function joinTrainer(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireRole("member");
  const code = text(formData.get("invite_code"), 12).toUpperCase();
  if (!code) return { fieldErrors: { invite_code: "Vul de code van je trainer in." } };

  const supabase = await createClient();
  // RPC: de databasefunctie zoekt de trainer en koppelt je (zie join_trainer in schema.sql).
  const { error } = await supabase.rpc("join_trainer", { code });
  if (error) {
    return { fieldErrors: { invite_code: error.code === "P0002" ? "Deze code bestaat niet." : error.message } };
  }

  revalidatePath("/app", "layout");
  return { success: "Gekoppeld! Je trainer ziet nu je trainingen." };
}

export async function leaveTrainer() {
  await requireRole("member");
  const supabase = await createClient();
  await supabase.rpc("leave_trainer");
  revalidatePath("/app", "layout");
}
