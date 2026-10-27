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
