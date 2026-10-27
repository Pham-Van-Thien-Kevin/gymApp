// Server Component (geen state): de RPE-tabel uit de coaching-sheet, als
// naslag tijdens het trainen. Werkt ook binnen een Client Component.
import { RPE_MEANING, RPE_TABLE } from "@/lib/rpe";
import { formatNumber } from "@/lib/stats";

const RPES = Object.keys(RPE_TABLE)
  .map(Number)
  .sort((a, b) => b - a);
const REPS = Array.from({ length: 12 }, (_, i) => i + 1);

export function RpeTable() {
  return (
    <details className="border border-chalk/15">
      <summary className="flex min-h-12 cursor-pointer items-center px-4 font-semibold hover:bg-chalk/5">
        RPE-tabel: % van je 1RM
      </summary>
      <div className="px-4 pb-4">
        <p className="mb-3 text-sm text-chalk/70">
          Rij = RPE, kolom = aantal reps. Bv. 5 reps op RPE 8 = 81% van je 1RM. Het voorgestelde gewicht is je
          geschatte 1RM × dit percentage, afgerond op 2,5 kg.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-xl text-right text-sm tabular-nums">
            <caption className="sr-only">Percentage van het 1RM per RPE en aantal herhalingen</caption>
            <thead className="text-chalk/60">
              <tr>
                <th scope="col" className="py-1 pr-2 text-left font-medium">
                  RPE \ reps
                </th>
                {REPS.map((reps) => (
                  <th key={reps} scope="col" className="px-1 font-medium">
                    {reps}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {RPES.map((rpe) => (
                <tr key={rpe} className="border-t border-chalk/10">
                  <th scope="row" className="py-1 pr-2 text-left font-semibold">
                    {formatNumber(rpe)}
                  </th>
                  {RPE_TABLE[rpe].map((percentage, index) => (
                    <td key={index} className="px-1 text-chalk/80">
                      {percentage}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <dl className="mt-4 grid gap-x-4 gap-y-1 text-sm sm:grid-cols-2">
          {RPE_MEANING.map(([rpe, meaning]) => (
            <div key={rpe} className="flex gap-2">
              <dt className="w-10 shrink-0 font-semibold">{rpe}</dt>
              <dd className="text-chalk/70">{meaning}</dd>
            </div>
          ))}
        </dl>
      </div>
    </details>
  );
}
