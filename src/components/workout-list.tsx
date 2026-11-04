// Server Component: een lijst trainingen als links. Gebruikt door de
// historiek (member) en de cliëntdetailpagina (trainer), met een eigen hrefBase.
import Link from "next/link";
import { Badge, EmptyState } from "@/components/ui/layout";
import { groupByBlockWeek, isExpiredBlock } from "@/lib/blocks";
import { formatDate, relativeDays } from "@/lib/dates";
import type { WorkoutListItem } from "@/lib/types";

export function WorkoutList({
  workouts,
  hrefBase,
  emptyText = "Nog geen trainingen gelogd.",
  currentBlock = null,
  byWeek = false,
}: {
  workouts: WorkoutListItem[];
  hrefBase: string;
  emptyText?: string;
  /** Je huidige blok: geplande sessies uit een ouder blok tonen we als "Verlopen". */
  currentBlock?: string | null;
  /** Opdelen per blokweek uit de sheet ("Augustus 2026 · Week 4"), zoals de trainer het plant. */
  byWeek?: boolean;
}) {
  if (workouts.length === 0) return <EmptyState title={emptyText} />;

  if (!byWeek) return <Rows workouts={workouts} hrefBase={hrefBase} currentBlock={currentBlock} />;

  // groupByBlockWeek verwacht sheetTab (zoals in blocks.ts); de lijst heeft sheet_tab uit de database.
  const weeks = groupByBlockWeek(workouts.map((workout) => ({ ...workout, sheetTab: workout.sheet_tab })));
  return (
    <div className="flex flex-col gap-6">
      {weeks.map((week) => {
        const monthName = formatDate(`${week.year}-${String(week.month + 1).padStart(2, "0")}-01`, { month: "long", year: "numeric" });
        const done = week.items.filter((workout) => workout.status === "completed").length;
        return (
          <section key={week.key} aria-label={`${monthName}, week ${week.week}`}>
            <h3 className="mb-2 flex items-baseline justify-between gap-3 text-sm">
              <span className="font-semibold">
                <span className="capitalize">{monthName}</span> · Week {week.week}
              </span>
              <span className="text-chalk/60 tabular-nums">
                {done}/{week.items.length} gedaan
              </span>
            </h3>
            <Rows workouts={week.items} hrefBase={hrefBase} currentBlock={currentBlock} />
          </section>
        );
      })}
    </div>
  );
}

function Rows({ workouts, hrefBase, currentBlock }: { workouts: WorkoutListItem[]; hrefBase: string; currentBlock: string | null }) {
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
              {workout.status === "planned" && <Badge>{isExpiredBlock(workout.sheet_tab, currentBlock) ? "Verlopen" : "Nog te doen"}</Badge>}
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
