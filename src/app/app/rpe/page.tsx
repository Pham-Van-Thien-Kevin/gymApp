// Server Component: haalt je geschatte 1RM's per oefening op, zodat je ze in de
// calculator (Client Component) met één tik kan invullen.
import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { getLiftStats, getLoggedExercises } from "@/lib/data";
import { formatDate, todayISO } from "@/lib/dates";
import { PageHeader, Section } from "@/components/ui/layout";
import { RpeCalculator, type OneRepMaxPreset } from "@/components/rpe-calculator";
import { RpeTable } from "@/components/rpe-table";

export const metadata: Metadata = { title: "RPE-calculator" };

export default async function MemberRpePage() {
  const profile = await requireRole("member");
  const exercises = await getLoggedExercises(profile.id);
  const stats = await getLiftStats(
    profile.id,
    exercises.map((exercise) => exercise.id),
    todayISO(),
  );

  // Recent geschat 1RM als dat er is, anders je beste ooit.
  const presets: OneRepMaxPreset[] = exercises.flatMap((exercise) => {
    const lift = stats[exercise.id];
    if (lift?.reference) return [{ name: exercise.name, e1rm: lift.reference.e1rm, note: formatDate(lift.reference.date) }];
    if (lift?.best) return [{ name: exercise.name, e1rm: lift.best, note: "beste ooit" }];
    return [];
  });

  return (
    <>
      <PageHeader title="RPE-calculator" description="Rekent met de RPE-tabel van je coach: gewicht, geschat 1RM of RPE." />
      <Section>
        <RpeCalculator presets={presets} />
      </Section>
      <Section>
        <RpeTable />
      </Section>
    </>
  );
}
