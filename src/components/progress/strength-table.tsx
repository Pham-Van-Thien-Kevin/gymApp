// Server Component: maxima per blok (squat, bench, deadlift, totaal).
import { EmptyState } from "@/components/ui/layout";
import { formatDate } from "@/lib/dates";
import { formatKg } from "@/lib/stats";
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
    <td className={isBest ? "font-bold text-lime" : "text-chalk/80"}>
      {formatKg(value)}
      {isBest && value ? <span className="sr-only"> (beste)</span> : null}
      {isBest && value ? <span aria-hidden="true"> ★</span> : null}
    </td>
  );

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm tabular-nums sm:text-base">
        <caption className="sr-only">Maxima per blok</caption>
        <thead className="text-sm text-chalk/60">
          <tr className="border-b border-chalk/15">
            <th scope="col" className="py-2 font-medium">Blok</th>
            <th scope="col" className="font-medium">Squat</th>
            <th scope="col" className="font-medium">Bench</th>
            <th scope="col" className="font-medium">Deadlift</th>
            <th scope="col" className="font-medium">Totaal</th>
          </tr>
        </thead>
        <tbody>
          {tests.map((test) => (
            <tr key={test.id} className="border-b border-chalk/10">
              <th scope="row" className="py-2 font-semibold">
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
