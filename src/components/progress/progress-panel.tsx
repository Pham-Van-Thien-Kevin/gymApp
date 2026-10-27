// Server Component: haalt de sets van één oefening op, rekent per dag de
// zwaarste set en het geschatte 1RM uit, en geeft enkel die punten door aan de
// grafiek (Client Component). Zo gaat er weinig data naar de browser.
import { getLoggedExercises, getSetLog } from "@/lib/data";
import { buildProgressSeries, formatKg } from "@/lib/stats";
import { formatDate } from "@/lib/dates";
import { EmptyState, Stat } from "@/components/ui/layout";
import { TrendChart } from "@/components/charts/trend-chart";
import { ExercisePicker } from "./exercise-picker";

export async function ProgressPanel({ memberId, exerciseId }: { memberId: string; exerciseId?: string }) {
  const options = await getLoggedExercises(memberId);
  if (options.length === 0) {
    return <EmptyState title="Nog geen data">Log een paar trainingen met gewicht en je ziet hier je progressie.</EmptyState>;
  }

  const selected = options.find((option) => option.id === exerciseId) ?? options[0];
  const series = buildProgressSeries(await getSetLog(memberId, selected.id));
  const heaviest = series.reduce((best, point) => (point.heaviest > (best?.heaviest ?? 0) ? point : best), series[0]);
  const bestE1rm = series.reduce((best, point) => (point.e1rm > (best?.e1rm ?? 0) ? point : best), series[0]);

  return (
    <div className="flex flex-col gap-5">
      <ExercisePicker options={options} selectedId={selected.id} />
      {series.length === 0 ? (
        <EmptyState title="Geen sets met gewicht">Voor {selected.name} zijn nog geen sets met een gewicht gelogd.</EmptyState>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Stat label="Zwaarste set" value={formatKg(heaviest.heaviest)} hint={formatDate(heaviest.date, { day: "numeric", month: "short", year: "numeric" })} />
            <Stat label="Beste geschat 1RM" value={formatKg(bestE1rm.e1rm)} hint={bestE1rm.bestSet} />
          </div>
          <TrendChart
            title={`Progressie ${selected.name}`}
            data={series.map((point) => ({ date: point.date, heaviest: point.heaviest, e1rm: point.e1rm, detail: point.bestSet }))}
            series={[
              { key: "heaviest", label: "Zwaarste set" },
              { key: "e1rm", label: "Geschat 1RM", dashed: true, opacity: 0.6 },
            ]}
          />
        </>
      )}
    </div>
  );
}
