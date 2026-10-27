// Server Component: controleert de rol en geeft het member-id door aan de
// importflow (Client Component). Dezelfde flow wordt door trainers gebruikt.
import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { getImportBatches } from "@/lib/data";
import { formatLongDate } from "@/lib/dates";
import { PageHeader, Section } from "@/components/ui/layout";
import { ImportFlow } from "@/components/import/import-flow";

export const metadata: Metadata = { title: "Importeren" };

export default async function ImportPage() {
  const profile = await requireRole("member");
  const batches = await getImportBatches(profile.id);

  return (
    <>
      <PageHeader
        title="Importeren uit Google Sheets"
        description="Laad je bestaande trainingen in vanuit je coaching-sheet. Je ziet eerst een voorbeeld; er wordt pas iets opgeslagen als je bevestigt."
      />
      <Section>
        <ImportFlow memberId={profile.id} historyHref="/app/history" hasBottomNav />
      </Section>
      {batches.length > 0 && (
        <Section title="Eerdere imports">
          <ul className="divide-y divide-chalk/10 border-y border-chalk/15 text-sm">
            {batches.map((batch) => (
              <li key={batch.id} className="flex flex-wrap justify-between gap-2 py-3">
                <span className="font-semibold">{batch.sheet_tab}</span>
                <span className="text-chalk/60">
                  {batch.workout_count} trainingen · {formatLongDate(batch.created_at.slice(0, 10))}
                </span>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </>
  );
}
