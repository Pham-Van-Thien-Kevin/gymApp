// Server Component: 404 binnen het trainerdashboard, met de zijbalk erbij.
import { NotFoundView } from "@/components/not-found-view";

export default function TrainerNotFound() {
  return <NotFoundView homeHref="/trainer" homeLabel="Terug naar je cliënten" />;
}
