// Server Component: de startpagina heeft geen eigen inhoud. De proxy stuurt
// ingelogde gebruikers al door; dit is de vangnet-versie van dezelfde logica.
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { homeForRole } from "@/lib/roles";

export default async function RootPage() {
  const profile = await getCurrentProfile();
  redirect(profile ? homeForRole(profile.role) : "/login");
}
