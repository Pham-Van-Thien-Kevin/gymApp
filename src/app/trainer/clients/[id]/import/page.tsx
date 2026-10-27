// Server Component: dezelfde importflow als in de gebruikersapp, maar voor een
// cliënt. requireClient controleert dat het om een eigen cliënt gaat; de
// Server Actions en RLS controleren dat daarna nog eens.
import Link from "next/link";
import { notFound } from "next/navigation";
import { isUuid } from "@/lib/parse";
import { requireClient } from "@/lib/trainer";
import { PageHeader, Section } from "@/components/ui/layout";
import { ImportFlow } from "@/components/import/import-flow";

export default async function ClientImportPage({ params }: PageProps<"/trainer/clients/[id]/import">) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const { client } = await requireClient(id);

  return (
    <>
      <Link href={`/trainer/clients/${id}`} className="mb-4 inline-block text-sm text-chalk/70 underline underline-offset-4 hover:text-chalk">
        ← {client.full_name}
      </Link>
      <PageHeader
        eyebrow={client.full_name}
        title="Importeren uit Google Sheets"
        description="Importeer de bestaande trainingen van je cliënt. Nieuwe oefeningen komen in jouw bibliotheek."
      />
      <Section className="max-w-4xl">
        <ImportFlow memberId={id} historyHref={`/trainer/clients/${id}#historiek`} />
      </Section>
    </>
  );
}
