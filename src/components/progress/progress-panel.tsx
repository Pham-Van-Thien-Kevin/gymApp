// Server Component: haalt de sets van één oefening op, rekent per dag de
// zwaarste set en het geschatte 1RM uit, en geeft enkel die punten door aan de
// grafiek (Client Component). Zo gaat er weinig data naar de browser.
//
// Met ?exercise=sbd tonen we squat, bench en deadlift samen. Heb je die
// gelogd, dan is dat ook wat je eerst ziet.
import { getLoggedExercises, getSetLog, getSetLogs } from "@/lib/data";
import { BIG_THREE, BIG_THREE_VIEW, bigThreeLift, type BigThreeLift } from "@/lib/exercises";
import { roundToIncrement } from "@/lib/rpe";
import { buildProgressSeries, combineByDate, formatKg, formatLoad, pickReferenceE1rm, weeklyTonnage, type ProgressPoint } from "@/lib/stats";
import { formatDate, todayISO } from "@/lib/dates";
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

/**
 * "Wat kan ik nu?" Hetzelfde geschatte 1RM als de voorstellen in de logger
 * (pickReferenceE1rm). Is je laatste training te lang geleden, dan het meest
 * recente punt, met de datum erbij zodat je ziet hoe oud de schatting is.
 */
function currentEstimate(series: ProgressPoint[], today: string) {
  const reference = pickReferenceE1rm(series, today) ?? series.at(-1);
  return reference ? series.find((point) => point.date === reference.date) ?? null : null;
}

const estimateHint = (point: ProgressPoint) => `Uit ${point.bestSet} (${formatDate(point.date)})`;

async function BigThreeChart({ memberId, options }: { memberId: string; options: Option[] }) {
  // Een sporter kan twee oefeningen "Squat" hebben (standaardbibliotheek én
  // import): alle ids per lift samen, zodat de geschiedenis niet in twee valt.
  const idsByLift = Object.fromEntries(BIG_THREE.map((lift) => [lift, options.filter((o) => bigThreeLift(o.name) === lift).map((o) => o.id)])) as Record<BigThreeLift, string[]>;
  const rows = await getSetLogs(memberId, Object.values(idsByLift).flat());
  const today = todayISO();

  const perLift = Object.fromEntries(
    BIG_THREE.map((lift) => [lift, buildProgressSeries(rows.filter((row) => idsByLift[lift].includes(row.exercise_id)))]),
  ) as Record<BigThreeLift, ProgressPoint[]>;
  const lifts = BIG_THREE.filter((lift) => perLift[lift].length > 0);

  if (lifts.length === 0) {
    return <EmptyState title="Geen sets met gewicht">Voor squat, bench en deadlift zijn nog geen sets met een gewicht gelogd.</EmptyState>;
  }

  const estimates = Object.fromEntries(lifts.map((lift) => [lift, currentEstimate(perLift[lift], today)]));
  // Totaal van de afgeronde maxima, zodat de som klopt met wat erboven staat.
  const total = lifts.reduce((sum, lift) => sum + roundToIncrement(estimates[lift]?.e1rm ?? 0), 0);

  return (
    <>
      <p className="-mb-2 text-sm text-chalk/60">Geschat 1RM, afgerond op 2,5 kg</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {BIG_THREE.map((lift) => {
          const estimate = estimates[lift];
          return <Stat key={lift} label={LIFT_LABEL[lift]} value={formatLoad(estimate?.e1rm)} hint={estimate ? estimateHint(estimate) : "Nog niet gelogd"} />;
        })}
        <Stat label="Total" value={formatKg(total)} hint={lifts.length < 3 ? "Niet alle drie gelogd" : "Som van de drie"} />
      </div>
      <TrendChart
        title="Zwaarste set per training: squat, bench en deadlift"
        // Per lift de zwaarste set die dag: wat je echt deed, geen schatting.
        data={combineByDate(
          Object.fromEntries(lifts.map((lift) => [lift, perLift[lift].map((p) => ({ date: p.date, value: p.heaviest, detail: p.heaviestSet }))])),
        )}
        series={lifts.map((lift) => ({ key: lift, label: LIFT_LABEL[lift], detailKey: `${lift}Detail`, ...LIFT_STYLE[lift] }))}
      />
      <p className="text-sm text-chalk/60">De grafiek toont je zwaarste set per training. Tik op een punt voor reps en RPE.</p>

      <h3 className="mt-4 font-semibold">Volume per week</h3>
      <p className="-mt-3 text-sm text-chalk/60">Tonnage: gewicht × reps van al je sets, per week opgeteld.</p>
      <TrendChart
        title="Tonnage per week: squat, bench en deadlift"
        height={200}
        data={combineByDate(
          Object.fromEntries(lifts.map((lift) => [lift, weeklyTonnage(rows.filter((row) => idsByLift[lift].includes(row.exercise_id)))])),
        )}
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
  const estimate = currentEstimate(series, todayISO());

  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <Stat label="Geschat 1RM" value={formatLoad(estimate?.e1rm)} hint={estimate ? estimateHint(estimate) : undefined} />
        <Stat label="Zwaarste set ooit" value={formatKg(heaviest.heaviest)} hint={`${heaviest.heaviestSet} (${formatDate(heaviest.date)})`} />
      </div>
      <TrendChart
        title={`Zwaarste set per training: ${exercise.name}`}
        data={series.map((point) => ({ date: point.date, heaviest: point.heaviest, detail: point.heaviestSet }))}
        series={[{ key: "heaviest", label: "Zwaarste set", detailKey: "detail" }]}
      />
    </>
  );
}
