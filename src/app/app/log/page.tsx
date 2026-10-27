// Server Component: verzamelt alles wat de logger nodig heeft (bibliotheek,
// schemadag, vorige prestaties, geschatte maxima) en geeft het als props aan de
// Client Component.
import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { getExercises, getLiftStats, getPreviousPerformances, getProgramDay } from "@/lib/data";
import { todayISO } from "@/lib/dates";
import { isUuid } from "@/lib/parse";
import { PageHeader } from "@/components/ui/layout";
import { WorkoutLogger } from "./workout-logger";

export const metadata: Metadata = { title: "Training loggen" };

export default async function LogPage({ searchParams }: PageProps<"/app/log">) {
  const profile = await requireRole("member");
  const { day } = await searchParams;
  const dayId = isUuid(day) ? day : null;

  const [exercises, programDay] = await Promise.all([getExercises(), dayId ? getProgramDay(dayId) : null]);
  const exerciseIds = (programDay?.program_exercises ?? []).flatMap((pe) => (pe.exercise ? [pe.exercise.id] : []));
  const today = todayISO();
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
            ? "Vink een set af om hem te loggen: lege velden krijgen je doel en het voorgestelde gewicht, en de rusttimer start."
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
