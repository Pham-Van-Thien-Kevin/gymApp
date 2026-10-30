// Server Component: haalt alle data op de server op (geen loading-spinners in
// de browser) en stuurt kant-en-klare HTML. Er is hier geen interactiviteit.
import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { getActiveAssignment, getCheckins, getProgramLoads, getWorkoutDates, getWorkoutStatuses, getWorkouts } from "@/lib/data";
import { nextMonday } from "@/lib/blocks";
import { addDays, formatDate, startOfWeek, todayISO } from "@/lib/dates";
import { formatTarget, pickTodaysDay, weekdayLabel } from "@/lib/program";
import { formatNumber, weeklyStreak } from "@/lib/stats";
import { ButtonLink } from "@/components/ui/button";
import { Badge, Card, EmptyState, PageHeader, Section, Stat } from "@/components/ui/layout";
import { WorkoutList } from "@/components/workout-list";

export default async function MemberHome() {
  const profile = await requireRole("member");
  const today = todayISO();

  // Promise.all: de vijf queries lopen tegelijk in plaats van na elkaar.
  const [assignment, recentDates, recent, checkins, weekStatuses] = await Promise.all([
    getActiveAssignment(profile.id),
    getWorkoutDates(profile.id, addDays(today, -400)),
    getWorkouts(profile.id, { limit: 3 }),
    getCheckins(profile.id, 1),
    getWorkoutStatuses(profile.id, startOfWeek(today)),
  ]);

  const dates = recentDates.map((workout) => workout.date);
  const lastProgramDayId = recentDates.find((workout) => workout.program_day_id)?.program_day_id ?? null;
  const plan = pickTodaysDay(assignment?.program.program_days ?? [], today, lastProgramDayId);
  const doneToday = plan.kind === "training" && recentDates.some((w) => w.date === today && w.program_day_id === plan.day.id);
  const streak = weeklyStreak(dates, today);
  // Deze week: afgewerkt tegenover gepland. Gepland = de sessies van deze week
  // (uit je sheet: afgewerkt + nog te doen), of het aantal dagen in het schema
  // van je trainer als dat meer is.
  const weekRows = weekStatuses.filter((w) => w.date < nextMonday(today));
  const thisWeek = weekRows.filter((w) => w.status === "completed").length;
  const plannedThisWeek = Math.max(weekRows.length, assignment?.program.program_days.length ?? 0);
  const checkinThisWeek = checkins[0]?.week_start === startOfWeek(today) ? checkins[0] : null;
  const firstName = profile.full_name.split(" ")[0] || "sporter";
  // Gewichten voor de training van vandaag, zodat je weet wat je laadt.
  const loads = plan.kind === "training" ? await getProgramLoads(profile.id, plan.day.program_exercises, today) : {};

  return (
    <>
      <PageHeader eyebrow={formatDate(today, { weekday: "long", day: "numeric", month: "long" })} title={`Hoi ${firstName}`} />

      {!profile.trainer_id && (
        <Card className="mb-8 border-accent">
          <p className="font-semibold">Nog niet gekoppeld aan een trainer</p>
          <p className="mt-1 mb-4 text-chalk/70">Vraag je trainer om de uitnodigingscode en vul die in bij je profiel.</p>
          <ButtonLink href="/app/profile" variant="secondary">
            Trainer koppelen
          </ButtonLink>
        </Card>
      )}

      <Section title="Vandaag">
        {plan.kind === "none" && (
          <EmptyState
            title="Nog geen schema"
            action={
              <ButtonLink href="/app/log?vrij=1" size="lg">
                Vrije training loggen
              </ButtonLink>
            }
          >
            Zodra je trainer een schema toewijst, zie je hier elke dag je training.
          </EmptyState>
        )}

        {plan.kind === "rest" && (
          <Card>
            <p className="text-2xl font-bold">Rustdag</p>
            <p className="mt-1 text-chalk/70">
              Volgende: <span className="font-semibold text-chalk">{plan.next.name}</span> op {weekdayLabel(plan.next.weekday)?.toLowerCase()}.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <ButtonLink href={`/app/log?day=${plan.next.id}`} variant="secondary">
                Toch trainen
              </ButtonLink>
              <ButtonLink href="/app/log?vrij=1" variant="ghost">
                Vrije training
              </ButtonLink>
            </div>
          </Card>
        )}

        {plan.kind === "training" && (
          <Card>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm text-chalk/60">{assignment?.program.name}</p>
                <p className="text-2xl font-bold">{plan.day.name}</p>
              </div>
              {doneToday && <Badge strong>✓ Gedaan</Badge>}
            </div>
            <ol className="mt-4 divide-y divide-chalk/10 border-t border-chalk/10">
              {plan.day.program_exercises.map((exercise) => (
                <li key={exercise.id} className="flex items-baseline justify-between gap-4 py-2">
                  <span className="font-medium">
                    {exercise.exercise?.name ?? "Onbekende oefening"}
                    {exercise.optional && <span className="ml-2 text-sm text-chalk/60">(optioneel)</span>}
                  </span>
                  <span className="shrink-0 text-right text-sm tabular-nums text-chalk/70">
                    {formatTarget(exercise)}
                    {loads[exercise.id] !== undefined && (
                      <span className="block font-semibold text-chalk sm:ml-2 sm:inline">{formatNumber(loads[exercise.id], 2)} kg</span>
                    )}
                  </span>
                </li>
              ))}
            </ol>
            <ButtonLink href={`/app/log?day=${plan.day.id}`} size="lg" className="mt-5 w-full sm:w-auto">
              {doneToday ? "Nog een sessie loggen" : "Start training"}
            </ButtonLink>
          </Card>
        )}
      </Section>

      <Section>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Stat label="Streak" value={streak} hint={streak === 1 ? "week op rij" : "weken op rij"} />
          <Stat
            label="Deze week"
            value={
              plannedThisWeek > 0 ? (
                <>
                  {thisWeek}
                  <span className="text-xl font-normal text-chalk/60"> / {plannedThisWeek}</span>
                </>
              ) : (
                thisWeek
              )
            }
            hint={
              plannedThisWeek > 0 ? (
                <span className="mt-1 block">
                  {/* Balk = versiering; "1 / 4" zegt het al. */}
                  <span aria-hidden="true" className="block h-1.5 overflow-hidden rounded-full bg-chalk/15">
                    <span className="block h-full rounded-full bg-accent" style={{ width: `${Math.min(100, (thisWeek / plannedThisWeek) * 100)}%` }} />
                  </span>
                  <span className="mt-1 block">{thisWeek >= plannedThisWeek ? "week volledig" : `nog ${plannedThisWeek - thisWeek} te gaan`}</span>
                </span>
              ) : thisWeek === 1 ? (
                "training"
              ) : (
                "trainingen"
              )
            }
          />
          <div className="col-span-2 rounded-xl border border-chalk/15 p-4 sm:col-span-1">
            <p className="text-sm text-chalk/60">Check-in</p>
            {checkinThisWeek ? (
              <>
                <p className="mt-1 text-3xl font-bold">✓</p>
                <p className="mt-1 text-sm text-chalk/60">
                  Ingevuld{checkinThisWeek.score ? ` · cijfer ${checkinThisWeek.score}` : ""}
                </p>
              </>
            ) : (
              <Link href="/app/checkin" className="mt-2 inline-block font-semibold underline underline-offset-4">
                Vul je check-in in →
              </Link>
            )}
          </div>
        </div>
      </Section>

      <Section
        title="Recent"
        action={
          <Link href="/app/history" className="text-sm text-chalk/70 underline underline-offset-4 hover:text-chalk">
            Alle trainingen
          </Link>
        }
      >
        <WorkoutList workouts={recent.items} hrefBase="/app/history" />
      </Section>
    </>
  );
}
