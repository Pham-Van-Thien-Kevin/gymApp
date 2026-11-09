// Server Component: een training van een cliënt bekijken en feedback geven.
import Link from "next/link";
import { notFound } from "next/navigation";
import { getLiftStats, getWorkoutDetail } from "@/lib/data";
import { todayISO } from "@/lib/dates";
import { isUuid } from "@/lib/parse";
import { suggestFromTarget } from "@/lib/rpe";
import { formatNumber } from "@/lib/stats";
import { requireClient } from "@/lib/trainer";
import { ActionForm } from "@/components/ui/action-form";
import { Field, TextareaField } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { Card, PageHeader } from "@/components/ui/layout";
import { WorkoutDetail } from "@/components/workout-detail";
import { addFeedback, deleteFeedback, moveWorkout, setCoachWeights } from "@/app/trainer/actions";

export default async function ClientWorkoutPage({ params }: PageProps<"/trainer/clients/[id]/workouts/[workoutId]">) {
  const { id, workoutId } = await params;
  if (!isUuid(id) || !isUuid(workoutId)) notFound();
  const { trainer, client } = await requireClient(id);

  const workout = await getWorkoutDetail(workoutId);
  // Ook controleren dat de training bij déze cliënt hoort (anders klopt de URL niet).
  if (!workout || workout.member_id !== id) notFound();

  // Enkel een geplande sessie krijgt gewichten van de coach. Als hint in elk veld:
  // wat de app zelf zou voorstellen op basis van het geschatte 1RM van de cliënt.
  const planned = workout.status === "planned";
  const exercises = workout.workout_exercises.filter((we) => we.exercise);
  const stats = planned ? await getLiftStats(id, exercises.map((we) => we.exercise!.id), todayISO()) : {};

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
        {planned && exercises.length > 0 && (
          <Card className="mb-6">
            <h2 className="font-semibold">Voorgestelde gewichten</h2>
            <p className="mb-3 text-sm text-chalk/60">Je cliënt ziet deze gewichten in de logger. Leeg laten = de app rekent zelf een voorstel uit (grijs).</p>
            {/* key: na het opslaan tonen de velden de opgeslagen waarden (defaultValue telt enkel bij de eerste render). */}
            <ActionForm key={exercises.map((we) => we.coach_weight ?? "").join("|")} action={setCoachWeights.bind(null, workout.id)}>
              <ul className="flex flex-col gap-3">
                {exercises.map((we) => {
                  const auto = suggestFromTarget(stats[we.exercise!.id]?.reference?.e1rm, we.target_reps, we.target_intensity);
                  return (
                    <li key={we.id} className="grid grid-cols-[1fr_7rem] items-center gap-3">
                      <label htmlFor={`weight-${we.id}`} className="min-w-0">
                        <span className="block truncate font-medium">{we.exercise!.name}</span>
                        <span className="text-sm text-chalk/60">
                          {[we.target_sets && we.target_reps ? `${we.target_sets} × ${we.target_reps}` : we.target_reps, we.target_intensity].filter(Boolean).join(" @ ") || "Geen doel"}
                        </span>
                      </label>
                      <div className="flex items-center gap-1.5">
                        <input
                          id={`weight-${we.id}`}
                          name={`weight-${we.id}`}
                          inputMode="decimal"
                          className="field text-right tabular-nums"
                          defaultValue={we.coach_weight === null ? "" : String(we.coach_weight).replace(".", ",")}
                          placeholder={auto ? formatNumber(auto.weight, 2) : "–"}
                        />
                        <span className="text-sm text-chalk/60">kg</span>
                      </div>
                    </li>
                  );
                })}
              </ul>
              <SubmitButton className="self-start">Gewichten opslaan</SubmitButton>
            </ActionForm>
          </Card>
        )}
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
