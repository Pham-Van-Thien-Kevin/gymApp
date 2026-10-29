// Unit tests voor de Excel-export in src/lib/export.ts.
import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { buildWorkbook, exportFileName, workoutRows, type ExportWorkout } from "@/lib/export";

const squat = { id: "e1", name: "Squat" };

const workouts: ExportWorkout[] = [
  {
    date: "2026-10-28",
    title: "Dag 1",
    status: "completed",
    duration_minutes: 70,
    notes: null,
    cardio_entries: [{ type: "Fietsen", duration_minutes: 15 }],
    workout_exercises: [
      {
        position: 0,
        target_sets: 2,
        target_reps: "5",
        target_intensity: "RPE 8",
        actual_rpe: null,
        notes: "Goed",
        optional: false,
        performed: true,
        exercise: squat,
        workout_sets: [
          { set_number: 1, reps: 5, weight: 140, rpe: 7.5 },
          { set_number: 2, reps: 5, weight: 142.5, rpe: 8 },
        ],
      },
    ],
  },
  {
    date: "2026-11-02",
    title: "Dag 2",
    status: "planned",
    duration_minutes: null,
    notes: null,
    cardio_entries: [],
    workout_exercises: [
      {
        position: 0,
        target_sets: 3,
        target_reps: "8-10",
        target_intensity: "RPE 7",
        actual_rpe: null,
        notes: null,
        optional: false,
        performed: false,
        exercise: squat,
        workout_sets: [],
      },
    ],
  },
];

describe("workoutRows", () => {
  it("geeft één rij per set, plus cardio", () => {
    const rows = workoutRows(workouts.slice(0, 1));
    expect(rows).toHaveLength(3);
    expect(rows[1]).toMatchObject({ Datum: "2026-10-28", Oefening: "Squat", Set: 2, Reps: 5, "Gewicht (kg)": 142.5, RPE: 8, Status: "Afgewerkt" });
    expect(rows[2]).toMatchObject({ Oefening: "Cardio: Fietsen", "Duur (min)": 15 });
  });

  it("houdt een geplande oefening zonder sets als één rij met het doel", () => {
    const [row] = workoutRows(workouts.slice(1));
    expect(row).toMatchObject({ Status: "Gepland", "Doel sets": 3, "Doel reps": "8-10", Set: null, Uitgevoerd: "nee" });
  });
});

describe("buildWorkbook", () => {
  it("maakt een geldig .xlsx met vier tabbladen", () => {
    const file = buildWorkbook({ workouts, strengthTests: [], bodyMetrics: [{ id: "m1", date: "2026-10-25", weight: 62.9 }], checkins: [] });
    const book = XLSX.read(file);
    expect(book.SheetNames).toEqual(["Trainingen", "Maxima", "Lichaamsgewicht", "Check-ins"]);
    const trainingen = XLSX.utils.sheet_to_json<Record<string, unknown>>(book.Sheets.Trainingen);
    expect(trainingen).toHaveLength(4);
    expect(trainingen[0]["Gewicht (kg)"]).toBe(140); // een getal, geen tekst: rekenen in Excel werkt
    expect(XLSX.utils.sheet_to_json(book.Sheets.Maxima)).toEqual([{ Info: "Nog geen gegevens." }]);
  });
});

describe("exportFileName", () => {
  it("maakt een veilige bestandsnaam", () => {
    expect(exportFileName("Noor Janssens", "2026-10-30")).toBe("liftlog-noor-janssens-2026-10-30.xlsx");
    expect(exportFileName("Zoë D'hondt!", "2026-10-30")).toBe("liftlog-zoe-d-hondt-2026-10-30.xlsx");
    expect(exportFileName("", "2026-10-30")).toBe("liftlog-export-2026-10-30.xlsx");
  });
});
