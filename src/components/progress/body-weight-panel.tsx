// Server Component: lichaamsgewicht als grafiek + laatste meting.
import { EmptyState, Stat } from "@/components/ui/layout";
import { TrendChart } from "@/components/charts/trend-chart";
import { formatDate } from "@/lib/dates";
import { formatKg, formatNumber } from "@/lib/stats";
import type { BodyMetric } from "@/lib/types";

export function BodyWeightPanel({ metrics }: { metrics: BodyMetric[] }) {
  if (metrics.length === 0) return <EmptyState title="Nog geen metingen" />;

  const latest = metrics.at(-1)!;
  const first = metrics[0];
  const change = latest.weight - first.weight;

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-3">
        <Stat label="Laatste meting" value={formatKg(latest.weight)} hint={formatDate(latest.date, { day: "numeric", month: "short" })} />
        <Stat
          label="Verschil"
          value={`${change > 0 ? "+" : ""}${formatNumber(change, 1)} kg`}
          hint={`sinds ${formatDate(first.date, { day: "numeric", month: "short", year: "numeric" })}`}
        />
      </div>
      {metrics.length > 1 && (
        <TrendChart
          title="Lichaamsgewicht"
          height={200}
          data={metrics.map((metric) => ({ date: metric.date, weight: metric.weight }))}
          series={[{ key: "weight", label: "Gewicht" }]}
        />
      )}
    </div>
  );
}
