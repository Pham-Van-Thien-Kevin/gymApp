// Server Component: drie blokken (oefening, maxima, lichaamsgewicht). Elk
// blok haalt zijn data op de server op; enkel grafiek en formulieren zijn client-side.
import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { getBodyMetrics, getStrengthTests } from "@/lib/data";
import { todayISO } from "@/lib/dates";
import { PageHeader, Section } from "@/components/ui/layout";
import { BodyWeightPanel } from "@/components/progress/body-weight-panel";
import { ProgressPanel } from "@/components/progress/progress-panel";
import { StrengthTable } from "@/components/progress/strength-table";
import { BodyWeightForm, StrengthTestForm } from "./progress-forms";

export const metadata: Metadata = { title: "Progressie" };

export default async function ProgressPage({ searchParams }: PageProps<"/app/progress">) {
  const profile = await requireRole("member");
  const { exercise } = await searchParams;
  const [tests, metrics] = await Promise.all([getStrengthTests(profile.id), getBodyMetrics(profile.id)]);

  return (
    <>
      <PageHeader title="Progressie" description="Zwaarste set en geschat 1RM per oefening, je maxima per blok en je lichaamsgewicht." />

      <Section title="Per oefening">
        <ProgressPanel memberId={profile.id} exerciseId={typeof exercise === "string" ? exercise : undefined} />
      </Section>

      <Section title="Maxima per blok">
        <StrengthTable tests={tests} />
        <details className="mt-4">
          <summary className="cursor-pointer font-semibold text-chalk/80 hover:text-chalk">+ Nieuwe max toevoegen</summary>
          <div className="mt-4">
            <StrengthTestForm />
          </div>
        </details>
      </Section>

      <Section title="Lichaamsgewicht">
        <BodyWeightPanel metrics={metrics} />
        <div className="mt-6">
          <BodyWeightForm today={todayISO()} />
        </div>
      </Section>
    </>
  );
}
