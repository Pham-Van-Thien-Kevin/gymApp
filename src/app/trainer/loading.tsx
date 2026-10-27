// Server Component: loading.tsx wordt automatisch in een <Suspense> rond de
// pagina gezet. Dit skelet staat meteen op het scherm terwijl de data laadt.
import { PageSkeleton } from "@/components/ui/layout";

export default function Loading() {
  return <PageSkeleton />;
}
