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
