// Server Component: de lijst meldingen, gedeeld door /app/meldingen en
// /trainer/meldingen. Ongelezen meldingen krijgen een accentstreep.
import Link from "next/link";
import { formatDate, relativeDays, toISODate } from "@/lib/dates";
import type { AppNotification } from "@/lib/types";
import { EmptyState } from "@/components/ui/layout";
import { MarkAllRead } from "./mark-all-read";

export function NotificationList({ notifications }: { notifications: AppNotification[] }) {
  if (notifications.length === 0) {
    return <EmptyState title="Nog geen meldingen">Hier verschijnen afgewerkte trainingen, nieuwe schema&apos;s en feedback.</EmptyState>;
  }
  const unread = notifications.filter((n) => !n.read_at).length;
  return (
    <>
      {unread > 0 && <MarkAllRead />}
      <ul className="divide-y divide-chalk/15 border-y border-chalk/15">
        {notifications.map((n) => {
          const day = toISODate(new Date(n.created_at));
          const content = (
            <>
              <p className="font-semibold">{n.title}</p>
              {n.body && <p className="text-sm text-chalk/70">{n.body}</p>}
              <p className="mt-1 text-xs text-chalk/50">
                {formatDate(day)} · {relativeDays(day)}
              </p>
            </>
          );
          return (
            <li key={n.id} className={n.read_at ? "py-3 sm:px-2" : "border-l-4 border-accent py-3 pl-3 sm:px-3"}>
              {n.read_at ? null : <span className="sr-only">Nieuw: </span>}
              {n.link ? (
                <Link href={n.link} className="block hover:underline">
                  {content}
                </Link>
              ) : (
                content
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}
