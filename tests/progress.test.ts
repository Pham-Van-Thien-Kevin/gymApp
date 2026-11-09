// Unit tests voor de gecombineerde squat/bench/deadlift-grafiek.
import { describe, expect, it } from "vitest";
import { bigThreeLift } from "@/lib/exercises";
import { buildProgressSeries, combineByDate, formatLoad } from "@/lib/stats";
import type { SetLogRow } from "@/lib/types";

describe("bigThreeLift", () => {
  it("herkent de wedstrijdlifts, ook met andere hoofdletters of spaties", () => {
    expect(bigThreeLift("Squat")).toBe("squat");
    expect(bigThreeLift(" comp  bench ")).toBe("bench");
    expect(bigThreeLift("Benchpress")).toBe("bench");
    expect(bigThreeLift("Comp deadlift")).toBe("deadlift");
    expect(bigThreeLift("Sumo deadlift")).toBe("deadlift");
  });

  it("negeert varianten met een ander 1RM", () => {
    expect(bigThreeLift("Close grip bench")).toBeNull();
    expect(bigThreeLift("Romanian deadlifts")).toBeNull();
    expect(bigThreeLift("Beltsquat")).toBeNull();
    expect(bigThreeLift("Tempo bench 3-2-0")).toBeNull();
  });
});

describe("combineByDate", () => {
  it("zet reeksen op één tijd-as en laat ontbrekende dagen leeg", () => {
    const rows = combineByDate({
      squat: [{ date: "2026-10-05", value: 180 }, { date: "2026-10-12", value: 182.5 }],
      bench: [{ date: "2026-10-06", value: 120 }],
    });
    expect(rows).toEqual([
      { date: "2026-10-05", squat: 180 },
      { date: "2026-10-06", bench: 120 },
      { date: "2026-10-12", squat: 182.5 },
    ]);
  });
});

describe("formatLoad", () => {
  it("rondt een geschat gewicht af op 2,5 kg (IPF-schijven)", () => {
    expect(formatLoad(145.6)).toBe("145 kg");
    expect(formatLoad(146.3)).toBe("147,5 kg");
    expect(formatLoad(121.06)).toBe("120 kg");
    expect(formatLoad(null)).toBe("–");
  });
});

describe("buildProgressSeries", () => {
  const set = (weight: number, reps: number, rpe: number | null = null): SetLogRow => ({
    exercise_id: "e1", workout_id: "w1", date: "2026-10-28", set_number: 1, reps, weight, rpe, reps_estimated: false,
  });

  it("toont de zwaarste set die je echt deed, bij gelijk gewicht die met de meeste reps", () => {
    const [point] = buildProgressSeries([set(140, 1, 8), set(140, 3, 9), set(120, 8, 8)]);
    expect(point.heaviest).toBe(140);
    expect(point.heaviestSet).toBe("140 kg × 3 @ RPE 9");
  });
});

describe("combineByDate met detail", () => {
  it("zet de set als <reeks>Detail naast de waarde", () => {
    const [row] = combineByDate({ squat: [{ date: "2026-10-05", value: 140, detail: "140 kg × 3" }] });
    expect(row).toEqual({ date: "2026-10-05", squat: 140, squatDetail: "140 kg × 3" });
  });
});

describe("weeklyTonnage", () => {
  it("telt gewicht × reps op per week (maandag)", async () => {
    const { weeklyTonnage } = await import("@/lib/stats");
    const row = (date: string, weight: number, reps: number): SetLogRow => ({
      exercise_id: "e1", workout_id: "w1", date, set_number: 1, reps, weight, rpe: null, reps_estimated: false,
    });
    expect(weeklyTonnage([row("2026-10-26", 100, 5), row("2026-10-28", 100, 3), row("2026-11-02", 50, 10)])).toEqual([
      { date: "2026-10-26", value: 800 },
      { date: "2026-11-02", value: 500 },
    ]);
  });
});

describe("summarizeMonths", () => {
  // Vrijdag 30 oktober 2026: deze week loopt van maandag 26 oktober tot zondag 1 november.
  const today = "2026-10-30";

  it("telt per maand en week: gedaan / totaal, een gemiste sessie geeft 3/4", async () => {
    const { summarizeMonths } = await import("@/lib/blocks");
    const done = (date: string) => ({ date, status: "completed" as const });
    const planned = (date: string) => ({ date, status: "planned" as const });
    const [oct] = summarizeMonths(
      [done("2026-10-19"), done("2026-10-20"), done("2026-10-24"), planned("2026-10-25"), done("2026-10-26"), planned("2026-10-29")],
      today,
    );
    expect(oct.tab).toBe("OKT2026");
    expect(oct.weeks.map((w) => [w.week, w.done, w.total, w.current])).toEqual([
      [3, 3, 4, false],
      [4, 1, 2, true],
    ]);
  });
});

describe("bestTestedMaxes", () => {
  it("neemt per lift je beste geteste max over alle blokken", async () => {
    const { bestTestedMaxes } = await import("@/lib/stats");
    const prs = bestTestedMaxes([
      { label: "Blok 1", squat: 100, bench: 105, deadlift: 150, tested_on: "2026-07-28" },
      { label: "Blok 2", squat: 135, bench: 105, deadlift: 160, tested_on: "2026-09-21" },
    ]);
    expect([prs.squat?.kg, prs.bench?.kg, prs.deadlift?.kg]).toEqual([135, 105, 160]);
    expect(prs.squat?.label).toBe("Blok 2");
    expect(bestTestedMaxes([]).bench).toBeNull();
  });
});

describe("blokken verlopen", () => {
  it("het nieuwste begonnen blok is het huidige; oudere blokken zijn verlopen, nieuwere niet", async () => {
    const { currentBlockTab, isExpiredBlock } = await import("@/lib/blocks");
    const rows = [
      { sheetTab: "SEP2026", status: "completed" as const },
      { sheetTab: "SEP2026", status: "planned" as const },
      { sheetTab: "OCT2026", status: "completed" as const },
      { sheetTab: "OCT2026", status: "planned" as const },
      { sheetTab: "NOV2026", status: "planned" as const }, // al geïmporteerd, nog niet begonnen
    ];
    const current = currentBlockTab(rows);
    expect(current).toBe("OCT2026");
    expect(isExpiredBlock("SEP2026", current)).toBe(true);
    expect(isExpiredBlock("OCT2026", current)).toBe(false);
    expect(isExpiredBlock("NOV2026", current)).toBe(false);
    expect(isExpiredBlock(null, current)).toBe(false); // geen import: verloopt nooit
    // Eén sessie van november afgewerkt: nu is oktober verlopen.
    expect(isExpiredBlock("OCT2026", currentBlockTab([...rows, { sheetTab: "NOV2026", status: "completed" as const }]))).toBe(true);
    // Over de jaargrens heen.
    expect(isExpiredBlock("DEC2026", "JAN2027")).toBe(true);
  });
});

describe("groupByBlockWeek", () => {
  it("groepeert per blokweek uit de sheet, nieuwste week eerst; vrije trainingen volgen de kalender", async () => {
    const { groupByBlockWeek } = await import("@/lib/blocks");
    const weeks = groupByBlockWeek([
      { date: "2026-10-27", status: "completed" as const, title: "Vrije training", sheetTab: null },
      // Uit de sheet: "Week 4" van augustus, ook al valt 6 sep al in september.
      { date: "2026-09-06", status: "planned" as const, title: "Week 4 · Sessie 4", sheetTab: "AUG2026" },
      { date: "2026-08-25", status: "completed" as const, title: "Week 4 · Sessie 2", sheetTab: "AUG2026" },
      { date: "2026-08-18", status: "completed" as const, title: "Week 3 · Sessie 2", sheetTab: "AUG2026" },
    ]);
    expect(weeks.map((w) => [w.month, w.week, w.items.length])).toEqual([
      [9, 4, 1], // oktober, week 4 (maandag 26 okt)
      [7, 4, 2],
      [7, 3, 1],
    ]);
  });
});

describe("blokken van de trainer", () => {
  // Blok 1: maandag 2 november 2026, 2 weken (t.e.m. zondag 15 november).
  const blocks = [{ number: 1, start_date: "2026-11-02", weeks: 2 }];

  it("plaatst een datum in blok en week, met de maandag van die week", async () => {
    const { placeInBlock } = await import("@/lib/blocks");
    expect(placeInBlock("2026-11-02", blocks)).toEqual({ block: 1, week: 1, monday: "2026-11-02" });
    expect(placeInBlock("2026-11-15", blocks)).toEqual({ block: 1, week: 2, monday: "2026-11-09" });
    expect(placeInBlock("2026-11-16", blocks)).toBeNull();
    expect(placeInBlock("2026-11-01", blocks)).toBeNull();
  });

  it("groepeert per blokweek; trainingen buiten een blok volgen de maand", async () => {
    const { groupByBlockWeek } = await import("@/lib/blocks");
    const weeks = groupByBlockWeek(
      [
        { date: "2026-11-11", status: "completed" as const, title: "Week 2 · Sessie 1", sheetTab: "NOV2026" },
        { date: "2026-11-03", status: "completed" as const, title: "Week 1 · Sessie 1", sheetTab: "NOV2026" },
        { date: "2026-10-27", status: "completed" as const, title: "Vrije training", sheetTab: null },
      ],
      blocks,
    );
    expect(weeks.map((w) => [w.block, w.week, w.monday])).toEqual([
      [1, 2, "2026-11-09"],
      [1, 1, "2026-11-02"],
      [null, 4, "2026-10-26"], // oktober, week 4
    ]);
  });

  it("toont de dagen van een week", async () => {
    const { formatWeekRange } = await import("@/lib/blocks");
    expect(formatWeekRange("2026-11-02")).toBe("2 – 8 nov");
    expect(formatWeekRange("2026-11-30")).toBe("30 nov – 6 dec");
  });
});

describe("upcomingProgramDays", () => {
  const day = (id: string, weekday: number | null) => ({ id, name: id, position: 0, weekday, program_exercises: [] });

  it("rekent de schemadagen van de komende twee weken uit op hun weekdag, vanaf morgen", async () => {
    const { upcomingProgramDays } = await import("@/lib/program");
    const noBlock = { block_weeks: null, rpe_start: null, rpe_end: null };
    // Woensdag 4 november 2026; maandag (0) en donderdag (3) zijn trainingsdagen, "vrij" heeft geen weekdag.
    const upcoming = upcomingProgramDays([day("ma", 0), day("do", 3), day("vrij", null)], noBlock, "2026-10-01", "2026-11-04");
    expect(upcoming.map((u) => [u.date, u.day.id, u.rpe])).toEqual([
      ["2026-11-05", "do", null],
      ["2026-11-09", "ma", null],
      ["2026-11-12", "do", null],
      ["2026-11-16", "ma", null],
    ]);
  });

  it("stopt na de laatste blokweek en geeft de RPE van elke week mee", async () => {
    const { upcomingProgramDays } = await import("@/lib/program");
    // Blok van 2 weken (RPE 7 → 8), gestart maandag 26 oktober: na zondag 8 november is het voorbij.
    const block = { block_weeks: 2, rpe_start: 7, rpe_end: 8 };
    const upcoming = upcomingProgramDays([day("do", 3)], block, "2026-10-26", "2026-11-04");
    expect(upcoming.map((u) => [u.date, u.rpe])).toEqual([["2026-11-05", 8]]);
  });
});
