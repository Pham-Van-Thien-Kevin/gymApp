"use server";
// Server Actions van het trainerdashboard. Telkens eerst requireRole("trainer"):
// een member die deze endpoints rechtstreeks aanroept, wordt doorgestuurd.
// Daarna beschermt RLS nog eens dat het om een eigen cliënt gaat.
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { addDays, isValidISODate, startOfWeek, todayISO } from "@/lib/dates";
import { inRange, isUuid, parseDecimal, parseInteger, text } from "@/lib/parse";
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

/** Een training van een cliënt op een andere dag zetten (gepland of al gelogd). */
export async function moveWorkout(workoutId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireRole("trainer");
  const date = String(formData.get("date") ?? "");
  if (!isUuid(workoutId)) return { error: "Onbekende training." };
  if (!isValidISODate(date)) return { error: "Kies een geldige datum." };

  const supabase = await createClient();
  // move_workout controleert dat het om een eigen cliënt gaat en verandert enkel de datum.
  const { error } = await supabase.rpc("move_workout", { p_workout_id: workoutId, p_date: date });
  if (error) return { error: error.message };

  // Ook de app van de cliënt toont de nieuwe datum.
  revalidatePath("/trainer", "layout");
  revalidatePath("/app", "layout");
  return { success: "Datum aangepast." };
}

/** Een blok aanmaken voor een cliënt: "Blok 2" vanaf een maandag, een aantal weken lang. */
export async function createBlock(memberId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireRole("trainer");
  const number = parseInteger(formData.get("number"));
  const weeks = parseInteger(formData.get("weeks"));
  const date = String(formData.get("start_date") ?? "");
  if (!isUuid(memberId)) return { error: "Onbekende cliënt." };
  if (!inRange(number, 1, 99)) return { error: "Kies een bloknummer van 1 tot 99." };
  if (!inRange(weeks, 1, 16)) return { error: "Een blok duurt 1 tot 16 weken." };
  if (!isValidISODate(date)) return { error: "Kies een geldige startdatum." };
  // Een blokweek loopt van maandag tot zondag: kies je een woensdag, dan start het blok op die maandag.
  const start = startOfWeek(date);

  const supabase = await createClient();
  const { data: existing, error: loadError } = await supabase.from("training_blocks").select("number, start_date, weeks").eq("member_id", memberId);
  if (loadError) return { error: `Blokken laden lukte niet: ${loadError.message}` };
  // Twee blokken mogen niet overlappen, anders weet de app niet bij welk blok een training hoort.
  const end = addDays(start, weeks * 7);
  const overlap = existing.find((block) => start < addDays(block.start_date, block.weeks * 7) && block.start_date < end);
  if (overlap) return { error: `Dit blok overlapt met Blok ${overlap.number}. Kies een latere startdatum of minder weken.` };

  // RLS ("training_blocks: trainer schrijft") weigert als dit niet je eigen cliënt is.
  const { error } = await supabase.from("training_blocks").insert({ member_id: memberId, number, start_date: start, weeks });
  if (error) {
    // 23505 = unique_violation: dit bloknummer bestaat al bij deze cliënt.
    if (error.code === "23505") return { error: `Blok ${number} bestaat al. Kies een ander nummer.` };
    return { error: `Opslaan lukte niet: ${error.message}` };
  }

  revalidatePath(`/trainer/clients/${memberId}`);
  return { success: `Blok ${number} aangemaakt (${weeks} ${weeks === 1 ? "week" : "weken"}).` };
}

// Past ook in een ActionForm: een functie met minder parameters mag je doorgeven waar er meer verwacht worden.
export async function deleteBlock(memberId: string, blockId: string): Promise<ActionState> {
  await requireRole("trainer");
  if (!isUuid(memberId) || !isUuid(blockId)) return { error: "Onbekend blok." };
  const supabase = await createClient();
  // Enkel het blok verdwijnt; de trainingen blijven en tonen weer hun maand.
  const { error } = await supabase.from("training_blocks").delete().eq("id", blockId).eq("member_id", memberId);
  if (error) return { error: `Verwijderen lukte niet: ${error.message}` };
  revalidatePath(`/trainer/clients/${memberId}`);
  return { success: "Blok verwijderd." };
}

/**
 * Voorgestelde gewichten van de coach voor een geplande sessie. Het formulier
 * heeft per oefening een veld "weight-<workout_exercise_id>"; leeg = geen
 * gewicht van de coach (de app rekent dan zelf een voorstel uit).
 */
export async function setCoachWeights(workoutId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireRole("trainer");
  if (!isUuid(workoutId)) return { error: "Onbekende training." };

  const weights: Record<string, number | null> = {};
  for (const [name, value] of formData.entries()) {
    const id = name.startsWith("weight-") ? name.slice("weight-".length) : null;
    if (!isUuid(id)) continue;
    const raw = String(value).trim();
    const weight = parseDecimal(raw);
    if (raw && !inRange(weight, 0, 999)) return { error: `"${raw}" is geen geldig gewicht. Typ bv. 82,5.` };
    weights[id] = raw ? weight : null;
  }

  const supabase = await createClient();
  // set_coach_weights controleert dat het een geplande sessie van een eigen cliënt is.
  const { error } = await supabase.rpc("set_coach_weights", { p_workout_id: workoutId, p_weights: weights });
  if (error) return { error: error.message };

  revalidatePath("/trainer", "layout");
  revalidatePath("/app", "layout");
  return { success: "Gewichten opgeslagen. Je cliënt ziet ze in de logger." };
}
