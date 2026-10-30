// Server Component: pure presentatie. Werkt in Server én Client Components.
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Wat een Server Action teruggeeft aan useActionState. */
export type ActionState = {
  error?: string;
  success?: string;
  fieldErrors?: Record<string, string>;
  /**
   * React 19 maakt een formulier na elke Server Action leeg. Stuur bij een fout
   * de ingevulde waarden terug en zet ze als defaultValue, dan blijven ze staan.
   */
  values?: Record<string, string>;
} | null;

type FieldProps = ComponentProps<"input"> & {
  label: string;
  name: string;
  hint?: string;
  error?: string;
};

// Label, input, hint en fout aan elkaar gekoppeld met id's, zodat een
// schermlezer ze samen voorleest (aria-describedby).
export function Field({ label, name, hint, error, id, className, ...props }: FieldProps) {
  const inputId = id ?? name;
  const describedBy = [hint && `${inputId}-hint`, error && `${inputId}-error`].filter(Boolean).join(" ");
  return (
    <div className={className}>
      <label htmlFor={inputId} className="label">
        {label}
      </label>
      <input
        id={inputId}
        name={name}
        className="field"
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        {...props}
      />
      {hint && (
        <p id={`${inputId}-hint`} className="mt-1 text-sm text-chalk/60">
          {hint}
        </p>
      )}
      {error && <FieldError id={`${inputId}-error`}>{error}</FieldError>}
    </div>
  );
}

type SelectProps = ComponentProps<"select"> & { label: string; name: string; error?: string };

export function SelectField({ label, name, error, id, className, children, ...props }: SelectProps) {
  const inputId = id ?? name;
  return (
    <div className={className}>
      <label htmlFor={inputId} className="label">
        {label}
      </label>
      <select
        id={inputId}
        name={name}
        className="field"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${inputId}-error` : undefined}
        {...props}
      >
        {children}
      </select>
      {error && <FieldError id={`${inputId}-error`}>{error}</FieldError>}
    </div>
  );
}

type TextareaProps = ComponentProps<"textarea"> & { label: string; name: string; error?: string };

export function TextareaField({ label, name, error, id, className, ...props }: TextareaProps) {
  const inputId = id ?? name;
  return (
    <div className={className}>
      <label htmlFor={inputId} className="label">
        {label}
      </label>
      <textarea
        id={inputId}
        name={name}
        rows={3}
        className="field min-h-24"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${inputId}-error` : undefined}
        {...props}
      />
      {error && <FieldError id={`${inputId}-error`}>{error}</FieldError>}
    </div>
  );
}

// Er is geen rood in het palet, dus een fout kan niet "rood" zijn. Daarom: een icoon, een
// duidelijk woord en een dikke rand. Kleur is nooit de enige drager van betekenis.
function FieldError({ id, children }: { id: string; children: ReactNode }) {
  return (
    <p id={id} className="mt-1 text-sm font-semibold">
      <span aria-hidden="true">✕ </span>
      {children}
    </p>
  );
}

export function FormMessage({ state }: { state: ActionState }) {
  if (!state?.error && !state?.success) return null;
  const isError = Boolean(state.error);
  return (
    <p
      role={isError ? "alert" : "status"}
      className={cn(
        "rounded-lg border px-3 py-2 text-sm",
        isError ? "border-2 border-accent font-semibold" : "border-chalk/30 bg-chalk/5",
      )}
    >
      <span aria-hidden="true">{isError ? "✕ " : "✓ "}</span>
      {state.error ?? state.success}
    </p>
  );
}
