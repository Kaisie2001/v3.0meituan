import { describe, expect, it } from "vitest";
import { applyTravelSettingsToPlan } from "@/lib/applyTravelSettingsToPlan";
import { parseInput } from "@/lib/parseIntent";
import { getPersonaConfig, inferPersona } from "@/lib/persona";
import { runAgent } from "@/lib/runAgent";
import { scenarioFixtures, type ScenarioFixture } from "@/lib/scenarioFixtures";
import { buildSemanticProfile } from "@/lib/semanticHash";
import { buildTravelSettingEffects } from "@/lib/travelSettingEffects";
import type { ScoredPoi } from "@/lib/types";

function collectPersonaText(fixture: ScenarioFixture) {
  const parseResult = parseInput(fixture.goal, fixture.wechat, fixture.seed);
  const persona = inferPersona(parseResult);
  const config = getPersonaConfig(parseResult);
  return {
    parseResult,
    persona,
    text: [persona, config.label, config.summary, ...config.tags].join(" "),
  };
}

function assertNoNaNInPois(pois: ScoredPoi[]) {
  for (const poi of pois) {
    expect(Number.isFinite(poi.goabilityScore)).toBe(true);
    expect(Number.isFinite(poi.queueMinutes)).toBe(true);
    expect(Number.isFinite(poi.routeEtaMinutes)).toBe(true);
    expect(Number.isFinite(poi.pricePerPerson)).toBe(true);
  }
}

function assertPlanStructure(
  adjusted: ReturnType<typeof applyTravelSettingsToPlan>,
  fixture: ScenarioFixture,
) {
  expect(adjusted.adjustedRankedPois).toBeDefined();
  expect(adjusted.adjustedRoutePlan).toBeDefined();
  expect(adjusted.adjustedFallbackPlans).toBeDefined();
  expect(adjusted.planningSignals).toBeDefined();
  expect(adjusted.settingImpactSummary?.trim().length).toBeGreaterThan(0);

  assertNoNaNInPois(adjusted.adjustedRankedPois);

  const mainPlan = adjusted.adjustedRoutePlan.mainPlan;
  expect(mainPlan).toBeDefined();
  expect(Number.isFinite(mainPlan.totalMinutes)).toBe(true);
  expect(Number.isFinite(mainPlan.totalBudget)).toBe(true);
  expect(Number.isFinite(mainPlan.totalWaitMinutes)).toBe(true);
  expect(Number.isFinite(mainPlan.totalCommuteMinutes)).toBe(true);

  const planningText = [
    adjusted.settingImpactSummary,
    ...adjusted.planningSignals.impacts,
    adjusted.planningSignals.routePriority,
    adjusted.planningSignals.transportMode,
  ].join(" ");

  expect(planningText.trim().length).toBeGreaterThan(0);
  expect(fixture.travelSettings.routePriority).toBe(fixture.expectedRoutePriority);

  if (fixture.id === "rushTaxi") {
    expect(planningText).not.toMatch(/全程步行/);
    expect(planningText).toMatch(/驾车|转场|时间/);
  }

  if (fixture.id === "friendsEvening") {
    expect(adjusted.adjustedFallbackPlans.length).toBeGreaterThan(0);
  }
}

describe("scenarioFixtureIntegration", () => {
  it.each(scenarioFixtures.map((fixture) => [fixture.id, fixture] as const))(
    "fixture %s runs semantic/persona helpers without throwing",
    (_id, fixture) => {
      expect(() => buildSemanticProfile(fixture.goal)).not.toThrow();

      const { persona, text } = collectPersonaText(fixture);
      expect(persona).toBeTruthy();
      expect(text.trim().length).toBeGreaterThan(0);

      const hintMatched = fixture.expectedPersonaHints.some(
        (hint) =>
          persona.includes(hint as typeof persona) ||
          text.toLowerCase().includes(hint.toLowerCase()),
      );
      expect(hintMatched).toBe(true);
    },
  );

  it.each(scenarioFixtures.map((fixture) => [fixture.id, fixture] as const))(
    "fixture %s produces valid travelSettingEffects",
    (_id, fixture) => {
      const effects = buildTravelSettingEffects(fixture.travelSettings);
      expect(effects.planningAdvice.trim().length).toBeGreaterThan(0);
      expect(effects.routeGuidanceHint.trim().length).toBeGreaterThan(0);
      expect(effects.transportMode).toBe(fixture.travelSettings.transportMode);
      expect(effects.routePriority).toBe(fixture.travelSettings.routePriority);
    },
  );

  it.each(scenarioFixtures.map((fixture) => [fixture.id, fixture] as const))(
    "fixture %s applies travel settings to agent output without NaN/undefined",
    (_id, fixture) => {
      const agent = runAgent(fixture.goal, fixture.wechat, fixture.seed);
      const adjusted = applyTravelSettingsToPlan({
        routePlan: agent.routePlan,
        rankedPois: agent.rankedPois,
        parseResult: agent.parseResult,
        travelSettings: fixture.travelSettings,
      });

      expect(() => assertPlanStructure(adjusted, fixture)).not.toThrow();
    },
  );

  it.each(scenarioFixtures.map((fixture) => [fixture.id, fixture] as const))(
    "fixture %s expectedAssertions match helper output direction",
    (_id, fixture) => {
      const { text: personaText } = collectPersonaText(fixture);
      const effects = buildTravelSettingEffects(fixture.travelSettings);
      const agent = runAgent(fixture.goal, fixture.wechat, fixture.seed);
      const adjusted = applyTravelSettingsToPlan({
        routePlan: agent.routePlan,
        rankedPois: agent.rankedPois,
        parseResult: agent.parseResult,
        travelSettings: fixture.travelSettings,
      });

      const combined = [
        personaText,
        effects.planningAdvice,
        effects.routeGuidanceHint,
        effects.riskSummaryLine,
        adjusted.settingImpactSummary,
        ...adjusted.planningSignals.impacts,
      ].join(" ");

      for (const assertion of fixture.expectedAssertions) {
        if (assertion.keyword === "全程步行") {
          expect(combined).not.toMatch(/全程步行/);
          continue;
        }
        if (assertion.keyword) {
          expect(combined).toMatch(new RegExp(assertion.keyword));
        }
      }
    },
  );
});
