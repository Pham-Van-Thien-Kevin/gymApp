"use client";
// Client Component: de bel met het aantal ongelezen meldingen. Het startgetal
// komt van de server; via Supabase Realtime telt hij live verder als er een
// nieuwe melding binnenkomt (bv. je trainer zet een schema online).
import { useEffect, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { getBrowserClient } from "@/lib/supabase/client";

export function NotificationBell({ userId, initialCount, href, className }: { userId: string; initialCount: number; href: string; className?: string }) {
  const [count, setCount] = useState(initialCount);
  // Nieuwe server-render (bv. na "alles gelezen") → het getal van de server volgen.
  const [lastInitial, setLastInitial] = useState(initialCount);
  if (initialCount !== lastInitial) {
    setLastInitial(initialCount);
    setCount(initialCount);
  }

  useEffect(() => {
    const supabase = getBrowserClient();
    // Luister enkel naar NIEUWE rijen voor jou. De filter is een optimalisatie;
    // de echte beveiliging is RLS, die Realtime ook toepast.
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` }, () =>
        setCount((current) => current + 1),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const label = count === 0 ? "Meldingen" : `Meldingen, ${count} ongelezen`;
  return (
    <Link
      href={href}
      aria-label={label}
      className={cn("relative inline-flex size-10 items-center justify-center rounded-lg text-chalk/70 hover:bg-chalk/10 hover:text-chalk", className)}
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
        <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
      </svg>
      {count > 0 && (
        <span aria-hidden="true" className="absolute top-1 right-1 flex min-w-4 items-center justify-center rounded-full bg-lime px-1 text-[10px] font-bold leading-4 text-on-lime">
          {count > 9 ? "9+" : count}
        </span>
      )}
    </Link>
  );
}
