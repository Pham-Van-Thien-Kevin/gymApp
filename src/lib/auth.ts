import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { homeForRole, isRole, type Role } from "@/lib/roles";

export type Profile = {
  id: string;
  email: string | null;
  full_name: string;
  role: Role;
  trainer_id: string | null;
  invite_code: string | null;
};

/**
 * Data Access Layer voor de ingelogde gebruiker.
 *
 * `cache()` van React onthoudt het resultaat tijdens één request. De layout én
 * de pagina mogen deze functie dus allebei aanroepen: de database wordt maar
 * één keer bevraagd.
 */
export const getCurrentProfile = cache(async (): Promise<Profile | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, role, trainer_id, invite_code")
    .eq("id", claims.sub)
    .maybeSingle();

  if (!profile || !isRole(profile.role)) return null;
  return { ...profile, email: typeof claims.email === "string" ? claims.email : null };
});

/**
 * Gebruik dit bovenaan elke layout, pagina en Server Action die een rol vereist.
 *
 * Waarom ook hier, als de proxy al controleert? De proxy draait niet bij elke
 * manier waarop code uitgevoerd wordt (Server Actions zijn gewone POST-requests
 * die je ook buiten de UI kan sturen), en een fout in de matcher mag niet
 * meteen een datalek betekenen. Defense in depth.
 */
export async function requireRole(role: Role): Promise<Profile> {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.role !== role) redirect(homeForRole(profile.role));
  return profile;
}
