"use client";
// Supabase-client voor de BROWSER. Enkel gebruikt voor Realtime (de bel die
// nieuwe meldingen meteen hoort). Alle gewone data gaat via de server.
//
// createBrowserClient leest de sessie uit dezelfde cookies als de server, dus
// Realtime weet wie je bent en RLS geldt ook hier: je hoort enkel je eigen meldingen.
import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseEnv } from "./env";

let client: ReturnType<typeof createBrowserClient> | null = null;

/** Eén client per tabblad: elke client opent een eigen websocket. */
export function getBrowserClient() {
  if (!client) {
    const { url, key } = getSupabaseEnv();
    client = createBrowserClient(url, key);
  }
  return client;
}
