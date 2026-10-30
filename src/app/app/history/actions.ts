"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { isUuid } from "@/lib/parse";
import { createClient } from "@/lib/supabase/server";

export async function deleteWorkout(workoutId: string) {
  const profile = await requireRole("member");
  if (!isUuid(workoutId)) return;

  const supabase = await createClient();
  // RLS laat enkel eigen trainingen verwijderen; de extra .eq() maakt de
  // bedoeling ook in de code expliciet. Oefeningen, sets en cardio gaan mee
  // dankzij "on delete cascade".
  await supabase.from("workouts").delete().eq("id", workoutId).eq("member_id", profile.id);

  revalidatePath("/app", "layout");
  redirect("/app/history");
}

/**
 * Een geïmporteerde maand een week later of vroeger zetten, als week 1 in je
 * sheet niet op de eerste maandag van de maand begon. Alles van die maandtab
 * schuift mee, in één transactie (zie shift_import_block in schema.sql).
 */
export async function shiftMonth(sheetTab: string, days: number) {
  await requireRole("member");
  if (!/^[A-Z]{3}\d{4}$/.test(sheetTab) || (days !== 7 && days !== -7)) return;
  const supabase = await createClient();
  await supabase.rpc("shift_import_block", { p_sheet_tab: sheetTab, p_days: days });
  revalidatePath("/app", "layout");
}
