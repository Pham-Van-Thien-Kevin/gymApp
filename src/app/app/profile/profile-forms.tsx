"use client";
// Client Components: elk formulier toont zijn eigen succes- of foutmelding
// via useActionState, zonder dat de pagina herlaadt.
import { useActionState } from "react";
import { Field, FormMessage } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { joinTrainer, updateName } from "./actions";

export function NameForm({ fullName }: { fullName: string }) {
  const [state, formAction] = useActionState(updateName, null);
  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <Field label="Naam" name="full_name" defaultValue={fullName} required error={state?.fieldErrors?.full_name} className="flex-1" />
        <SubmitButton variant="secondary">Opslaan</SubmitButton>
      </div>
      <FormMessage state={state} />
    </form>
  );
}

export function JoinTrainerForm() {
  const [state, formAction] = useActionState(joinTrainer, null);
  return (
    <form action={formAction} className="flex flex-col gap-3">
      <Field
        label="Uitnodigingscode"
        name="invite_code"
        autoComplete="off"
        autoCapitalize="characters"
        maxLength={12}
        hint="Je trainer vindt deze code in het dashboard."
        error={state?.fieldErrors?.invite_code}
      />
      <FormMessage state={state} />
      <SubmitButton>Koppelen</SubmitButton>
    </form>
  );
}
