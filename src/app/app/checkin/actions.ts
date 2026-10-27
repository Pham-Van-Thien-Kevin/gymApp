"use server";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { addDays, startOfWeek, todayISO } from "@/lib/dates";
import { inRange, parseInteger, text } from "@/lib/parse";
import { createClient } from "@/lib/supabase/server";
import { RATINGS, type Rating } from "@/lib/types";
import type { ActionState } from "@/components/ui/form";

const isRating = (value: unknown): value is Rating => RATINGS.includes(value as Rating);

export async function saveCheckin(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const profile = await requireRole("member");

  // Enkel deze of vorige week: een check-in is een terugblik op een week.
  const thisWeek = startOfWeek(todayISO());
  const weekStart = String(formData.get("week_start"));
  if (weekStart !== thisWeek && weekStart !== addDays(thisWeek, -7)) return { error: "Kies deze of vorige week." };

  const training = formData.get("training");
  const motivation = formData.get("motivation");
  const pain = formData.get("pain");
  if (!isRating(training) || !isRating(motivation) || !isRating(pain)) {
    return { error: "Kies voor training, motivatie en pijn/klachten een score." };
  }
  const score = parseInteger(formData.get("score"));
  if (!inRange(score, 1, 10)) return { fieldErrors: { score: "Geef een cijfer van 1 tot 10." } };

  const supabase = await createClient();
  // upsert = insert, of update als er voor die week al een check-in is
  // (unique (member_id, week_start) in de database).
  const { error } = await supabase.from("weekly_checkins").upsert(
    {
      member_id: profile.id,
      week_start: weekStart,
      training,
      motivation,
      pain,
      score,
      feedback: text(formData.get("feedback"), 2000) || null,
    },
    { onConflict: "member_id,week_start" },
  );
  if (error) return { error: `Opslaan lukte niet: ${error.message}` };

  revalidatePath("/app", "layout");
  return { success: "Check-in opgeslagen. Je trainer ziet ze in het dashboard." };
}
