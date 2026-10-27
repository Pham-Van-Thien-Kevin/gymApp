// Server Component: de historiek wordt op de server opgehaald, met paginering
// via de URL (?pagina=2), zodat elke pagina een deelbare link heeft.
import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { getWorkouts } from "@/lib/data";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState, PageHeader } from "@/components/ui/layout";
import { WorkoutList } from "@/components/workout-list";

export const metadata: Metadata = { title: "Historiek" };

const PAGE_SIZE = 20;

export default async function HistoryPage({ searchParams }: PageProps<"/app/history">) {
  const profile = await requireRole("member");
  const { pagina } = await searchParams;
  const page = Math.max(1, Number(pagina) || 1);
  const { items, total } = await getWorkouts(profile.id, { limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE });
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      <PageHeader title="Historiek" description={`${total} trainingen`} />
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
