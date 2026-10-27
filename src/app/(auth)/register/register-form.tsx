"use client";
// Client Component: de keuze sporter/trainer bepaalt live of het veld voor de
// uitnodigingscode zichtbaar is. Daarvoor is state in de browser nodig.
import { useActionState, useState } from "react";
import { signUp } from "../actions";
import { Field, FormMessage } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { cn } from "@/lib/cn";

export function RegisterForm() {
  const [state, formAction] = useActionState(signUp, null);
  const [role, setRole] = useState<"member" | "trainer">("member");

  if (state?.success) {
    return <FormMessage state={state} />;
  }

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <fieldset>
        <legend className="label">Ik ben</legend>
        <div className="grid grid-cols-2 border border-chalk/30">
          {(["member", "trainer"] as const).map((option) => (
            <label
              key={option}
              className={cn(
                "flex min-h-12 cursor-pointer items-center justify-center font-semibold has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-lime",
                role === option ? "bg-lime text-ink" : "text-chalk/80 hover:bg-chalk/10",
              )}
            >
              <input
                type="radio"
                name="role"
                value={option}
                checked={role === option}
                onChange={() => setRole(option)}
                className="sr-only"
              />
              {option === "member" ? "Sporter" : "Trainer"}
            </label>
          ))}
        </div>
      </fieldset>

      <Field
        label="Naam"
        name="full_name"
        autoComplete="name"
        required
        defaultValue={state?.values?.full_name}
        error={state?.fieldErrors?.full_name}
      />
      <Field
        label="E-mailadres"
        name="email"
        type="email"
        autoComplete="email"
        required
        defaultValue={state?.values?.email}
        error={state?.fieldErrors?.email}
      />
      <Field
        label="Wachtwoord"
        name="password"
        type="password"
        autoComplete="new-password"
        minLength={8}
        required
        hint="Minstens 8 tekens."
        error={state?.fieldErrors?.password}
      />
      {role === "member" && (
        <Field
          label="Uitnodigingscode van je trainer (optioneel)"
          name="invite_code"
          autoComplete="off"
          autoCapitalize="characters"
          maxLength={12}
          defaultValue={state?.values?.invite_code}
          hint="Je kan later ook koppelen via Profiel."
        />
      )}
      <FormMessage state={state} />
      <SubmitButton size="lg" pendingLabel="Account maken…">
        Account maken
      </SubmitButton>
    </form>
  );
}
