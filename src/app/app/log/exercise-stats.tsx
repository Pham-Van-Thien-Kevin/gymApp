// Stats van één oefening: wat je vandaag al deed, plus je vorige keer en je record.
// Je opent ze door de kop van een oefening ingedrukt te houden in de logger.
// Geen "use client": de logger (een Client Component) importeert dit, dus het draait in de browser.
import { useRef } from "react";
import { formatDate } from "@/lib/dates";
import { formatLoad, formatNumber } from "@/lib/stats";
import type { LiftStats, PreviousPerformance } from "@/lib/types";

/** Zo lang (ms) moet je ingedrukt houden voor de stats openen. */
const LONG_PRESS_MS = 500;

/**
 * Houd dit gebied ingedrukt om de stats (popover met id `popoverId`) te openen.
 * Pointer events werken met vinger, muis en pen. Laat je los of scrol je voor de
 * tijd om is, dan gebeurt er niets. Met het toetsenbord opent Enter of spatie het meteen.
 * Een eigen component (geen hook), want we gebruiken het per oefening in een .map().
 */
export function HoldForStats({ popoverId, label, children }: { popoverId: string; label: string; children: React.ReactNode }) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const open = () => document.getElementById(popoverId)?.showPopover();
  const cancel = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={label}
      aria-haspopup="dialog"
      // select-none: lang drukken selecteert anders de tekst.
      className="min-w-0 select-none [-webkit-touch-callout:none]"
      onPointerDown={() => {
        cancel();
        timer.current = setTimeout(open, LONG_PRESS_MS);
      }}
      onPointerUp={cancel}
      onPointerLeave={cancel}
      onPointerCancel={cancel}
      // Op een gsm opent lang drukken anders het menu van de browser.
      onContextMenu={(event) => event.preventDefault()}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          open();
        }
      }}
    >
      {children}
    </div>
  );
}

/** Een gelogde set als getallen; null waar niets is ingevuld. */
export type LoggedSet = { reps: number | null; weight: number | null; e1rm: number | null; done: boolean };

export function ExerciseStats({
  id,
  name,
  sets,
  previous,
  stats,
}: {
  id: string;
  name: string;
  sets: LoggedSet[];
  previous: PreviousPerformance | undefined;
  stats: LiftStats | undefined;
}) {
  const done = sets.filter((set) => set.done);
  const totalReps = done.reduce((sum, set) => sum + (set.reps ?? 0), 0);
  // Volume = kg × reps opgeteld: een gangbare maat voor hoeveel werk je verzette.
  const volume = done.reduce((sum, set) => sum + (set.weight ?? 0) * (set.reps ?? 0), 0);
  const heaviest = Math.max(0, ...done.map((set) => set.weight ?? 0));
  const bestToday = Math.max(0, ...done.map((set) => set.e1rm ?? 0));

  return (
    // Native popover: sluiten met Esc of een tik ernaast, zonder eigen JavaScript (zoals het "Meer"-menu).
    <div
      id={id}
      popover="auto"
      aria-label={`Stats van ${name}`}
      className="fixed inset-x-0 top-auto bottom-0 m-0 w-full rounded-t-xl border-t border-chalk/30 bg-ink p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] text-chalk md:inset-x-auto md:top-1/2 md:left-1/2 md:bottom-auto md:w-96 md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-xl md:border"
    >
      <h3 className="text-lg font-bold">{name}</h3>
      <p className="text-sm text-chalk/60">Vandaag</p>
      <dl className="mt-3 grid grid-cols-2 gap-3">
        <Stat label="Sets gedaan" value={`${done.length} / ${sets.length}`} />
        <Stat label="Reps" value={formatNumber(totalReps, 0)} />
        <Stat label="Volume" value={`${formatNumber(volume, 0)} kg`} />
        <Stat label="Zwaarste set" value={heaviest ? `${formatNumber(heaviest, 2)} kg` : "–"} />
        <Stat label="Geschat 1RM vandaag" value={bestToday ? formatLoad(bestToday) : "–"} />
        <Stat label="Beste geschat 1RM" value={formatLoad(stats?.best)} />
      </dl>
      {done.length > 0 && (
        <p className="mt-4 text-sm tabular-nums">
          <span className="text-chalk/60">Je sets: </span>
          {done.map((set) => `${set.weight !== null ? formatNumber(set.weight, 2) : "BW"}×${set.reps ?? "?"}`).join(", ")}
        </p>
      )}
      {previous && (
        <p className="mt-1 text-sm tabular-nums">
          <span className="text-chalk/60">Vorige keer ({formatDate(previous.date)}): </span>
          {previous.sets.map((set) => `${set.weight !== null ? formatNumber(set.weight, 2) : "BW"}×${set.reps ?? "?"}`).join(", ")}
        </p>
      )}
      <button
        type="button"
        popoverTarget={id}
        popoverTargetAction="hide"
        className="mt-5 min-h-11 w-full rounded-lg border border-chalk/40 font-semibold hover:border-chalk"
      >
        Sluiten
      </button>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-chalk/15 p-3">
      <dt className="text-xs uppercase tracking-wide text-chalk/60">{label}</dt>
      <dd className="mt-1 text-lg font-bold tabular-nums">{value}</dd>
    </div>
  );
}
