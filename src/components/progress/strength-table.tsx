// Server Component: maxima per blok (squat, bench, deadlift, totaal).
import { EmptyState } from "@/components/ui/layout";
import { formatDate } from "@/lib/dates";
import { formatNumber } from "@/lib/stats";
import type { StrengthTest } from "@/lib/types";

export function StrengthTable({ tests }: { tests: StrengthTest[] }) {
  if (tests.length === 0) return <EmptyState title="Nog geen maxima">Voeg je maxima per blok toe of importeer ze uit je sheet.</EmptyState>;

  // Hoogste waarde per kolom markeren: een beste prestatie springt eruit zonder kleur.
  const best = {
    squat: Math.max(...tests.map((t) => t.squat ?? 0)),
    bench: Math.max(...tests.map((t) => t.bench ?? 0)),
    deadlift: Math.max(...tests.map((t) => t.deadlift ?? 0)),
    total: Math.max(...tests.map((t) => t.total)),
  };
  const cell = (value: number | null, isBest: boolean) => (
    <td className={isBest ? "pr-3 font-bold text-accent last:pr-0 sm:pr-4" : "pr-3 text-chalk/80 last:pr-0 sm:pr-4"}>
      {formatNumber(value, 2)}
      {/* Op mobiel is "kg" enkel voor schermlezers: zo past ook de kolom Totaal. */}
      {value !== null && <span className="max-sm:sr-only"> kg</span>}
      {isBest && value ? <span className="sr-only"> (beste)</span> : null}
      {isBest && value ? <span aria-hidden="true"> ★</span> : null}
    </td>
  );

  // whitespace-nowrap: "105 ★" breekt nooit af. Is het scherm toch te smal, dan
  // scrolt de tabel horizontaal (overflow-x-auto) in plaats van samen te drukken.
  return (
    <div className="overflow-x-auto">
      <p className="mb-1 text-sm text-chalk/60 sm:hidden" aria-hidden="true">
        Alle waarden in kg
      </p>
      <table className="w-full whitespace-nowrap text-left text-sm tabular-nums sm:text-base">
        <caption className="sr-only">Maxima per blok</caption>
        <thead className="text-sm text-chalk/60">
          <tr className="border-b border-chalk/15">
            <th scope="col" className="py-2 pr-3 font-medium sm:pr-4">Blok</th>
            <th scope="col" className="pr-3 font-medium sm:pr-4">Squat</th>
            <th scope="col" className="pr-3 font-medium sm:pr-4">Bench</th>
            <th scope="col" className="pr-3 font-medium sm:pr-4">Deadlift</th>
            <th scope="col" className="font-medium">Totaal</th>
          </tr>
        </thead>
        <tbody>
          {tests.map((test) => (
            <tr key={test.id} className="border-b border-chalk/10">
              <th scope="row" className="py-2 pr-3 font-semibold sm:pr-4">
                {test.label}
                {test.tested_on && <span className="block text-xs font-normal text-chalk/60">{formatDate(test.tested_on, { day: "numeric", month: "short", year: "numeric" })}</span>}
              </th>
              {cell(test.squat, test.squat === best.squat)}
              {cell(test.bench, test.bench === best.bench)}
              {cell(test.deadlift, test.deadlift === best.deadlift)}
              {cell(test.total, test.total === best.total)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
