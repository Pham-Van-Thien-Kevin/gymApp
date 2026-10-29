// Server Component: detail van één training. notFound() toont de 404-pagina
// als de training niet bestaat óf als RLS ze verbergt (andermans training).
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { getWorkoutDetail } from "@/lib/data";
import { isUuid } from "@/lib/parse";
import { ButtonLink } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form";
import { PageHeader } from "@/components/ui/layout";
import { WorkoutDetail } from "@/components/workout-detail";
import { DeleteWorkoutButton } from "./delete-workout-button";

export default async function WorkoutPage({ params, searchParams }: PageProps<"/app/history/[id]">) {
  await requireRole("member");
  const { id } = await params;
  const { saved } = await searchParams;
  if (!isUuid(id)) notFound();

  const workout = await getWorkoutDetail(id);
  if (!workout) notFound();

  return (
    <>
      <Link href="/app/history" className="mb-4 inline-block text-sm text-chalk/70 underline underline-offset-4 hover:text-chalk">
        ← Historiek
      </Link>
      <PageHeader
        title={workout.title ?? "Training"}
        actions={
          <>
            {workout.status === "planned" && (
              <ButtonLink href={`/app/log?gepland=${workout.id}`} size="sm">
                Afwerken
              </ButtonLink>
            )}
            <DeleteWorkoutButton workoutId={workout.id} />
          </>
        }
      />
      {saved && (
        <div className="mb-6">
          <FormMessage state={{ success: "Training opgeslagen. Sterk werk!" }} />
        </div>
      )}
      <WorkoutDetail workout={workout} />
    </>
  );
}
