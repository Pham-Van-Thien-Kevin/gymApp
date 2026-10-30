// Server Component: leest de querystring (?next=, ?error=) op de server en geeft
// die door aan het formulier. Het formulier zelf is een Client Component.
import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Inloggen" };

const errors: Record<string, string> = {
  profile: "Je profiel kon niet geladen worden. Controleer of supabase/schema.sql is uitgevoerd.",
  confirm: "De bevestigingslink is ongeldig of verlopen. Probeer opnieuw te registreren of in te loggen.",
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const next = typeof params.next === "string" ? params.next : "";
  const errorKey = typeof params.error === "string" ? params.error : "";

  return (
    <>
      <h1 className="text-4xl font-bold tracking-tight">Inloggen</h1>
      <p className="mt-2 mb-8 text-chalk/70">Log je training, volg je progressie.</p>
      <LoginForm next={next} initialError={errors[errorKey]} />
      <p className="mt-8 text-chalk/70">
        Nog geen account?{" "}
        <Link href="/register" className="font-semibold text-accent underline underline-offset-4">
          Registreer
        </Link>
      </p>
    </>
  );
}
