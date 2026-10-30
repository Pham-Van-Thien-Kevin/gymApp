"use client";
// Client Component: markeert de actieve link op basis van de URL in de browser.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

const items = [
  { href: "/trainer", label: "Cliënten" },
  { href: "/trainer/programs", label: "Schema's" },
  { href: "/trainer/exercises", label: "Oefeningen" },
  { href: "/trainer/rpe", label: "RPE-calculator" },
];

export function TrainerNav() {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/trainer"
      ? pathname === "/trainer" || pathname.startsWith("/trainer/clients")
      : pathname.startsWith(href);

  return (
    <nav aria-label="Trainermenu" className="overflow-x-auto px-3 pb-3 lg:px-3 lg:pb-0">
      <ul className="flex gap-1 lg:flex-col">
        {items.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={isActive(item.href) ? "page" : undefined}
              className={cn(
                "flex min-h-11 items-center rounded-lg px-3 font-medium whitespace-nowrap",
                isActive(item.href) ? "bg-lime text-on-lime" : "text-chalk/70 hover:bg-chalk/10 hover:text-chalk",
              )}
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
