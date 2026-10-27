// Server Component: 404 voor URL's buiten /app en /trainer.
import { NotFoundView } from "@/components/not-found-view";

export default function NotFound() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-16">
      <NotFoundView homeHref="/" homeLabel="Naar de startpagina" />
    </main>
  );
}
