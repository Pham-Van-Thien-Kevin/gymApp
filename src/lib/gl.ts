// IPF GL-punten (GoodLift, sinds 2020): maakt totals vergelijkbaar over
// gewichtsklassen heen. Formule: GL = total × 100 / (A − B · e^(−C · lichaamsgewicht)).
// A, B en C zijn de officiële IPF-coëfficiënten, per geslacht en per categorie.
// "classic" = raw (zonder suits), wat Liftlog bijhoudt.

export type Sex = "M" | "V";

/** Cookie met je keuze M/V voor de GL-punten. */
export const GL_SEX_COOKIE = "liftlog-gl-sex";

const COEFFICIENTS: Record<Sex, { A: number; B: number; C: number }> = {
  M: { A: 1199.72839, B: 1025.18162, C: 0.00921 }, // mannen, classic powerlifting (SBD)
  V: { A: 610.32796, B: 1045.59282, C: 0.03048 }, // vrouwen, classic powerlifting (SBD)
};

/** GL-punten voor een total (kg) bij een lichaamsgewicht (kg); null als een van beide ontbreekt. */
export function glPoints(total: number | null | undefined, bodyweight: number | null | undefined, sex: Sex): number | null {
  if (!total || !bodyweight || total <= 0 || bodyweight < 30) return null;
  const { A, B, C } = COEFFICIENTS[sex];
  return Math.round(((total * 100) / (A - B * Math.exp(-C * bodyweight))) * 100) / 100;
}
