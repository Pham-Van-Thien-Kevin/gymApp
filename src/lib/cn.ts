// Klein hulpje om Tailwind-classes samen te voegen en lege waarden weg te laten:
// cn("p-4", isActive && "bg-lime") → "p-4 bg-lime" of "p-4".
export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}
