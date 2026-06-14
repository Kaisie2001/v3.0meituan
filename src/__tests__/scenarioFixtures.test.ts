import { describe, expect, it } from "vitest";
import {
  getScenarioFixture,
  scenarioFixtures,
  type ScenarioFixture,
} from "@/lib/scenarioFixtures";
import { getDateLabel, getDurationLabel } from "@/lib/preferenceSummary";

const REQUIRED_TRAVEL_KEYS = [
  "date",
  "startTime",
  "duration",
  "transportMode",
  "routePriority",
  "partySize",
  "budget",
  "maxCommute",
] as const;

function assertFixtureShape(fixture: ScenarioFixture) {
  expect(fixture.id).toBeTruthy();
  expect(fixture.label.trim().length).toBeGreaterThan(0);
  expect(fixture.goal.trim().length).toBeGreaterThan(0);
  expect(fixture.expectedPersonaHints.length).toBeGreaterThan(0);
  expect(fixture.expectedRiskHints.length).toBeGreaterThan(0);
  expect(fixture.expectedBehavior.trim().length).toBeGreaterThan(0);
  expect(fixture.expectedAssertions.length).toBeGreaterThan(0);

  for (const assertion of fixture.expectedAssertions) {
    expect(assertion.description.trim().length).toBeGreaterThan(0);
  }

  const { travelSettings } = fixture;
  expect(travelSettings).toBeDefined();
  for (const key of REQUIRED_TRAVEL_KEYS) {
    expect(travelSettings[key]).toBeDefined();
    expect(travelSettings[key]).not.toBeNull();
  }

  expect(getDateLabel(travelSettings.date).trim().length).toBeGreaterThan(0);
  expect(getDurationLabel(travelSettings.duration).trim().length).toBeGreaterThan(0);
  expect(fixture.travelSettings.routePriority).toBe(fixture.expectedRoutePriority);
}

describe("scenarioFixtures", () => {
  it("contains at least 6 golden scenarios", () => {
    expect(scenarioFixtures.length).toBeGreaterThanOrEqual(6);
  });

  it.each(scenarioFixtures.map((fixture) => [fixture.id, fixture] as const))(
    "fixture %s has complete structure",
    (_id, fixture) => {
      assertFixtureShape(fixture);
    },
  );

  it("getScenarioFixture returns fixture by id", () => {
    for (const fixture of scenarioFixtures) {
      expect(getScenarioFixture(fixture.id)).toEqual(fixture);
    }
  });

  it("getScenarioFixture returns undefined for unknown id without throwing", () => {
    expect(() => getScenarioFixture("not-a-real-scenario")).not.toThrow();
    expect(getScenarioFixture("not-a-real-scenario")).toBeUndefined();
    expect(getScenarioFixture("")).toBeUndefined();
  });

  it("uses more than one transport mode across scenarios", () => {
    const modes = new Set(scenarioFixtures.map((fixture) => fixture.travelSettings.transportMode));
    expect(modes.size).toBeGreaterThan(1);
  });

  it("uses more than one route priority across scenarios", () => {
    const priorities = new Set(scenarioFixtures.map((fixture) => fixture.travelSettings.routePriority));
    expect(priorities.size).toBeGreaterThan(1);
  });

  it("covers the six canonical scenario ids", () => {
    const ids = scenarioFixtures.map((fixture) => fixture.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        "friendsEvening",
        "familyWeekend",
        "workAfternoon",
        "dateEvening",
        "errandAfternoon",
        "rushTaxi",
      ]),
    );
  });
});
