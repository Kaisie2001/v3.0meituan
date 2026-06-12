import { describe, expect, it } from "vitest";
import { DEMO_SCENARIOS, type DemoScenario } from "@/lib/demoScenarios";
import { getDateLabel, getDurationLabel } from "@/lib/preferenceSummary";

const REQUIRED_TRAVEL_KEYS = [
  "startTime",
  "transportMode",
  "routePriority",
] as const;

function assertScenarioShape(scenario: DemoScenario) {
  expect(scenario.id).toBeTruthy();
  expect(scenario.label || (scenario as { title?: string }).title).toBeTruthy();
  expect(scenario.goal.trim().length).toBeGreaterThan(0);

  const { travelSettings } = scenario;
  expect(travelSettings).toBeDefined();

  for (const key of REQUIRED_TRAVEL_KEYS) {
    expect(travelSettings[key]).toBeTruthy();
  }

  const dateLabel = getDateLabel(travelSettings.date);
  const durationLabel = getDurationLabel(travelSettings.duration);
  expect(dateLabel.trim().length).toBeGreaterThan(0);
  expect(durationLabel.trim().length).toBeGreaterThan(0);
}

describe("demoScenarios", () => {
  it("contains at least 5 demo scenarios", () => {
    expect(DEMO_SCENARIOS.length).toBeGreaterThanOrEqual(5);
  });

  it.each(DEMO_SCENARIOS.map((s) => [s.id, s] as const))(
    "scenario %s has complete structure",
    (_id, scenario) => {
      assertScenarioShape(scenario);
    },
  );

  it("covers core persona ids used by the demo", () => {
    const ids = DEMO_SCENARIOS.map((s) => s.id);
    expect(ids).toEqual(expect.arrayContaining(["friends", "family", "work"]));
  });
});
