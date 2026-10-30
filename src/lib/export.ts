// Export naar Excel (.xlsx) in hetzelfde template als de coachingsheet: een
// tab "Info" en per maand een tab ("AUG2026") met de weken naast elkaar en de
// sessies onder elkaar. Zo kan je het bestand ook opnieuw importeren.
//
// Pure functies: data erin, een bestand eruit. Het ophalen gebeurt in
// getExportData (src/lib/data.ts), het versturen in de Route Handlers onder
// /app/export en /trainer/clients/[id]/export.
import * as XLSX from "xlsx";
import { daysBetween, formatDate, startOfWeek } from "@/lib/dates";
import { placeWorkout } from "@/lib/blocks";
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
  name: string;
  workouts: ExportWorkout[];
  strengthTests: StrengthTest[];
  bodyMetrics: BodyMetric[];
  checkins: Checkin[];
};

type Cell = string | number | null;
type Grid = Cell[][];

const WEEKDAYS = ["Maandag", "Dinsdag", "Woensdag", "Donderdag", "Vrijdag", "Zaterdag", "Zondag"];

// Indeling van het template (zelfde kolommen als de sheet van de coach).
const WEEK_STRIDE = 11; // WEEK 1 in B, WEEK 2 in M, WEEK 3 in X, …
const FIRST_WEEK_COL = 1; // kolom B
const WEEK_ROW = 10; // rij 11
const FIRST_SESSION_ROW = 12; // rij 13
const SESSION_HEADER = ["SETS", "REPS", "INTENSITEIT", "GEWICHT", "ECHTE RPE", "NOTITIES"]; // vanaf kolom +2

type MonthTab = { tab: string; year: number; month: number; week1: string; weeks: Map<number, ExportWorkout[]> };

// Zelfde maand- en weekindeling als de rest van de app (en de import).
export { placeWorkout };

/**
 * De rijen van één oefening, zoals in de sheet: opeenvolgende sets met hetzelfde
 * gewicht en dezelfde reps worden één rij ("3 × 5 @ 70"). Een ander gewicht
 * (bv. een topset) krijgt een eigen rij. Zonder sets: één rij met het doel,
 * die de import weer als "gepland" leest.
 */
export function exerciseRows(we: ExportExercise): Cell[][] {
  const name = we.exercise?.name ?? "Onbekende oefening";
  const label = we.optional ? `(${name})` : name;
  if (we.workout_sets.length === 0) {
    return [[label, null, we.target_sets, we.target_reps, we.target_intensity, null, we.actual_rpe, we.notes]];
  }

  const groups: ExportSet[][] = [];
  for (const set of we.workout_sets) {
    const last = groups.at(-1);
    if (last && last[0].weight === set.weight && last[0].reps === set.reps) last.push(set);
    else groups.push([set]);
  }
  return groups.map((group, index) => {
    const rpes = group.map((s) => s.rpe).filter((rpe): rpe is number => rpe !== null);
    const min = Math.min(...rpes);
    const max = Math.max(...rpes);
    const rpe = rpes.length === 0 ? we.actual_rpe : min === max ? min : `${formatRpe(min)} - ${formatRpe(max)}`;
    // Gedaan zonder gewicht (bv. pull-ups): "BW" (bodyweight). Een lege cel zou de import als "gepland" lezen.
    const weight = group[0].weight ?? "BW";
    return [label, null, group.length, group[0].reps, we.target_intensity, weight, rpe, index === 0 ? we.notes : null];
  });
}

const formatRpe = (value: number) => String(value).replace(".", ",");

/** Eén maandtab als raster van cellen (rij × kolom). */
function monthGrid(month: MonthTab, checkins: Checkin[]): { grid: Grid; widths: number[] } {
  const grid: Grid = [];
  const set = (r: number, c: number, value: Cell) => {
    while (grid.length <= r) grid.push([]);
    grid[r][c] = value;
  };

  set(0, 1, "UITLEG OVER BLOCK");
  set(1, 1, `Geëxporteerd uit Liftlog. Week 1 begint op ${formatDate(month.week1, { day: "numeric", month: "long", year: "numeric" })}.`);

  const weekNumbers = [...month.weeks.keys()].sort((a, b) => a - b);
  const lastWeek = Math.max(...weekNumbers, ...checkins.map((c) => placeWorkout(c.week_start).week));
  let bottom = FIRST_SESSION_ROW;

  for (let week = 1; week <= lastWeek; week++) {
    const col = FIRST_WEEK_COL + (week - 1) * WEEK_STRIDE;
    set(WEEK_ROW, col, `WEEK ${week}`);
    let row = FIRST_SESSION_ROW;
    for (const [index, workout] of (month.weeks.get(week) ?? []).entries()) {
      set(row, col, `SESSIE ${index + 1}`);
      set(row, col + 1, WEEKDAYS[daysBetween(startOfWeek(workout.date), workout.date)]);
      SESSION_HEADER.forEach((text, i) => set(row, col + 2 + i, text));
      row++;
      for (const we of workout.workout_exercises) {
        for (const cells of exerciseRows(we)) {
          cells.forEach((value, i) => set(row, col + i, value));
          row++;
        }
      }
      // Cardio-blok onder elke sessie, zoals in de sheet: "/" = geen cardio.
      row++;
      set(row, col + 4, "CARDIO");
      set(row, col + 5, "SOORT");
      set(row, col + 6, "(DUUR)");
      const cardio = workout.cardio_entries[0];
      set(row + 1, col + 4, cardio ? "JA" : "/");
      set(row + 1, col + 5, cardio?.type ?? null);
      set(row + 1, col + 6, cardio?.duration_minutes ?? null);
      row += 4;
    }
    bottom = Math.max(bottom, row);
  }

  // Wekelijkse recap: voor alle weken op dezelfde rij, onder de langste week.
  for (let week = 1; week <= lastWeek; week++) {
    const col = FIRST_WEEK_COL + (week - 1) * WEEK_STRIDE;
    const checkin = checkins.find((c) => placeWorkout(c.week_start).week === week);
    set(bottom, col, "Wekelijkse recap");
    ["TRAINING", "OVERAL FEELING", "MOTIVATION", "PAIN/ACHES", "SESSIONS DONE", "SCORE"].forEach((text, i) => set(bottom, col + 1 + i, text));
    if (checkin) {
      [checkin.training, checkin.overall_feeling, checkin.motivation, checkin.pain, checkin.sessions_done, checkin.score].forEach((value, i) =>
        set(bottom + 1, col + 1 + i, value),
      );
    }
    set(bottom + 2, col, "Opmerking/feedback:");
    set(bottom + 2, col + 1, checkin?.feedback ?? null);
  }

  // Kolombreedtes per week: naam, weekdag, sets, reps, intensiteit, gewicht, rpe, notities, 3 lege.
  const weekWidths = [26, 11, 6, 7, 14, 9, 10, 30, 3, 3, 3];
  return { grid, widths: [3, ...Array.from({ length: lastWeek }, () => weekWidths).flat()] };
}

/** Tab "Info": naam, startdatum en de maxima per blok, zoals in de sheet. */
function infoGrid(data: ExportData): Grid {
  const first = data.workouts[0]?.date;
  const grid: Grid = [
    ["Naam", data.name],
    ["Start Datum", first ? formatDate(first, { day: "2-digit", month: "2-digit", year: "numeric" }) : null],
    [],
    ["Blok", "Squat", "Bench", "Deadlift", "Totaal", "Datum"],
  ];
  data.strengthTests.forEach((test, index) => {
    // De import herkent enkel labels als "Blok 2"; een ander label zetten we erachter.
    const label = /^blok\s*\d+$/i.test(test.label) ? test.label : `Blok ${index + 1}`;
    grid.push([label, test.squat, test.bench, test.deadlift, test.total, test.tested_on]);
  });
  return grid;
}

function addGrid(book: XLSX.WorkBook, name: string, grid: Grid, widths: number[]) {
  const sheet = XLSX.utils.aoa_to_sheet(grid);
  sheet["!cols"] = widths.map((wch) => ({ wch })); // kolombreedte in tekens
  XLSX.utils.book_append_sheet(book, sheet, name);
}

/** Het volledige werkboek als bestand (Buffer). */
export function buildWorkbook(data: ExportData): Buffer {
  const months = new Map<string, MonthTab>();
  for (const workout of data.workouts) {
    const place = placeWorkout(workout.date);
    const month = months.get(place.tab) ?? { ...place, weeks: new Map() };
    month.weeks.set(place.week, [...(month.weeks.get(place.week) ?? []), workout]);
    months.set(place.tab, month);
  }

  const book = XLSX.utils.book_new();
  addGrid(book, "Info", infoGrid(data), [16, 22, 10, 10, 10, 12]);
  // Nieuwste maand eerst, net zoals in de sheet.
  for (const month of [...months.values()].sort((a, b) => b.year - a.year || b.month - a.month)) {
    const checkins = data.checkins.filter((c) => placeWorkout(c.week_start).tab === month.tab);
    const { grid, widths } = monthGrid(month, checkins);
    addGrid(book, month.tab, grid, widths);
  }
  addGrid(book, "Lichaamsgewicht", [["Datum", "Gewicht (kg)"], ...data.bodyMetrics.map((m) => [m.date, m.weight])], [12, 12]);

  // Een .xlsx is een zip-bestand; SheetJS comprimeert het pas met compression: true.
  return XLSX.write(book, { type: "buffer", bookType: "xlsx", compression: true }) as Buffer;
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
