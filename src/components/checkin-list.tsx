// Server Component: overzicht van wekelijkse check-ins (member én trainer).
import { Badge, EmptyState } from "@/components/ui/layout";
import { RatingBadge } from "@/components/rating";
import { formatWeek } from "@/lib/dates";
import type { Checkin } from "@/lib/types";

export function CheckinList({ checkins }: { checkins: Checkin[] }) {
  if (checkins.length === 0) return <EmptyState title="Nog geen check-ins" />;

  return (
    <ul className="divide-y divide-chalk/15 border-y border-chalk/15">
      {checkins.map((checkin) => (
        <li key={checkin.id} className="py-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="font-semibold first-letter:uppercase">{formatWeek(checkin.week_start)}</p>
            <div className="flex items-center gap-2">
              {checkin.import_batch_id && <Badge>Import</Badge>}
              {checkin.score !== null && (
                <p className="text-sm">
                  Cijfer <span className="text-lg font-bold tabular-nums">{checkin.score}</span>
                  <span className="text-chalk/60">/10</span>
                </p>
              )}
            </div>
          </div>
          <dl className="mt-2 flex flex-wrap gap-x-5 gap-y-2 text-sm">
            <Item label="Training"><RatingBadge value={checkin.training} label="Training" /></Item>
            <Item label="Motivatie"><RatingBadge value={checkin.motivation} label="Motivatie" /></Item>
            <Item label="Pijn/klachten"><RatingBadge value={checkin.pain} label="Pijn/klachten" /></Item>
            {checkin.overall_feeling && (
              <Item label="Algemeen"><RatingBadge value={checkin.overall_feeling} label="Algemeen gevoel" /></Item>
            )}
            {checkin.sessions_done !== null && <Item label="Sessies">{checkin.sessions_done}</Item>}
          </dl>
          {checkin.feedback && <p className="mt-2 whitespace-pre-wrap text-chalk/80">“{checkin.feedback}”</p>}
        </li>
      ))}
    </ul>
  );
}

function Item({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <dt className="text-chalk/60">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}
