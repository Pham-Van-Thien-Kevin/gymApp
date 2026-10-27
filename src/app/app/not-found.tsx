// Server Component: 404 binnen de gebruikersapp. Omdat dit bestand in de map
// /app staat, blijft de layout met navigatie zichtbaar.
import { NotFoundView } from "@/components/not-found-view";

export default function MemberNotFound() {
  return <NotFoundView homeHref="/app" homeLabel="Terug naar home" />;
}
