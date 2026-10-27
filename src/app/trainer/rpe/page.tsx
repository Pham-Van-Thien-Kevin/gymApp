// Server Component: dezelfde calculator voor trainers, bv. om tijdens het
// schrijven van een schema snel een gewicht voor te rekenen.
import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { PageHeader, Section } from "@/components/ui/layout";
import { RpeCalculator } from "@/components/rpe-calculator";
import { RpeTable } from "@/components/rpe-table";

export const metadata: Metadata = { title: "RPE-calculator" };

export default async function TrainerRpePage() {
  await requireRole("trainer");
  return (
    <>
      <PageHeader title="RPE-calculator" description="Gewicht, geschat 1RM of RPE berekenen met de RPE-tabel uit de coaching-sheet." />
      <div className="grid gap-10 xl:grid-cols-2">
        <Section>
          <RpeCalculator />
        </Section>
        <Section>
          <RpeTable />
        </Section>
      </div>
    </>
  );
}
