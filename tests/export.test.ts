// Unit tests voor de Excel-export in src/lib/export.ts. De belangrijkste test is
// "heen en terug": wat we exporteren, moet de eigen import weer exact inlezen.
import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { buildWorkbook, exerciseRows, exportFileName, placeWorkout, type ExportData, type ExportWorkout } from "@/lib/export";
import { parseWorkbook } from "@/lib/import/parser";

const squat = { id: "e1", name: "Squat" };
const bench = { id: "e2", name: "Comp bench" };

const exercise = (overrides: Partial<ExportWorkout["workout_exercises"][number]>): ExportWorkout["workout_exercises"][number] => ({
  position: 0,
  target_sets: null,
  target_reps: null,
  target_intensity: null,
  actual_rpe: null,
  notes: null,
  optional: false,
  performed: true,
  exercise: squat,
  workout_sets: [],
  ...overrides,
});

const workout = (date: string, workout_exercises: ExportWorkout["workout_exercises"], cardio: ExportWorkout["cardio_entries"] = []): ExportWorkout => ({
  date,
  title: null,
  status: workout_exercises.some((we) => we.workout_sets.length) ? "completed" : "planned",
  duration_minutes: null,
  notes: null,
  workout_exercises,
  cardio_entries: cardio,
});

const data: ExportData = {
  name: "Noor Janssens",
  workouts: [
    // Maandag 3 augustus 2026 = eerste maandag van augustus = week 1, sessie 1.
    workout(
      "2026-08-03",
      [
        exercise({
          target_intensity: "RPE 6",
          notes: "Ging vlot",
          workout_sets: [
            { set_number: 1, reps: 1, weight: 100, rpe: 6 },
            { set_number: 2, reps: 5, weight: 70, rpe: 6 },
            { set_number: 3, reps: 5, weight: 70, rpe: 7 },
            { set_number: 4, reps: 5, weight: 70, rpe: 7 },
          ],
        }),
      ],
      [{ type: "Airbike", duration_minutes: 15 }],
    ),
    // Woensdag 5 augustus: gepland, nog niet gedaan.
    workout("2026-08-05", [exercise({ exercise: bench, target_sets: 3, target_reps: "8-10", target_intensity: "RPE 8", performed: false })]),
    // Maandag 10 augustus: week 2.
    workout("2026-08-10", [exercise({ workout_sets: [{ set_number: 1, reps: 3, weight: 110, rpe: 8.5 }] })]),
  ],
  strengthTests: [{ id: "t1", label: "Blok 1", squat: 135, bench: 105, deadlift: 160, total: 400, tested_on: "2026-08-01" }],
  bodyMetrics: [{ id: "m1", date: "2026-08-02", weight: 62.9 }],
  checkins: [
    {
      id: "c1",
      week_start: "2026-08-03",
      training: "AMAZING",
      motivation: "NEUTRAAL",
      pain: "BAD",
      overall_feeling: "AMAZING",
      score: 8,
      sessions_done: 2,
      feedback: "Goeie week",
      import_batch_id: null,
    },
  ],
};

describe("placeWorkout", () => {
  it("zet een week in de maand van haar maandag, week 1 = eerste maandag", () => {
    expect(placeWorkout("2026-08-05")).toMatchObject({ tab: "AUG2026", week: 1, week1: "2026-08-03" });
    // Zaterdag 1 augustus hoort bij de week van maandag 27 juli: juli, week 4.
    expect(placeWorkout("2026-08-01")).toMatchObject({ tab: "JUL2026", week: 4, week1: "2026-07-06" });
    expect(placeWorkout("2026-10-30")).toMatchObject({ tab: "OKT2026" });
  });
});

describe("exerciseRows", () => {
  it("bundelt sets met hetzelfde gewicht en reps tot één rij, zoals in de sheet", () => {
    const rows = exerciseRows(data.workouts[0].workout_exercises[0]);
    expect(rows).toEqual([
      ["Squat", null, 1, 1, "RPE 6", 100, 6, "Ging vlot"],
      ["Squat", null, 3, 5, "RPE 6", 70, "6 - 7", null],
    ]);
  });

  it("zet een optionele oefening tussen haakjes", () => {
    expect(exerciseRows(exercise({ optional: true }))[0][0]).toBe("(Squat)");
  });
});

describe("buildWorkbook", () => {
  const book = XLSX.read(buildWorkbook(data));

  it("heeft de tabs van het template: Info, de maanden, lichaamsgewicht", () => {
    expect(book.SheetNames).toEqual(["Info", "AUG2026", "Lichaamsgewicht"]);
    const cell = (address: string) => book.Sheets.AUG2026[address]?.v;
    expect(cell("B11")).toBe("WEEK 1");
    expect(cell("M11")).toBe("WEEK 2");
    expect([cell("B13"), cell("C13"), cell("D13"), cell("G13")]).toEqual(["SESSIE 1", "Maandag", "SETS", "GEWICHT"]);
  });

  it("leest heen en terug exact in met de eigen import", () => {
    const parsed = parseWorkbook(buildWorkbook(data));
    expect(parsed.months.map((m) => m.tab)).toEqual(["AUG2026"]);
    const [week1, week2] = parsed.months[0].weeks;

    expect(week1.sessions.map((s) => [s.number, s.weekday])).toEqual([[1, 0], [2, 2]]);
    const [top, backoff] = week1.sessions[0].exercises;
    expect(top).toMatchObject({ name: "Squat", performed: true, notes: "Ging vlot" });
    expect(top.sets).toEqual([{ setNumber: 1, reps: 1, weight: 100, repsEstimated: false }]);
    expect(backoff.sets.map((s) => s.weight)).toEqual([70, 70, 70]);
    expect(week1.sessions[0].cardio).toEqual([expect.objectContaining({ type: "Airbike", durationMinutes: 15 })]);

    // De geplande sessie blijft gepland, met haar doel.
    expect(week1.sessions[1].exercises[0]).toMatchObject({ name: "Comp bench", performed: false, targetSets: 3, targetReps: "8-10" });

    expect(week1.checkin).toMatchObject({ training: "AMAZING", pain: "BAD", score: 8, sessionsDone: 2, feedback: "Goeie week" });
    expect(week2.sessions[0].exercises[0].sets[0]).toMatchObject({ reps: 3, weight: 110 });
    expect(parsed.info?.strengthTests).toEqual([{ label: "Blok 1", squat: 135, bench: 105, deadlift: 160 }]);
  });
});

describe("exportFileName", () => {
  it("maakt een veilige bestandsnaam", () => {
    expect(exportFileName("Noor Janssens", "2026-10-30")).toBe("liftlog-noor-janssens-2026-10-30.xlsx");
    expect(exportFileName("Zoë D'hondt!", "2026-10-30")).toBe("liftlog-zoe-d-hondt-2026-10-30.xlsx");
    expect(exportFileName("", "2026-10-30")).toBe("liftlog-export-2026-10-30.xlsx");
  });
});

describe("echte sheet: importeren → exporteren → importeren", () => {
  it("houdt alle sessies, oefeningen, sets en gewichten", async () => {
    const fs = await import("node:fs");
    const { sessionDate, firstMondayOfMonth } = await import("@/lib/import/dates");
    const original = parseWorkbook(fs.readFileSync("fixtures/gymSheet.xlsx"));

    // Zoals de import het in de database zet: week 1 = eerste maandag van de maand.
    const workouts: ExportWorkout[] = original.months.flatMap((month) =>
      month.weeks.flatMap((week) =>
        week.sessions.map((session) =>
          workout(
            sessionDate(firstMondayOfMonth(month.year, month.month), week.number, session.dayOffset),
            session.exercises.map((e, position) =>
              exercise({
                position,
                exercise: { id: e.name, name: e.name },
                optional: e.optional,
                target_sets: e.targetSets,
                target_reps: e.targetReps,
                target_intensity: e.targetIntensity,
                actual_rpe: e.actualRpe,
                notes: e.notes,
                performed: e.performed,
                workout_sets: e.performed ? e.sets.map((s) => ({ set_number: s.setNumber, reps: s.reps, weight: s.weight, rpe: null })) : [],
              }),
            ),
          ),
        ),
      ),
    );
    workouts.sort((a, b) => a.date.localeCompare(b.date));
    const again = parseWorkbook(buildWorkbook({ ...data, workouts, checkins: [] }));

    const summary = (book: typeof original) =>
      book.months
        .flatMap((m) => m.weeks.flatMap((w) => w.sessions.map((s) => ({ m: m.tab, w: w.number, day: s.dayOffset, s }))))
        .map(({ m, w, day, s }) => ({
          where: `${m} week ${w} dag ${day}`,
          exercises: s.exercises.map((e) => `${e.optional ? "(" : ""}${e.name}${e.optional ? ")" : ""} ${e.performed ? "" : "gepland "}${e.sets.map((x) => `${x.reps}×${x.weight}`).join(",")}`).join(" | "),
        }))
        .sort((a, b) => a.where.localeCompare(b.where));
    // Zelfde sessies op dezelfde dagen…
    expect(summary(again).map((s) => s.where)).toEqual(summary(original).map((s) => s.where));
    // …en exact dezelfde sets (per set vergeleken: gelijke sets worden in de export één rij).
    const sets = (book: typeof original) =>
      book.months.flatMap((m) => m.weeks.flatMap((w) => w.sessions.flatMap((s) => s.exercises.flatMap((e) => (e.performed ? e.sets.map((x) => `${e.name}:${x.reps}×${x.weight}`) : [])))));
    expect(sets(again).sort()).toEqual(sets(original).sort());
    // …en wat gepland was, blijft gepland.
    const planned = (book: typeof original) =>
      book.months.flatMap((m) => m.weeks.flatMap((w) => w.sessions.flatMap((s) => s.exercises.filter((e) => !e.performed).map((e) => `${m.tab} ${w.number} ${e.name}`))));
    expect(planned(again).sort()).toEqual(planned(original).sort());
  });
});
