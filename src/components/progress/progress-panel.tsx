// Server Component: haalt de sets van één oefening op, rekent per dag de
// zwaarste set en het geschatte 1RM uit, en geeft enkel die punten door aan de
// grafiek (Client Component). Zo gaat er weinig data naar de browser.
//
// Met ?exercise=sbd tonen we squat, bench en deadlift samen. Heb je die
// gelogd, dan is dat ook wat je eerst ziet.
import { getLoggedExercises, getSetLog, getSetLogs } from "@/lib/data";
import { BIG_THREE, BIG_THREE_VIEW, bigThreeLift, type BigThreeLift } from "@/lib/exercises";
import { buildProgressSeries, combineByDate, formatKg } from "@/lib/stats";
import { formatDate } from "@/lib/dates";
import { EmptyState, Stat } from "@/components/ui/layout";
import { TrendChart, type TrendSeries } from "@/components/charts/trend-chart";
import { ExercisePicker } from "./exercise-picker";

type Option = { id: string; name: string; count: number };

const LIFT_LABEL: Record<BigThreeLift, string> = { squat: "Squat", bench: "Bench", deadlift: "Deadlift" };

// Elke lift zijn eigen kleur (tokens in globals.css). De kleur hoort bij de
// lift, niet bij de plaats in de lijst: zonder squat-data blijft bench blauw.
const LIFT_STYLE: Record<BigThreeLift, Pick<TrendSeries, "color">> = {
  squat: { color: "var(--color-lift-squat)" },
  bench: { color: "var(--color-lift-bench)" },
  deadlift: { color: "var(--color-lift-deadlift)" },
};

export async function ProgressPanel({ memberId, exerciseId }: { memberId: string; exerciseId?: string }) {
  const options = await getLoggedExercises(memberId);
  if (options.length === 0) {
    return <EmptyState title="Nog geen data">Log een paar trainingen met gewicht en je ziet hier je progressie.</EmptyState>;
  }

  const hasBigThree = options.some((option) => bigThreeLift(option.name));
  const chosen = options.find((option) => option.id === exerciseId);
  const showBigThree = hasBigThree && (exerciseId === BIG_THREE_VIEW || (!chosen && !exerciseId));

  return (
    <div className="flex flex-col gap-5">
      <ExercisePicker options={options} selectedId={showBigThree ? BIG_THREE_VIEW : (chosen ?? options[0]).id} showBigThree={hasBigThree} />
      {showBigThree ? <BigThreeChart memberId={memberId} options={options} /> : <ExerciseChart memberId={memberId} exercise={chosen ?? options[0]} />}
    </div>
  );
}

async function BigThreeChart({ memberId, options }: { memberId: string; options: Option[] }) {
  // Een sporter kan twee oefeningen "Squat" hebben (standaardbibliotheek én
  // import): alle ids per lift samen, zodat de geschiedenis niet in twee valt.
  const idsByLift = Object.fromEntries(BIG_THREE.map((lift) => [lift, options.filter((o) => bigThreeLift(o.name) === lift).map((o) => o.id)])) as Record<BigThreeLift, string[]>;
  const rows = await getSetLogs(memberId, Object.values(idsByLift).flat());

  const perLift = Object.fromEntries(
    BIG_THREE.map((lift) => {
      const liftRows = rows.filter((row) => idsByLift[lift].includes(row.exercise_id));
      return [lift, buildProgressSeries(liftRows).map((point) => ({ date: point.date, value: point.e1rm }))];
    }),
  ) as Record<BigThreeLift, { date: string; value: number }[]>;
  const lifts = BIG_THREE.filter((lift) => perLift[lift].length > 0);

  if (lifts.length === 0) {
    return <EmptyState title="Geen sets met gewicht">Voor squat, bench en deadlift zijn nog geen sets met een gewicht gelogd.</EmptyState>;
  }

  const best = (lift: BigThreeLift) => Math.max(0, ...perLift[lift].map((point) => point.value));
  const total = lifts.reduce((sum, lift) => sum + best(lift), 0);

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {BIG_THREE.map((lift) => (
          <Stat key={lift} label={LIFT_LABEL[lift]} value={perLift[lift].length ? formatKg(best(lift)) : "–"} hint="Beste geschat 1RM" />
        ))}
        <Stat label="Total" value={formatKg(total)} hint={lifts.length < 3 ? "Niet alle drie gelogd" : "Som van de beste e1RM's"} />
      </div>
      <TrendChart
        title="Geschat 1RM squat, bench en deadlift"
        data={combineByDate(perLift)}
        series={lifts.map((lift) => ({ key: lift, label: LIFT_LABEL[lift], ...LIFT_STYLE[lift] }))}
      />
    </>
  );
}

async function ExerciseChart({ memberId, exercise }: { memberId: string; exercise: Option }) {
  const series = buildProgressSeries(await getSetLog(memberId, exercise.id));
  if (series.length === 0) {
    return <EmptyState title="Geen sets met gewicht">Voor {exercise.name} zijn nog geen sets met een gewicht gelogd.</EmptyState>;
  }
  const heaviest = series.reduce((best, point) => (point.heaviest > best.heaviest ? point : best));
  const bestE1rm = series.reduce((best, point) => (point.e1rm > best.e1rm ? point : best));

  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <Stat label="Zwaarste set" value={formatKg(heaviest.heaviest)} hint={formatDate(heaviest.date, { day: "numeric", month: "short", year: "numeric" })} />
        <Stat label="Beste geschat 1RM" value={formatKg(bestE1rm.e1rm)} hint={bestE1rm.bestSet} />
      </div>
      <TrendChart
        title={`Progressie ${exercise.name}`}
        data={series.map((point) => ({ date: point.date, heaviest: point.heaviest, e1rm: point.e1rm, detail: point.bestSet }))}
        series={[
          { key: "heaviest", label: "Zwaarste set" },
          { key: "e1rm", label: "Geschat 1RM", dash: "6 4", opacity: 0.6 },
        ]}
      />
    </>
  );
}
