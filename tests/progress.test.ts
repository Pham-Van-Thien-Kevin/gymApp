// Unit tests voor de gecombineerde squat/bench/deadlift-grafiek.
import { describe, expect, it } from "vitest";
import { bigThreeLift } from "@/lib/exercises";
import { buildProgressSeries, combineByDate, formatLoad } from "@/lib/stats";
import type { SetLogRow } from "@/lib/types";

describe("bigThreeLift", () => {
  it("herkent de wedstrijdlifts, ook met andere hoofdletters of spaties", () => {
    expect(bigThreeLift("Squat")).toBe("squat");
    expect(bigThreeLift(" comp  bench ")).toBe("bench");
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
