// Server Component: verzamelt alles wat de logger nodig heeft (bibliotheek,
// schemadag, vorige prestaties, geschatte maxima) en geeft het als props aan de
// Client Component.
//
// Welke training? Met ?day=… die schemadag, met ?vrij=1 een vrije training.
// Zonder parameters volgen we het schema van je trainer: op een trainingsdag
// sturen we je meteen naar de sessie van vandaag, op een rustdag kies je zelf.
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { getActiveAssignment, getExercises, getLiftStats, getPreviousPerformances, getProgramDay, getWorkoutDates } from "@/lib/data";
import { addDays, todayISO } from "@/lib/dates";
import { uniqueByName } from "@/lib/exercises";
import { isUuid } from "@/lib/parse";
import { pickTodaysDay, weekdayLabel } from "@/lib/program";
import type { ProgramDay } from "@/lib/types";
import { PageHeader } from "@/components/ui/layout";
import { WorkoutLogger } from "./workout-logger";

export const metadata: Metadata = { title: "Training loggen" };

export default async function LogPage({ searchParams }: PageProps<"/app/log">) {
  const profile = await requireRole("member");
  const { day, vrij } = await searchParams;
  const dayId = isUuid(day) ? day : null;
  const today = todayISO();

  if (!dayId && vrij !== "1") {
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

  const [allExercises, programDay] = await Promise.all([getExercises(), dayId ? getProgramDay(dayId) : null]);
  // Eén oefening per naam: je eigen versie (met je geschiedenis) gaat voor.
  const exercises = uniqueByName(allExercises, profile.id);
  const exerciseIds = (programDay?.program_exercises ?? []).flatMap((pe) => (pe.exercise ? [pe.exercise.id] : []));
  const [previous, stats] = await Promise.all([
    getPreviousPerformances(profile.id, exerciseIds),
    getLiftStats(profile.id, exerciseIds, today),
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
      />
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
                  ? "flex min-h-16 items-center justify-between gap-4 bg-lime px-5 font-semibold text-ink"
                  : "flex min-h-16 items-center justify-between gap-4 border border-chalk/20 px-5 font-semibold hover:border-chalk"
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
