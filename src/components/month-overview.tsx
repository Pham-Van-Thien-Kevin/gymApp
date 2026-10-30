// Server Component: per maand hoeveel sessies je per week deed, zoals een coach
// het bekijkt ("week 3: 3/4"). Zelfde maanden en weken als in de sheet (zie
// src/lib/blocks.ts). Gemiste sessies tellen mee in het totaal; inhalen kan niet.
import { formatDate } from "@/lib/dates";
import type { MonthSummary, WeekSummary } from "@/lib/blocks";
import { cn } from "@/lib/cn";

export function MonthOverview({
  months,
  shiftAction,
}: {
  months: MonthSummary[];
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
              <WeekCell key={week.week} week={week} />
            ))}
          </ol>
          {shiftAction && month.importTab && (
            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              <span className="text-chalk/60">Begon week 1 in je sheet op een andere maandag?</span>
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

function WeekCell({ week }: { week: WeekSummary }) {
  const missed = !week.current && !week.future ? week.total - week.done : 0;
  const status = week.future ? "komt nog" : week.current ? "deze week" : missed > 0 ? `${missed} gemist` : "volledig";
  return (
    <li className={cn("rounded-lg border p-3", week.current ? "border-accent" : "border-chalk/15")}>
      <p className="text-sm text-chalk/60">Week {week.week}</p>
      <p className="text-xl font-bold tabular-nums">
        {week.done}
        <span className="text-base font-normal text-chalk/60"> / {week.total}</span>
      </p>
      {/* Balk = versiering; de tekst erboven en eronder zegt alles. */}
      <span aria-hidden="true" className="mt-2 block h-1.5 overflow-hidden rounded-full bg-chalk/15">
        <span className="block h-full rounded-full bg-accent" style={{ width: `${week.total ? (week.done / week.total) * 100 : 0}%` }} />
      </span>
      <p className={cn("mt-1 text-xs", missed > 0 ? "font-semibold" : "text-chalk/60")}>{status}</p>
    </li>
  );
}

const monthLabel = (month: MonthSummary) =>
  formatDate(`${month.year}-${String(month.month + 1).padStart(2, "0")}-01`, { month: "long", year: "numeric" });

const sum = (weeks: WeekSummary[], key: "done" | "total") => weeks.reduce((total, week) => total + week[key], 0);
