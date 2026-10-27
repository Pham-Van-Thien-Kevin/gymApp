"use server";
// Server Actions voor inloggen, registreren en uitloggen.
// "use server" bovenaan = elke export is een functie die op de server draait,
// ook al roep je hem aan vanuit een formulier in de browser. Wachtwoorden komen
// zo nooit in client-side JavaScript terecht en gaan rechtstreeks naar Supabase.
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { homeForRole, isRole } from "@/lib/roles";
import type { ActionState } from "@/components/ui/form";

/** Enkel doorsturen naar een pad binnen de eigen sectie: voorkomt "open redirects". */
function safeNext(next: string, home: string) {
  return next === home || next.startsWith(`${home}/`) ? next : home;
}

export async function signIn(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "");

  // Het wachtwoord sturen we nooit terug naar de browser, het e-mailadres wel.
  const values = { email };
  if (!email || !password) return { error: "Vul je e-mailadres en wachtwoord in.", values };

  const supabase = await createClient();
  // Supabase controleert het wachtwoord en zet bij succes de sessie-cookies
  // (via setAll in createClient).
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return {
      error:
        error.code === "email_not_confirmed"
          ? "Bevestig eerst je e-mailadres via de link in je mailbox."
          : "E-mailadres of wachtwoord klopt niet.",
      values,
    };
  }

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", data.user.id).maybeSingle();
  if (!isRole(profile?.role)) {
    return { error: "Je account heeft nog geen profiel. Is supabase/schema.sql uitgevoerd?", values };
  }

  // redirect() gooit intern een speciale fout; zet hem dus nooit in een try/catch.
  redirect(safeNext(next, homeForRole(profile.role)));
}

export async function signUp(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const fullName = String(formData.get("full_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const role = formData.get("role") === "trainer" ? "trainer" : "member";
  const inviteCode = String(formData.get("invite_code") ?? "").trim().toUpperCase();

  const values = { full_name: fullName, email, role, invite_code: inviteCode };
  const fieldErrors: Record<string, string> = {};
  if (!fullName) fieldErrors.full_name = "Vul je naam in.";
  if (!email.includes("@")) fieldErrors.email = "Vul een geldig e-mailadres in.";
  if (password.length < 8) fieldErrors.password = "Kies minstens 8 tekens.";
  if (Object.keys(fieldErrors).length) return { fieldErrors, values };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      // Deze metadata leest de trigger handle_new_user() om het profiel aan te
      // maken. Een kwaadwillige gebruiker kan hier "admin" invullen, maar de
      // trigger aanvaardt enkel 'member' of 'trainer'.
      data: { full_name: fullName, role, invite_code: role === "member" ? inviteCode : "" },
      emailRedirectTo: `${await getOrigin()}/auth/confirm`,
    },
  });

  if (error) {
    if (error.code === "user_already_exists") return { error: "Er bestaat al een account met dit e-mailadres.", values };
    if (error.code === "weak_password") return { fieldErrors: { password: "Dit wachtwoord is te zwak." }, values };
    return { error: `Registreren lukte niet: ${error.message}`, values };
  }

  // Staat "Confirm email" uit in Supabase, dan krijg je meteen een sessie.
  if (data.session) redirect(homeForRole(role));

  return { success: "Account aangemaakt! Klik op de link in je mailbox om je e-mailadres te bevestigen." };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

async function getOrigin() {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const protocol = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${protocol}://${host}`;
}
