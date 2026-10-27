// Server Component: profielgegevens worden op de server gelezen; de formulieren
// zelf zijn kleine Client Components.
import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import { Card, PageHeader, Section } from "@/components/ui/layout";
import { leaveTrainer } from "./actions";
import { JoinTrainerForm, NameForm } from "./profile-forms";

export const metadata: Metadata = { title: "Profiel" };

export default async function ProfilePage() {
  const profile = await requireRole("member");

  let trainerName: string | null = null;
  if (profile.trainer_id) {
    const supabase = await createClient();
    // RLS laat een member het profiel van zijn eigen trainer lezen.
    const { data } = await supabase.from("profiles").select("full_name").eq("id", profile.trainer_id).maybeSingle();
    trainerName = data?.full_name ?? null;
  }

  return (
    <>
      <PageHeader title="Profiel" description={profile.email} />

      <Section title="Gegevens">
        <NameForm fullName={profile.full_name} />
      </Section>

      <Section title="Trainer">
        {profile.trainer_id ? (
          <Card>
            <p className="text-sm text-chalk/60">Gekoppeld aan</p>
            <p className="text-xl font-bold">{trainerName ?? "Je trainer"}</p>
            <p className="mt-2 text-sm text-chalk/70">
              Je trainer kan je trainingen, progressie en check-ins bekijken en feedback geven.
            </p>
            <form action={leaveTrainer} className="mt-4">
              <Button type="submit" variant="ghost" size="sm">
                Ontkoppelen
              </Button>
            </form>
          </Card>
        ) : (
          <JoinTrainerForm />
        )}
      </Section>

      <Section title="Meer">
        <ul className="divide-y divide-chalk/15 border-y border-chalk/15">
          {[
            { href: "/app/history", label: "Historiek" },
            { href: "/app/checkin", label: "Wekelijkse check-in" },
            { href: "/app/import", label: "Importeren uit Google Sheets" },
          ].map((item) => (
            <li key={item.href}>
              <Link href={item.href} className="flex min-h-14 items-center justify-between font-medium hover:bg-chalk/5">
                {item.label}
                <span aria-hidden="true">→</span>
              </Link>
            </li>
          ))}
        </ul>
      </Section>

      <form action={signOut}>
        <Button type="submit" variant="secondary" size="lg" className="w-full sm:w-auto">
          Uitloggen
        </Button>
      </form>
    </>
  );
}
