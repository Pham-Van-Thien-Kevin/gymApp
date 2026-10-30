import { EXERCISE_CATEGORIES } from "@/lib/types";

/**
 * Oefeningen gegroepeerd per categorie, voor <optgroup>-lijsten.
 * Categorieën zonder oefeningen vallen weg, zodat er geen lege koppen in een
 * keuzemenu staan. Een onbekende categorie telt als "Andere".
 */
export function groupByCategory<T extends { category: string }>(exercises: T[]) {
  return EXERCISE_CATEGORIES.map((category) => ({
    category,
    items: exercises.filter((exercise) => (EXERCISE_CATEGORIES.includes(exercise.category) ? exercise.category : "Andere") === category),
  })).filter((group) => group.items.length > 0);
}

/**
 * Eén oefening per naam (hoofdletterongevoelig) voor keuzemenu's. Zonder dit
 * staat bv. "Squat" er twee keer: één uit de standaardbibliotheek en één die
 * een import aanmaakte. Voorkeur: van `preferredOwner` (daar hangt je
 * geschiedenis aan), dan de standaardbibliotheek, dan de rest.
 */
export function uniqueByName<T extends { name: string; created_by?: string | null }>(exercises: T[], preferredOwner: string | null) {
  const rank = (exercise: T) => (exercise.created_by === preferredOwner && preferredOwner ? 0 : exercise.created_by == null ? 1 : 2);
  const byName = new Map<string, T>();
  for (const exercise of exercises) {
    const key = exercise.name.trim().toLowerCase();
    const current = byName.get(key);
    if (!current || rank(exercise) < rank(current)) byName.set(key, exercise);
  }
  return exercises.filter((exercise) => byName.get(exercise.name.trim().toLowerCase()) === exercise);
}

export const BIG_THREE = ["squat", "bench", "deadlift"] as const;
/** Waarde van ?exercise= voor de gecombineerde grafiek op de progressiepagina. */
export const BIG_THREE_VIEW = "sbd";
export type BigThreeLift = (typeof BIG_THREE)[number];

// Enkel de wedstrijdlift telt, geen varianten: "Close grip bench" of
// "Romanian deadlift" hebben een ander 1RM en zouden de lijn vertekenen.
const BIG_THREE_NAMES: Record<BigThreeLift, string[]> = {
  squat: ["squat", "comp squat", "back squat", "competition squat"],
  bench: ["bench", "benchpress", "comp bench", "comp benchpress", "bench press", "comp bench press", "competition bench", "competition bench press"],
  deadlift: ["deadlift", "comp deadlift", "competition deadlift", "conventional deadlift", "sumo deadlift"],
};

/** Welke van de drie wedstrijdlifts is deze oefening? `null` voor al de rest. */
export function bigThreeLift(name: string): BigThreeLift | null {
  const normalized = name.trim().toLowerCase().replace(/\s+/g, " ");
  return BIG_THREE.find((lift) => BIG_THREE_NAMES[lift].includes(normalized)) ?? null;
}
