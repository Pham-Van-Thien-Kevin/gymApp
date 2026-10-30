"use client";
// Client Component: dit is het meest interactieve scherm van de app. Sets
// toevoegen, afvinken, voorstellen invullen en een concept bewaren gebeurt
// allemaal in de browser. Pas bij "Opslaan" gaat alles naar de server.
import { useEffect, useState, useSyncExternalStore, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/dates";
import { formatTarget } from "@/lib/program";
import { formatNumber } from "@/lib/stats";
import { parseDecimal, parseInteger } from "@/lib/parse";
import { estimateOneRepMax, suggestFromTarget, targetRpeFrom } from "@/lib/rpe";
import {
  EXERCISE_CATEGORIES,
  type Exercise,
  type LiftStats,
  type PreviousPerformance,
  type ProgramDay,
  type WorkoutDetail,
} from "@/lib/types";
import { groupByCategory } from "@/lib/exercises";
import { RpeTable } from "@/components/rpe-table";
import { createExercise, fetchExerciseHistory, saveWorkout } from "./actions";
import { PlatesLine, PrLine, SuggestionLine, TargetPicker, type Suggestion } from "./lift-insights";
import type { DraftExercise, DraftSet, WorkoutDraft } from "./types";

type Props = {
  memberId: string;
  today: string;
  programDay: ProgramDay | null;
  /** Geplande training uit je sheet die je nu afwerkt (in plaats van een schemadag). */
  planned?: WorkoutDetail | null;
  exercises: Exercise[];
  previous: Record<string, PreviousPerformance>;
  stats: Record<string, LiftStats>;
};

// Unieke sleutel voor nieuwe rijen. Buiten de component, want React-componenten
// moeten "puur" zijn tijdens het renderen; dit wordt enkel in klik-handlers aangeroepen.
const newKey = () => crypto.randomUUID();

const emptySet = (key: string): DraftSet => ({ key, reps: "", weight: "", rpe: "", done: false });

function initialDraft(props: Props): WorkoutDraft {
  return props.planned ? draftFromPlanned(props.planned, props) : draftFromProgramDay(props);
}

function draftFromProgramDay({ today, programDay }: Props): WorkoutDraft {
  return {
    version: 1,
    programDayId: programDay?.id ?? null,
    savedAt: 0,
    date: today,
    title: programDay?.name ?? "Vrije training",
    duration: "",
    notes: "",
    cardio: [],
    exercises: (programDay?.program_exercises ?? [])
      .filter((pe) => pe.exercise)
      .map((pe) => ({
        key: `pe-${pe.id}`,
        exerciseId: pe.exercise!.id,
        name: pe.exercise!.name,
        targetSets: pe.target_sets,
        targetReps: pe.target_reps,
        targetIntensity: pe.target_rpe ? `RPE ${pe.target_rpe}` : null,
        optional: pe.optional,
        barbell: pe.exercise!.equipment === "Barbell",
        notes: pe.notes ?? "",
        sets: Array.from({ length: pe.target_sets ?? 1 }, (_, i) => emptySet(`pe-${pe.id}-${i}`)),
      })),
  };
}

/**
 * Een geplande training uit je sheet als startpunt. De datum wordt vandaag (dan
 * train je ze); wat al ingevuld was, blijft staan. Zonder sets krijg je zoveel
 * lege sets als het doel aangeeft.
 */
function draftFromPlanned(planned: WorkoutDetail, { today, exercises }: Props): WorkoutDraft {
  const str = (value: number | null) => (value === null ? "" : toInput(value));
  return {
    version: 1,
    programDayId: null,
    plannedWorkoutId: planned.id,
    savedAt: 0,
    date: today,
    title: planned.title ?? "Training",
    duration: "",
    notes: planned.notes ?? "",
    cardio: planned.cardio_entries.map((c) => ({ key: `pc-${c.id}`, type: c.type, minutes: str(c.duration_minutes) })),
    exercises: planned.workout_exercises
      .filter((we) => we.exercise)
      .map((we) => ({
        key: `pw-${we.id}`,
        exerciseId: we.exercise!.id,
        name: we.exercise!.name,
        targetSets: we.target_sets,
        targetReps: we.target_reps,
        targetIntensity: we.target_intensity,
        optional: we.optional,
        barbell: exercises.some((e) => e.id === we.exercise!.id && e.equipment === "Barbell"),
        notes: we.notes ?? "",
        sets: we.workout_sets.length
          ? we.workout_sets.map((s) => ({ key: `pw-${s.id}`, reps: str(s.reps), weight: str(s.weight), rpe: str(s.rpe), done: false }))
          : Array.from({ length: we.target_sets ?? 1 }, (_, i) => emptySet(`pw-${we.id}-${i}`)),
      })),
  };
}

// --- Concept in localStorage -------------------------------------------------
// localStorage bestaat niet op de server. useSyncExternalStore leest het veilig:
// op de server (en tijdens hydratatie) krijgen we null, in de browser de echte waarde.
function subscribeToStorage(callback: () => void) {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}
function readStorage(key: string) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null; // privévenster of geblokkeerde opslag
  }
}
function writeStorage(key: string, value: string | null) {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
    // Het "storage"-event vuurt normaal enkel in ándere tabbladen; we sturen het
    // zelf ook, zodat useSyncExternalStore in dit tabblad de wijziging ziet.
    window.dispatchEvent(new StorageEvent("storage", { key }));
  } catch {
    // Geen opslag beschikbaar: dan maar zonder concept.
  }
}

/** Ondergrens van een rep-doel: "8-10" → "8". */
function lowerBound(reps: string | null) {
  return reps?.match(/\d+/)?.[0] ?? "";
}

/** De reps van een set: wat er al stond (bv. uit je sheet), anders je doel. */
function repsFor(exercise: DraftExercise, set: DraftSet) {
  return set.reps || lowerBound(targetFor(exercise).reps);
}

function describePrevious(previous: PreviousPerformance) {
  return previous.sets
    .map((set) => `${set.weight !== null ? formatNumber(set.weight, 2) : "BW"}×${set.reps ?? "?"}${set.rpe !== null ? ` @${formatNumber(set.rpe)}` : ""}`)
    .join(", ");
}

/** 102.5 → "102,5", zoals je het zelf zou typen. */
const toInput = (value: number) => String(value).replace(".", ",");

/**
 * Het doel waarvoor we een gewicht voorstellen: dat uit het schema, of, bij een
 * vrije oefening zonder doel, standaard 5 reps @ RPE 8 (aan te passen in de logger).
 */
function targetFor(exercise: DraftExercise) {
  return exercise.targetIntensity
    ? { reps: exercise.targetReps, rpe: exercise.targetIntensity }
    : { reps: "5", rpe: "RPE 8" };
}

/**
 * Voorgesteld gewicht: geschat 1RM × percentage uit de RPE-tabel voor het doel
 * (ondergrens van reps en RPE). Geen doel-RPE of nog geen geschiedenis → geen voorstel.
 */
function suggestionFor(exercise: DraftExercise, stats: Record<string, LiftStats>): Suggestion | null {
  const reference = stats[exercise.exerciseId]?.reference ?? null;
  const target = targetFor(exercise);
  const suggestion = suggestFromTarget(reference?.e1rm, target.reps, target.rpe);
  return suggestion && reference ? { ...suggestion, reference } : null;
}

/** Geschat 1RM van een ingevulde set. Zonder ingevulde RPE nemen we de doel-RPE. */
function setE1rm(set: DraftSet, exercise: DraftExercise): number | null {
  const weight = parseDecimal(set.weight);
  const reps = parseInteger(set.reps);
  if (!weight || !reps) return null;
  const rpe = set.rpe.trim() ? parseDecimal(set.rpe) : targetRpeFrom(exercise.targetIntensity);
  return estimateOneRepMax(weight, reps, rpe);
}

export function WorkoutLogger(props: Props) {
  const router = useRouter();
  const storageKey = `liftlog:draft:${props.memberId}`;
  const savedDraftJson = useSyncExternalStore(subscribeToStorage, () => readStorage(storageKey), () => null);

  const [draft, setDraft] = useState<WorkoutDraft>(() => initialDraft(props));
  const [dirty, setDirty] = useState(false);
  const [library, setLibrary] = useState(props.exercises);
  const [previous, setPrevious] = useState(props.previous);
  const [stats, setStats] = useState(props.stats);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, startSaving] = useTransition();

  // Elke wijziging gaat via update(): zo weten we dat de gebruiker begonnen is.
  function update(change: (current: WorkoutDraft) => WorkoutDraft) {
    setDraft((current) => change(current));
    setDirty(true);
  }
  function updateExercise(key: string, change: (exercise: DraftExercise) => DraftExercise) {
    update((d) => ({ ...d, exercises: d.exercises.map((e) => (e.key === key ? change(e) : e)) }));
  }
  function updateSet(exerciseKey: string, setKey: string, change: Partial<DraftSet>) {
    updateExercise(exerciseKey, (e) => ({ ...e, sets: e.sets.map((s) => (s.key === setKey ? { ...s, ...change } : s)) }));
  }

  // Concept bewaren zodra er iets veranderd is (niet bij het openen van de pagina,
  // anders zou een ouder concept meteen overschreven worden).
  useEffect(() => {
    if (dirty) writeStorage(storageKey, JSON.stringify({ ...draft, savedAt: Date.now() }));
  }, [dirty, draft, storageKey]);

  let restorable: WorkoutDraft | null = null;
  if (!dirty && savedDraftJson) {
    try {
      const parsed = JSON.parse(savedDraftJson) as WorkoutDraft;
      if (parsed.version === 1 && (parsed.exercises.length > 0 || parsed.cardio.length > 0)) restorable = parsed;
    } catch {
      restorable = null;
    }
  }

  function toggleDone(exercise: DraftExercise, set: DraftSet) {
    if (set.done) {
      updateSet(exercise.key, set.key, { done: false });
      return;
    }
    // Eén tik = "gedaan zoals gepland": lege velden krijgen het doel en het
    // voorgestelde gewicht (of anders het gewicht van de vorige keer).
    const lastWeight = previous[exercise.exerciseId]?.sets.at(-1)?.weight;
    const fallbackWeight = suggestionFor(exercise, stats)?.weight ?? lastWeight;
    updateSet(exercise.key, set.key, {
      done: true,
      reps: repsFor(exercise, set),
      weight: set.weight || (fallbackWeight != null ? toInput(fallbackWeight) : ""),
    });
  }

  /** Het voorstel invullen in alle sets die nog geen gewicht hebben en niet af zijn. */
  function fillSuggestion(exercise: DraftExercise, weight: number) {
    updateExercise(exercise.key, (e) => ({
      ...e,
      sets: e.sets.map((s) => (s.done || s.weight.trim() ? s : { ...s, weight: toInput(weight) })),
    }));
  }

  async function addExercise(exercise: Exercise) {
    const key = newKey();
    update((d) => ({
      ...d,
      exercises: [
        ...d.exercises,
        {
          key,
          exerciseId: exercise.id,
          name: exercise.name,
          targetSets: null,
          targetReps: null,
          targetIntensity: null,
          optional: false,
          barbell: exercise.equipment === "Barbell",
          notes: "",
          sets: [emptySet(`${key}-0`)],
        },
      ],
    }));
    if (!previous[exercise.id] && !stats[exercise.id]) {
      const result = await fetchExerciseHistory(exercise.id);
      if (result.previous) setPrevious((current) => ({ ...current, [exercise.id]: result.previous! }));
      if (result.stats) setStats((current) => ({ ...current, [exercise.id]: result.stats! }));
    }
  }

  function save() {
    setError(null);
    startSaving(async () => {
      // Reps uit het doel invullen voor elke set waar je kg of RPE invulde of die je afvinkte.
      const withReps: WorkoutDraft = {
        ...draft,
        exercises: draft.exercises.map((e) => ({
          ...e,
          sets: e.sets.map((s) => (s.done || s.weight.trim() || s.rpe.trim() ? { ...s, reps: repsFor(e, s) } : s)),
        })),
      };
      const result = await saveWorkout(withReps);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      writeStorage(storageKey, null);
      router.push(`/app/history/${result.workoutId}?saved=1`);
    });
  }

  return (
    <div>
      {restorable && (
        <div role="status" className="mb-6 rounded-xl border border-accent p-4">
          <p className="font-semibold">Niet-opgeslagen training gevonden</p>
          <p className="mt-1 text-sm text-chalk/70">
            {restorable.title} · {formatDate(restorable.date)} · {restorable.exercises.length} oefeningen
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" onClick={() => update(() => restorable!)}>
              Verder loggen
            </Button>
            <Button size="sm" variant="ghost" onClick={() => writeStorage(storageKey, null)}>
              Verwijderen
            </Button>
          </div>
        </div>
      )}

      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor="workout-date" className="label">
            Datum
          </label>
          <input
            id="workout-date"
            type="date"
            className="field"
            value={draft.date}
            max={props.today}
            onChange={(event) => update((d) => ({ ...d, date: event.target.value }))}
          />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="workout-title" className="label">
            Titel
          </label>
          <input
            id="workout-title"
            className="field"
            value={draft.title}
            maxLength={120}
            onChange={(event) => update((d) => ({ ...d, title: event.target.value }))}
          />
        </div>
      </div>

      <ol className="flex flex-col gap-6">
        {draft.exercises.map((exercise, index) => {
          const prev = previous[exercise.exerciseId];
          const lastWeight = prev?.sets.at(-1)?.weight;
          const suggestion = suggestionFor(exercise, stats);
          const best = stats[exercise.exerciseId]?.best ?? null;
          // Een PR telt pas als er al een vorig record was (je eerste keer is altijd "beste").
          const isPr = (set: DraftSet) => {
            const e1rm = set.done ? setE1rm(set, exercise) : null;
            return best !== null && e1rm !== null && e1rm > best + 0.05;
          };
          const prE1rm = Math.max(0, ...exercise.sets.filter(isPr).map((set) => setE1rm(set, exercise) ?? 0));
          // Schijven tonen voor de set die je nu gaat laden, of anders het voorstel.
          const nextSetWeight = parseDecimal(exercise.sets.find((set) => !set.done && set.weight.trim())?.weight ?? "");
          const plateWeight = nextSetWeight ?? suggestion?.weight ?? null;
          return (
            <li key={exercise.key} className="overflow-hidden rounded-xl border border-chalk/15">
              <div className="flex items-start justify-between gap-3 border-b border-chalk/15 p-4">
                <div className="min-w-0">
                  <h2 className="text-xl font-bold">
                    <span className="mr-2 text-chalk/40 tabular-nums">{index + 1}</span>
                    {exercise.name}
                    {exercise.optional && <span className="ml-2 text-sm font-normal text-chalk/60">optioneel</span>}
                  </h2>
                  {!exercise.customTarget && (exercise.targetSets || exercise.targetReps || exercise.targetIntensity) && (
                    <p className="mt-1 text-sm">
                      <span className="text-chalk/60">Doel </span>
                      <span className="font-semibold tabular-nums">
                        {formatTarget({
                          target_sets: exercise.targetSets,
                          target_reps: exercise.targetReps,
                          target_rpe: exercise.targetIntensity?.replace(/^RPE\s*/i, "") ?? null,
                        })}
                      </span>
                    </p>
                  )}
                  {/* Vrije oefening (geen doel uit het schema): zelf reps @ RPE kiezen voor het voorstel. */}
                  {(!exercise.targetIntensity || exercise.customTarget) && stats[exercise.exerciseId]?.reference && (
                    <TargetPicker
                      exerciseName={exercise.name}
                      reps={Number(lowerBound(targetFor(exercise).reps))}
                      rpe={targetRpeFrom(targetFor(exercise).rpe) ?? 8}
                      onChange={(reps, rpe) =>
                        updateExercise(exercise.key, (e) => ({
                          ...e,
                          customTarget: true,
                          targetReps: String(reps),
                          targetIntensity: `RPE ${String(rpe).replace(".", ",")}`,
                        }))
                      }
                    />
                  )}
                  {suggestion && <SuggestionLine suggestion={suggestion} exerciseName={exercise.name} onFill={() => fillSuggestion(exercise, suggestion.weight)} />}
                  <p className="mt-1 text-sm text-chalk/60">
                    {prev ? (
                      <>
                        Vorige keer ({formatDate(prev.date)}): <span className="text-chalk/90 tabular-nums">{describePrevious(prev)}</span>
                      </>
                    ) : (
                      "Nog geen vorige prestatie"
                    )}
                  </p>
                </div>
                <button
                  type="button"
                  aria-label={`${exercise.name} verwijderen`}
                  onClick={() => update((d) => ({ ...d, exercises: d.exercises.filter((e) => e.key !== exercise.key) }))}
                  className="flex size-11 shrink-0 items-center justify-center text-chalk/60 hover:bg-chalk/10 hover:text-chalk"
                >
                  <span aria-hidden="true">✕</span>
                </button>
              </div>

              <table className="w-full text-left">
                <caption className="sr-only">Sets van {exercise.name}</caption>
                <thead className="text-xs uppercase tracking-wide text-chalk/60">
                  <tr>
                    <th scope="col" className="w-10 py-2 pl-4 font-medium">Set</th>
                    <th scope="col" className="w-14 px-1 text-center font-medium">Reps</th>
                    <th scope="col" className="px-1 font-medium">Kg</th>
                    <th scope="col" className="px-1 font-medium">RPE</th>
                    <th scope="col" className="w-14 pr-4 text-right font-medium">
                      <span className="sr-only">Gedaan</span>✓
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {exercise.sets.map((set, setIndex) => (
                    <tr key={set.key} className={cn("border-t border-chalk/10", set.done && "bg-lime/10")}>
                      <th scope="row" className="py-2 pl-4 font-semibold tabular-nums">
                        {setIndex + 1}
                        {isPr(set) && (
                          <span className="ml-1 text-[10px] font-bold text-accent" title="Persoonlijk record">
                            PR
                          </span>
                        )}
                      </th>
                      {/* Reps typ je niet: ze komen uit je doel (bij "8-10" de ondergrens). Enkel kg en RPE invullen. */}
                      <td className="px-1 text-center text-lg font-semibold tabular-nums">{repsFor(exercise, set) || "–"}</td>
                      <td className="px-1">
                        <input
                          aria-label={`${exercise.name} set ${setIndex + 1} gewicht in kg`}
                          inputMode="decimal"
                          className="field min-h-11 px-2 text-center tabular-nums"
                          placeholder={formatNumber(suggestion?.weight ?? lastWeight, 2)}
                          value={set.weight}
                          onChange={(event) => updateSet(exercise.key, set.key, { weight: event.target.value })}
                        />
                      </td>
                      <td className="px-1">
                        <input
                          aria-label={`${exercise.name} set ${setIndex + 1} RPE`}
                          inputMode="decimal"
                          className="field min-h-11 px-2 text-center tabular-nums"
                          placeholder={exercise.targetIntensity?.match(/\d+([.,]\d+)?/)?.[0] ?? "–"}
                          value={set.rpe}
                          onChange={(event) => updateSet(exercise.key, set.key, { rpe: event.target.value })}
                        />
                      </td>
                      <td className="pr-4 text-right">
                        <button
                          type="button"
                          aria-pressed={set.done}
                          aria-label={`${exercise.name} set ${setIndex + 1} ${set.done ? "niet meer afvinken" : "afvinken"}`}
                          onClick={() => toggleDone(exercise, set)}
                          className={cn(
                            "inline-flex size-11 items-center justify-center rounded-lg border text-lg font-bold",
                            set.done ? "border-lime bg-lime text-on-lime" : "border-chalk/40 hover:border-chalk",
                          )}
                        >
                          ✓
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {(prE1rm > 0 || (exercise.barbell && plateWeight)) && (
                <div className="flex flex-col gap-1 border-t border-chalk/10 px-4 py-2">
                  {prE1rm > 0 && best !== null && <PrLine e1rm={prE1rm} previousBest={best} />}
                  {exercise.barbell && plateWeight && <PlatesLine weight={plateWeight} />}
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2 border-t border-chalk/10 p-3">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => updateExercise(exercise.key, (e) => ({ ...e, sets: [...e.sets, emptySet(newKey())] }))}
                >
                  + Set
                </Button>
                {exercise.sets.length > 0 && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => updateExercise(exercise.key, (e) => ({ ...e, sets: e.sets.slice(0, -1) }))}
                  >
                    − Laatste set
                  </Button>
                )}
                <label className="sr-only" htmlFor={`notes-${exercise.key}`}>
                  Notitie bij {exercise.name}
                </label>
                <input
                  id={`notes-${exercise.key}`}
                  className="field min-h-10 flex-1 basis-40 text-sm"
                  placeholder="Notitie"
                  value={exercise.notes}
                  onChange={(event) => updateExercise(exercise.key, (e) => ({ ...e, notes: event.target.value }))}
                />
              </div>
            </li>
          );
        })}
      </ol>

      <AddExercise library={library} onAdd={addExercise} onCreated={(exercise) => setLibrary((l) => [...l, exercise])} />

      <div className="mt-6 flex flex-col gap-2">
        <RpeTable />
        <Link href="/app/rpe" className="self-start text-sm text-chalk/70 underline underline-offset-4 hover:text-chalk">
          Open de RPE-calculator
        </Link>
      </div>

      <section className="mt-10" aria-labelledby="cardio-title">
        <h2 id="cardio-title" className="mb-3 text-lg font-semibold">
          Cardio <span className="font-normal text-chalk/60">(optioneel)</span>
        </h2>
        <datalist id="cardio-types">
          {["Loopband (wandelen)", "Loopband (lopen)", "Fiets", "Airbike", "Stairmaster", "Roeien"].map((type) => (
            <option key={type} value={type} />
          ))}
        </datalist>
        <ul className="flex flex-col gap-2">
          {draft.cardio.map((entry, index) => (
            <li key={entry.key} className="flex gap-2">
              <input
                aria-label={`Cardio ${index + 1} soort`}
                list="cardio-types"
                className="field flex-1"
                placeholder="Soort"
                value={entry.type}
                onChange={(event) =>
                  update((d) => ({ ...d, cardio: d.cardio.map((c) => (c.key === entry.key ? { ...c, type: event.target.value } : c)) }))
                }
              />
              <input
                aria-label={`Cardio ${index + 1} duur in minuten`}
                inputMode="numeric"
                className="field w-24 text-center"
                placeholder="min"
                value={entry.minutes}
                onChange={(event) =>
                  update((d) => ({ ...d, cardio: d.cardio.map((c) => (c.key === entry.key ? { ...c, minutes: event.target.value } : c)) }))
                }
              />
              <button
                type="button"
                aria-label={`Cardio ${index + 1} verwijderen`}
                onClick={() => update((d) => ({ ...d, cardio: d.cardio.filter((c) => c.key !== entry.key) }))}
                className="flex size-12 shrink-0 items-center justify-center text-chalk/60 hover:bg-chalk/10 hover:text-chalk"
              >
                <span aria-hidden="true">✕</span>
              </button>
            </li>
          ))}
        </ul>
        <Button
          variant="secondary"
          size="sm"
          className="mt-3"
          onClick={() => update((d) => ({ ...d, cardio: [...d.cardio, { key: newKey(), type: "", minutes: "" }] }))}
        >
          + Cardio
        </Button>
      </section>

      <section className="mt-10 grid gap-4 sm:grid-cols-3" aria-label="Afronden">
        <div>
          <label htmlFor="workout-duration" className="label">
            Duur (min)
          </label>
          <input
            id="workout-duration"
            inputMode="numeric"
            className="field"
            value={draft.duration}
            onChange={(event) => update((d) => ({ ...d, duration: event.target.value }))}
          />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="workout-notes" className="label">
            Notities
          </label>
          <textarea
            id="workout-notes"
            rows={2}
            className="field"
            value={draft.notes}
            onChange={(event) => update((d) => ({ ...d, notes: event.target.value }))}
          />
        </div>
      </section>

      <div className="mt-8 flex flex-col gap-3">
        <FormMessage state={error ? { error } : null} />
        <Button size="lg" onClick={save} disabled={isSaving}>
          {isSaving ? "Opslaan…" : "Training opslaan"}
        </Button>
      </div>
    </div>
  );
}

function AddExercise({
  library,
  onAdd,
  onCreated,
}: {
  library: Exercise[];
  onAdd: (exercise: Exercise) => void;
  onCreated: (exercise: Exercise) => void;
}) {
  const [selected, setSelected] = useState("");
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState("Andere");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const byCategory = groupByCategory(library);

  return (
    <section className="mt-6 rounded-xl border border-dashed border-chalk/30 p-4" aria-labelledby="add-exercise-title">
      <h2 id="add-exercise-title" className="mb-3 font-semibold">
        Oefening toevoegen
      </h2>
      <div className="flex gap-2">
        <label htmlFor="add-exercise" className="sr-only">
          Kies een oefening
        </label>
        <select id="add-exercise" className="field flex-1" value={selected} onChange={(event) => setSelected(event.target.value)}>
          <option value="">Kies een oefening…</option>
          {byCategory.map((group) => (
            <optgroup key={group.category} label={group.category}>
              {group.items.map((exercise) => (
                <option key={exercise.id} value={exercise.id}>
                  {exercise.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <Button
          disabled={!selected}
          onClick={() => {
            const exercise = library.find((e) => e.id === selected);
            if (exercise) onAdd(exercise);
            setSelected("");
          }}
        >
          Toevoegen
        </Button>
      </div>

      {creating ? (
        <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto_auto]">
          <label htmlFor="new-exercise-name" className="sr-only">
            Naam nieuwe oefening
          </label>
          <input
            id="new-exercise-name"
            className="field"
            placeholder="Naam nieuwe oefening"
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
          />
          <label htmlFor="new-exercise-category" className="sr-only">
            Categorie
          </label>
          <select id="new-exercise-category" className="field" value={newCategory} onChange={(event) => setNewCategory(event.target.value)}>
            {EXERCISE_CATEGORIES.map((category) => (
              <option key={category}>{category}</option>
            ))}
          </select>
          <Button
            disabled={isPending || !newName.trim()}
            onClick={() =>
              startTransition(async () => {
                const result = await createExercise(newName, newCategory);
                if (result.error || !result.exercise) {
                  setMessage(result.error ?? "Aanmaken mislukt.");
                  return;
                }
                onCreated(result.exercise);
                onAdd(result.exercise);
                setNewName("");
                setCreating(false);
                setMessage(null);
              })
            }
          >
            Aanmaken
          </Button>
          {message && (
            <p role="alert" className="text-sm font-semibold sm:col-span-3">
              ✕ {message}
            </p>
          )}
        </div>
      ) : (
        <button type="button" onClick={() => setCreating(true)} className="mt-3 text-sm text-chalk/70 underline underline-offset-4 hover:text-chalk">
          Staat je oefening er niet tussen?
        </button>
      )}
    </section>
  );
}
