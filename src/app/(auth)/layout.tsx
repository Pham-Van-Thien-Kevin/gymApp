// Server Component: een simpele, gecentreerde layout voor login en registratie.
// De haakjes in "(auth)" maken er een route group van: de map telt niet mee in
// de URL, dus deze pagina's staan op /login en /register.
import type { ReactNode } from "react";
import { APP_NAME } from "@/lib/config";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 py-12">
      <p className="mb-10 text-sm font-bold uppercase tracking-[0.3em]">
        <span aria-hidden="true" className="mr-2 inline-block size-2.5 bg-lime align-middle" />
        {APP_NAME}
      </p>
      {children}
    </main>
  );
}
