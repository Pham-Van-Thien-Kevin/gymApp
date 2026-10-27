import "server-only";
import { notFound } from "next/navigation";
import { requireRole, type Profile } from "@/lib/auth";
import { getMemberActivity } from "@/lib/data";
import type { MemberActivity } from "@/lib/types";

/**
 * Voor pagina's onder /trainer/clients/[id]: is dit een cliënt van mij?
 * RLS geeft enkel rijen van eigen cliënten terug, dus "geen rij" = geen toegang.
 * We tonen dan een 404 in plaats van "geen toegang", zodat je niet kan afleiden
 * welke id's bestaan.
 */
export async function requireClient(memberId: string): Promise<{ trainer: Profile; client: MemberActivity }> {
  const trainer = await requireRole("trainer");
  const [client] = await getMemberActivity(memberId);
  if (!client || client.trainer_id !== trainer.id) notFound();
  return { trainer, client };
}
