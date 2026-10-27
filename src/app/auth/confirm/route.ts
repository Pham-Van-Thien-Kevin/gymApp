// Route Handler (geen pagina): hierop komt de gebruiker terecht na een klik op
// de bevestigingslink in de e-mail van Supabase.
import type { EmailOtpType } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const tokenHash = params.get("token_hash");
  const type = params.get("type") as EmailOtpType | null;
  const code = params.get("code");
  const supabase = await createClient();

  let ok = false;
  if (tokenHash && type) {
    // Aanbevolen e-mailtemplate (zie README): werkt ook als je de link in een
    // andere browser opent dan waarin je registreerde.
    ok = !(await supabase.auth.verifyOtp({ type, token_hash: tokenHash })).error;
  } else if (code) {
    // Standaard-template van Supabase (PKCE): ruilt de code in voor een sessie.
    ok = !(await supabase.auth.exchangeCodeForSession(code)).error;
  }

  // "/" stuurt de proxy door naar /app of /trainer, afhankelijk van de rol.
  redirect(ok ? "/" : "/login?error=confirm");
}
