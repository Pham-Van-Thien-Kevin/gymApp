// Server Component: toont het actieve schema dat de trainer toewees.
import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { getActiveAssignment, getProgramLoads } from "@/lib/data";
import { formatLongDate, todayISO } from "@/lib/dates";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState, PageHeader } from "@/components/ui/layout";
import { ProgramView } from "@/components/program-view";

export const metadata: Metadata = { title: "Schema" };

export default async function SchemaPage() {
  const profile = await requireRole("member");
  const assignment = await getActiveAssignment(profile.id);

  if (!assignment) {
    return (
      <>
        <PageHeader title="Schema" />
        <EmptyState
          title="Nog geen schema"
          action={
            <ButtonLink href={profile.trainer_id ? "/app/log" : "/app/profile"} variant="secondary">
              {profile.trainer_id ? "Vrije training loggen" : "Trainer koppelen"}
            </ButtonLink>
          }
        >
          {profile.trainer_id
            ? "Je trainer heeft je nog geen schema toegewezen."
            : "Koppel je aan een trainer om een schema te krijgen."}
        </EmptyState>
      </>
    );
  }

  const { program } = assignment;
  // Voorgesteld gewicht per oefening, op basis van je eigen geschat 1RM.
  const loads = await getProgramLoads(
    profile.id,
    program.program_days.flatMap((day) => day.program_exercises),
    todayISO(),
  );
  return (
    <>
      <PageHeader
        eyebrow={`Actief sinds ${formatLongDate(assignment.start_date)}`}
        title={program.name}
        description={program.description}
      />
      <ProgramView
        days={program.program_days}
        loads={loads}
        dayAction={(day) => (
          <ButtonLink href={`/app/log?day=${day.id}`} variant="secondary" size="sm">
            Deze dag loggen
          </ButtonLink>
        )}
      />
    </>
  );
}
