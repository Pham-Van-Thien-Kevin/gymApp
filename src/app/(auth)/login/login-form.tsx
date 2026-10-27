"use client";
// Client Component: useActionState houdt het antwoord van de Server Action bij
// (bv. "wachtwoord klopt niet") zonder dat de pagina herlaadt.
import { useActionState } from "react";
import { signIn } from "../actions";
import { Field, FormMessage } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";

export function LoginForm({ next, initialError }: { next: string; initialError?: string }) {
  const [state, formAction] = useActionState(signIn, initialError ? { error: initialError } : null);

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <input type="hidden" name="next" value={next} />
      <Field label="E-mailadres" name="email" type="email" autoComplete="email" required defaultValue={state?.values?.email} />
      <Field label="Wachtwoord" name="password" type="password" autoComplete="current-password" required />
      <FormMessage state={state} />
      <SubmitButton size="lg" pendingLabel="Inloggen…">
        Inloggen
      </SubmitButton>
    </form>
  );
}
