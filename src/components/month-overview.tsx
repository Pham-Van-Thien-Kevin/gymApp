// Server Component: per maand hoeveel sessies je per week deed, zoals een coach
// het bekijkt ("week 3: 3/4"). Zelfde maanden en weken als in de sheet (zie
// src/lib/blocks.ts). Klik op een week uit je sheet om de sessies te zien en de
// rest af te werken; een blok verloopt pas als je aan een nieuwer blok begint.
import Link from "next/link";
import { isExpiredBlock, type MonthSummary, type WeekSummary } from "@/lib/blocks";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/dates";

export function MonthOverview({
  months,
  shiftAction,
  currentBlock = null,
}: {
  months: MonthSummary[];
  /** Je huidige blok: oudere blokken zijn verlopen. */
  currentBlock?: string | null;
  /** Enkel voor de sporter zelf: een geïmporteerde maand een week opschuiven. */
  shiftAction?: (sheetTab: string, days: number) => Promise<void>;
}) {
  if (months.length === 0) return null;
  return (
    <div className="flex flex-col gap-4">
      {months.map((month) => (
        <section key={month.tab} aria-label={monthLabel(month)} className="rounded-xl border border-chalk/15 p-4 sm:p-5">
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <h3 className="font-semibold capitalize">{monthLabel(month)}</h3>
            <p className="text-sm text-chalk/60 tabular-nums">
              {sum(month.weeks, "done")} / {sum(month.weeks, "total")} sessies
            </p>
          </div>
          <ol className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {month.weeks.map((week) => (
              <WeekCell
                key={week.week}
                week={week}
                // Enkel weken uit je sheet hebben een weekpagina.
                href={month.importTab ? `/app/week?blok=${month.importTab}&week=${week.week}` : null}
                expired={isExpiredBlock(month.importTab, currentBlock)}
              />
            ))}
          </ol>
          {shiftAction && month.importTab && (
            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              <span className="text-chalk/60">Datums van dit blok verschuiven:</span>
              {/* Gewone formulieren met een Server Action: werkt ook zonder JavaScript. */}
              <form action={shiftAction.bind(null, month.importTab, -7)}>
                <button type="submit" className="font-semibold underline underline-offset-4">1 week eerder</button>
              </form>
              <form action={shiftAction.bind(null, month.importTab, 7)}>
                <button type="submit" className="font-semibold underline underline-offset-4">1 week later</button>
              </form>
            </div>
          )}
        </section>
      ))}
    </div>
  );
}

function WeekCell({ week, href, expired }: { week: WeekSummary; href: string | null; expired: boolean }) {
  const open = week.total - week.done;
  const status = open === 0 ? "volledig" : expired ? `${open} niet gedaan` : `${open} nog te doen`;
  const content = (
    <>
      <p className="text-sm text-chalk/60">Week {week.week}</p>
      <p className="text-xl font-bold tabular-nums">
        {week.done}
        <span className="text-base font-normal text-chalk/60"> / {week.total}</span>
      </p>
      {/* Balk = versiering; de tekst erboven en eronder zegt alles. */}
      <span aria-hidden="true" className="mt-2 block h-1.5 overflow-hidden rounded-full bg-chalk/15">
        <span className="block h-full rounded-full bg-accent" style={{ width: `${week.total ? (week.done / week.total) * 100 : 0}%` }} />
      </span>
      <p className={cn("mt-1 text-xs", open > 0 && !expired ? "font-semibold" : "text-chalk/60")}>{status}</p>
    </>
  );
  const box = cn("block rounded-lg border p-3", open > 0 && !expired ? "border-accent" : "border-chalk/15");
  return <li>{href ? <Link href={href} className={cn(box, "hover:border-chalk")} aria-label={`Week ${week.week}: ${week.done} van ${week.total} gedaan, ${status}`}>{content}</Link> : <div className={box}>{content}</div>}</li>;
}

const monthLabel = (month: MonthSummary) =>
  formatDate(`${month.year}-${String(month.month + 1).padStart(2, "0")}-01`, { month: "long", year: "numeric" });

const sum = (weeks: WeekSummary[], key: "done" | "total") => weeks.reduce((total, week) => total + week[key], 0);
