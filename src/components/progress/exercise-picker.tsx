"use client";
// Client Component: bij het kiezen van een oefening passen we de URL aan
// (?exercise=...). De Server Component leest die en haalt nieuwe data op.
// Zo is elke grafiek ook een deelbare link.
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

export function ExercisePicker({ options, selectedId }: { options: { id: string; name: string; count: number }[]; selectedId: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex items-center gap-3">
      <label htmlFor="exercise-picker" className="sr-only">
        Oefening
      </label>
      <select
        id="exercise-picker"
        className="field max-w-sm"
        value={selectedId}
        onChange={(event) => {
          const params = new URLSearchParams(searchParams);
          params.set("exercise", event.target.value);
          startTransition(() => router.replace(`${pathname}?${params}`, { scroll: false }));
        }}
      >
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name} ({option.count}×)
          </option>
        ))}
      </select>
      {isPending && (
        <span role="status" className="text-sm text-chalk/60">
          Laden…
        </span>
      )}
    </div>
  );
}
