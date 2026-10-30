// Zet de geparste sheet + de keuzes uit de preview om naar de payload voor de
// databasefunctie import_sheet (zie supabase/schema.sql). Pure functie: geen
// database, dus makkelijk te testen.
import { isValidISODate } from "@/lib/dates";
import { EXERCISE_CATEGORIES } from "@/lib/types";
import { checkinWeekStart, sessionDate } from "./dates";
import { looseKey, nameKey, type ImportChoices, type LibraryExercise } from "./matching";
import type { ParsedExercise, ParsedWorkbook } from "./types";

export type ImportPayload = {
  member_id: string;
  source: "link" | "upload";
  new_exercises: { key: string; name: string; category: string }[];
  tabs: {
    sheet_tab: string;
    block_description: string | null;
    workouts: {
      date: string;
      title: string;
      status: "completed" | "planned";
      notes: string | null;
      exercises: {
        exercise_id: string | null;
        exercise_key: string | null;
        position: number;
        target_sets: number | null;
        target_reps: string | null;
        target_intensity: string | null;
        actual_rpe: number | null;
        notes: string | null;
        optional: boolean;
        performed: boolean;
        raw: Record<string, unknown>;
        sets: { set_number: number; reps: number | null; weight: number | null; rpe: number | null; reps_estimated: boolean }[];
      }[];
      cardio: { type: string; duration_minutes: number | null }[];
    }[];
    checkins: {
      week_start: string;
      training: string | null;
      motivation: string | null;
      pain: string | null;
      overall_feeling: string | null;
      sessions_done: number | null;
      feedback: string | null;
      raw: Record<string, unknown>;
    }[];
  }[];
  strength_tests: { label: string; squat: number | null; bench: number | null; deadlift: number | null }[] | null;
};

export type BuildResult = { ok: true; payload: ImportPayload } | { ok: false; error: string };

function exerciseNotes(exercise: ParsedExercise) {
  const parts = [
    exercise.suggestedLoad && `Voorgesteld gewicht: ${exercise.suggestedLoad} kg`,
    exercise.comment && `Opmerking: ${exercise.comment}`,
    exercise.notes,
    exercise.extraFrom !== null && `Extra oefening uit sessie ${exercise.extraFrom}`,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}

export function buildPayload(
  workbook: ParsedWorkbook,
  choices: ImportChoices,
  library: LibraryExercise[],
  memberId: string,
  source: "link" | "upload",
): BuildResult {
  const byName = new Map(library.map((exercise) => [nameKey(exercise.name), exercise.id]));
  const libraryIds = new Set(library.map((exercise) => exercise.id));
  const newExercises = new Map<string, { key: string; name: string; category: string }>();

  // Nieuwe oefening registreren (één keer per naam, ook als ze vaak voorkomt).
  const addNew = (name: string, category: string) => {
    const key = looseKey(name);
    if (!newExercises.has(key)) {
      newExercises.set(key, { key, name: name.trim(), category: EXERCISE_CATEGORIES.includes(category) ? category : "Andere" });
    }
    return key;
  };

  // De bibliotheek aanvullen met de lijst uit het Info-tabblad (geen bijna-dubbels:
  // "Leg extension" komt er niet bij als "Leg extensions" al bestaat).
  if (choices.includeInfo && workbook.info) {
    const loose = new Set(library.map((exercise) => looseKey(exercise.name)));
    for (const exercise of workbook.info.exercises) {
      if (!loose.has(looseKey(exercise.name))) addNew(exercise.name, exercise.category);
    }
  }

  const resolve = (name: string): { exercise_id: string | null; exercise_key: string | null } | string => {
    const existing = byName.get(nameKey(name));
    if (existing) return { exercise_id: existing, exercise_key: null };
    const choice = choices.names[nameKey(name)];
    if (!choice) return `Geen koppeling gekozen voor "${name}".`;
    if (choice.kind === "existing") {
      return libraryIds.has(choice.exerciseId) ? { exercise_id: choice.exerciseId, exercise_key: null } : `Onbekende oefening gekozen voor "${name}".`;
    }
    if (!choice.name.trim()) return `Geef een naam voor de nieuwe oefening "${name}".`;
    return { exercise_id: null, exercise_key: addNew(choice.name, choice.category) };
  };

  const tabs: ImportPayload["tabs"] = [];
  for (const month of workbook.months) {
    const tabChoice = choices.tabs[month.tab];
    if (!tabChoice?.include) continue;
    if (!isValidISODate(tabChoice.week1)) return { ok: false, error: `Kies een geldige startdatum voor ${month.tab}.` };

    const workouts: ImportPayload["tabs"][number]["workouts"] = [];
    for (const week of month.weeks) {
      for (const session of week.sessions) {
        if (session.exercises.length === 0 && session.cardio.length === 0) continue;
        const exercises: ImportPayload["tabs"][number]["workouts"][number]["exercises"] = [];
        for (const [position, exercise] of session.exercises.entries()) {
          const link = resolve(exercise.name);
          if (typeof link === "string") return { ok: false, error: link };
          exercises.push({
            ...link,
            position,
            target_sets: exercise.targetSets,
            target_reps: exercise.targetReps,
            target_intensity: exercise.targetIntensity,
            actual_rpe: exercise.actualRpe,
            notes: exerciseNotes(exercise),
            optional: exercise.optional,
            performed: exercise.performed,
            raw: { sheet: month.tab, cell: exercise.cell, ...exercise.raw },
            sets: exercise.sets.map((set) => ({
              set_number: set.setNumber,
              reps: set.reps,
              weight: set.weight,
              rpe: null, // de echte RPE staat per oefening (actual_rpe), niet per set
              reps_estimated: set.repsEstimated,
            })),
          });
        }
        const done = session.exercises.some((exercise) => exercise.performed) || session.cardio.length > 0;
        workouts.push({
          date: sessionDate(tabChoice.week1, week.number, session.dayOffset),
          title: `Week ${week.number} · Sessie ${session.number}`,
          status: done ? "completed" : "planned",
          notes: null,
          exercises,
          cardio: session.cardio.map((cardio) => ({ type: cardio.type, duration_minutes: cardio.durationMinutes })),
        });
      }
    }

    tabs.push({
      sheet_tab: month.tab,
      block_description: month.description,
      workouts,
      checkins: month.weeks.flatMap((week) =>
        week.checkin
          ? [
              {
                week_start: checkinWeekStart(tabChoice.week1, week.number),
                training: week.checkin.training,
                motivation: week.checkin.motivation,
                pain: week.checkin.pain,
                overall_feeling: week.checkin.overallFeeling,
                sessions_done: week.checkin.sessionsDone,
                feedback: week.checkin.feedback,
                raw: { sheet: month.tab, week: week.number, ...week.checkin.raw },
              },
            ]
          : [],
      ),
    });
  }

  const strengthTests = choices.includeInfo && workbook.info?.strengthTests.length ? workbook.info.strengthTests : null;
  if (tabs.length === 0 && !strengthTests) return { ok: false, error: "Selecteer minstens één tabblad om te importeren." };

  return {
    ok: true,
    payload: { member_id: memberId, source, new_exercises: [...newExercises.values()], tabs, strength_tests: strengthTests },
  };
}
