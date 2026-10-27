// Server Component: haalt bestaande check-ins op en rendert het formulier
// (Client Component) plus de lijst met vorige weken.
import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { getCheckins } from "@/lib/data";
import { addDays, startOfWeek, todayISO } from "@/lib/dates";
import { PageHeader, Section } from "@/components/ui/layout";
import { CheckinList } from "@/components/checkin-list";
import { CheckinForm } from "./checkin-form";

export const metadata: Metadata = { title: "Wekelijkse check-in" };

export default async function CheckinPage() {
  const profile = await requireRole("member");
  const checkins = await getCheckins(profile.id, 12);
  const thisWeek = startOfWeek(todayISO());
  const weeks = [thisWeek, addDays(thisWeek, -7)];
  const existing = Object.fromEntries(checkins.filter((c) => weeks.includes(c.week_start)).map((c) => [c.week_start, c]));

  return (
    <>
      <PageHeader
        title="Wekelijkse check-in"
        description="Eén keer per week: hoe liep je training, je motivatie en heb je ergens pijn?"
      />
      <Section>
        <CheckinForm weeks={weeks} existing={existing} />
      </Section>
      <Section title="Vorige check-ins">
        <CheckinList checkins={checkins} />
      </Section>
    </>
  );
}
