// Server Component: waar zit je in het blok? Elke week met haar RPE, de week
// van vandaag in de accentkleur. Gebruikt op het schema (sporter) en bij de
// cliënt (trainer).
import { blockRpe, formatRpeTarget } from "@/lib/program";
import { cn } from "@/lib/cn";
import type { ActiveAssignment } from "@/lib/types";

export function BlockProgress({ assignment }: { assignment: ActiveAssignment }) {
  const { block, program } = assignment;
  if (!block) return null;
  const settings = { block_weeks: Number(program.block_weeks), rpe_start: Number(program.rpe_start), rpe_end: Number(program.rpe_end) };
  return (
    <section aria-label="Blokopbouw" className="mb-6 rounded-xl border border-chalk/15 p-4">
      <p className="font-semibold">
        {block.finished ? (
          <>Blok voltooid · vraag je trainer om een nieuw schema</>
        ) : (
          <>
            Week {block.week} van {block.weeks} · deze week <span className="text-accent">RPE {formatRpeTarget(block.rpe)}</span>
          </>
        )}
      </p>
      <ol className="mt-3 grid gap-2" style={{ gridTemplateColumns: `repeat(${block.weeks}, minmax(0, 1fr))` }}>
        {Array.from({ length: block.weeks }, (_, i) => i + 1).map((week) => {
          const current = week === block.week && !block.finished;
          return (
            <li
              key={week}
              aria-current={current ? "step" : undefined}
              className={cn(
                "rounded-lg border px-2 py-2 text-center text-sm tabular-nums",
                current ? "border-accent bg-lime font-semibold text-on-lime" : week < block.week || block.finished ? "border-chalk/15 text-chalk/50" : "border-chalk/15",
              )}
            >
              <span className="block text-xs">W{week}</span>
              RPE {formatRpeTarget(blockRpe(settings, week) ?? 0)}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
