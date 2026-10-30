// Unit tests voor het powerlifting-rekenwerk in src/lib/rpe.ts.
import { describe, expect, it } from "vitest";
import {
  estimateOneRepMax,
  estimateRpe,
  percentageOf1RM,
  platesPerSide,
  roundToIncrement,
  suggestFromTarget,
  suggestLoad,
  targetRpeFrom,
} from "@/lib/rpe";
import { buildProgressSeries } from "@/lib/stats";

describe("RPE-tabel", () => {
  it("geeft het percentage uit de sheet", () => {
    expect(percentageOf1RM(1, 10)).toBe(1);
    expect(percentageOf1RM(5, 8)).toBe(0.81);
    expect(percentageOf1RM(12, 5)).toBe(0.53);
  });

  it("interpoleert tussen twee RPE-rijen", () => {
    // 5 reps: RPE 8 = 81%, RPE 8,5 = 82% → RPE 8,25 = 81,5%
    expect(percentageOf1RM(5, 8.25)).toBeCloseTo(0.815, 5);
  });

  it("geeft null buiten de tabel", () => {
    expect(percentageOf1RM(13, 8)).toBeNull();
    expect(percentageOf1RM(5, 4.5)).toBeNull();
    expect(percentageOf1RM(2.5, 8)).toBeNull();
  });
});

describe("geschat 1RM", () => {
  it("gebruikt de RPE-tabel als er een RPE is", () => {
    expect(estimateOneRepMax(100, 5, 8)).toBeCloseTo(123.46, 2); // 100 / 0,81
  });

  it("valt terug op Epley zonder RPE of buiten de tabel", () => {
    expect(estimateOneRepMax(100, 5, null)).toBeCloseTo(116.67, 2);
    expect(estimateOneRepMax(100, 15, 8)).toBe(150);
    expect(estimateOneRepMax(100, 1, null)).toBe(100);
  });

  it("wordt gebruikt in de progressiegrafiek", () => {
    const [point] = buildProgressSeries([
      { exercise_id: "x", workout_id: "w", date: "2026-10-20", set_number: 1, reps: 5, weight: 100, rpe: 8, reps_estimated: false },
    ]);
    expect(point.e1rm).toBe(123.5);
  });
});

describe("voorgesteld gewicht", () => {
  it("komt overeen met de rekenmachine in de sheet", () => {
    expect(suggestLoad(105, 4, 7)).toBe(85); // bench: 105 × 81% = 85,05 → 85
    expect(suggestLoad(160, 6, 6)).toBe(117.5); // deadlift: 160 × 74% = 118,4 → 117,5
  });

  it("rondt af op 2,5 kg en geeft null buiten de tabel", () => {
    expect(roundToIncrement(101.2)).toBe(100);
    expect(roundToIncrement(101.3)).toBe(102.5);
    expect(suggestLoad(100, 15, 8)).toBeNull();
  });

  it("leest de doel-RPE uit de tekst (ondergrens bij een bereik)", () => {
    expect(targetRpeFrom("RPE 8-8,5")).toBe(8);
    expect(targetRpeFrom("RPE 7,5")).toBe(7.5);
    expect(targetRpeFrom("7-8")).toBe(7); // zo staat het in een schema
    expect(targetRpeFrom("Load indien te licht")).toBeNull();
    expect(targetRpeFrom(null)).toBeNull();
  });

  it("stelt een gewicht voor vanuit een schemadoel", () => {
    // Squat met geschat 1RM 145,6 kg, doel 4 × 5 @ RPE 7 → 79% → 115 kg
    expect(suggestFromTarget(145.6, "5", "7")).toEqual({ weight: 115, reps: 5, rpe: 7 });
    expect(suggestFromTarget(145.6, "8-10", "7-8")).toEqual({ weight: 100, reps: 8, rpe: 7 });
    expect(suggestFromTarget(null, "5", "7")).toBeNull();
    expect(suggestFromTarget(145.6, "5", "Load indien te licht")).toBeNull();
  });
});

describe("RPE inschatten", () => {
  it("vindt de RPE terug uit de tabel", () => {
    // 1RM 100 kg: 81 kg × 5 = 81% = RPE 8 in de tabel.
    expect(estimateRpe(81, 5, 100)).toEqual({ rpe: 8 });
  });

  it("interpoleert tussen twee rijen", () => {
    // 5 reps: RPE 8 = 81%, RPE 8,5 = 82% → 81,5% ≈ RPE 8,25
    const result = estimateRpe(81.5, 5, 100);
    expect(result && "rpe" in result ? result.rpe : null).toBeCloseTo(8.25, 5);
  });

  it("meldt als het gewicht buiten de tabel valt", () => {
    expect(estimateRpe(90, 5, 100)).toEqual({ outOfRange: "above" }); // 90% bij 5 reps > RPE 10
    expect(estimateRpe(60, 5, 100)).toEqual({ outOfRange: "below" });
    expect(estimateRpe(80, 15, 100)).toBeNull();
  });
});

describe("schijven per kant", () => {
  it("legt de zwaarste schijven eerst", () => {
    expect(platesPerSide(140)).toEqual({ plates: [25, 25, 10], rest: 0 });
    expect(platesPerSide(102.5)).toEqual({ plates: [25, 15, 1.25], rest: 0 });
  });

  it("kent de lege stang en te lichte gewichten", () => {
    expect(platesPerSide(20)).toEqual({ plates: [], rest: 0 });
    expect(platesPerSide(15)).toBeNull();
  });

  it("meldt wat je niet precies kan leggen", () => {
    expect(platesPerSide(101)).toEqual({ plates: [25, 15], rest: 1 });
  });
});

describe("IPF GL-punten", () => {
  it("rekent met de IPF-formule (classic)", async () => {
    const { glPoints } = await import("@/lib/gl");
    // 700 kg total bij 83 kg, man: 700 × 100 / (1199.72839 − 1025.18162 · e^(−0.00921 · 83))
    const expected = (700 * 100) / (1199.72839 - 1025.18162 * Math.exp(-0.00921 * 83));
    expect(glPoints(700, 83, "M")).toBeCloseTo(expected, 2);
    expect(glPoints(700, 83, "M")).toBeGreaterThan(90);
    expect(glPoints(700, 83, "M")).toBeLessThan(100);
    // Zelfde total, lichter = meer punten.
    expect(glPoints(700, 74, "M")!).toBeGreaterThan(glPoints(700, 83, "M")!);
    // Vrouwen hebben eigen coëfficiënten.
    expect(glPoints(400, 63, "V")).toBeCloseTo((400 * 100) / (610.32796 - 1045.59282 * Math.exp(-0.03048 * 63)), 2);
  });

  it("geeft null zonder total of lichaamsgewicht", async () => {
    const { glPoints } = await import("@/lib/gl");
    expect(glPoints(0, 80, "M")).toBeNull();
    expect(glPoints(500, null, "M")).toBeNull();
  });
});

describe("blokopbouw", () => {
  it("4 weken van RPE 6 naar 9: 6, 7, 8, 9", async () => {
    const { blockRpe } = await import("@/lib/program");
    const block = { block_weeks: 4, rpe_start: 6, rpe_end: 9 };
    expect([1, 2, 3, 4].map((week) => blockRpe(block, week))).toEqual([6, 7, 8, 9]);
    // Na het blok blijft het op de top; vóór week 1 op de start.
    expect(blockRpe(block, 6)).toBe(9);
    expect(blockRpe(block, 0)).toBe(6);
    // Oneven stappen worden afgerond op 0,5: 3 weken van 6 naar 9 = 6, 7,5, 9.
    expect([1, 2, 3].map((week) => blockRpe({ block_weeks: 3, rpe_start: 6, rpe_end: 9 }, week))).toEqual([6, 7.5, 9]);
    expect(blockRpe({ block_weeks: null, rpe_start: null, rpe_end: null }, 1)).toBeNull();
  });

  it("telt de week vanaf de toewijzing (maandag tot zondag)", async () => {
    const { currentBlock } = await import("@/lib/program");
    const block = { block_weeks: 4, rpe_start: 6, rpe_end: 9 };
    // Toegewezen op woensdag 7 oktober: die week is week 1.
    expect(currentBlock(block, "2026-10-07", "2026-10-11")).toEqual({ week: 1, weeks: 4, rpe: 6, finished: false });
    expect(currentBlock(block, "2026-10-07", "2026-10-12")).toMatchObject({ week: 2, rpe: 7 });
    expect(currentBlock(block, "2026-10-07", "2026-11-01")).toMatchObject({ week: 4, rpe: 9, finished: false });
    expect(currentBlock(block, "2026-10-07", "2026-11-02")).toMatchObject({ week: 4, rpe: 9, finished: true });
  });

  it("vervangt de RPE van alle oefeningen", async () => {
    const { withBlockRpe } = await import("@/lib/program");
    const day = { id: "d", name: "Dag 1", position: 0, weekday: 0, program_exercises: [{ id: "p", position: 0, target_sets: 3, target_reps: "5", target_rpe: "8", notes: null, optional: false, exercise: null }] };
    expect(withBlockRpe([day], { week: 2, weeks: 4, rpe: 7.5, finished: false })[0].program_exercises[0].target_rpe).toBe("7,5");
    expect(withBlockRpe([day], null)[0].program_exercises[0].target_rpe).toBe("8");
  });
});
