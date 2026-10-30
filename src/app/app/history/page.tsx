// Server Component: de historiek wordt op de server opgehaald, met paginering
// via de URL (?pagina=2), zodat elke pagina een deelbare link heeft. Bovenaan:
// geplande sessies uit je sheet die je nog kan afwerken, en de export naar Excel.
import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { getPlannedWorkouts, getWorkoutStatuses, getWorkouts } from "@/lib/data";
import { summarizeMonths } from "@/lib/blocks";
import { MonthOverview } from "@/components/month-overview";
import { addDays, formatDate, relativeDays, todayISO } from "@/lib/dates";
import { ButtonLink, buttonClasses } from "@/components/ui/button";
import { EmptyState, PageHeader, Section } from "@/components/ui/layout";
import { WorkoutList } from "@/components/workout-list";

export const metadata: Metadata = { title: "Historiek" };

const PAGE_SIZE = 20;

export default async function HistoryPage({ searchParams }: PageProps<"/app/history">) {
  const profile = await requireRole("member");
  const { pagina } = await searchParams;
  const page = Math.max(1, Number(pagina) || 1);
  const today = todayISO();
  const [{ items, total }, planned, statuses] = await Promise.all([
    getWorkouts(profile.id, { limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE }),
    getPlannedWorkouts(profile.id, today),
    // Twee maanden terug is genoeg voor "deze maand en de vorige".
    getWorkoutStatuses(profile.id, addDays(today, -70)),
  ]);
  const months = summarizeMonths(statuses, today).slice(0, 2);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      <PageHeader
        title="Historiek"
        description={`${total} trainingen`}
        actions={
          total > 0 && (
            // Een gewone <a>: het is een bestand, geen pagina. "download" vraagt de browser het op te slaan.
            <a href="/app/export" download className={buttonClasses("secondary", "sm")}>
              Exporteren (.xlsx)
            </a>
          )
        }
      />
      {page === 1 && months.length > 0 && (
        <Section title="Per maand">
          <MonthOverview months={months} />
        </Section>
      )}
      {page === 1 && planned.total > 0 && (
        <Section title={`Nog af te werken (${planned.total})`}>
          <p className="-mt-2 mb-4 text-sm text-chalk/60">Gepland voor deze week, nog niet gelogd. Een gemiste sessie uit een voorbije week kan je niet meer inhalen; de volgende week gaat maandag om 0:00 open.</p>
          <ul className="divide-y divide-chalk/15 border-y border-chalk/15">
            {planned.items.map((workout) => (
              <li key={workout.id} className="flex min-h-16 items-center gap-4 py-3 sm:px-2">
                <div className="w-14 shrink-0 text-center">
                  <p className="text-2xl font-bold leading-none tabular-nums">{formatDate(workout.date, { day: "numeric" })}</p>
                  <p className="text-xs uppercase text-chalk/60">{formatDate(workout.date, { month: "short" })}</p>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{workout.title ?? "Training"}</p>
                  <p className="text-sm text-chalk/60">
                    {workout.exercise_count} oefeningen · {relativeDays(workout.date)}
                  </p>
                </div>
                <ButtonLink href={`/app/log?gepland=${workout.id}`} size="sm" aria-label={`${workout.title ?? "Training"} afwerken`}>
                  Afwerken
                </ButtonLink>
              </li>
            ))}
          </ul>
          {planned.total > planned.items.length && (
            <p className="mt-3 text-sm text-chalk/60">
              Nog {planned.total - planned.items.length} geplande sessies deze week.
            </p>
          )}
        </Section>
      )}
      {total === 0 ? (
        <EmptyState
          title="Nog geen trainingen"
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <ButtonLink href="/app/log">Training loggen</ButtonLink>
              <ButtonLink href="/app/import" variant="secondary">
                Importeren uit Google Sheets
              </ButtonLink>
            </div>
          }
        >
          Log je eerste training of importeer je oude trainingen.
        </EmptyState>
      ) : (
        <WorkoutList workouts={items} hrefBase="/app/history" />
      )}
      {pages > 1 && (
        <nav aria-label="Paginering" className="mt-6 flex items-center justify-between gap-4">
          {page > 1 ? (
            <ButtonLink href={`/app/history?pagina=${page - 1}`} variant="secondary" size="sm">
              ← Nieuwer
            </ButtonLink>
          ) : (
            <span />
          )}
          <p className="text-sm text-chalk/60">
            Pagina {page} van {pages}
          </p>
          {page < pages ? (
            <ButtonLink href={`/app/history?pagina=${page + 1}`} variant="secondary" size="sm">
              Ouder →
            </ButtonLink>
          ) : (
            <span />
          )}
        </nav>
      )}
    </>
  );
}
