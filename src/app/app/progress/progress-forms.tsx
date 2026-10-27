"use client";
// Client Components: kleine formulieren met directe feedback via useActionState.
import { useActionState } from "react";
import { Field, FormMessage } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { addBodyWeight, addStrengthTest } from "./actions";

export function BodyWeightForm({ today }: { today: string }) {
  const [state, formAction] = useActionState(addBodyWeight, null);
  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <Field label="Gewicht (kg)" name="weight" inputMode="decimal" required error={state?.fieldErrors?.weight} />
        <Field label="Datum" name="date" type="date" defaultValue={today} max={today} error={state?.fieldErrors?.date} />
        <SubmitButton variant="secondary" className="col-span-2 sm:col-span-1">
          Opslaan
        </SubmitButton>
      </div>
      <FormMessage state={state} />
    </form>
  );
}

export function StrengthTestForm() {
  const [state, formAction] = useActionState(addStrengthTest, null);
  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5 sm:items-end">
        <Field label="Blok" name="label" placeholder="Blok 3" required error={state?.fieldErrors?.label} className="col-span-2 sm:col-span-1" />
        <Field label="Squat" name="squat" inputMode="decimal" error={state?.fieldErrors?.squat} />
        <Field label="Bench" name="bench" inputMode="decimal" error={state?.fieldErrors?.bench} />
        <Field label="Deadlift" name="deadlift" inputMode="decimal" error={state?.fieldErrors?.deadlift} />
        <Field label="Getest op" name="tested_on" type="date" error={state?.fieldErrors?.tested_on} />
      </div>
      <FormMessage state={state} />
      <SubmitButton variant="secondary" className="self-start">
        Max toevoegen
      </SubmitButton>
    </form>
  );
}
