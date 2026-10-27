"use client";
// Client Component: vraagt eerst om bevestiging (confirm()) in de browser
// voordat de Server Action de training echt verwijdert.
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { deleteWorkout } from "../actions";

export function DeleteWorkoutButton({ workoutId }: { workoutId: string }) {
  const [isPending, startTransition] = useTransition();
  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={isPending}
      onClick={() => {
        if (!window.confirm("Deze training definitief verwijderen?")) return;
        startTransition(() => deleteWorkout(workoutId));
      }}
    >
      {isPending ? "Verwijderen…" : "Verwijderen"}
    </Button>
  );
}
