"use client";
// Client Component: de import is een stappenplan met state in de browser
// (gekozen bestand, preview, aangepaste datums). Het zware werk (downloaden,
// parsen, opslaan) gebeurt in Server Actions.
import Link from "next/link";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form";
import { cn } from "@/lib/cn";
import { confirmImport, previewImport, type ImportPreview } from "@/lib/import/actions";
import type { ImportChoices } from "@/lib/import/matching";
import { ImportPreviewView } from "./import-preview";

type Summary = { workouts: number; exercises: number; sets: number; checkins: number; strength_tests: number; new_exercises: number };

export function ImportFlow({
  memberId,
  historyHref,
  hasBottomNav = false,
}: {
  memberId: string;
  historyHref: string;
  /** In de gebruikersapp staat op mobiel een tabbalk onderaan; de actiebalk moet daarboven. */
  hasBottomNav?: boolean;
}) {
  const [mode, setMode] = useState<"link" | "upload">("link");
  const [link, setLink] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [choices, setChoices] = useState<ImportChoices | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Bij preview én bevestigen sturen we dezelfde bron mee: de server parset opnieuw.
  function sourceFormData() {
    const formData = new FormData();
    formData.set("member_id", memberId);
    formData.set("source", mode);
    if (mode === "link") formData.set("link", link);
    else if (file) formData.set("file", file);
    return formData;
  }

  function loadPreview() {
    setError(null);
    startTransition(async () => {
      const result = await previewImport(sourceFormData());
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setPreview(result.preview);
      setChoices(result.preview.defaults);
    });
  }

  function runImport() {
    if (!choices) return;
    setError(null);
    startTransition(async () => {
      const formData = sourceFormData();
      formData.set("choices", JSON.stringify(choices));
      const result = await confirmImport(formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSummary(result.summary);
    });
  }

  function reset() {
    setPreview(null);
    setChoices(null);
    setSummary(null);
    setError(null);
  }

  if (summary) {
    return (
      <div role="status" className="border-2 border-accent p-6">
        <p className="text-sm font-semibold uppercase tracking-widest">✓ Import voltooid</p>
        <p className="mt-2 text-2xl font-bold">
          {summary.workouts} trainingen, {summary.sets} sets geïmporteerd
        </p>
        <p className="mt-1 text-chalk/70">
          {summary.checkins} check-ins · {summary.strength_tests} maxima · {summary.new_exercises} nieuwe oefeningen
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          <Link href={historyHref} className="inline-flex min-h-12 items-center rounded-lg bg-lime px-5 font-semibold text-on-lime">
            Bekijk de trainingen
          </Link>
          <Button variant="ghost" onClick={reset}>
            Nog een import
          </Button>
        </div>
      </div>
    );
  }

  if (preview && choices) {
    return (
      <div className="flex flex-col gap-6">
        <ImportPreviewView preview={preview} choices={choices} onChange={setChoices} />
        <div
          className={cn(
            "sticky bottom-0 z-10 flex flex-col gap-3 border-t border-chalk/30 bg-ink py-4",
            hasBottomNav && "bottom-[calc(4rem+env(safe-area-inset-bottom))] md:bottom-0",
          )}
        >
          <FormMessage state={error ? { error } : null} />
          <p className="text-sm text-chalk/60">
            Al eerder geïmporteerd? Dan wordt de vorige import van dezelfde tab vervangen: geen dubbels.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button size="lg" onClick={runImport} disabled={isPending}>
              {isPending ? "Importeren…" : "Importeren"}
            </Button>
            <Button variant="ghost" size="lg" onClick={reset} disabled={isPending}>
              Annuleren
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div role="radiogroup" aria-label="Bron" className="grid overflow-hidden rounded-lg grid-cols-2 border border-chalk/30">
        {(["link", "upload"] as const).map((option) => (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={mode === option}
            onClick={() => setMode(option)}
            className={cn("min-h-12 font-semibold", mode === option ? "bg-lime text-on-lime" : "text-chalk/80 hover:bg-chalk/10")}
          >
            {option === "link" ? "Deellink plakken" : "Bestand uploaden"}
          </button>
        ))}
      </div>

      {/* key: React maakt een nieuw <input> bij wisselen. Anders hergebruikt hij
          hetzelfde element en wordt een "controlled" tekstveld een bestandsveld. */}
      {mode === "link" ? (
        <div key="link">
          <label htmlFor="sheet-link" className="label">
            Link naar je Google Sheet
          </label>
          <input
            id="sheet-link"
            type="url"
            className="field"
            placeholder="https://docs.google.com/spreadsheets/d/…"
            value={link}
            onChange={(event) => setLink(event.target.value)}
          />
          <p className="mt-1 text-sm text-chalk/60">De sheet moet gedeeld zijn met “Iedereen met de link”.</p>
        </div>
      ) : (
        <div key="upload">
          <label htmlFor="sheet-file" className="label">
            Excel-bestand (.xlsx)
          </label>
          <input
            id="sheet-file"
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="field file:mr-4 file:border-0 file:bg-lime file:px-3 file:py-1 file:font-semibold file:text-on-lime"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          />
          <p className="mt-1 text-sm text-chalk/60">In Google Sheets: Bestand → Downloaden → Microsoft Excel (.xlsx).</p>
        </div>
      )}

      <FormMessage state={error ? { error } : null} />
      <Button size="lg" onClick={loadPreview} disabled={isPending || (mode === "link" ? !link.trim() : !file)} className="self-start">
        {isPending ? "Sheet lezen…" : "Voorbeeld tonen"}
      </Button>
    </div>
  );
}
