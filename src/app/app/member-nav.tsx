"use client";
// Client Component: usePathname() leest de huidige URL in de browser, zodat de
// actieve tab gemarkeerd wordt (aria-current="page" voor schermlezers).
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

const primary = [
  { href: "/app", label: "Home" },
  { href: "/app/schema", label: "Schema" },
  { href: "/app/log", label: "Loggen" },
  { href: "/app/progress", label: "Progressie" },
];

const more = [
  { href: "/app/history", label: "Historiek" },
  { href: "/app/checkin", label: "Check-in" },
  { href: "/app/rpe", label: "RPE-calculator" },
  { href: "/app/import", label: "Import" },
  { href: "/app/profile", label: "Profiel" },
];

function isActive(pathname: string, href: string) {
  return href === "/app" ? pathname === "/app" : pathname === href || pathname.startsWith(`${href}/`);
}

export function MemberNav({ variant }: { variant: "top" | "bottom" }) {
  const pathname = usePathname();

  const moreActive = more.some((item) => isActive(pathname, item.href));

  if (variant === "top") {
    // Vanaf tablet: de vier hoofdlinks + "Meer" in een balk bovenaan. Alle negen
    // links naast elkaar passen niet in de kopbalk.
    return (
      <nav aria-label="Hoofdmenu" className="hidden md:block">
        <ul className="flex gap-1">
          {primary.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={isActive(pathname, item.href) ? "page" : undefined}
                className={cn(
                  "flex min-h-10 items-center px-3 text-sm font-medium",
                  isActive(pathname, item.href) ? "bg-lime text-ink" : "text-chalk/70 hover:text-chalk",
                )}
              >
                {item.label}
              </Link>
            </li>
          ))}
          <li>
            <button
              type="button"
              popoverTarget="member-more-top"
              className={cn(
                "flex min-h-10 items-center gap-1 px-3 text-sm font-medium",
                moreActive ? "bg-lime text-ink" : "text-chalk/70 hover:text-chalk",
              )}
            >
              Meer <span aria-hidden="true">▾</span>
            </button>
          </li>
        </ul>
        {/* Rechts uitgelijnd met de inhoud: (schermbreedte − 48rem) / 2 + de 1rem padding. */}
        <MoreMenu
          id="member-more-top"
          pathname={pathname}
          className="fixed top-14 right-[max(1rem,calc((100vw-48rem)/2+1rem))] bottom-auto left-auto m-0 w-60 border border-chalk/30 bg-ink p-2 text-chalk"
          itemClassName="min-h-11 px-3 text-base"
        />
      </nav>
    );
  }

  // Mobiel: tabbalk onderaan, binnen bereik van je duim. "Meer" opent een menu
  // via het native popover-attribuut: toegankelijk en zonder extra JavaScript.
  return (
    <nav aria-label="Hoofdmenu" className="fixed inset-x-0 bottom-0 z-30 border-t border-chalk/15 bg-ink pb-[env(safe-area-inset-bottom)] md:hidden">
      <ul className="grid grid-cols-5">
        {primary.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={isActive(pathname, item.href) ? "page" : undefined}
              className={cn(
                "flex min-h-16 flex-col items-center justify-center text-xs font-semibold",
                item.href === "/app/log" && "m-1.5 min-h-13 bg-lime text-ink",
                item.href !== "/app/log" && (isActive(pathname, item.href) ? "text-lime" : "text-chalk/60"),
              )}
            >
              <span aria-hidden="true" className={cn("mb-1 h-0.5 w-5", isActive(pathname, item.href) && item.href !== "/app/log" ? "bg-lime" : "bg-transparent")} />
              {item.label}
            </Link>
          </li>
        ))}
        <li>
          <button
            type="button"
            popoverTarget="member-more"
            className={cn("flex min-h-16 w-full flex-col items-center justify-center text-xs font-semibold", moreActive ? "text-lime" : "text-chalk/60")}
          >
            <span aria-hidden="true" className={cn("mb-1 h-0.5 w-5", moreActive ? "bg-lime" : "bg-transparent")} />
            Meer
          </button>
        </li>
      </ul>
      <MoreMenu
        id="member-more"
        pathname={pathname}
        className="fixed inset-x-0 top-auto bottom-[calc(4rem+env(safe-area-inset-bottom))] m-0 w-full border-t border-chalk/30 bg-ink p-2 text-chalk"
        itemClassName="min-h-14 px-4 text-lg"
      />
    </nav>
  );
}

/**
 * Het "Meer"-menu. Het native popover-attribuut regelt openen, sluiten met Esc
 * of een klik ernaast, en de focus: toegankelijk zonder eigen JavaScript.
 */
function MoreMenu({ id, pathname, className, itemClassName }: { id: string; pathname: string; className: string; itemClassName: string }) {
  return (
    <div id={id} popover="auto" className={className}>
      <ul>
        {more.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={isActive(pathname, item.href) ? "page" : undefined}
              onClick={() => document.getElementById(id)?.hidePopover()}
              className={cn(
                "flex items-center font-semibold",
                itemClassName,
                isActive(pathname, item.href) ? "bg-lime text-ink" : "hover:bg-chalk/10",
              )}
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
