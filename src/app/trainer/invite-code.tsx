"use client";
// Client Component: kopiëren naar het klembord (navigator.clipboard) en een
// bevestiging vragen kan enkel in de browser.
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { regenerateInviteCode } from "./actions";

export function InviteCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-4 border border-chalk/20 p-5 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-sm text-chalk/70">Jouw uitnodigingscode</p>
        <p className="font-mono text-4xl font-bold tracking-[0.2em] text-lime">{code}</p>
        <p className="mt-1 text-sm text-chalk/60">Cliënten vullen deze code in bij registratie of in hun profiel.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(code);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            } catch {
              setCopied(false);
            }
          }}
        >
          <span aria-live="polite">{copied ? "✓ Gekopieerd" : "Kopiëren"}</span>
        </Button>
        <Button
          variant="ghost"
          disabled={isPending}
          onClick={() => {
            if (!window.confirm("Nieuwe code maken? De oude code werkt dan niet meer (bestaande cliënten blijven gekoppeld).")) return;
            startTransition(() => regenerateInviteCode());
          }}
        >
          {isPending ? "Vernieuwen…" : "Vernieuwen"}
        </Button>
      </div>
    </div>
  );
}
