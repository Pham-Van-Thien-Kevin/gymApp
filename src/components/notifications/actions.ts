"use server";
// Server Action: al je meldingen als gelezen markeren. Werkt voor members én
// trainers; RLS en de kolomrechten (enkel read_at) beperken het tot je eigen rijen.
import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function markAllNotificationsRead() {
  const profile = await getCurrentProfile();
  if (!profile) return;
  const supabase = await createClient();
  await supabase.from("notifications").update({ read_at: new Date().toISOString() }).is("read_at", null);
  // De bel in de layout toont nu 0: de layout opnieuw renderen.
  revalidatePath("/", "layout");
}
