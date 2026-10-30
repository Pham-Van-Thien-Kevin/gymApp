// Server Component: je meldingen (nieuw schema, feedback van je trainer).
import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { getNotifications } from "@/lib/data";
import { PageHeader } from "@/components/ui/layout";
import { NotificationList } from "@/components/notifications/notification-list";

export const metadata: Metadata = { title: "Meldingen" };

export default async function MemberNotificationsPage() {
  await requireRole("member");
  return (
    <>
      <PageHeader title="Meldingen" description="Nieuwe schema's en feedback van je trainer." />
      <NotificationList notifications={await getNotifications()} />
    </>
  );
}
