// Server Component: detail van één training. notFound() toont de 404-pagina
// als de training niet bestaat óf als RLS ze verbergt (andermans training).
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { getCurrentBlockTab, getWorkoutDetail } from "@/lib/data";
import { isUuid } from "@/lib/parse";
import { isExpiredBlock } from "@/lib/blocks";
import { ButtonLink } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form";
import { PageHeader } from "@/components/ui/layout";
import { WorkoutDetail } from "@/components/workout-detail";
import { DeleteWorkoutButton } from "./delete-workout-button";

export default async function WorkoutPage({ params, searchParams }: PageProps<"/app/history/[id]">) {
  const profile = await requireRole("member");
  const { id } = await params;
  const { saved } = await searchParams;
  if (!isUuid(id)) notFound();

  const [workout, current] = await Promise.all([getWorkoutDetail(id), getCurrentBlockTab(profile.id)]);
  if (!workout) notFound();
  const expired = isExpiredBlock(workout.import_batch?.sheet_tab, current);

  return (
    <>
      <Link href="/app/history" className="mb-4 inline-block text-sm text-chalk/70 underline underline-offset-4 hover:text-chalk">
        ← Historiek
      </Link>
      <PageHeader
        title={workout.title ?? "Training"}
        actions={
          <>
            {workout.status === "planned" && !expired && (
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
          <FormMessage
            state={{ success: profile.trainer_id ? "Training opgeslagen en naar je coach gestuurd. Sterk werk!" : "Training opgeslagen. Sterk werk!" }}
          />
        </div>
      )}
      <WorkoutDetail workout={workout} expired={expired} />
    </>
  );
}
