// Server Component: een lijst trainingen als links. Gebruikt door de
// historiek (member) en de cliëntdetailpagina (trainer), met een eigen hrefBase.
import Link from "next/link";
import { Badge, EmptyState } from "@/components/ui/layout";
import { plannedState } from "@/lib/blocks";
import { formatDate, relativeDays, startOfWeek, todayISO } from "@/lib/dates";
import type { WorkoutListItem } from "@/lib/types";

export function WorkoutList({
  workouts,
  hrefBase,
  emptyText = "Nog geen trainingen gelogd.",
}: {
  workouts: WorkoutListItem[];
  hrefBase: string;
  emptyText?: string;
}) {
  if (workouts.length === 0) return <EmptyState title={emptyText} />;
  const today = todayISO();

  return (
    <ul className="divide-y divide-chalk/15 border-y border-chalk/15">
      {workouts.map((workout) => (
        <li key={workout.id}>
          <Link
            href={`${hrefBase}/${workout.id}`}
            className="group flex min-h-16 items-center gap-4 py-3 hover:bg-chalk/5 sm:px-2"
          >
            <div className="w-14 shrink-0 text-center">
              <p className="text-2xl font-bold leading-none tabular-nums">{formatDate(workout.date, { day: "numeric" })}</p>
              <p className="text-xs uppercase text-chalk/60">{formatDate(workout.date, { month: "short" })}</p>
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold group-hover:underline">{workout.title ?? "Training"}</p>
              <p className="text-sm text-chalk/60">
                {workout.exercise_count} oefeningen
                {workout.duration_minutes ? ` · ${workout.duration_minutes} min` : ""} · {relativeDays(workout.date)}
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap justify-end gap-1">
              {workout.status === "planned" && <Badge>{plannedLabel(workout.date, today)}</Badge>}
              {workout.import_batch_id && <Badge>Import</Badge>}
              {workout.feedback_count > 0 && <Badge strong>Feedback</Badge>}
            </div>
            <span aria-hidden="true" className="text-chalk/40 group-hover:text-chalk">
              →
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** Badge voor een geplande sessie: gemist, gepland (deze week) of op slot tot maandag. */
function plannedLabel(date: string, today: string) {
  const state = plannedState(date, today);
  if (state === "missed") return "Gemist";
  if (state === "open") return "Gepland";
  return `Vanaf ${formatDate(startOfWeek(date), { weekday: "short", day: "numeric", month: "short" })}`;
}
