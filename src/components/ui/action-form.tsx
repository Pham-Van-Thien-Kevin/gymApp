"use client";
// Client Component: een <form> die een Server Action uitvoert en het resultaat
// (succes of fout) toont. De velden (children) mogen gewoon in een Server
// Component staan; enkel deze wrapper draait in de browser.
import { useActionState, type ReactNode } from "react";
import { FormMessage, type ActionState } from "./form";
import { cn } from "@/lib/cn";

type ServerAction = (state: ActionState, formData: FormData) => Promise<ActionState>;

export function ActionForm({
  action,
  children,
  className,
  confirm,
}: {
  action: ServerAction;
  children: ReactNode;
  className?: string;
  /** Vraag eerst bevestiging, bv. bij verwijderen. */
  confirm?: string;
}) {
  const [state, formAction] = useActionState(action, null);
  return (
    <form
      action={formAction}
      className={cn("flex flex-col gap-3", className)}
      onSubmit={(event) => {
        if (confirm && !window.confirm(confirm)) event.preventDefault();
      }}
    >
      {children}
      <FormMessage state={state} />
    </form>
  );
}
