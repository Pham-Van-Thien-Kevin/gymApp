"use client";
// Client Component: de blokopbouw van een schema. Client-side omdat het formulier
// meteen moet reageren op het vinkje: staat het uit, dan zijn de velden grijs en
// staat er duidelijk "Uit". Vroeger stonden 4 weken / RPE 6 / 9 altijd ingevuld,
// waardoor het leek alsof het blok aan stond terwijl dat niet zo was.
import { useState } from "react";
import { ActionForm } from "@/components/ui/action-form";
import { Field } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { cn } from "@/lib/cn";
import { parseDecimal, parseInteger } from "@/lib/parse";
import { blockRpe, formatRpeTarget, type BlockSettings } from "@/lib/program";
import { updateBlock } from "../actions";

export function BlockEditor({ programId, settings }: { programId: string; settings: BlockSettings }) {
  const savedOn = settings.block_weeks !== null;
  const [on, setOn] = useState(savedOn);
  const [weeks, setWeeks] = useState(String(settings.block_weeks ?? 4));
  const [start, setStart] = useState(formatRpeTarget(settings.rpe_start ?? 6));
  const [end, setEnd] = useState(formatRpeTarget(settings.rpe_end ?? 9));

  // Voorbeeld van wat je invult, al vóór je opslaat.
  const draft = { block_weeks: parseInteger(weeks), rpe_start: parseDecimal(start), rpe_end: parseDecimal(end) };
  const valid = draft.block_weeks !== null && draft.block_weeks >= 2 && draft.block_weeks <= 12 && draft.rpe_start !== null && draft.rpe_end !== null;
  const preview = valid ? Array.from({ length: draft.block_weeks! }, (_, i) => blockRpe(draft, i + 1)) : [];

  return (
    <ActionForm action={updateBlock.bind(null, programId)}>
      <div className="flex flex-col gap-3">
        <p className="text-sm">
          Status:{" "}
          <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold uppercase", savedOn ? "bg-lime text-on-lime" : "border border-chalk/40")}>
            {savedOn ? "Aan" : "Uit"}
          </span>
          {on !== savedOn && <span className="ml-2 text-chalk/60">(nog niet opgeslagen)</span>}
        </p>
        <label className="flex items-start gap-3">
          <input type="checkbox" name="enabled" checked={on} onChange={(event) => setOn(event.target.checked)} className="mt-1 size-5 accent-accent" />
          <span>
            <span className="font-semibold">Automatisch blok</span>
            <span className="block text-sm text-chalk/60">Elke week gaat de RPE van squat, bench en deadlift en hun varianten (paused, close grip, tempo, Larsen) omhoog. Accessoires houden de RPE die je hieronder invult.</span>
          </span>
        </label>
        {/* fieldset disabled: grijs en niet in te vullen zolang het vinkje uit staat. */}
        <fieldset disabled={!on} className={cn("grid grid-cols-3 gap-2", !on && "opacity-40")}>
          <Field label="Weken" name="block_weeks" type="number" min={2} max={12} value={weeks} onChange={(event) => setWeeks(event.target.value)} />
          <Field label="RPE start" name="rpe_start" inputMode="decimal" value={start} onChange={(event) => setStart(event.target.value)} />
          <Field label="RPE eind" name="rpe_end" inputMode="decimal" value={end} onChange={(event) => setEnd(event.target.value)} />
        </fieldset>
        {on && valid && <p className="text-sm text-chalk/70">{preview.map((rpe, i) => `W${i + 1}: RPE ${formatRpeTarget(rpe ?? 0)}`).join(" · ")}</p>}
        {!on && <p className="text-sm text-chalk/60">Uit: elke oefening gebruikt de vaste RPE die je hieronder per oefening invult.</p>}
        <SubmitButton variant="secondary">Opslaan</SubmitButton>
      </div>
    </ActionForm>
  );
}
