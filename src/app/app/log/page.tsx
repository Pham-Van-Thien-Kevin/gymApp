// Server Component: verzamelt alles wat de logger nodig heeft (bibliotheek,
// schemadag, vorige prestaties, geschatte maxima) en geeft het als props aan de
// Client Component.
//
// Welke training? Met ?day=… die schemadag, met ?vrij=1 een vrije training,
// met ?gepland=… een geplande training uit je sheet die je nu afwerkt.
// Zonder parameters volgen we het schema van je trainer: op een trainingsdag
// sturen we je meteen naar de sessie van vandaag, op een rustdag kies je zelf.
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import {
  getActiveAssignment,
  getCurrentBlockTab,
  getExercises,
  getLiftStats,
  getPreviousPerformances,
  getProgramDay,
  getWorkoutDates,
  getPlannedWorkouts,
  getWorkoutDetail,
  getWorkoutDraft,
} from "@/lib/data";
import { addDays, formatDate, todayISO } from "@/lib/dates";
import { isExpiredBlock } from "@/lib/blocks";
import { uniqueByName } from "@/lib/exercises";
import { isUuid } from "@/lib/parse";
import { pickTodaysDay, weekdayLabel } from "@/lib/program";
import type { ProgramDay, WorkoutDetail, WorkoutListItem } from "@/lib/types";
import { PageHeader } from "@/components/ui/layout";
import { WorkoutLogger } from "./workout-logger";

export const metadata: Metadata = { title: "Training loggen" };

export default async function LogPage({ searchParams }: PageProps<"/app/log">) {
  const profile = await requireRole("member");
  const { day, vrij, gepland } = await searchParams;
  const dayId = isUuid(day) ? day : null;
  const today = todayISO();

  if (isUuid(gepland)) {
    // RLS verbergt andermans trainingen al; we controleren ook dat ze nog gepland is.
    const planned = await getWorkoutDetail(gepland);
    if (!planned || planned.member_id !== profile.id) notFound();
    // Al afgewerkt, of uit een verlopen blok: terug naar de training, die zegt waarom.
    const current = await getCurrentBlockTab(profile.id);
    if (planned.status !== "planned" || isExpiredBlock(planned.import_batch?.sheet_tab, current)) redirect(`/app/history/${planned.id}`);
    return <LogPlanned memberId={profile.id} today={today} planned={planned} hasTrainer={profile.trainer_id !== null} />;
  }

  if (!dayId && vrij !== "1") {
    // Eerst je sheet: sessies uit je huidige (of een nieuwer) blok die je nog moet doen.
    const planned = await getPlannedWorkouts(profile.id, 20);
    if (planned.total > 0) return <ChoosePlanned sessions={planned.items} />;

    const assignment = await getActiveAssignment(profile.id);
    if (assignment && assignment.program.program_days.length > 0) {
      const recent = await getWorkoutDates(profile.id, addDays(today, -60));
      const lastProgramDayId = recent.find((workout) => workout.program_day_id)?.program_day_id ?? null;
      const plan = pickTodaysDay(assignment.program.program_days, today, lastProgramDayId);
      // redirect() werkt ook in een Server Component: de browser krijgt meteen de juiste URL.
      if (plan.kind === "training") redirect(`/app/log?day=${plan.day.id}`);
      return (
        <ChooseSession
          programName={assignment.program.name}
          days={assignment.program.program_days}
          nextId={plan.kind === "rest" ? plan.next.id : null}
        />
      );
    }
  }

  const [allExercises, assignment] = await Promise.all([getExercises(), dayId ? getActiveAssignment(profile.id) : null]);
  // Een dag uit je eigen schema nemen we uit de toewijzing: daar staat de RPE
  // van deze blokweek al in. Anders (bv. een oude link) de dag zoals hij is.
  const programDay = dayId ? (assignment?.program.program_days.find((day) => day.id === dayId) ?? (await getProgramDay(dayId))) : null;
  // Eén oefening per naam: je eigen versie (met je geschiedenis) gaat voor.
  const exercises = uniqueByName(allExercises, profile.id);
  const exerciseIds = (programDay?.program_exercises ?? []).flatMap((pe) => (pe.exercise ? [pe.exercise.id] : []));
  const [previous, stats, serverDraft] = await Promise.all([
    getPreviousPerformances(profile.id, exerciseIds),
    getLiftStats(profile.id, exerciseIds, today),
    getWorkoutDraft(profile.id),
  ]);

  return (
    <>
      <PageHeader
        eyebrow="Training loggen"
        title={programDay?.name ?? "Vrije training"}
        description={
          programDay
            ? "Vink een set af om hem te loggen: lege velden krijgen je doel en het voorgestelde gewicht."
            : "Voeg oefeningen toe en log je sets."
        }
      />
      {/* key: bij een andere schemadag begint de logger met een schone lei. */}
      <WorkoutLogger
        key={programDay?.id ?? "free"}
        memberId={profile.id}
        today={today}
        programDay={programDay}
        exercises={exercises}
        previous={previous}
        stats={stats}
        serverDraft={serverDraft}
        hasTrainer={profile.trainer_id !== null}
      />
    </>
  );
}

/** Een geplande training uit je sheet afwerken: dezelfde logger, met de planning als startpunt. */
async function LogPlanned({ memberId, today, planned, hasTrainer }: { memberId: string; today: string; planned: WorkoutDetail; hasTrainer: boolean }) {
  const exerciseIds = planned.workout_exercises.flatMap((we) => (we.exercise ? [we.exercise.id] : []));
  const [allExercises, previous, stats, serverDraft] = await Promise.all([
    getExercises(),
    getPreviousPerformances(memberId, exerciseIds),
    getLiftStats(memberId, exerciseIds, today),
    getWorkoutDraft(memberId),
  ]);

  return (
    <>
      <PageHeader
        eyebrow={`Gepland voor ${formatDate(planned.date, { weekday: "long", day: "numeric", month: "long" })}`}
        title={planned.title ?? "Training"}
        description="Vink je sets af. Bij opslaan wordt deze geplande sessie een afgewerkte training."
      />
      <WorkoutLogger
        key={planned.id}
        memberId={memberId}
        today={today}
        programDay={null}
        planned={planned}
        exercises={uniqueByName(allExercises, memberId)}
        previous={previous}
        stats={stats}
        serverDraft={serverDraft}
        hasTrainer={hasTrainer}
      />
    </>
  );
}

/** Nog te doen uit je sheet: kies een sessie en werk ze meteen af. */
function ChoosePlanned({ sessions }: { sessions: WorkoutListItem[] }) {
  return (
    <>
      <PageHeader
        eyebrow="Training loggen"
        title="Nog te doen"
        description={sessions.length === 1 ? "Nog één sessie uit je schema." : `Nog ${sessions.length} sessies uit je schema, in volgorde.`}
      />
      <ul className="flex flex-col gap-3">
        {sessions.map((session, index) => (
          <li key={session.id}>
            <Link
              href={`/app/log?gepland=${session.id}`}
              className={
                index === 0
                  ? "flex min-h-16 items-center justify-between gap-4 rounded-xl bg-lime px-5 font-semibold text-on-lime"
                  : "flex min-h-16 items-center justify-between gap-4 rounded-xl border border-chalk/20 px-5 font-semibold hover:border-chalk"
              }
            >
              <span>{session.title ?? "Training"}</span>
              <span className={index === 0 ? "shrink-0 text-sm" : "shrink-0 text-sm text-chalk/60"}>
                {index === 0 ? "Afwerken →" : `${session.exercise_count} oefeningen`}
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <p className="mt-6 text-sm text-chalk/60">
        Iets anders gedaan?{" "}
        <Link href="/app/log?vrij=1" className="text-chalk underline underline-offset-4">
          Log een vrije training
        </Link>
      </p>
    </>
  );
}

/** Rustdag volgens het schema: kies welke sessie je toch logt. */
function ChooseSession({ programName, days, nextId }: { programName: string; days: ProgramDay[]; nextId: string | null }) {
  return (
    <>
      <PageHeader
        eyebrow="Training loggen"
        title="Welke sessie?"
        description={`Volgens ${programName} is het vandaag een rustdag. Kies de sessie die je toch traint.`}
      />
      <ul className="flex flex-col gap-3">
        {days.map((day) => (
          <li key={day.id}>
            <Link
              href={`/app/log?day=${day.id}`}
              className={
                day.id === nextId
                  ? "flex min-h-16 items-center justify-between gap-4 rounded-xl bg-lime px-5 font-semibold text-on-lime"
                  : "flex min-h-16 items-center justify-between gap-4 rounded-xl border border-chalk/20 px-5 font-semibold hover:border-chalk"
              }
            >
              <span>{day.name}</span>
              <span className={day.id === nextId ? "shrink-0 text-sm" : "shrink-0 text-sm text-chalk/60"}>
                {day.id === nextId ? "Volgende in je schema" : weekdayLabel(day.weekday)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <p className="mt-6 text-sm text-chalk/60">
        Iets anders gedaan?{" "}
        <Link href="/app/log?vrij=1" className="text-chalk underline underline-offset-4">
          Log een vrije training
        </Link>
      </p>
    </>
  );
}
