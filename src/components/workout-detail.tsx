// Server Component: toont één training met oefeningen, sets, cardio en
// trainersfeedback. Gedeeld door de historiek (member) en het trainerdashboard.
import type { ReactNode } from "react";
import { Badge, Card, Section } from "@/components/ui/layout";
import { formatDate, formatLongDate } from "@/lib/dates";
import { formatKg, formatNumber } from "@/lib/stats";
import type { WorkoutDetail as Workout } from "@/lib/types";

type Props = {
  workout: Workout;
  /** Extra inhoud onder de feedback, bv. het formulier voor de trainer. */
  feedbackSlot?: ReactNode;
  feedbackTitle?: string;
  /** Trainer-weergave: eigen feedback kan verwijderd worden via deze Server Action. */
  deleteFeedbackAction?: (feedbackId: string) => Promise<void>;
  currentTrainerId?: string;
  /** Geplande sessie uit een verlopen blok (er is al een nieuwer blok begonnen). */
  expired?: boolean;
};

export function WorkoutDetail({
  workout,
  feedbackSlot,
  feedbackTitle = "Feedback van je trainer",
  deleteFeedbackAction,
  currentTrainerId,
  expired = false,
}: Props) {
  const performed = workout.workout_exercises.filter((we) => we.performed);
  const totalSets = performed.reduce((sum, we) => sum + we.workout_sets.length, 0);
  const tonnage = performed.reduce(
    (sum, we) => sum + we.workout_sets.reduce((s, set) => s + (set.weight ?? 0) * (set.reps ?? 0), 0),
    0,
  );

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center gap-2 text-sm text-chalk/70">
        <span>{formatLongDate(workout.date)}</span>
        {workout.duration_minutes ? <span>· {workout.duration_minutes} min</span> : null}
        {workout.status === "planned" && <Badge>{expired ? "Verlopen: je bent aan een nieuwer blok begonnen" : "Nog te doen"}</Badge>}
        {workout.import_batch && <Badge>Import · {workout.import_batch.sheet_tab}</Badge>}
      </div>

      <div className="mb-8 grid grid-cols-3 gap-3">
        <SmallStat label="Oefeningen" value={String(performed.length)} />
        <SmallStat label="Sets" value={String(totalSets)} />
        <SmallStat label="Volume" value={tonnage ? `${formatNumber(tonnage, 0)} kg` : "–"} />
      </div>

      {(workout.workout_feedback.length > 0 || feedbackSlot) && (
        <Section title={feedbackTitle}>
          <ul className="flex flex-col gap-3">
            {workout.workout_feedback.map((feedback) => (
              <li key={feedback.id} className="rounded-r-xl border-l-4 border-accent bg-chalk/5 p-4">
                <p className="whitespace-pre-wrap">{feedback.message}</p>
                <div className="mt-2 flex items-center justify-between gap-2 text-sm text-chalk/60">
                  <p>
                    {feedback.trainer?.full_name ?? "Trainer"} · {formatDate(feedback.created_at.slice(0, 10))}
                  </p>
                  {deleteFeedbackAction && feedback.trainer_id === currentTrainerId && (
                    // .bind() koppelt het feedback-id aan de Server Action, zonder verborgen veld.
                    <form action={deleteFeedbackAction.bind(null, feedback.id)}>
                      <button type="submit" className="min-h-10 px-2 underline underline-offset-4 hover:text-chalk">
                        Verwijderen
                      </button>
                    </form>
                  )}
                </div>
              </li>
            ))}
          </ul>
          {feedbackSlot}
        </Section>
      )}

      <Section title="Oefeningen">
        {workout.workout_exercises.length === 0 ? (
          <p className="text-chalk/60">Geen oefeningen in deze training.</p>
        ) : (
          <ol className="flex flex-col gap-4">
            {workout.workout_exercises.map((we) => (
              <li key={we.id}>
                <Card className={we.performed ? undefined : "border-dashed"}>
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h3 className="text-lg font-bold">
                      {we.exercise?.name ?? "Onbekende oefening"}
                      {we.optional && <span className="ml-2 text-sm font-normal text-chalk/60">optioneel</span>}
                    </h3>
                    {!we.performed && <Badge>Niet uitgevoerd</Badge>}
                  </div>
                  {(we.target_sets || we.target_reps || we.target_intensity) && (
                    <p className="mt-1 text-sm text-chalk/70">
                      Doel: {we.target_sets ?? "?"} × {we.target_reps ?? "?"}
                      {we.target_intensity ? ` · ${we.target_intensity}` : ""}
                      {we.actual_rpe !== null ? ` · echte RPE ${formatNumber(we.actual_rpe)}` : ""}
                    </p>
                  )}
                  {we.workout_sets.length > 0 && (
                    <table className="mt-3 w-full text-left text-sm tabular-nums">
                      <caption className="sr-only">Sets van {we.exercise?.name}</caption>
                      <thead className="text-chalk/60">
                        <tr>
                          <th scope="col" className="py-1 font-medium">Set</th>
                          <th scope="col" className="font-medium">Reps</th>
                          <th scope="col" className="font-medium">Gewicht</th>
                          <th scope="col" className="font-medium">RPE</th>
                        </tr>
                      </thead>
                      <tbody>
                        {we.workout_sets.map((set) => (
                          <tr key={set.id} className="border-t border-chalk/10">
                            <th scope="row" className="py-1.5 font-medium">{set.set_number}</th>
                            <td>
                              {set.reps ?? "–"}
                              {set.reps_estimated && (
                                <abbr title="Geschat: de sheet gaf een bereik" className="ml-0.5 text-chalk/60 no-underline">
                                  *
                                </abbr>
                              )}
                            </td>
                            <td>{formatKg(set.weight)}</td>
                            <td>{set.rpe !== null ? formatNumber(set.rpe) : "–"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                  {we.notes && <p className="mt-3 text-sm whitespace-pre-wrap text-chalk/80">“{we.notes}”</p>}
                </Card>
              </li>
            ))}
          </ol>
        )}
      </Section>

      {workout.cardio_entries.length > 0 && (
        <Section title="Cardio">
          <ul className="divide-y divide-chalk/10 border-y border-chalk/10">
            {workout.cardio_entries.map((entry) => (
              <li key={entry.id} className="flex justify-between py-2">
                <span>{entry.type}</span>
                <span className="tabular-nums text-chalk/70">{entry.duration_minutes ? `${entry.duration_minutes} min` : "–"}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {workout.notes && (
        <Section title="Notities">
          <p className="whitespace-pre-wrap text-chalk/80">{workout.notes}</p>
        </Section>
      )}
    </>
  );
}

function SmallStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-chalk/15 p-3">
      <p className="text-xs text-chalk/60">{label}</p>
      <p className="mt-0.5 text-xl font-bold tabular-nums">{value}</p>
    </div>
  );
}
