// Server Component: de schema-editor. Elke wijziging is een klein <form> met
// een Server Action; na het opslaan herlaadt Next.js deze pagina met verse data
// (revalidatePath). Zo is er geen client-state die uit sync kan raken.
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { getExercises, getMemberActivity, sortProgramDays } from "@/lib/data";
import { WEEKDAYS, formatLongDate, todayISO } from "@/lib/dates";
import { isUuid } from "@/lib/parse";
import { formatTarget } from "@/lib/program";
import { createClient } from "@/lib/supabase/server";
import type { Exercise, ProgramDay, ProgramExercise } from "@/lib/types";
import { groupByCategory, uniqueByName } from "@/lib/exercises";
import { ActionForm } from "@/components/ui/action-form";
import { Field, SelectField, TextareaField } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { Card, PageHeader, Section } from "@/components/ui/layout";
import { assignProgram } from "@/app/trainer/actions";
import {
  addDay,
  addProgramExercise,
  deleteDay,
  deleteProgram,
  deleteProgramExercise,
  move,
  updateDay,
  updateProgram,
  updateProgramExercise,
} from "../actions";

export const metadata: Metadata = { title: "Schema bewerken" };

export default async function ProgramEditor({ params }: PageProps<"/trainer/programs/[id]">) {
  const trainer = await requireRole("trainer");
  const { id } = await params;
  if (!isUuid(id)) notFound();

  const supabase = await createClient();
  const [{ data: program }, exercises, clients] = await Promise.all([
    supabase
      .from("programs")
      .select(
        `id, name, description, trainer_id,
         program_days ( id, name, position, weekday,
           program_exercises ( id, position, target_sets, target_reps, target_rpe, notes, optional, exercise:exercises ( id, name, category, equipment ) ) ),
         program_assignments ( id, member_id, start_date, active )`,
      )
      .eq("id", id)
      .maybeSingle(),
    getExercises(),
    getMemberActivity(),
  ]);
  if (!program || program.trainer_id !== trainer.id) notFound();

  const days = sortProgramDays(program.program_days as unknown as ProgramDay[]);
  const myClients = clients.filter((client) => client.trainer_id === trainer.id);
  const activeAssignments = (program.program_assignments as { id: string; member_id: string; start_date: string; active: boolean }[]).filter(
    (assignment) => assignment.active,
  );

  return (
    <>
      <Link href="/trainer/programs" className="mb-4 inline-block text-sm text-chalk/70 underline underline-offset-4 hover:text-chalk">
        ← Alle schema&apos;s
      </Link>
      <PageHeader title={program.name} description={program.description} />

      <div className="grid gap-10 xl:grid-cols-[1fr_22rem]">
        <div className="min-w-0">
          <Section title="Dagen">
            <ol className="flex flex-col gap-6">
              {days.map((day, index) => (
                <li key={day.id}>
                  <DayEditor programId={id} day={day} index={index} total={days.length} exercises={uniqueByName(exercises, trainer.id)} />
                </li>
              ))}
            </ol>
            <Card className="mt-6 border-dashed">
              <h3 className="mb-3 font-semibold">Dag toevoegen</h3>
              <ActionForm action={addDay.bind(null, id)}>
                <div className="grid gap-3 sm:grid-cols-[1fr_12rem_auto] sm:items-end">
                  <Field label="Naam" name="name" required placeholder={`Dag ${days.length + 1}`} />
                  <WeekdaySelect name="weekday" />
                  <SubmitButton variant="secondary">Toevoegen</SubmitButton>
                </div>
              </ActionForm>
            </Card>
          </Section>
        </div>

        <aside className="flex flex-col gap-10">
          <Section title="Toewijzen">
            {activeAssignments.length > 0 && (
              <ul className="mb-4 divide-y divide-chalk/10 border-y border-chalk/10 text-sm">
                {activeAssignments.map((assignment) => (
                  <li key={assignment.id} className="flex justify-between gap-2 py-2">
                    <Link href={`/trainer/clients/${assignment.member_id}`} className="font-semibold hover:underline">
                      {myClients.find((client) => client.member_id === assignment.member_id)?.full_name ?? "Cliënt"}
                    </Link>
                    <span className="text-chalk/60">sinds {formatLongDate(assignment.start_date)}</span>
                  </li>
                ))}
              </ul>
            )}
            {myClients.length === 0 ? (
              <p className="text-sm text-chalk/60">Je hebt nog geen cliënten.</p>
            ) : (
              <ActionForm action={assignProgram}>
                <input type="hidden" name="program_id" value={id} />
                <SelectField label="Cliënt" name="member_id" required defaultValue="">
                  <option value="" disabled>
                    Kies een cliënt…
                  </option>
                  {myClients.map((client) => (
                    <option key={client.member_id} value={client.member_id}>
                      {client.full_name}
                    </option>
                  ))}
                </SelectField>
                <Field label="Startdatum" name="start_date" type="date" defaultValue={todayISO()} />
                <p className="text-sm text-chalk/60">Een eventueel vorig schema van die cliënt wordt inactief.</p>
                <SubmitButton>Toewijzen</SubmitButton>
              </ActionForm>
            )}
          </Section>

          <Section title="Gegevens">
            <ActionForm action={updateProgram.bind(null, id)}>
              <Field label="Naam" name="name" defaultValue={program.name} required maxLength={100} />
              <TextareaField label="Beschrijving" name="description" defaultValue={program.description ?? ""} maxLength={1000} />
              <SubmitButton variant="secondary">Opslaan</SubmitButton>
            </ActionForm>
            <ActionForm
              action={deleteProgram.bind(null, id)}
              confirm="Dit schema en alle dagen definitief verwijderen? Gelogde trainingen blijven bewaard."
              className="mt-6"
            >
              <SubmitButton variant="ghost" size="sm" className="self-start">
                Schema verwijderen
              </SubmitButton>
            </ActionForm>
          </Section>
        </aside>
      </div>
    </>
  );
}

function WeekdaySelect({ name, defaultValue }: { name: string; defaultValue?: number | null }) {
  return (
    <SelectField label="Weekdag" name={name} defaultValue={defaultValue ?? ""}>
      <option value="">Geen vaste dag</option>
      {WEEKDAYS.map((weekday, index) => (
        <option key={weekday} value={index}>
          {weekday}
        </option>
      ))}
    </SelectField>
  );
}

/** Kleine vierkante knop die een gebonden Server Action uitvoert (↑ ↓ ✕). */
function IconAction({ action, label, children }: { action: () => Promise<void>; label: string; children: string }) {
  return (
    <form action={action}>
      <button
        type="submit"
        aria-label={label}
        title={label}
        className="flex size-10 items-center justify-center text-chalk/60 hover:bg-chalk/10 hover:text-chalk"
      >
        <span aria-hidden="true">{children}</span>
      </button>
    </form>
  );
}

function DayEditor({
  programId,
  day,
  index,
  total,
  exercises,
}: {
  programId: string;
  day: ProgramDay;
  index: number;
  total: number;
  exercises: Exercise[];
}) {
  return (
    <Card className="p-0 sm:p-0">
      <div className="flex flex-wrap items-end gap-3 border-b border-chalk/15 p-4">
        <ActionForm action={updateDay.bind(null, programId, day.id)} className="min-w-0 flex-1">
          <div className="grid gap-3 sm:grid-cols-[1fr_12rem_auto] sm:items-end">
            <Field label={`Dag ${index + 1}`} name="name" defaultValue={day.name} required id={`day-name-${day.id}`} />
            <WeekdaySelect name="weekday" defaultValue={day.weekday} />
            <SubmitButton variant="secondary" size="md">
              Opslaan
            </SubmitButton>
          </div>
        </ActionForm>
        <div className="flex">
          {index > 0 && <IconAction action={move.bind(null, programId, "program_days", day.id, "up")} label={`${day.name} omhoog`}>↑</IconAction>}
          {index < total - 1 && (
            <IconAction action={move.bind(null, programId, "program_days", day.id, "down")} label={`${day.name} omlaag`}>↓</IconAction>
          )}
          <IconAction action={deleteDay.bind(null, programId, day.id)} label={`${day.name} verwijderen`}>✕</IconAction>
        </div>
      </div>

      {day.program_exercises.length === 0 ? (
        <p className="p-4 text-sm text-chalk/60">Nog geen oefeningen op deze dag.</p>
      ) : (
        <ol className="divide-y divide-chalk/10">
          {day.program_exercises.map((row, rowIndex) => (
            <li key={row.id} className="px-4 py-2">
              <ExerciseRow programId={programId} row={row} index={rowIndex} total={day.program_exercises.length} />
            </li>
          ))}
        </ol>
      )}

      <div className="border-t border-chalk/15 p-4">
        {exercises.length === 0 ? (
          // Zonder oefeningen in je bibliotheek valt er niets te kiezen: zeg dat
          // duidelijk in plaats van een leeg keuzemenu te tonen.
          <p className="text-sm text-chalk/70">
            Je oefeningenbibliotheek is nog leeg.{" "}
            <Link href="/trainer/exercises" className="font-semibold text-accent underline underline-offset-4">
              Voeg eerst oefeningen toe
            </Link>
            , daarna kan je ze hier inplannen.
          </p>
        ) : (
          <details>
            <summary className="cursor-pointer font-semibold text-chalk/80 hover:text-chalk">+ Oefening toevoegen</summary>
            <ActionForm action={addProgramExercise.bind(null, programId, day.id)} className="mt-4">
              <SelectField label="Oefening" name="exercise_id" required defaultValue="" id={`add-ex-${day.id}`}>
                <option value="" disabled>
                  Kies een oefening…
                </option>
                {groupByCategory(exercises).map((group) => (
                  <optgroup key={group.category} label={group.category}>
                    {group.items.map((exercise) => (
                      <option key={exercise.id} value={exercise.id}>
                        {exercise.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </SelectField>
              <TargetFields idPrefix={`add-${day.id}`} />
              <SubmitButton className="self-start">Toevoegen</SubmitButton>
            </ActionForm>
          </details>
        )}
      </div>
    </Card>
  );
}

function ExerciseRow({ programId, row, index, total }: { programId: string; row: ProgramExercise; index: number; total: number }) {
  return (
    <details className="group">
      <summary className="flex min-h-12 cursor-pointer list-none items-center gap-3">
        <span className="w-5 text-sm text-chalk/40 tabular-nums">{index + 1}</span>
        <span className="min-w-0 flex-1">
          <span className="font-medium">{row.exercise?.name ?? "Onbekende oefening"}</span>
          {row.optional && <span className="ml-2 text-sm text-chalk/60">(optioneel)</span>}
          <span className="block text-sm tabular-nums text-chalk/70 sm:inline sm:before:content-['_·_']">{formatTarget(row)}</span>
        </span>
        <span className="text-sm text-chalk/50 group-open:hidden">Bewerken</span>
        <span className="hidden text-sm text-chalk/50 group-open:inline">Sluiten</span>
      </summary>
      <div className="flex flex-wrap items-start gap-4 pt-2 pb-4">
        <ActionForm action={updateProgramExercise.bind(null, programId, row.id)} className="min-w-0 flex-1">
          <TargetFields idPrefix={row.id} row={row} />
          <SubmitButton variant="secondary" size="sm" className="self-start">
            Opslaan
          </SubmitButton>
        </ActionForm>
        <div className="flex">
          {index > 0 && (
            <IconAction action={move.bind(null, programId, "program_exercises", row.id, "up")} label={`${row.exercise?.name} omhoog`}>
              ↑
            </IconAction>
          )}
          {index < total - 1 && (
            <IconAction action={move.bind(null, programId, "program_exercises", row.id, "down")} label={`${row.exercise?.name} omlaag`}>
              ↓
            </IconAction>
          )}
          <IconAction action={deleteProgramExercise.bind(null, programId, row.id)} label={`${row.exercise?.name} verwijderen`}>
            ✕
          </IconAction>
        </div>
      </div>
    </details>
  );
}

function TargetFields({ idPrefix, row }: { idPrefix: string; row?: ProgramExercise }) {
  return (
    <>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Sets" name="target_sets" id={`${idPrefix}-sets`} inputMode="numeric" defaultValue={row?.target_sets ?? 3} />
        <Field label="Reps" name="target_reps" id={`${idPrefix}-reps`} defaultValue={row?.target_reps ?? ""} placeholder="8-10" />
        <Field label="Doel-RPE" name="target_rpe" id={`${idPrefix}-rpe`} defaultValue={row?.target_rpe ?? ""} placeholder="8" />
      </div>
      <Field label="Notitie (optioneel)" name="notes" id={`${idPrefix}-notes`} defaultValue={row?.notes ?? ""} maxLength={300} />
      <label className="flex min-h-11 items-center gap-3">
        <input type="checkbox" name="optional" defaultChecked={row?.optional} className="size-5 accent-accent" />
        Optionele oefening
      </label>
    </>
  );
}
