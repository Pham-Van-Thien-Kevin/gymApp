// Unit tests voor de import. Draaien met: npm test
// De meeste tests gebruiken de echte voorbeeldsheet in fixtures/gymSheet.xlsx.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { buildPayload } from "@/lib/import/build-payload";
import { checkinWeekStart, firstMondayOfMonth, sessionDate } from "@/lib/import/dates";
import { defaultChoices, findUnknownNames, type LibraryExercise } from "@/lib/import/matching";
import { parseWorkbook } from "@/lib/import/parser";
import { extractSheetId } from "@/lib/import/sheet-link";
import type { ParsedExercise, ParsedMonth } from "@/lib/import/types";
import {
  normalizeRating,
  parseExerciseName,
  parseMonthTab,
  parseNumber,
  parseReps,
  parseRpe,
  parseWeight,
} from "@/lib/import/values";
import { weekdayIndex } from "@/lib/dates";

const workbook = parseWorkbook(readFileSync("fixtures/gymSheet.xlsx"));
const month = (tab: string) => workbook.months.find((m) => m.tab === tab)!;
const exercise = (m: ParsedMonth, cell: string): ParsedExercise =>
  m.weeks.flatMap((w) => w.sessions.flatMap((s) => s.exercises)).find((e) => e.cell === cell)!;

describe("celwaarden", () => {
  it("leest getallen met een decimale komma", () => {
    expect(parseNumber("102,5")).toBe(102.5);
    expect(parseNumber(" 60 ")).toBe(60);
    expect(parseNumber("Error")).toBeNull();
  });

  it("neemt bij een rep-bereik de ondergrens en markeert het als geschat", () => {
    expect(parseReps("8-10")).toEqual({ reps: 8, estimated: true, ok: true });
    expect(parseReps(5)).toEqual({ reps: 5, estimated: false, ok: true });
    expect(parseReps("AMRAP").ok).toBe(false);
  });

  it("neemt bij een RPE-bereik het gemiddelde", () => {
    expect(parseRpe("6-7").rpe).toBe(6.5);
    expect(parseRpe("6 - 6,5").rpe).toBe(6.25);
    expect(parseRpe("7.5").rpe).toBe(7.5);
    expect(parseRpe("11").ok).toBe(false);
  });

  it("herkent gewichten en waarschuwt bij rare waarden", () => {
    expect(parseWeight("102,5")).toEqual({ weight: 102.5, warning: null });
    expect(parseWeight("/")).toEqual({ weight: null, warning: null });
    expect(parseWeight("85-80").weight).toBe(85);
    expect(parseWeight("85-80").warning).toMatch(/bereik/);
    expect(parseWeight("20i")).toEqual({ weight: null, warning: 'Gewicht "20i" niet herkend.' });
  });

  it("normaliseert de recap-scores", () => {
    expect(normalizeRating("NEUTRAAL").rating).toBe("NEUTRAAL");
    expect(normalizeRating("GOOD").rating).toBe("AMAZING");
    expect(normalizeRating("HOLY ASS")).toMatchObject({ rating: null });
  });

  it("herkent maandtabs en optionele oefeningen", () => {
    expect(parseMonthTab("JUL2026")).toEqual({ year: 2026, month: 6 });
    expect(parseMonthTab("OKT2026")).toEqual({ year: 2026, month: 9 });
    expect(parseMonthTab("RPE")).toBeNull();
    expect(parseExerciseName("(Hammer curls)")).toEqual({ name: "Hammer curls", optional: true });
    expect(parseExerciseName("Belt squat (hack squat)")).toEqual({ name: "Belt squat (hack squat)", optional: false });
  });
});

describe("fixtures/gymSheet.xlsx: tabbladen", () => {
  it("vindt de maandtabs in chronologische volgorde en slaat RPE en Externals over", () => {
    expect(workbook.months.map((m) => m.tab)).toEqual(["JUL2026", "AUG2026"]);
    expect(workbook.skippedTabs).toEqual(["RPE", "Externals"]);
  });

  it("leest uit Info enkel startdatum, oefeningenlijst en maxima per blok", () => {
    const info = workbook.info!;
    expect(info.startDate).toBe("2026-07-06");
    expect(info.exercises).toHaveLength(23);
    expect(info.exercises.filter((e) => e.category === "Legs")).toHaveLength(8);
    expect(info.exercises).toContainEqual({ name: "Pull ups(weighted)", category: "Deadlift" });
    expect(info.exercises).toContainEqual({ name: "Hamstring curl", category: "Legs" }); // spatie achteraan weg
    expect(info.strengthTests).toEqual([
      { label: "Blok 1", squat: 100, bench: 105, deadlift: 150 },
      { label: "Blok 2", squat: 135, bench: 105, deadlift: 160 },
    ]);
  });
});

describe("fixtures/gymSheet.xlsx: JUL2026 (zonder WEEK-koppen)", () => {
  const jul = month("JUL2026");

  it("vindt 4 weken van elk 4 sessies", () => {
    expect(jul.weeks.map((w) => w.number)).toEqual([1, 2, 3, 4]);
    for (const week of jul.weeks) expect(week.sessions.map((s) => s.number)).toEqual([1, 2, 3, 4]);
  });

  it("zet een oefeningrij om naar doelen + sets", () => {
    const beltSquat = exercise(jul, "B9");
    expect(beltSquat).toMatchObject({ name: "Belt squat", targetSets: 1, targetReps: "5", targetIntensity: "RPE 5", performed: true });
    expect(beltSquat.sets).toEqual([{ setNumber: 1, reps: 5, weight: 60, repsEstimated: false }]);
    expect(exercise(jul, "B10").sets).toHaveLength(3);
  });

  it("leest rep-bereiken die Google Sheets als datum opsloeg", () => {
    // In de cel staat intern 46366 (= 10 december), op het scherm "10-12".
    const legExtensions = exercise(jul, "B12");
    expect(legExtensions.targetReps).toBe("10-12");
    expect(legExtensions.sets[0]).toMatchObject({ reps: 10, repsEstimated: true, weight: 66 });
  });

  it("bewaart rijen zonder gewicht én zonder echte RPE als gepland", () => {
    const bayesian = exercise(jul, "B15");
    expect(bayesian.performed).toBe(false);
    expect(bayesian.sets).toEqual([]);
  });

  it("rekent een RPE-bereik om naar het gemiddelde en bewaart de originele cel", () => {
    const compBench = exercise(jul, "K26"); // ECHTE RPE "6 - 6,5"
    expect(compBench.actualRpe).toBe(6.25);
    expect(compBench.raw.rpe).toBe("6 - 6,5");
  });

  it("waarschuwt bij onleesbaar gewicht maar telt de rij als uitgevoerd", () => {
    expect(exercise(jul, "B28").performed).toBe(true); // "20i"
    expect(exercise(jul, "B28").sets[0].weight).toBeNull();
    expect(workbook.warnings).toContainEqual({ sheet: "JUL2026", cell: "G28", message: 'Flat DB press: Gewicht "20i" niet herkend.' });
  });

  it("neemt 1 set aan als het aantal sets ontbreekt", () => {
    expect(exercise(jul, "B43")).toMatchObject({ name: "Rdls gedaan", targetSets: null, actualRpe: 8 });
    expect(exercise(jul, "B43").sets).toHaveLength(1);
  });

  it("leest cardio onder de rij (DUUR)", () => {
    expect(jul.weeks[1].sessions[0].cardio).toMatchObject([{ type: "Airbike", durationMinutes: 30 }]);
    expect(jul.weeks[2].sessions[2].cardio).toMatchObject([{ type: "Loopband (Wandelen)", durationMinutes: 20 }]);
    // "NEE" met een soort ingevuld = geen cardio.
    expect(jul.weeks[0].sessions[1].cardio).toEqual([]);
  });

  it("negeert lege EXTRA-blokken (cellen met /)", () => {
    const names = jul.weeks.flatMap((w) => w.sessions.flatMap((s) => s.exercises)).filter((e) => e.extraFrom !== null);
    expect(names).toEqual([]);
  });

  it("leest de weekdag uit de kopregel en lost een sessie die 'terug in de tijd' gaat op", () => {
    const week3 = jul.weeks[2];
    expect(week3.sessions.map((s) => s.weekday)).toEqual([0, 1, 5, 0]); // ma, di, za, ma
    expect(week3.sessions.map((s) => s.dayOffset)).toEqual([0, 1, 5, 6]);
  });

  it("leest de wekelijkse recap", () => {
    expect(jul.weeks[0].checkin).toMatchObject({ training: "NEUTRAAL", overallFeeling: "NEUTRAAL", motivation: "BAD", pain: "NEUTRAAL", sessionsDone: 3 });
    expect(jul.weeks[2].checkin).toMatchObject({ motivation: null, pain: "BAD", feedback: "Volgende week locked in" });
    expect(jul.weeks[2].checkin?.raw.motivation).toBe("HOLY ASS");
    expect(jul.weeks[3].checkin).toBeNull();
  });
});

describe("fixtures/gymSheet.xlsx: AUG2026 (met WEEK-koppen en uitleg)", () => {
  const aug = month("AUG2026");

  it("vindt 5 weken via de WEEK-koppen en bewaart de uitleg van de coach", () => {
    expect(aug.weeks.map((w) => w.number)).toEqual([1, 2, 3, 4, 5]);
    expect(aug.description).toMatch(/^Dit block bestaat uit 3 weken/);
  });

  it("vindt de kolommen ook als de kop SETS ontbreekt", () => {
    // Kopregel "SESSIE 4" van week 1 heeft geen "SETS" en geen weekdag.
    const session4 = aug.weeks[0].sessions[3];
    expect(session4.weekday).toBeNull();
    expect(session4.dayOffset).toBe(3); // dag na sessie 3
    expect(session4.exercises[0]).toMatchObject({ name: "comp bench", targetSets: 3, targetReps: "6" });
  });

  it("markeert oefeningen tussen haakjes als optioneel", () => {
    expect(exercise(aug, "B48")).toMatchObject({ name: "Hammer curls", optional: true, performed: false });
    expect(exercise(aug, "M48")).toMatchObject({ optional: true, performed: true });
  });

  it("slaat rijen met een getal als oefeningnaam over, met waarschuwing", () => {
    expect(exercise(aug, "AI48")).toBeUndefined();
    expect(workbook.warnings).toContainEqual({ sheet: "AUG2026", cell: "AI48", message: '"9" is geen oefeningnaam; rij overgeslagen.' });
  });

  it("leest een RPE die Google Sheets als datum opsloeg", () => {
    expect(exercise(aug, "AI14").actualRpe).toBe(6.5); // "6-7"
  });

  it("zet opmerkingen naast de oefening apart", () => {
    expect(exercise(aug, "AT42")).toMatchObject({ name: "Wide grip bench", comment: "Pink op de ringen", performed: true });
  });
});

describe("datums", () => {
  it("kiest standaard de eerste maandag van de maand", () => {
    expect(firstMondayOfMonth(2026, 6)).toBe("2026-07-06");
    expect(firstMondayOfMonth(2026, 7)).toBe("2026-08-03");
    expect(firstMondayOfMonth(2026, 5)).toBe("2026-06-01"); // 1 juni 2026 is zelf een maandag
  });

  it("berekent sessiedatums en check-inweken vanaf week 1", () => {
    expect(sessionDate("2026-07-06", 3, 5)).toBe("2026-07-25"); // week 3, zaterdag
    expect(checkinWeekStart("2026-07-08", 2)).toBe("2026-07-13"); // altijd een maandag
  });
});

describe("payload voor de database", () => {
  const library: LibraryExercise[] = [
    { id: "00000000-0000-4000-8000-000000000001", name: "Leg extension", category: "Legs" },
    { id: "00000000-0000-4000-8000-000000000002", name: "Lat pulldown", category: "Deadlift" },
  ];
  const unknown = findUnknownNames(workbook, library);
  const choices = defaultChoices(workbook, unknown);

  it("koppelt namen hoofdletterongevoelig en stelt een bijna-match voor", () => {
    expect(unknown.find((n) => n.key === "lat pulldown")).toBeUndefined(); // exact (andere hoofdletters niet nodig)
    expect(unknown.find((n) => n.key === "leg extensions")?.suggestion).toEqual({
      kind: "existing",
      exerciseId: "00000000-0000-4000-8000-000000000001",
    });
    expect(unknown.find((n) => n.key === "comp deadlift")?.suggestion).toMatchObject({ kind: "new", name: "comp deadlift" });
  });

  it("bouwt een payload met datums, geplande trainingen en check-ins", () => {
    const result = buildPayload(workbook, choices, library, "11111111-1111-4111-8111-111111111111", "upload");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const { payload } = result;
    expect(payload.tabs.map((t) => t.sheet_tab)).toEqual(["JUL2026", "AUG2026"]);

    const jul = payload.tabs[0];
    expect(jul.workouts[0]).toMatchObject({ date: "2026-07-06", title: "Week 1 · Sessie 1", status: "completed" });
    expect(jul.workouts.every((w) => w.exercises.every((e) => e.exercise_id || e.exercise_key))).toBe(true);
    expect(jul.checkins.map((c) => c.week_start)).toEqual(["2026-07-06", "2026-07-13", "2026-07-20"]);
    expect(jul.checkins.every((c) => weekdayIndex(c.week_start) === 0)).toBe(true);

    // AUG week 5 sessie 4 heeft enkel niet-uitgevoerde rijen → gepland.
    const aug = payload.tabs[1];
    expect(aug.workouts.at(-1)).toMatchObject({ title: "Week 5 · Sessie 4", status: "planned" });
    expect(payload.strength_tests).toHaveLength(2);

    // Elke nieuwe oefening maar één keer, ook al komt ze in vele weken voor.
    const keys = payload.new_exercises.map((e) => e.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("geeft bij dezelfde invoer exact dezelfde payload (herimport = vervangen, geen dubbels)", () => {
    const first = buildPayload(workbook, choices, library, "11111111-1111-4111-8111-111111111111", "link");
    const second = buildPayload(workbook, choices, library, "11111111-1111-4111-8111-111111111111", "link");
    expect(second).toEqual(first);
  });

  it("verschuift alle datums mee met een andere startdatum voor week 1", () => {
    const shifted = { ...choices, tabs: { ...choices.tabs, JUL2026: { include: true, week1: "2026-07-13" } } };
    const result = buildPayload(workbook, shifted, library, "11111111-1111-4111-8111-111111111111", "link");
    expect(result.ok && result.payload.tabs[0].workouts[0].date).toBe("2026-07-13");
  });

  it("weigert te importeren zonder koppeling voor een onbekende naam", () => {
    const incomplete = { ...choices, names: {} };
    const result = buildPayload(workbook, incomplete, library, "11111111-1111-4111-8111-111111111111", "link");
    expect(result).toMatchObject({ ok: false });
  });
});

describe("variant: WEEK n SESSIE 1 in één kopcel", () => {
  // Kleine sheet zoals in de beschrijving: uitleg in de eerste kopcel, geen
  // weekdagen en een kolom die een plaats opschoof.
  const rows: (string | number | null)[][] = [
    ["WEEK 1 SESSIE 1 - Deload-week, rustig opbouwen", null, "SETS", "REPS", "INTENSITEIT", "GEWICHT", "ECHTE RPE", "NOTITIES", null, null, null,
     "WEEK 2 SESSIE 1", null, null, "SETS", "REPS", "INTENSITEIT", "GEWICHT", "ECHTE RPE", "NOTITIES"],
    ["Squat", null, 3, 5, "RPE 6", "100", "6", null, null, null, null, "Squat", null, null, 3, 5, "RPE 7", "102,5", "7", null],
    ["SESSIE 2", null, "SETS", "REPS", "INTENSITEIT", "GEWICHT", "ECHTE RPE", "NOTITIES", null, null, null, "SESSIE 2", null, null, "SETS", "REPS", "INTENSITEIT", "GEWICHT", "ECHTE RPE", "NOTITIES"],
    ["Bench", null, 3, "8-10", "RPE 8", null, null, null, null, null, null, "Bench", null, null, 3, "8", "RPE 8", "80", null, null],
  ];
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(rows), "SEP2026");
  const parsed = parseWorkbook(XLSX.write(book, { type: "array", bookType: "xlsx" }));
  const sep = parsed.months[0];

  it("vindt de weken en bewaart de uitleg uit de eerste kopcel", () => {
    expect(sep.weeks.map((w) => w.number)).toEqual([1, 2]);
    expect(sep.description).toBe("Deload-week, rustig opbouwen");
  });

  it("plant sessies zonder weekdag op opeenvolgende dagen", () => {
    expect(sep.weeks[0].sessions.map((s) => s.dayOffset)).toEqual([0, 1]);
  });

  it("vindt de kolommen via de kopteksten, ook als ze opschoven", () => {
    const squat = sep.weeks[1].sessions[0].exercises[0];
    expect(squat).toMatchObject({ targetSets: 3, targetIntensity: "RPE 7", actualRpe: 7 });
    expect(squat.sets[0].weight).toBe(102.5);
    expect(sep.weeks[0].sessions[1].exercises[0]).toMatchObject({ name: "Bench", performed: false });
  });
});

describe("deellink", () => {
  it("haalt het ID uit een Google Sheets-link", () => {
    expect(extractSheetId("https://docs.google.com/spreadsheets/d/1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789/edit#gid=0")).toBe(
      "1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789",
    );
    expect(extractSheetId("https://example.com/spreadsheet")).toBeNull();
  });
});

describe("voorstel van de coach in de gewichtkolom", () => {
  it("haalt het voorstel eruit en houdt het echte gewicht", async () => {
    const { splitSuggestedLoad } = await import("@/lib/import/values");
    expect(splitSuggestedLoad("suggested load 120-122,5")).toEqual({ value: null, suggestion: "120-122,5" });
    expect(splitSuggestedLoad("(suggested load 140-145) 150")).toEqual({ value: "150", suggestion: "140-145" });
    expect(splitSuggestedLoad("(suggested load 92,5-95) 97,5")).toEqual({ value: "97,5", suggestion: "92,5-95" });
    expect(splitSuggestedLoad("(suggested load) 90")).toEqual({ value: "90", suggestion: null });
    expect(splitSuggestedLoad("Suggested load: 100 kg")).toEqual({ value: null, suggestion: "100" });
    expect(splitSuggestedLoad(80)).toEqual({ value: 80, suggestion: null });
    expect(splitSuggestedLoad("20i")).toEqual({ value: "20i", suggestion: null });
  });

  it("een rij met enkel een voorstel is gepland, met voorstel en gewicht is ze gedaan", async () => {
    const XLSX = await import("xlsx");
    const { parseWorkbook } = await import("@/lib/import/parser");
    const sheet = XLSX.utils.aoa_to_sheet([
      [],
      ["", "WEEK 1"],
      ["", "SESSIE 1", "Maandag", "SETS", "REPS", "INTENSITEIT", "GEWICHT", "ECHTE RPE", "NOTITIES"],
      ["", "Comp squat", null, 3, 3, "RPE 8", "suggested load 120-122,5"],
      ["", "Deadlift", null, 1, 2, "RPE 8", "(suggested load 140-145) 150"],
    ]);
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, "OKT2026");
    const parsed = parseWorkbook(XLSX.write(book, { type: "buffer", bookType: "xlsx" }));
    const [squat, deadlift] = parsed.months[0].weeks[0].sessions[0].exercises;
    expect(squat).toMatchObject({ performed: false, suggestedLoad: "120-122,5", sets: [] });
    expect(deadlift).toMatchObject({ performed: true, suggestedLoad: "140-145" });
    expect(deadlift.sets[0].weight).toBe(150);
  });
});
