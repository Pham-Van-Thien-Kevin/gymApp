"use server";
// Server Actions van het trainerdashboard. Telkens eerst requireRole("trainer"):
// een member die deze endpoints rechtstreeks aanroept, wordt doorgestuurd.
// Daarna beschermt RLS nog eens dat het om een eigen cliënt gaat.
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { isValidISODate, todayISO } from "@/lib/dates";
import { isUuid, text } from "@/lib/parse";
import { createClient } from "@/lib/supabase/server";
import type { ActionState } from "@/components/ui/form";

export async function regenerateInviteCode(): Promise<void> {
  await requireRole("trainer");
  const supabase = await createClient();
  const { error } = await supabase.rpc("regenerate_invite_code");
  if (error) throw new Error(error.message);
  revalidatePath("/trainer", "layout");
}

export async function assignProgram(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireRole("trainer");
  const memberId = formData.get("member_id");
  const programId = formData.get("program_id");
  const startDate = String(formData.get("start_date") || todayISO());
  if (!isUuid(memberId)) return { error: "Kies een cliënt." };
  if (!isUuid(programId)) return { error: "Kies een schema." };
  if (!isValidISODate(startDate)) return { error: "Ongeldige startdatum." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("assign_program", {
    p_program_id: programId,
    p_member_id: memberId,
    p_start_date: startDate,
  });
  if (error) return { error: `Toewijzen lukte niet: ${error.message}` };

  revalidatePath(`/trainer/clients/${memberId}`);
  revalidatePath("/trainer/programs", "layout");
  return { success: "Schema toegewezen." };
}

export async function addFeedback(workoutId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const trainer = await requireRole("trainer");
  const message = text(formData.get("message"), 2000);
  if (!isUuid(workoutId)) return { error: "Onbekende training." };
  if (!message) return { error: "Schrijf eerst een bericht." };

  const supabase = await createClient();
  // trainer_id = ingelogde trainer; RLS weigert als de training niet van een eigen cliënt is.
  const { error } = await supabase.from("workout_feedback").insert({ workout_id: workoutId, trainer_id: trainer.id, message });
  if (error) return { error: `Opslaan lukte niet: ${error.message}` };

  revalidatePath("/trainer", "layout");
  return { success: "Feedback geplaatst. Je cliënt ziet ze bij deze training." };
}

export async function deleteFeedback(feedbackId: string): Promise<void> {
  const trainer = await requireRole("trainer");
  if (!isUuid(feedbackId)) return;
  const supabase = await createClient();
  await supabase.from("workout_feedback").delete().eq("id", feedbackId).eq("trainer_id", trainer.id);
  revalidatePath("/trainer", "layout");
}
