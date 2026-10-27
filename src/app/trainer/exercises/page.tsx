// Server Component: de oefeningenbibliotheek, gefilterd via ?categorie= in de
// URL (gewone links, dus geen JavaScript nodig om te filteren).
import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { getExercises } from "@/lib/data";
import { cn } from "@/lib/cn";
import { EXERCISE_CATEGORIES, type Exercise } from "@/lib/types";
import { ActionForm } from "@/components/ui/action-form";
import { Field, SelectField } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { Badge, Card, EmptyState, PageHeader, Section } from "@/components/ui/layout";
import { createExercise, deleteExercise, updateExercise } from "./actions";

export const metadata: Metadata = { title: "Oefeningen" };

export default async function ExercisesPage({ searchParams }: PageProps<"/trainer/exercises">) {
  const trainer = await requireRole("trainer");
  const { categorie } = await searchParams;
  const filter = typeof categorie === "string" && EXERCISE_CATEGORIES.includes(categorie) ? categorie : null;
  const all = await getExercises();
  const exercises = filter ? all.filter((exercise) => exercise.category === filter) : all;

  return (
    <>
      <PageHeader title="Oefeningen" description={`${all.length} oefeningen in je bibliotheek.`} />

      <div className="grid gap-10 lg:grid-cols-[1fr_22rem]">
        <Section>
          <nav aria-label="Filter op categorie" className="mb-4">
            <ul className="flex flex-wrap gap-1">
              {[null, ...EXERCISE_CATEGORIES].map((category) => (
                <li key={category ?? "alle"}>
                  <Link
                    href={category ? `/trainer/exercises?categorie=${category}` : "/trainer/exercises"}
                    aria-current={filter === category ? "page" : undefined}
                    className={cn(
                      "flex min-h-10 items-center border px-3 text-sm font-medium",
                      filter === category ? "border-lime bg-lime text-ink" : "border-chalk/30 text-chalk/80 hover:border-chalk",
                    )}
                  >
                    {category ?? "Alle"}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {exercises.length === 0 ? (
            <EmptyState title="Geen oefeningen in deze categorie" />
          ) : (
            <ul className="divide-y divide-chalk/10 border-y border-chalk/15">
              {exercises.map((exercise) => (
                <li key={exercise.id}>
                  <ExerciseItem exercise={exercise} editable={exercise.created_by === trainer.id} />
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Nieuwe oefening">
          <Card>
            <ActionForm action={createExercise}>
              <ExerciseFields idPrefix="new" />
              <SubmitButton>Toevoegen</SubmitButton>
            </ActionForm>
          </Card>
        </Section>
      </div>
    </>
  );
}

function ExerciseItem({ exercise, editable }: { exercise: Exercise; editable: boolean }) {
  const summary = (
    <span className="flex min-w-0 flex-1 items-center gap-3">
      <span className="min-w-0 flex-1 truncate font-medium">{exercise.name}</span>
      <span className="hidden text-sm text-chalk/60 sm:inline">{exercise.equipment}</span>
      <Badge>{exercise.category}</Badge>
    </span>
  );

  if (!editable) {
    // Globale oefeningen en die van cliënten zijn zichtbaar, maar niet aan te passen.
    return (
      <div className="flex min-h-14 items-center gap-3">
        {summary}
        <span className="w-20 text-right text-xs text-chalk/50">{exercise.created_by ? "van cliënt" : "standaard"}</span>
      </div>
    );
  }

  return (
    <details className="group">
      <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3">
        {summary}
        <span className="w-20 text-right text-sm text-chalk/60 group-open:hidden">Bewerken</span>
        <span className="hidden w-20 text-right text-sm text-chalk/60 group-open:inline">Sluiten</span>
      </summary>
      <div className="grid gap-4 pb-4 sm:grid-cols-[1fr_auto] sm:items-start">
        <ActionForm action={updateExercise.bind(null, exercise.id)}>
          <ExerciseFields idPrefix={exercise.id} exercise={exercise} />
          <SubmitButton variant="secondary" size="sm" className="self-start">
            Opslaan
          </SubmitButton>
        </ActionForm>
        <ActionForm action={deleteExercise.bind(null, exercise.id)} confirm={`${exercise.name} verwijderen?`}>
          <SubmitButton variant="ghost" size="sm">
            Verwijderen
          </SubmitButton>
        </ActionForm>
      </div>
    </details>
  );
}

function ExerciseFields({ idPrefix, exercise }: { idPrefix: string; exercise?: Exercise }) {
  return (
    <>
      <Field label="Naam" name="name" id={`${idPrefix}-name`} defaultValue={exercise?.name} required maxLength={80} />
      <div className="grid grid-cols-2 gap-3">
        <SelectField label="Categorie" name="category" id={`${idPrefix}-category`} defaultValue={exercise?.category ?? "Andere"}>
          {EXERCISE_CATEGORIES.map((category) => (
            <option key={category}>{category}</option>
          ))}
        </SelectField>
        <Field label="Materiaal" name="equipment" id={`${idPrefix}-equipment`} defaultValue={exercise?.equipment ?? ""} placeholder="Barbell" />
      </div>
    </>
  );
}
