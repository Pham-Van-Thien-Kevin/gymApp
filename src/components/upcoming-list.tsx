// Server Component: de komende trainingen van een cliënt, uit twee bronnen in
// één lijst op datum: geplande sessies uit de geïmporteerde sheet en de dagen
// van het toegewezen schema (uitgerekend op hun weekdag).
import Link from "next/link";
import { Badge, EmptyState } from "@/components/ui/layout";
import { placeInBlock, type BlockRange } from "@/lib/blocks";
import { formatDate, relativeDays } from "@/lib/dates";
import { formatRpeTarget, type UpcomingProgramDay } from "@/lib/program";
import type { WorkoutListItem } from "@/lib/types";

type Row =
  | { key: string; date: string; source: "sheet"; title: string; detail: string; href: string }
  | { key: string; date: string; source: "schema"; title: string; detail: string };

export function UpcomingList({
  planned,
  programDays,
  hrefBase,
  blocks = [],
}: {
  planned: WorkoutListItem[];
  programDays: UpcomingProgramDay[];
  hrefBase: string;
  /** Blokken van de trainer: bij elke training staat in welk blok en welke week ze valt. */
  blocks?: BlockRange[];
}) {
  const rows: Row[] = [
    ...planned.map((workout) => ({
      key: workout.id,
      date: workout.date,
      source: "sheet" as const,
      title: workout.title ?? "Training",
      detail: `${workout.exercise_count} oefeningen`,
      href: `${hrefBase}/${workout.id}`,
    })),
    ...programDays.map((upcoming) => ({
      key: `${upcoming.day.id}-${upcoming.date}`,
      date: upcoming.date,
      source: "schema" as const,
      title: upcoming.day.name,
      detail: `${upcoming.day.program_exercises.length} oefeningen${upcoming.rpe !== null ? ` · RPE ${formatRpeTarget(upcoming.rpe)}` : ""}`,
    })),
  ].sort((a, b) => a.date.localeCompare(b.date));

  if (rows.length === 0) return <EmptyState title="Geen komende trainingen">Geen geplande sessies uit de sheet en geen schemadagen met een vaste weekdag.</EmptyState>;

  return (
    <ul className="divide-y divide-chalk/15 border-y border-chalk/15">
      {rows.map((row) => {
        const content = (
          <>
            <div className="w-14 shrink-0 text-center">
              <p className="text-2xl font-bold leading-none tabular-nums">{formatDate(row.date, { day: "numeric" })}</p>
              <p className="text-xs uppercase text-chalk/60">{formatDate(row.date, { weekday: "short" })}</p>
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold group-hover:underline">{row.title}</p>
              <p className="text-sm text-chalk/60">
                {blockLabel(row.date, blocks)}
                {row.detail} · {relativeDays(row.date)}
              </p>
            </div>
            <Badge>{row.source === "sheet" ? "Sheet" : "Schema"}</Badge>
          </>
        );
        return (
          <li key={row.key}>
            {/* Enkel een sessie uit de sheet bestaat al als training; een schemadag is nog maar een plan. */}
            {row.source === "sheet" ? (
              <Link href={row.href} className="group flex min-h-16 items-center gap-4 py-3 hover:bg-chalk/5 sm:px-2">
                {content}
                <span aria-hidden="true" className="text-chalk/40 group-hover:text-chalk">
                  →
                </span>
              </Link>
            ) : (
              <div className="flex min-h-16 items-center gap-4 py-3 sm:px-2">{content}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** "Blok 2 · Week 1 · " als de datum in een blok valt, anders niets. */
function blockLabel(date: string, blocks: BlockRange[]) {
  const place = placeInBlock(date, blocks);
  return place ? `Blok ${place.block} · Week ${place.week} · ` : "";
}
