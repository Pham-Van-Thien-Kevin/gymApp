// Server Component: rolcontrole op de server + de vaste structuur van het
// trainerdashboard (zijbalk op desktop, balk bovenaan op kleinere schermen).
import { requireRole } from "@/lib/auth";
import { APP_NAME } from "@/lib/config";
import { TrainerNav } from "./trainer-nav";
import { signOut } from "@/app/(auth)/actions";

export default async function TrainerLayout({ children }: LayoutProps<"/trainer">) {
  const profile = await requireRole("trainer");

  return (
    <div className="flex min-h-full flex-1 flex-col lg:flex-row">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:bg-lime focus:px-4 focus:py-2 focus:text-ink">
        Naar inhoud
      </a>
      <aside className="border-b border-chalk/15 lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-64 lg:shrink-0 lg:flex-col lg:border-r lg:border-b-0">
        <div className="flex items-center justify-between gap-4 px-5 py-4 lg:block lg:py-6">
          <p className="text-sm font-bold uppercase tracking-[0.3em]">
            <span aria-hidden="true" className="mr-2 inline-block size-2.5 bg-lime align-middle" />
            {APP_NAME}
          </p>
          <p className="hidden text-sm text-chalk/60 lg:mt-1 lg:block">Trainer</p>
          {/* Op kleine schermen is de zijbalk-footer verborgen: uitloggen staat dan hier. */}
          <form action={signOut} className="lg:hidden">
            <button type="submit" className="min-h-10 px-2 text-sm text-chalk/70 underline underline-offset-4 hover:text-chalk">
              Uitloggen
            </button>
          </form>
        </div>
        <TrainerNav />
        <div className="hidden border-t border-chalk/15 p-5 lg:mt-auto lg:block">
          <p className="truncate font-semibold">{profile.full_name}</p>
          <p className="mb-3 text-sm text-chalk/60">
            Code <span className="font-mono font-semibold text-lime">{profile.invite_code}</span>
          </p>
          <form action={signOut}>
            <button type="submit" className="text-sm text-chalk/70 underline underline-offset-4 hover:text-chalk">
              Uitloggen
            </button>
          </form>
        </div>
      </aside>
      <main id="main" className="w-full min-w-0 flex-1 px-4 py-8 sm:px-8 lg:px-12">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
