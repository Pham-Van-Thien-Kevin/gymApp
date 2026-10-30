// Server Component: alles over één cliënt op één pagina. Elk blok hergebruikt
// dezelfde componenten als de gebruikersapp; RLS zorgt dat de trainer enkel
// data van eigen cliënten krijgt.
import Link from "next/link";
import { getActiveAssignment, getBodyMetrics, getCheckins, getImportBatches, getProgramLoads, getStrengthTests, getWorkouts } from "@/lib/data";
import { formatLongDate, todayISO } from "@/lib/dates";
import { clientFlags } from "@/lib/flags";
import { isUuid } from "@/lib/parse";
import { requireClient } from "@/lib/trainer";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { ButtonLink, buttonClasses } from "@/components/ui/button";
import { ActionForm } from "@/components/ui/action-form";
import { Field, SelectField } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { Badge, Card, PageHeader, Section } from "@/components/ui/layout";
import { CheckinList } from "@/components/checkin-list";
import { ProgramView } from "@/components/program-view";
import { BlockProgress } from "@/components/block-progress";
import { WorkoutList } from "@/components/workout-list";
import { BodyWeightPanel } from "@/components/progress/body-weight-panel";
import { ProgressPanel } from "@/components/progress/progress-panel";
import { StrengthTable } from "@/components/progress/strength-table";
import { assignProgram } from "../../actions";

const sections = [
  { id: "schema", label: "Schema" },
  { id: "historiek", label: "Historiek" },
  { id: "progressie", label: "Progressie" },
  { id: "maxima", label: "Maxima" },
  { id: "gewicht", label: "Gewicht" },
  { id: "checkins", label: "Check-ins" },
];

export default async function ClientPage({ params, searchParams }: PageProps<"/trainer/clients/[id]">) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const { trainer, client } = await requireClient(id);
  const { exercise } = await searchParams;
  const flags = clientFlags(client, todayISO());

  const supabase = await createClient();
  const [assignment, workouts, tests, metrics, checkins, imports, programs] = await Promise.all([
    getActiveAssignment(id),
    getWorkouts(id, { limit: 15 }),
    getStrengthTests(id),
    getBodyMetrics(id),
    getCheckins(id, 12),
    getImportBatches(id),
    supabase.from("programs").select("id, name").eq("trainer_id", trainer.id).order("name"),
  ]);
  // Voorgestelde gewichten op basis van de geschatte 1RM's van deze cliënt
  // (RLS laat de trainer de sets van eigen cliënten lezen).
  const loads = assignment
    ? await getProgramLoads(id, assignment.program.program_days.flatMap((day) => day.program_exercises), todayISO())
    : {};

  return (
    <>
      <Link href="/trainer" className="mb-4 inline-block text-sm text-chalk/70 underline underline-offset-4 hover:text-chalk">
        ← Alle cliënten
      </Link>
      <PageHeader
        title={client.full_name}
        description={
          <span className="flex flex-wrap gap-1.5">
            {flags.inactive && <Badge strong>▲ {flags.daysSinceWorkout === null ? "Nog niet getraind" : `${flags.daysSinceWorkout} dagen niet getraind`}</Badge>}
            {flags.pain && <Badge strong>▲ Pijn/klachten: BAD</Badge>}
            {!flags.needsAttention && <Badge>Alles in orde</Badge>}
          </span>
        }
        actions={
          <>
            <ButtonLink href={`/trainer/clients/${id}/import`} variant="secondary">
              Importeren uit Google Sheets
            </ButtonLink>
            {/* Gewone <a>: een bestand, geen pagina. */}
            <a href={`/trainer/clients/${id}/export`} download className={buttonClasses("secondary")}>
              Exporteren (.xlsx)
            </a>
          </>
        }
      />

      <nav aria-label="Secties" className="sticky top-0 z-10 -mx-4 mb-8 overflow-x-auto border-b border-chalk/15 bg-ink px-4 sm:mx-0 sm:px-0">
        <ul className="flex gap-1 py-2">
          {sections.map((section) => (
            <li key={section.id}>
              <a href={`#${section.id}`} className="flex min-h-10 items-center px-3 text-sm whitespace-nowrap text-chalk/70 hover:bg-chalk/10 hover:text-chalk">
                {section.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="grid gap-x-12 xl:grid-cols-2">
        <Section id="schema" title="Schema" className="scroll-mt-16 xl:col-span-2">
          {assignment ? (
            <>
              <p className="mb-4 text-chalk/70">
                <span className="font-semibold text-chalk">{assignment.program.name}</span> · actief sinds{" "}
                {formatLongDate(assignment.start_date)}
              </p>
              <BlockProgress assignment={assignment} />
              <ProgramView days={assignment.program.program_days} loads={loads} />
            </>
          ) : (
            <p className="mb-4 text-chalk/70">Nog geen actief schema.</p>
          )}
          <Card className="mt-6">
            <h3 className="mb-3 font-semibold">{assignment ? "Ander schema toewijzen" : "Schema toewijzen"}</h3>
            {programs.data?.length ? (
              <ActionForm action={assignProgram}>
                <input type="hidden" name="member_id" value={id} />
                <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end">
                  <SelectField label="Schema" name="program_id" required defaultValue="">
                    <option value="" disabled>
                      Kies een schema…
                    </option>
                    {programs.data.map((program) => (
                      <option key={program.id} value={program.id}>
                        {program.name}
                      </option>
                    ))}
                  </SelectField>
                  <Field label="Startdatum" name="start_date" type="date" defaultValue={todayISO()} />
                  <SubmitButton>Toewijzen</SubmitButton>
                </div>
              </ActionForm>
            ) : (
              <ButtonLink href="/trainer/programs" variant="secondary" size="sm">
                Eerst een schema maken
              </ButtonLink>
            )}
          </Card>
        </Section>

        <Section id="historiek" title="Historiek" className="scroll-mt-16">
          <WorkoutList workouts={workouts.items} hrefBase={`/trainer/clients/${id}/workouts`} emptyText="Nog geen trainingen." />
          {workouts.total > workouts.items.length && (
            <p className="mt-3 text-sm text-chalk/60">Laatste {workouts.items.length} van {workouts.total} trainingen.</p>
          )}
        </Section>

        <Section id="progressie" title="Progressie" className="scroll-mt-16">
          <ProgressPanel memberId={id} exerciseId={typeof exercise === "string" ? exercise : undefined} />
        </Section>

        <Section id="maxima" title="Maxima per blok" className="scroll-mt-16">
          <StrengthTable tests={tests} />
        </Section>

        <Section id="gewicht" title="Lichaamsgewicht" className="scroll-mt-16">
          <BodyWeightPanel metrics={metrics} />
        </Section>

        <Section id="checkins" title="Wekelijkse check-ins" className="scroll-mt-16 xl:col-span-2">
          <CheckinList checkins={checkins} />
        </Section>

        {imports.length > 0 && (
          <Section title="Imports" className="xl:col-span-2">
            <ul className="divide-y divide-chalk/10 border-y border-chalk/10 text-sm">
              {imports.map((batch) => (
                <li key={batch.id} className="flex flex-wrap justify-between gap-2 py-2">
                  <span className="font-semibold">{batch.sheet_tab}</span>
                  <span className="text-chalk/60">
                    {batch.workout_count} trainingen · {batch.source === "link" ? "via link" : "via upload"} ·{" "}
                    {formatLongDate(batch.created_at.slice(0, 10))}
                  </span>
                </li>
              ))}
            </ul>
          </Section>
        )}
      </div>
    </>
  );
}
