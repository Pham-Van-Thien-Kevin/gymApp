// Unit tests voor de gecombineerde squat/bench/deadlift-grafiek.
import { describe, expect, it } from "vitest";
import { bigThreeLift } from "@/lib/exercises";
import { combineByDate } from "@/lib/stats";

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
