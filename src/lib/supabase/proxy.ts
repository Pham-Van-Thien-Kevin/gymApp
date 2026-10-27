import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseEnv } from "./env";
import { homeForRole, isRole, type Role } from "@/lib/roles";

/**
 * Draait vóór elke pagina (via src/proxy.ts) en doet twee dingen:
 *
 * 1. Sessie verversen. Een access token is maar ±1 uur geldig. Is hij verlopen,
 *    dan vraagt Supabase met de refresh token een nieuwe aan en schrijven we de
 *    nieuwe cookies op het antwoord. Server Components kunnen dat zelf niet.
 * 2. Routes afschermen: niet ingelogd → /login, verkeerde rol → eigen startpagina.
 *
 * Dit is de eerste verdedigingslinie. De layouts van /app en /trainer
 * controleren de rol nog eens (zie src/lib/auth.ts), en RLS in de database is
 * de laatste. Zo hangt de beveiliging nooit van één plek af.
 */
export async function updateSession(request: NextRequest) {
  const { url, key } = getSupabaseEnv();
  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        // Nieuwe cookies op het request zetten (zodat de pagina ze ziet) én op
        // het antwoord (zodat de browser ze bewaart).
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        // Supabase stuurt "no-store"-headers mee zodat een CDN nooit iemands
        // sessie-cookie aan een andere gebruiker serveert.
        Object.entries(headers).forEach(([name, value]) => response.headers.set(name, value));
      },
    },
  });

  // getClaims() controleert de handtekening van de JWT. Gebruik op de server
  // nooit getSession(): die vertrouwt de cookie blind.
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims.sub;

  const path = request.nextUrl.pathname;
  const inMemberArea = path === "/app" || path.startsWith("/app/");
  const inTrainerArea = path === "/trainer" || path.startsWith("/trainer/");
  const onAuthPage = path === "/login" || path === "/register";

  // Een redirect moet de (mogelijk net ververste) cookies meenemen.
  const redirectTo = (target: string) => {
    const redirect = NextResponse.redirect(new URL(target, request.url));
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    response.headers.forEach((value, name) => {
      if (name !== "set-cookie") redirect.headers.set(name, value);
    });
    return redirect;
  };

  if (!userId) {
    if (inMemberArea || inTrainerArea) {
      return redirectTo(`/login?next=${encodeURIComponent(path)}`);
    }
    return response;
  }

  if (!inMemberArea && !inTrainerArea && !onAuthPage && path !== "/") {
    return response;
  }

  // De rol staat in profiles. RLS laat je altijd je eigen profiel lezen.
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", userId).maybeSingle();
  const role: Role | null = isRole(profile?.role) ? profile.role : null;

  if (!role) {
    // Ingelogd maar zonder profiel (trigger niet uitgevoerd?). Niet doorsturen
    // naar /app of /trainer, anders ontstaat er een redirect-lus.
    return inMemberArea || inTrainerArea ? redirectTo("/login?error=profile") : response;
  }

  const home = homeForRole(role);
  if (onAuthPage || path === "/") return redirectTo(home);
  if (inMemberArea && role !== "member") return redirectTo(home);
  if (inTrainerArea && role !== "trainer") return redirectTo(home);

  return response;
}
