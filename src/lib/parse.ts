// Invoer uit formulieren is altijd tekst. Deze hulpjes zetten ze veilig om en
// aanvaarden zowel "102.5" als "102,5" (Belgische schrijfwijze).

export function parseDecimal(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  const cleaned = value.trim().replace(",", ".");
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return null;
  return Number(cleaned);
}

export function parseInteger(value: unknown): number | null {
  const number = parseDecimal(value);
  return number !== null && Number.isInteger(number) ? number : null;
}

export function inRange(value: number | null, min: number, max: number): value is number {
  return value !== null && value >= min && value <= max;
}

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export function text(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}
