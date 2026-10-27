"use client";
// Client Component: useFormStatus is een React-hook die in de browser bijhoudt
// of het omringende <form> nog aan het versturen is.
import { useFormStatus } from "react-dom";
import { Button } from "./button";
import type { ComponentProps } from "react";

type Props = ComponentProps<typeof Button> & { pendingLabel?: string };

export function SubmitButton({ children, pendingLabel = "Bezig…", disabled, ...props }: Props) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || disabled} aria-disabled={pending || disabled} {...props}>
      {pending ? pendingLabel : children}
    </Button>
  );
}
