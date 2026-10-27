"use client";
// Client Component: een timer heeft een klok nodig die elke seconde verder
// tikt in de browser. Dat kan alleen met state + een interval.
import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";

const PRESETS = [60, 90, 120, 180];

function format(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * We bewaren het EINDtijdstip (endAt), niet "nog X seconden". Een telefoon
 * pauzeert intervals als het scherm uit gaat; met een eindtijdstip klopt de
 * resterende tijd toch nog wanneer je terugkomt.
 */
export function RestTimer({
  endAt,
  defaultSeconds,
  onStart,
  onStop,
  onChangeDefault,
}: {
  endAt: number | null;
  defaultSeconds: number;
  onStart: (seconds: number) => void;
  onStop: () => void;
  onChangeDefault: (seconds: number) => void;
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (endAt === null) return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [endAt]);

  const remaining = endAt === null ? null : Math.max(0, Math.ceil((endAt - now) / 1000));
  const finished = remaining === 0;

  useEffect(() => {
    if (finished) navigator.vibrate?.([200, 100, 200]);
  }, [finished]);

  return (
    <div
      className={cn(
        "fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-20 border-t border-chalk/30 md:bottom-0",
        finished ? "bg-lime text-ink" : "bg-ink",
      )}
    >
      <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-2">
        <p className="w-20 text-2xl font-bold tabular-nums" aria-hidden="true">
          {remaining === null ? format(defaultSeconds) : format(remaining)}
        </p>
        {/* Schermlezers horen enkel het moment waarop de rust voorbij is. */}
        <p className="sr-only" aria-live="assertive">
          {finished ? "Rust voorbij, volgende set!" : ""}
        </p>
        {endAt === null ? (
          <>
            <label className="sr-only" htmlFor="rest-default">
              Rusttijd
            </label>
            <select
              id="rest-default"
              value={defaultSeconds}
              onChange={(event) => onChangeDefault(Number(event.target.value))}
              className="min-h-11 border border-chalk/30 px-2 text-sm"
            >
              {PRESETS.map((seconds) => (
                <option key={seconds} value={seconds}>
                  {format(seconds)} rust
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => onStart(defaultSeconds)}
              className="ml-auto min-h-11 bg-lime px-4 font-semibold text-ink"
            >
              Start rust
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => onStart((remaining ?? 0) + 15)}
              className={cn("min-h-11 border px-3 text-sm font-semibold", finished ? "border-ink/40" : "border-chalk/40")}
            >
              +15 s
            </button>
            <button
              type="button"
              onClick={onStop}
              className={cn("ml-auto min-h-11 px-4 font-semibold", finished ? "bg-ink text-lime" : "bg-lime text-ink")}
            >
              {finished ? "Klaar" : "Stop"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
