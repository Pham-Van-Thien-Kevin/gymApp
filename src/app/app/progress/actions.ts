"use server";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { isValidISODate, todayISO } from "@/lib/dates";
import { inRange, parseDecimal, text } from "@/lib/parse";
import { createClient } from "@/lib/supabase/server";
import type { ActionState } from "@/components/ui/form";

export async function addBodyWeight(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const profile = await requireRole("member");
  const weight = parseDecimal(formData.get("weight"));
  const date = String(formData.get("date") || todayISO());
  if (!inRange(weight, 20, 400)) return { fieldErrors: { weight: "Vul een gewicht tussen 20 en 400 kg in." } };
  if (!isValidISODate(date) || date > todayISO()) return { fieldErrors: { date: "Kies een geldige datum (niet in de toekomst)." } };

  const supabase = await createClient();
  // Eén meting per dag: een tweede meting op dezelfde dag overschrijft de eerste.
  const { error } = await supabase
    .from("body_metrics")
    .upsert({ member_id: profile.id, date, weight }, { onConflict: "member_id,date" });
  if (error) return { error: error.message };

  revalidatePath("/app/progress");
  return { success: "Gewicht opgeslagen." };
}

export async function addStrengthTest(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const profile = await requireRole("member");
  const label = text(formData.get("label"), 40);
  const testedOn = String(formData.get("tested_on") || "");
  const lifts = {
    squat: formData.get("squat") ? parseDecimal(formData.get("squat")) : null,
    bench: formData.get("bench") ? parseDecimal(formData.get("bench")) : null,
    deadlift: formData.get("deadlift") ? parseDecimal(formData.get("deadlift")) : null,
  };
  if (!label) return { fieldErrors: { label: "Geef het blok een naam, bv. Blok 3." } };
  for (const [lift, value] of Object.entries(lifts)) {
    if (formData.get(lift) && !inRange(value, 0, 1000)) return { fieldErrors: { [lift]: "Ongeldig gewicht." } };
  }
  if (Object.values(lifts).every((value) => value === null)) return { error: "Vul minstens één max in." };
  if (testedOn && !isValidISODate(testedOn)) return { fieldErrors: { tested_on: "Ongeldige datum." } };

  const supabase = await createClient();
  const { error } = await supabase
    .from("strength_tests")
    .insert({ member_id: profile.id, label, ...lifts, tested_on: testedOn || null });
  if (error) return { error: error.message };

  revalidatePath("/app/progress");
  return { success: `${label} toegevoegd.` };
}
