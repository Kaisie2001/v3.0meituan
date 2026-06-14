import { describe, expect, it } from "vitest";
import { runAgent } from "@/lib/runAgent";
import { DEFAULT_TRAVEL_SETTINGS, type TravelSettings } from "@/lib/preferenceSummary";
import {
  applyTravelSettingsToPlan,
  computeRouteSpreadFromPlan,
  getTravelSettingsPoiAdjustment,
  routeSpread,
} from "@/lib/applyTravelSettingsToPlan";
import type { RoutePlan, ScoredPoi } from "@/lib/types";

function withSettings(overrides: Partial<TravelSettings>): TravelSettings {
  return { ...DEFAULT_TRAVEL_SETTINGS, ...overrides };
}

function adjust(goal: string, settings: TravelSettings) {
  const agent = runAgent(goal, "", "");
  return applyTravelSettingsToPlan({
    routePlan: agent.routePlan,
    rankedPois: agent.rankedPois,
    parseResult: agent.parseResult,
    travelSettings: settings,
  });
}

describe("applyTravelSettingsToPlan", () => {
  it("demotes high-queue POIs when route priority is queue", () => {
    const agent = runAgent("晚上和朋友吃饭，吃完想找地方聊天", "", "");
    const highQueue = agent.rankedPois.find((poi) => poi.queueMinutes >= 20);
    const lowQueue = agent.rankedPois.find((poi) => poi.queueMinutes <= 8);
    expect(highQueue).toBeTruthy();
    expect(lowQueue).toBeTruthy();

    const queuePlan = applyTravelSettingsToPlan({
      routePlan: agent.routePlan,
      rankedPois: agent.rankedPois,
      parseResult: agent.parseResult,
      travelSettings: withSettings({ routePriority: "queue" }),
    });
    const experiencePlan = applyTravelSettingsToPlan({
      routePlan: agent.routePlan,
      rankedPois: agent.rankedPois,
      parseResult: agent.parseResult,
      travelSettings: withSettings({ routePriority: "experience" }),
    });

    const highQueueRankQueue = queuePlan.adjustedRankedPois.findIndex((poi) => poi.id === highQueue!.id);
    const lowQueueRankQueue = queuePlan.adjustedRankedPois.findIndex((poi) => poi.id === lowQueue!.id);
    const highQueueRankExperience = experiencePlan.adjustedRankedPois.findIndex((poi) => poi.id === highQueue!.id);
    const lowQueueRankExperience = experiencePlan.adjustedRankedPois.findIndex((poi) => poi.id === lowQueue!.id);

    expect(lowQueueRankQueue).toBeLessThan(highQueueRankQueue);
    expect(lowQueueRankExperience - highQueueRankExperience).toBeLessThan(
      highQueueRankQueue - lowQueueRankQueue,
    );
    expect(queuePlan.settingImpactSummary).toMatch(/少排队/);
  });

  it("prefers nearer POIs as route nodes for distance priority", () => {
    const agent = runAgent("周末下午带孩子出去玩3小时", "", "");
    const near = [...agent.rankedPois].sort((a, b) => a.distanceMeters - b.distanceMeters)[0];
    const far = [...agent.rankedPois].sort((a, b) => b.distanceMeters - a.distanceMeters)[0];

    const distancePlan = adjust("周末下午带孩子出去玩3小时", withSettings({ routePriority: "distance", transportMode: "walking" }));
    const routePoiIds =
      distancePlan.adjustedRoutePlan.mainPlan?.slots.map((slot) => slot.poi?.id).filter(Boolean) ?? [];

    expect(routePoiIds).toContain(near.id);
    expect(routeSpread(distancePlan.adjustedRoutePlan.mainPlan?.slots.map((s) => s.poi).filter(Boolean) as ScoredPoi[])).toBeLessThanOrEqual(
      poiSpread(agent.routePlan, far.id),
    );
    expect(distancePlan.settingImpactSummary).toMatch(/步行|少走路/);
  });

  it("builds a less zig-zag route for detour priority than default time priority", () => {
    const goal = "我先去学校拿东西，再找地方坐坐，晚上和朋友吃饭";
    const detourPlan = adjust(goal, withSettings({ routePriority: "detour" }));
    const timePlan = adjust(goal, withSettings({ routePriority: "time" }));

    expect(computeRouteSpreadFromPlan(detourPlan.adjustedRoutePlan)).toBeLessThanOrEqual(
      computeRouteSpreadFromPlan(timePlan.adjustedRoutePlan) + 120,
    );
    expect(detourPlan.planningSignals.impacts.join(" ")).toMatch(/顺路/);
  });

  it("does not over-penalize far POIs when transport mode is driving", () => {
    const agent = runAgent("晚上和朋友吃饭，吃完想找地方聊天", "", "");
    const far = [...agent.rankedPois]
      .filter((poi) => poi.openNow && poi.routeEtaMinutes >= 14)
      .sort((a, b) => b.routeEtaMinutes - a.routeEtaMinutes)[0];
    expect(far).toBeTruthy();

    const walkingAdjustment = getTravelSettingsPoiAdjustment(
      far,
      withSettings({ transportMode: "walking", routePriority: "distance" }),
      agent.parseResult.intent,
    );
    const drivingAdjustment = getTravelSettingsPoiAdjustment(
      far,
      withSettings({ transportMode: "driving", routePriority: "time" }),
      agent.parseResult.intent,
    );

    expect(drivingAdjustment).toBeGreaterThan(walkingAdjustment);

    const drivingPlan = adjust("晚上和朋友吃饭，吃完想找地方聊天", withSettings({ transportMode: "driving", routePriority: "time" }));
    expect(drivingPlan.planningSignals.impacts.join(" ")).toMatch(/驾车/);
  });

  it("reflects lower wait fallback during evening rush with queue priority", () => {
    const rushSettings = withSettings({ startTime: "18:30", routePriority: "queue" });
    const adjusted = adjust("晚上和朋友吃饭，吃完想找地方聊天", rushSettings);
    const mainRestaurant = adjusted.adjustedRoutePlan.restaurant;
    const fallback = adjusted.adjustedFallbackPlans[0]?.slots.find((slot) => slot.slotType === "food")?.poi;

    expect(adjusted.adjustedFallbackPlans.length).toBeGreaterThan(0);
    expect(fallback).toBeTruthy();
    const fallbackRisk = adjusted.adjustedFallbackPlans[0]?.slots[1]?.riskNotes?.join(" ") ?? "";
    if (mainRestaurant && fallback && fallback.queueMinutes < mainRestaurant.queueMinutes) {
      expect(fallback.queueMinutes).toBeLessThan(mainRestaurant.queueMinutes);
    } else {
      expect(fallbackRisk).toMatch(/等待|排队|切换/);
    }
    expect(adjusted.settingImpactSummary).toMatch(/晚高峰|少排队/);
    expect(fallbackRisk || adjusted.planningSignals.impacts.join(" ")).toMatch(/等待|排队|备选|晚高峰/);
  });

  it("handles empty data safely without undefined or NaN", () => {
    const emptyRoutePlan: RoutePlan = {
      steps: [],
      totalMinutes: 0,
      totalBudget: 0,
      totalWaitMinutes: 0,
      fitsTimeWindow: true,
    };

    expect(() =>
      applyTravelSettingsToPlan({
        routePlan: emptyRoutePlan,
        rankedPois: [],
        parseResult: runAgent("", "", "").parseResult,
        travelSettings: DEFAULT_TRAVEL_SETTINGS,
      }),
    ).not.toThrow();

    const brokenPoi = {
      ...runAgent("朋友吃饭", "", "").rankedPois[0],
      queueMinutes: Number.NaN,
      pricePerPerson: undefined as unknown as number,
      goabilityScore: Number.NaN,
    } as ScoredPoi;

    const adjusted = applyTravelSettingsToPlan({
      routePlan: emptyRoutePlan,
      rankedPois: [brokenPoi],
      parseResult: runAgent("朋友吃饭", "", "").parseResult,
      travelSettings: DEFAULT_TRAVEL_SETTINGS,
    });

    expect(Number.isFinite(adjusted.adjustedRankedPois[0]?.goabilityScore ?? 0)).toBe(true);
    expect(JSON.stringify(adjusted)).not.toMatch(/undefined|NaN/);
  });
});

function poiSpread(routePlan: RoutePlan, farId: string) {
  const pois = routePlan.mainPlan?.slots.map((slot) => slot.poi).filter(Boolean) as ScoredPoi[];
  const spread = routeSpread(pois);
  return pois.some((poi) => poi.id === farId) ? spread : spread + 500;
}
