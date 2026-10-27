"use client";
// Client Component: Recharts tekent SVG met JavaScript in de browser (meten van
// de breedte, hover-tooltip), dus deze grafiek moet een Client Component zijn.
// De data komt kant-en-klaar van een Server Component.
import { CartesianGrid, LabelList, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatDate, parseISODate, toISODate } from "@/lib/dates";
import { formatNumber } from "@/lib/stats";

export type TrendSeries = {
  key: string;
  label: string;
  /** Met maar één kleur onderscheiden we reeksen via doorzichtigheid en streepjes. */
  dashed?: boolean;
  opacity?: number;
};

type Point = { date: string } & Record<string, number | string | null>;

// Assen, raster en labels zijn chalk (currentColor); enkel de datalijnen zijn lime.
// Een CSS-variabele werkt ook als SVG-attribuut, zo blijft de kleur in globals.css staan.
const ACCENT = "var(--color-lime)";

export function TrendChart({
  data,
  series,
  unit = "kg",
  height = 260,
  title,
}: {
  data: Point[];
  series: TrendSeries[];
  unit?: string;
  height?: number;
  title: string;
}) {
  // Een tijd-as (getallen) i.p.v. tekstlabels: zo staan trainingen die 3 weken
  // uit elkaar liggen ook echt verder uit elkaar dan twee op opeenvolgende dagen.
  const rows = data.map((point) => ({ ...point, t: parseISODate(point.date).getTime() }));
  const last = rows.length - 1;

  return (
    <figure className="text-chalk">
      {series.length > 1 && (
        <ul className="mb-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-chalk/80" aria-label="Legende">
          {series.map((s) => (
            <li key={s.key} className="flex items-center gap-2">
              <svg width="24" height="8" aria-hidden="true">
                <line
                  x1="0"
                  y1="4"
                  x2="24"
                  y2="4"
                  stroke={ACCENT}
                  strokeWidth="2"
                  strokeOpacity={s.opacity ?? 1}
                  strokeDasharray={s.dashed ? "4 3" : undefined}
                />
              </svg>
              {s.label}
            </li>
          ))}
        </ul>
      )}

      {/* role="img" + label: schermlezers krijgen een samenvatting; de details staan in de tabel eronder. */}
      <div role="img" aria-label={`${title}: ${rows.length} metingen`} style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ top: 16, right: 48, bottom: 4, left: 0 }}>
            <CartesianGrid stroke="currentColor" strokeOpacity={0.1} vertical={false} />
            <XAxis
              dataKey="t"
              type="number"
              scale="time"
              domain={["dataMin", "dataMax"]}
              tickFormatter={(t: number) => formatDate(toISODate(new Date(t)))}
              stroke="currentColor"
              strokeOpacity={0.3}
              tick={{ fill: "currentColor", fillOpacity: 0.7, fontSize: 12 }}
              tickLine={false}
              minTickGap={24}
            />
            <YAxis
              width={44}
              domain={["auto", "auto"]}
              stroke="currentColor"
              strokeOpacity={0.3}
              tick={{ fill: "currentColor", fillOpacity: 0.7, fontSize: 12 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value: number) => formatNumber(value, 0)}
            />
            <Tooltip
              cursor={{ stroke: "currentColor", strokeOpacity: 0.3 }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const point = payload[0].payload as Point;
                return (
                  <div className="border border-chalk/40 bg-ink px-3 py-2 text-sm text-chalk">
                    <p className="font-semibold">{formatDate(point.date, { weekday: "short", day: "numeric", month: "short", year: "numeric" })}</p>
                    {series.map((s) => (
                      <p key={s.key} className="tabular-nums text-chalk/80">
                        {s.label}: <span className="font-semibold text-chalk">{formatValue(point[s.key], unit)}</span>
                      </p>
                    ))}
                    {typeof point.detail === "string" && point.detail && <p className="mt-1 text-chalk/60">{point.detail}</p>}
                  </div>
                );
              }}
            />
            {series.map((s) => (
              <Line
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.label}
                stroke={ACCENT}
                strokeWidth={2}
                strokeOpacity={s.opacity ?? 1}
                strokeDasharray={s.dashed ? "6 4" : undefined}
                dot={{ r: 4, fill: "var(--color-ink)", stroke: ACCENT, strokeWidth: 2, strokeOpacity: s.opacity ?? 1 }}
                activeDot={{ r: 6, fill: ACCENT, stroke: "var(--color-ink)", strokeWidth: 2 }}
                connectNulls
                isAnimationActive={false}
              >
                {/* Enkel het laatste punt krijgt een label: geen getal bij elk punt. */}
                <LabelList
                  dataKey={s.key}
                  content={({ x, y, value, index }) =>
                    index === last && value != null ? (
                      <text x={Number(x) + 8} y={Number(y) + 4} fill="currentColor" fontSize={12} fontWeight={600}>
                        {formatNumber(Number(value), 1)}
                      </text>
                    ) : null
                  }
                />
              </Line>
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <details className="mt-3 text-sm">
        <summary className="cursor-pointer text-chalk/70 hover:text-chalk">Toon als tabel</summary>
        <table className="mt-2 w-full text-left tabular-nums">
          <caption className="sr-only">{title}</caption>
          <thead className="text-chalk/60">
            <tr>
              <th scope="col" className="py-1 font-medium">Datum</th>
              {series.map((s) => (
                <th key={s.key} scope="col" className="font-medium">
                  {s.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[...data].reverse().map((point) => (
              <tr key={point.date} className="border-t border-chalk/10">
                <th scope="row" className="py-1 font-normal">{formatDate(point.date, { day: "numeric", month: "short", year: "numeric" })}</th>
                {series.map((s) => (
                  <td key={s.key}>{formatValue(point[s.key], unit)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}

function formatValue(value: number | string | null | undefined, unit: string) {
  return typeof value === "number" ? `${formatNumber(value, 1)} ${unit}` : "–";
}
