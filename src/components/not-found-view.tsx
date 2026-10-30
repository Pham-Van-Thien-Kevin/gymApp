// Server Component: de inhoud van elke 404-pagina. Ook getoond als RLS een
// rij verbergt (bv. de training van iemand anders): zo verraadt de app niet
// welke id's bestaan.
import { ButtonLink } from "@/components/ui/button";

export function NotFoundView({ homeHref, homeLabel }: { homeHref: string; homeLabel: string }) {
  return (
    <div className="rounded-xl border border-dashed border-chalk/30 p-8 sm:p-12">
      <p className="text-sm font-semibold uppercase tracking-widest text-chalk/60">404</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">Deze pagina bestaat niet</h1>
      <p className="mt-2 max-w-prose text-chalk/70">
        De link klopt niet, of je hebt geen toegang tot wat hier zou moeten staan.
      </p>
      <ButtonLink href={homeHref} className="mt-6">
        {homeLabel}
      </ButtonLink>
    </div>
  );
}
