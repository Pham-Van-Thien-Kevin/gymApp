import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseEnv } from "./env";

/**
 * Supabase-client voor de server: Server Components, Server Actions en Route Handlers.
 *
 * Auth-uitleg: de sessie (access token + refresh token) zit in cookies. Deze
 * client leest die cookies, zodat elke query als de ingelogde gebruiker naar
 * Supabase gaat, en Postgres dus de juiste RLS-policies toepast.
 *
 * Maak per request een nieuwe client (deze functie aanroepen), nooit één
 * gedeelde client: anders zou de sessie van gebruiker A bij gebruiker B lekken.
 */
export async function createClient() {
  // Eerst cookies() lezen: dat vertelt Next.js dat deze pagina per request
  // gerenderd moet worden (dynamisch) en niet tijdens de build.
  const cookieStore = await cookies();
  const { url, key } = getSupabaseEnv();

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // In een Server Component mag je geen cookies schrijven (enkel in
          // Server Actions en Route Handlers). Dat is geen probleem: de proxy
          // (src/proxy.ts) ververst de sessie al vóór elke pagina.
        }
      },
    },
  });
}
