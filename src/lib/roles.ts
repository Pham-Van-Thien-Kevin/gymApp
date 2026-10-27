// Gedeeld door proxy, layouts en Server Actions. Bewust zonder "server-only",
// omdat de proxy dit bestand ook importeert.
export type Role = "member" | "trainer";

export function isRole(value: unknown): value is Role {
  return value === "member" || value === "trainer";
}

export function homeForRole(role: Role) {
  return role === "trainer" ? "/trainer" : "/app";
}
