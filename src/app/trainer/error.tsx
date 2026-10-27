"use client";
// Client Component (verplicht voor error.tsx): vangt fouten op in elke pagina
// van deze sectie, terwijl de layout met navigatie gewoon blijft staan.
import { ErrorView } from "@/components/error-view";

export default function SectionError({ error, retry }: { error: unknown; retry: () => void }) {
  return <ErrorView error={error} retry={retry} />;
}
