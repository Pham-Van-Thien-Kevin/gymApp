"use client";
// Client Component: useActionState toont de bevestiging of fout van de Server
// Action, en `key` op de velden zorgt dat ze opnieuw vullen bij een andere week.
import { useActionState, useState } from "react";
import { Field, FormMessage, SelectField, TextareaField } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { RatingField } from "@/components/rating";
import { formatWeek } from "@/lib/dates";
import type { Checkin } from "@/lib/types";
import { saveCheckin } from "./actions";

export function CheckinForm({ weeks, existing }: { weeks: string[]; existing: Record<string, Checkin> }) {
  const [state, formAction] = useActionState(saveCheckin, null);
  const [week, setWeek] = useState(weeks[0]);
  const current = existing[week];

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <SelectField label="Week" name="week_start" value={week} onChange={(event) => setWeek(event.target.value)}>
        {weeks.map((weekStart, index) => (
          <option key={weekStart} value={weekStart}>
            {index === 0 ? "Deze week" : "Vorige week"} ({formatWeek(weekStart)}){existing[weekStart] ? " · ingevuld" : ""}
          </option>
        ))}
      </SelectField>

      {/* key={week}: React maakt de velden opnieuw aan, zodat defaultValue de waarden van die week toont. */}
      <div key={week} className="flex flex-col gap-6">
        <RatingField name="training" legend="Training" defaultValue={current?.training} />
        <RatingField name="motivation" legend="Motivatie" defaultValue={current?.motivation} />
        <RatingField name="pain" legend="Pijn / klachten" defaultValue={current?.pain} />
        <Field
          label="Cijfer voor deze week (1-10)"
          name="score"
          type="number"
          inputMode="numeric"
          min={1}
          max={10}
          required
          defaultValue={current?.score ?? ""}
          error={state?.fieldErrors?.score}
          className="max-w-48"
        />
        <TextareaField
          label="Opmerking of feedback"
          name="feedback"
          defaultValue={current?.feedback ?? ""}
          placeholder="Hoe ging het? Iets dat je trainer moet weten?"
        />
      </div>

      <FormMessage state={state} />
      <SubmitButton size="lg" pendingLabel="Opslaan…">
        {current ? "Check-in bijwerken" : "Check-in opslaan"}
      </SubmitButton>
    </form>
  );
}
