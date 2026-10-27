// Server Components: bouwstenen voor pagina's, zonder interactiviteit.
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  eyebrow?: ReactNode;
}) {
  return (
    <header className="mb-8 flex flex-col gap-4 border-b border-chalk/15 pb-6 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow && <p className="mb-1 text-sm font-medium uppercase tracking-widest text-chalk/60">{eyebrow}</p>}
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
        {description && <p className="mt-2 max-w-prose text-chalk/70">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}

export function Section({
  title,
  action,
  children,
  className,
  id,
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section id={id} className={cn("mb-10 min-w-0", className)}>
      {(title || action) && (
        <div className="mb-4 flex items-baseline justify-between gap-4">
          {title && <h2 className="text-lg font-semibold tracking-tight">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("border border-chalk/15 p-4 sm:p-5", className)}>{children}</div>;
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="border border-chalk/15 p-4">
      <p className="text-sm text-chalk/60">{label}</p>
      <p className="mt-1 text-3xl font-bold tabular-nums tracking-tight">{value}</p>
      {hint && <p className="mt-1 text-sm text-chalk/60">{hint}</p>}
    </div>
  );
}

export function Badge({ children, strong = false }: { children: ReactNode; strong?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide",
        strong ? "bg-lime text-ink" : "border border-chalk/40 text-chalk/80",
      )}
    >
      {children}
    </span>
  );
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="border border-dashed border-chalk/30 p-8 text-center">
      <p className="text-lg font-semibold">{title}</p>
      {children && <div className="mx-auto mt-2 max-w-md text-chalk/70">{children}</div>}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn("animate-pulse bg-chalk/10", className)} />;
}

/** Standaard laadscherm voor loading.tsx-bestanden. */
export function PageSkeleton() {
  return (
    <div role="status" aria-live="polite">
      <span className="sr-only">Laden…</span>
      <Skeleton className="mb-3 h-4 w-24" />
      <Skeleton className="mb-8 h-10 w-64" />
      <div className="grid gap-3 sm:grid-cols-3">
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </div>
      <Skeleton className="mt-8 h-48" />
    </div>
  );
}
