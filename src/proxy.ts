import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

// Next.js 16 noemt "middleware" voortaan "proxy": zelfde werking, nieuwe naam.
// Deze functie draait op de server vóór elke request die door de matcher komt.
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // Alles behalve statische bestanden en afbeeldingen: daar is geen sessie voor nodig.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
