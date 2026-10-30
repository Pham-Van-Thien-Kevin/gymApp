// Server Component: meldingen voor de trainer (afgewerkte trainingen van cliënten).
import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { getNotifications } from "@/lib/data";
import { PageHeader } from "@/components/ui/layout";
import { NotificationList } from "@/components/notifications/notification-list";

export const metadata: Metadata = { title: "Meldingen" };

export default async function TrainerNotificationsPage() {
  await requireRole("trainer");
  return (
    <>
      <PageHeader title="Meldingen" description="Trainingen die je cliënten afgewerkt hebben." />
      <NotificationList notifications={await getNotifications(50)} />
    </>
  );
}
