// Server Component: statische pagina met een interactief formulier erin.
import type { Metadata } from "next";
import Link from "next/link";
import { RegisterForm } from "./register-form";

export const metadata: Metadata = { title: "Registreren" };

export default function RegisterPage() {
  return (
    <>
      <h1 className="text-4xl font-bold tracking-tight">Account maken</h1>
      <p className="mt-2 mb-8 text-chalk/70">Als sporter of als trainer.</p>
      <RegisterForm />
      <p className="mt-8 text-chalk/70">
        Al een account?{" "}
        <Link href="/login" className="font-semibold text-lime underline underline-offset-4">
          Log in
        </Link>
      </p>
    </>
  );
}
