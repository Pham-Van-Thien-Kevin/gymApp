// Server Component: lijst van de schema's van deze trainer + formulier om een
// nieuw schema te starten.
import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ActionForm } from "@/components/ui/action-form";
import { Field, TextareaField } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { Card, EmptyState, PageHeader, Section } from "@/components/ui/layout";
import { createProgram } from "./actions";

export const metadata: Metadata = { title: "Schema's" };

export default async function ProgramsPage() {
  const trainer = await requireRole("trainer");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("programs")
    .select("id, name, description, program_days(count), program_assignments(active)")
    .eq("trainer_id", trainer.id)
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);

  return (
    <>
      <PageHeader title="Schema's" description="Maak schema's met dagen en oefeningen, en wijs ze toe aan je cliënten." />

      <div className="grid gap-10 lg:grid-cols-[1fr_22rem]">
        <Section title="Jouw schema's">
          {data.length === 0 ? (
            <EmptyState title="Nog geen schema's">Maak rechts je eerste schema.</EmptyState>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {data.map((program) => {
                const days = program.program_days?.[0]?.count ?? 0;
                const active = (program.program_assignments as { active: boolean }[]).filter((a) => a.active).length;
                return (
                  <li key={program.id}>
                    <Link href={`/trainer/programs/${program.id}`} className="block h-full border border-chalk/15 p-5 hover:border-chalk">
                      <p className="text-lg font-bold">{program.name}</p>
                      {program.description && <p className="mt-1 line-clamp-2 text-sm text-chalk/70">{program.description}</p>}
                      <p className="mt-3 text-sm text-chalk/60">
                        {days} {days === 1 ? "dag" : "dagen"} · {active} {active === 1 ? "actieve cliënt" : "actieve cliënten"}
                      </p>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Section>

        <Section title="Nieuw schema">
          <Card>
            <ActionForm action={createProgram}>
              <Field label="Naam" name="name" required maxLength={100} placeholder="Blok 4 · Peaking" />
              <TextareaField label="Beschrijving (optioneel)" name="description" maxLength={1000} />
              <SubmitButton>Schema maken</SubmitButton>
            </ActionForm>
          </Card>
        </Section>
      </div>
    </>
  );
}
