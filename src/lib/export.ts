// Export naar Excel (.xlsx). Pure functies: data erin, rijen of een bestand eruit.
// Het ophalen gebeurt in getExportData (src/lib/data.ts), het versturen in de
// Route Handlers onder /app/export en /trainer/clients/[id]/export.
import * as XLSX from "xlsx";
import type { BodyMetric, Checkin, StrengthTest, WorkoutDetail, WorkoutExerciseDetail, WorkoutSet } from "@/lib/types";

// Precies de kolommen die getExportData ophaalt (geen id's of ruwe sheetdata).
type ExportSet = Pick<WorkoutSet, "set_number" | "reps" | "weight" | "rpe">;
type ExportExercise = Pick<
  WorkoutExerciseDetail,
  "position" | "target_sets" | "target_reps" | "target_intensity" | "actual_rpe" | "notes" | "optional" | "performed" | "exercise"
> & { workout_sets: ExportSet[] };

export type ExportWorkout = Pick<WorkoutDetail, "date" | "title" | "status" | "duration_minutes" | "notes"> & {
  workout_exercises: ExportExercise[];
  cardio_entries: { type: string; duration_minutes: number | null }[];
};

export type ExportData = {
  workouts: ExportWorkout[];
  strengthTests: StrengthTest[];
  bodyMetrics: BodyMetric[];
  checkins: Checkin[];
};

type Row = Record<string, string | number | null>;

/**
 * Eén rij per set, zoals je het in een sheet zou bijhouden. Een oefening zonder
 * sets (gepland of overgeslagen) krijgt één rij zonder setgegevens, zodat de
 * planning ook in de export staat.
 */
export function workoutRows(workouts: ExportWorkout[]): Row[] {
  const rows: Row[] = [];
  for (const workout of workouts) {
    const base = {
      Datum: workout.date,
      Training: workout.title ?? "Training",
      Status: workout.status === "planned" ? "Gepland" : "Afgewerkt",
    };
    for (const [index, we] of workout.workout_exercises.entries()) {
      const exercise = {
        ...base,
        Nr: index + 1,
        Oefening: we.exercise?.name ?? "Onbekende oefening",
        "Doel sets": we.target_sets,
        "Doel reps": we.target_reps,
        "Doel intensiteit": we.target_intensity,
      };
      const sets = we.workout_sets.length ? we.workout_sets : [null];
      for (const set of sets) {
        rows.push({
          ...exercise,
          Set: set?.set_number ?? null,
          Reps: set?.reps ?? null,
          "Gewicht (kg)": set?.weight ?? null,
          RPE: set?.rpe ?? we.actual_rpe,
          Uitgevoerd: we.performed ? "ja" : "nee",
          Notities: we.notes,
        });
      }
    }
    for (const cardio of workout.cardio_entries) {
      rows.push({ ...base, Oefening: `Cardio: ${cardio.type}`, "Duur (min)": cardio.duration_minutes });
    }
  }
  return rows;
}

/** Het volledige werkboek als bestand (Buffer), met één tabblad per soort data. */
export function buildWorkbook(data: ExportData): Buffer {
  const book = XLSX.utils.book_new();
  addSheet(book, "Trainingen", workoutRows(data.workouts), [11, 28, 10, 4, 26, 9, 9, 18, 5, 6, 12, 6, 10, 30]);
  addSheet(
    book,
    "Maxima",
    data.strengthTests.map((t) => ({ Blok: t.label, Datum: t.tested_on, Squat: t.squat, Bench: t.bench, Deadlift: t.deadlift, Totaal: t.total })),
    [16, 11, 8, 8, 9, 8],
  );
  addSheet(
    book,
    "Lichaamsgewicht",
    data.bodyMetrics.map((m) => ({ Datum: m.date, "Gewicht (kg)": m.weight })),
    [11, 12],
  );
  addSheet(
    book,
    "Check-ins",
    data.checkins.map((c) => ({
      Week: c.week_start,
      Training: c.training,
      Motivatie: c.motivation,
      Pijn: c.pain,
      Algemeen: c.overall_feeling,
      Score: c.score,
      Sessies: c.sessions_done,
      Feedback: c.feedback,
    })),
    [11, 10, 10, 10, 10, 6, 8, 40],
  );
  // Een .xlsx is een zip-bestand; SheetJS comprimeert het pas met compression: true.
  return XLSX.write(book, { type: "buffer", bookType: "xlsx", compression: true }) as Buffer;
}

function addSheet(book: XLSX.WorkBook, name: string, rows: Row[], widths: number[]) {
  // Een leeg tabblad met enkel een melding is duidelijker dan een ontbrekend tabblad.
  const sheet = XLSX.utils.json_to_sheet(rows.length ? rows : [{ Info: "Nog geen gegevens." }]);
  sheet["!cols"] = widths.map((wch) => ({ wch })); // kolombreedte in tekens
  XLSX.utils.book_append_sheet(book, sheet, name);
}

/** Bestandsnaam zonder rare tekens: "liftlog-noor-janssens-2026-10-30.xlsx". */
export function exportFileName(name: string, today: string) {
  const slug = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // accenten weg: "é" → "e"
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `liftlog-${slug || "export"}-${today}.xlsx`;
}

/** Content-Disposition "attachment" = de browser downloadt het bestand in plaats van het te tonen. */
export function xlsxResponse(file: Buffer, fileName: string) {
  return new Response(new Uint8Array(file), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "no-store", // persoonlijke data: nergens bewaren
    },
  });
}
