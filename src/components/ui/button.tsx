// Server Component (geen "use client"): een knop of link heeft geen state nodig.
// Zo kan hij overal gebruikt worden, ook in Client Components.
import Link from "next/link";
import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost";
type Size = "md" | "lg" | "sm";

const base =
  "inline-flex items-center justify-center gap-2 rounded-lg font-semibold tracking-tight transition-colors " +
  "disabled:cursor-not-allowed disabled:opacity-40 select-none";

const variants: Record<Variant, string> = {
  primary: "bg-lime text-on-lime hover:bg-lime/85",
  secondary: "border border-chalk/40 text-chalk hover:border-chalk hover:bg-chalk/10",
  ghost: "text-chalk/75 hover:text-chalk hover:bg-chalk/10",
};

// Minstens 44-48px hoog: een comfortabel tikdoel op mobiel (WCAG 2.5.5).
const sizes: Record<Size, string> = {
  sm: "min-h-10 px-3 text-sm",
  md: "min-h-12 px-5 text-base",
  lg: "min-h-14 px-6 text-lg",
};

export function buttonClasses(variant: Variant = "primary", size: Size = "md", className?: string) {
  return cn(base, variants[variant], sizes[size], className);
}

type ButtonProps = ComponentProps<"button"> & { variant?: Variant; size?: Size };

export function Button({ variant, size, className, type = "button", ...props }: ButtonProps) {
  return <button type={type} className={buttonClasses(variant, size, className)} {...props} />;
}

type ButtonLinkProps = ComponentProps<typeof Link> & { variant?: Variant; size?: Size };

export function ButtonLink({ variant, size, className, ...props }: ButtonLinkProps) {
  return <Link className={buttonClasses(variant, size, className)} {...props} />;
}
