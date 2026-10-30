// Server Component: controleert de rol op de server vóór er iets gerenderd wordt.
// De map heet "app" omdat de URL /app is (src/app/ is de App Router-map zelf).
import { requireRole } from "@/lib/auth";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { APP_NAME } from "@/lib/config";
import { MemberNav } from "./member-nav";

export default async function MemberLayout({ children }: LayoutProps<"/app">) {
  // Tweede controle naast de proxy: is dit écht een member? Zo niet, dan
  // stuurt requireRole door en wordt geen enkele pagina hieronder gerenderd.
  await requireRole("member");

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:bg-lime focus:px-4 focus:py-2 focus:text-on-lime">
        Naar inhoud
      </a>
      <header className="sticky top-0 z-30 border-b border-chalk/15 bg-ink">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
          <p className="text-sm font-bold uppercase tracking-[0.3em]">
            <span aria-hidden="true" className="mr-2 inline-block size-2.5 rounded-[3px] bg-accent align-middle" />
            {APP_NAME}
          </p>
          <div className="flex items-center gap-1">
            <MemberNav variant="top" />
            <ThemeToggle />
          </div>
        </div>
      </header>
      <main id="main" className="mx-auto w-full max-w-3xl flex-1 px-4 pt-6 pb-28 md:pb-12">
        {children}
      </main>
      <MemberNav variant="bottom" />
    </div>
  );
}
