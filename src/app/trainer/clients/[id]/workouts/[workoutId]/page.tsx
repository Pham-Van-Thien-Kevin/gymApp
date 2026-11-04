// Server Component: een training van een cliënt bekijken en feedback geven.
import Link from "next/link";
import { notFound } from "next/navigation";
import { getWorkoutDetail } from "@/lib/data";
import { todayISO } from "@/lib/dates";
import { isUuid } from "@/lib/parse";
import { requireClient } from "@/lib/trainer";
import { ActionForm } from "@/components/ui/action-form";
import { Field, TextareaField } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { Card, PageHeader } from "@/components/ui/layout";
import { WorkoutDetail } from "@/components/workout-detail";
import { addFeedback, deleteFeedback, moveWorkout } from "@/app/trainer/actions";

export default async function ClientWorkoutPage({ params }: PageProps<"/trainer/clients/[id]/workouts/[workoutId]">) {
  const { id, workoutId } = await params;
  if (!isUuid(id) || !isUuid(workoutId)) notFound();
  const { trainer, client } = await requireClient(id);

  const workout = await getWorkoutDetail(workoutId);
  // Ook controleren dat de training bij déze cliënt hoort (anders klopt de URL niet).
  if (!workout || workout.member_id !== id) notFound();

  return (
    <>
      <Link href={`/trainer/clients/${id}#historiek`} className="mb-4 inline-block text-sm text-chalk/70 underline underline-offset-4 hover:text-chalk">
        ← {client.full_name}
      </Link>
      <PageHeader eyebrow={client.full_name} title={workout.title ?? "Training"} />
      <div className="max-w-3xl">
        <Card className="mb-6">
          <h2 className="mb-3 font-semibold">{workout.status === "planned" ? "Naar een andere dag verplaatsen" : "Datum corrigeren"}</h2>
          {/* key: na het verplaatsen toont het veld de nieuwe datum (defaultValue telt enkel bij de eerste render). */}
          <ActionForm key={workout.date} action={moveWorkout.bind(null, workout.id)}>
            <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
              <Field
                label="Datum"
                name="date"
                type="date"
                required
                defaultValue={workout.date}
                // Een gelogde training kan niet in de toekomst liggen; de database controleert dit ook.
                max={workout.status === "planned" ? undefined : todayISO()}
              />
              <SubmitButton>Datum opslaan</SubmitButton>
            </div>
          </ActionForm>
        </Card>
        <WorkoutDetail
          workout={workout}
          feedbackTitle="Feedback"
          currentTrainerId={trainer.id}
          deleteFeedbackAction={deleteFeedback}
          feedbackSlot={
            <ActionForm action={addFeedback.bind(null, workout.id)} className="mt-4">
              <TextareaField
                label="Nieuwe feedback"
                name="message"
                required
                maxLength={2000}
                placeholder="Wat ging goed, wat kan beter, wat verandert er volgende week?"
              />
              <SubmitButton className="self-start">Feedback plaatsen</SubmitButton>
            </ActionForm>
          }
        />
      </div>
    </>
  );
}
