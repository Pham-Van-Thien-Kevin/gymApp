"use client";
// Client Component: bij het kiezen van een oefening passen we de URL aan
// (?exercise=...). De Server Component leest die en haalt nieuwe data op.
// Zo is elke grafiek ook een deelbare link.
//
// Bovenaan staat (als je ze gelogd hebt) de gecombineerde grafiek van de drie
// wedstrijdlifts, met ?exercise=sbd (BIG_THREE_VIEW) in de URL.
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { BIG_THREE_VIEW } from "@/lib/exercises";

export function ExercisePicker({
  options,
  selectedId,
  showBigThree,
}: {
  options: { id: string; name: string; count: number }[];
  selectedId: string;
  showBigThree: boolean;
}) {
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
        {showBigThree && <option value={BIG_THREE_VIEW}>Squat · bench · deadlift</option>}
        {/* optgroup = een kopje in de lijst; zonder de gecombineerde optie is het overbodig. */}
        {showBigThree ? <optgroup label="Per oefening">{renderOptions(options)}</optgroup> : renderOptions(options)}
      </select>
      {isPending && (
        <span role="status" className="text-sm text-chalk/60">
          Laden…
        </span>
      )}
    </div>
  );
}

function renderOptions(options: { id: string; name: string; count: number }[]) {
  return options.map((option) => (
    <option key={option.id} value={option.id}>
      {option.name} ({option.count}×)
    </option>
  ));
}
