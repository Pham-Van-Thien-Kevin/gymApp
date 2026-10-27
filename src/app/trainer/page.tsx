// Server Component: het overzicht van alle cliënten. Eén query op de view
// member_activity levert per cliënt de laatste training, trainingen deze week
// en de laatste check-in (RLS beperkt het tot je eigen cliënten).
import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { getMemberActivity } from "@/lib/data";
import { formatDate, formatWeek, relativeDays, todayISO } from "@/lib/dates";
import { clientFlags, INACTIVE_AFTER_DAYS, type ClientFlags } from "@/lib/flags";
import type { MemberActivity } from "@/lib/types";
import { Badge, EmptyState, PageHeader, Section, Stat } from "@/components/ui/layout";
import { RatingBadge } from "@/components/rating";
import { InviteCode } from "./invite-code";

export default async function TrainerOverview() {
  const trainer = await requireRole("trainer");
  const today = todayISO();
  const activity = await getMemberActivity();

  // Wie aandacht nodig heeft, staat bovenaan.
  const clients = activity
    .filter((client) => client.trainer_id === trainer.id)
    .map((client) => ({ client, flags: clientFlags(client, today) }))
    .sort((a, b) => Number(b.flags.needsAttention) - Number(a.flags.needsAttention) || a.client.full_name.localeCompare(b.client.full_name));

  const attention = clients.filter((c) => c.flags.needsAttention).length;
  const trainedThisWeek = clients.filter((c) => c.client.workouts_this_week > 0).length;

  return (
    <>
      <PageHeader eyebrow={formatDate(today, { weekday: "long", day: "numeric", month: "long" })} title="Cliënten" />

      <Section>
        <InviteCode code={trainer.invite_code ?? "------"} />
      </Section>

      {clients.length === 0 ? (
        <EmptyState title="Nog geen cliënten">
          Geef je uitnodigingscode aan je sporters. Zodra ze die invullen, verschijnen ze hier.
        </EmptyState>
      ) : (
        <>
          <Section>
            <div className="grid grid-cols-3 gap-3">
              <Stat label="Cliënten" value={clients.length} />
              <Stat label="Trainden deze week" value={trainedThisWeek} />
              <Stat label="Aandacht nodig" value={attention} hint={attention ? "zie markering ▲" : "alles in orde"} />
            </div>
          </Section>

          <Section title="Overzicht">
            {/* Desktop: tabel. Mobiel: kaartjes (een brede tabel past niet op een gsm). */}
            <table className="hidden w-full text-left md:table">
              <caption className="sr-only">Cliënten met laatste training, trainingen deze week en laatste check-in</caption>
              <thead className="text-sm text-chalk/60">
                <tr className="border-b border-chalk/15">
                  <th scope="col" className="py-3 font-medium">Cliënt</th>
                  <th scope="col" className="font-medium">Laatste training</th>
                  <th scope="col" className="font-medium">Deze week</th>
                  <th scope="col" className="font-medium">Laatste check-in</th>
                  <th scope="col" className="font-medium">
                    <span className="sr-only">Status</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {clients.map(({ client, flags }) => (
                  <tr key={client.member_id} className={flags.needsAttention ? "border-b border-chalk/15 bg-lime/5" : "border-b border-chalk/15"}>
                    <th scope="row" className="py-4 pr-4">
                      <Link href={`/trainer/clients/${client.member_id}`} className="font-semibold underline-offset-4 hover:underline">
                        {client.full_name}
                      </Link>
                    </th>
                    <td className="pr-4">
                      <LastWorkout client={client} flags={flags} />
                    </td>
                    <td className="pr-4 text-xl font-bold tabular-nums">{client.workouts_this_week}</td>
                    <td className="pr-4">
                      <LastCheckin client={client} />
                    </td>
                    <td className="text-right">
                      <Flags flags={flags} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <ul className="flex flex-col gap-3 md:hidden">
              {clients.map(({ client, flags }) => (
                <li key={client.member_id}>
                  <Link
                    href={`/trainer/clients/${client.member_id}`}
                    className={flags.needsAttention ? "block border-2 border-lime p-4" : "block border border-chalk/15 p-4"}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-lg font-semibold">{client.full_name}</p>
                      <Flags flags={flags} />
                    </div>
                    <dl className="mt-2 grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <dt className="text-chalk/60">Laatste training</dt>
                        <dd>
                          <LastWorkout client={client} flags={flags} />
                        </dd>
                      </div>
                      <div>
                        <dt className="text-chalk/60">Deze week</dt>
                        <dd className="font-bold tabular-nums">{client.workouts_this_week}</dd>
                      </div>
                      <div className="col-span-2">
                        <dt className="text-chalk/60">Laatste check-in</dt>
                        <dd>
                          <LastCheckin client={client} />
                        </dd>
                      </div>
                    </dl>
                  </Link>
                </li>
              ))}
            </ul>
          </Section>
        </>
      )}
    </>
  );
}

function LastWorkout({ client, flags }: { client: MemberActivity; flags: ClientFlags }) {
  if (!client.last_workout_date) return <span className="text-chalk/60">Nog nooit</span>;
  return (
    <span className={flags.inactive ? "font-bold" : undefined}>
      {formatDate(client.last_workout_date)} <span className="text-chalk/60">· {relativeDays(client.last_workout_date)}</span>
    </span>
  );
}

function LastCheckin({ client }: { client: MemberActivity }) {
  if (!client.last_checkin_week) return <span className="text-chalk/60">Geen</span>;
  return (
    <span className="flex flex-wrap items-center gap-1.5 text-sm">
      <span className="text-chalk/70 first-letter:uppercase">{formatWeek(client.last_checkin_week)}</span>
      <RatingBadge value={client.last_checkin_pain} label="Pijn" />
      {client.last_checkin_score !== null && <span className="tabular-nums text-chalk/70">· {client.last_checkin_score}/10</span>}
    </span>
  );
}

// Markering met symbool + tekst, nooit enkel kleur.
function Flags({ flags }: { flags: ClientFlags }) {
  if (!flags.needsAttention) return <span className="text-sm text-chalk/50">OK</span>;
  return (
    <span className="inline-flex flex-wrap justify-end gap-1">
      {flags.inactive && (
        <Badge strong>
          <span aria-hidden="true">▲</span>
          {flags.daysSinceWorkout === null ? "Nog niet getraind" : `${INACTIVE_AFTER_DAYS}+ dagen inactief`}
        </Badge>
      )}
      {flags.pain && (
        <Badge strong>
          <span aria-hidden="true">▲</span>
          Pijn: BAD
        </Badge>
      )}
    </span>
  );
}
