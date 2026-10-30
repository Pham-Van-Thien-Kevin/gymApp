// Server Component: één week uit een blok van je sheet (bv. oktober, week 3).
// Je ziet welke sessies je deed en welke nog niet, en werkt de rest meteen af.
// Een blok verloopt pas als je aan een nieuwer blok begint.
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { isExpiredBlock } from "@/lib/blocks";
import { getBlockWeek, getCurrentBlockTab } from "@/lib/data";
import { formatDate } from "@/lib/dates";
import { parseMonthTab } from "@/lib/import/values";
import { ButtonLink } from "@/components/ui/button";
import { Badge, EmptyState, PageHeader } from "@/components/ui/layout";

export const metadata: Metadata = { title: "Week" };

export default async function BlockWeekPage({ searchParams }: PageProps<"/app/week">) {
  const profile = await requireRole("member");
  const { blok, week } = await searchParams;
  const tab = typeof blok === "string" && /^[A-Z]{3}\d{4}$/.test(blok) ? blok : null;
  const weekNumber = Number(week);
  const month = tab ? parseMonthTab(tab) : null;
  if (!tab || !month || !Number.isInteger(weekNumber) || weekNumber < 1 || weekNumber > 6) notFound();

  const [sessions, current] = await Promise.all([getBlockWeek(profile.id, tab, weekNumber), getCurrentBlockTab(profile.id)]);
  const expired = isExpiredBlock(tab, current);
  const monthName = formatDate(`${month.year}-${String(month.month + 1).padStart(2, "0")}-01`, { month: "long", year: "numeric" });
  const done = sessions.filter((s) => s.status === "completed").length;

  return (
    <>
      <Link href="/app/history" className="mb-4 inline-block text-sm text-chalk/70 underline underline-offset-4 hover:text-chalk">
        ← Historiek
      </Link>
      <PageHeader
        eyebrow={<span className="capitalize">{monthName}</span>}
        title={`Week ${weekNumber}`}
        description={
          sessions.length === 0
            ? undefined
            : expired
              ? `${done} van ${sessions.length} sessies gedaan. Dit blok is verlopen: je bent al aan een nieuwer blok begonnen.`
              : `${done} van ${sessions.length} sessies gedaan.`
        }
      />
      {sessions.length === 0 ? (
        <EmptyState title="Geen sessies in deze week">Deze week staat niet (meer) in je geïmporteerde sheet.</EmptyState>
      ) : (
        <ul className="divide-y divide-chalk/15 border-y border-chalk/15">
          {sessions.map((session) => (
            <li key={session.id} className="flex min-h-16 items-center gap-4 py-3 sm:px-2">
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{session.title}</p>
                <p className="text-sm text-chalk/60">
                  {session.exercise_count} oefeningen · {formatDate(session.date, { weekday: "long", day: "numeric", month: "short" })}
                </p>
              </div>
              {session.status === "completed" ? (
                <Link href={`/app/history/${session.id}`} className="text-sm font-semibold underline underline-offset-4">
                  Gedaan · bekijken
                </Link>
              ) : expired ? (
                <Badge>Verlopen</Badge>
              ) : (
                <ButtonLink href={`/app/log?gepland=${session.id}`} size="sm" aria-label={`${session.title} afwerken`}>
                  Afwerken
                </ButtonLink>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
