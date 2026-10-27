// Server Component: een schema per dag, alleen-lezen. Gebruikt door de member
// (/app/schema) en de trainer (cliëntdetail).
import type { ReactNode } from "react";
import { Card } from "@/components/ui/layout";
import { formatTarget, weekdayLabel } from "@/lib/program";
import { formatNumber } from "@/lib/stats";
import type { ProgramDay } from "@/lib/types";

export function ProgramView({
  days,
  dayAction,
  loads = {},
}: {
  days: ProgramDay[];
  dayAction?: (day: ProgramDay) => ReactNode;
  /** Voorgesteld gewicht per program_exercise.id (zie getProgramLoads). */
  loads?: Record<string, number>;
}) {
  if (days.length === 0) return <p className="text-chalk/60">Dit schema heeft nog geen dagen.</p>;

  return (
    <ol className="grid gap-4 lg:grid-cols-2">
      {days.map((day, index) => (
        <li key={day.id}>
          <Card className="h-full">
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="text-lg font-bold">{day.name}</h3>
              <p className="shrink-0 text-sm text-chalk/60">{weekdayLabel(day.weekday) ?? `Dag ${index + 1}`}</p>
            </div>
            {day.program_exercises.length === 0 ? (
              <p className="mt-3 text-sm text-chalk/60">Nog geen oefeningen.</p>
            ) : (
              <ol className="mt-3 divide-y divide-chalk/10 border-t border-chalk/10">
                {day.program_exercises.map((exercise) => (
                  <li key={exercise.id} className="py-2">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="font-medium">
                        {exercise.exercise?.name ?? "Onbekende oefening"}
                        {exercise.optional && <span className="ml-2 text-sm text-chalk/60">(optioneel)</span>}
                      </span>
                      <span className="shrink-0 text-right text-sm tabular-nums text-chalk/70">
                        {formatTarget(exercise)}
                        {loads[exercise.id] !== undefined && (
                          <span className="block font-semibold text-chalk sm:ml-2 sm:inline">{formatNumber(loads[exercise.id], 2)} kg</span>
                        )}
                      </span>
                    </div>
                    {exercise.notes && <p className="mt-0.5 text-sm text-chalk/60">{exercise.notes}</p>}
                  </li>
                ))}
              </ol>
            )}
            {dayAction && <div className="mt-4">{dayAction(day)}</div>}
          </Card>
        </li>
      ))}
    </ol>
  );
}
