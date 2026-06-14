import { describe, expect, it } from "vitest";
import { runAgent } from "@/lib/runAgent";
import {
  buildRouteGuidance,
  buildRouteLegGuidanceForTest,
  LEG_DEMO_NOTE,
} from "@/lib/routeGuidance";
import type { RouteSlot, ScoredPoi } from "@/lib/types";

function makePoi(overrides: Partial<ScoredPoi> & { id: string; name: string }): ScoredPoi {
  return {
    category: "restaurant",
    x: 50,
    y: 50,
    lat: 39.91,
    lng: 116.4,
    distanceMeters: 680,
    rating: 4.5,
    pricePerPerson: 120,
    sceneTags: [],
    reviewPositive: [],
    reviewNegative: [],
    riskTags: [],
    openNow: true,
    crowdLevel: "medium",
    queueMinutes: 10,
    reservationAvailable: true,
    dealAvailable: true,
    routeEtaMinutes: 12,
    nearMetro: true,
    goabilityScore: 80,
    sceneFitScore: 75,
    availabilityScore: 70,
    routeScore: 72,
    level: "green",
    reasons: ["mock"],
    risks: [],
    ...overrides,
  };
}

function makeSlot(poi: ScoredPoi, etaMinutes: number, slotType: RouteSlot["slotType"] = "food"): RouteSlot {
  return {
    slotType,
    poi,
    startTime: "18:00",
    endTime: "19:00",
    etaMinutes,
    waitMinutes: 5,
    rationaleNotes: [],
    riskNotes: [],
  };
}

function serializeGuidance(value: unknown) {
  return JSON.stringify(value);
}

describe("routeGuidance", () => {
  it("uses named transit stations instead of generic nearest stop copy", () => {
    const legs = buildRouteLegGuidanceForTest({
      transportMode: "transit",
      routePriority: "queue",
      slots: [
        makeSlot(makePoi({ id: "a", name: "Tree Cafe" }), 8, "activity"),
        makeSlot(makePoi({ id: "b", name: "Plain Table" }), 14, "food"),
      ],
    });

    expect(legs.length).toBeGreaterThan(0);
    const text = legs.map((leg) => leg.steps.join(" ")).join(" ");
    expect(text).not.toMatch(/最近地铁\/公交站/);
    expect(text).toMatch(/「.+站」/);
    expect(text).toMatch(/Plain Table/);
  });

  it("includes walking distance and time when walking is preferred", () => {
    const legs = buildRouteLegGuidanceForTest({
      transportMode: "walking",
      routePriority: "distance",
      slots: [
        makeSlot(makePoi({ id: "w1", name: "Quiet Lab Coffee", distanceMeters: 900 }), 12, "activity"),
        makeSlot(makePoi({ id: "w2", name: "Bloom Cafe", distanceMeters: 520 }), 10, "food"),
      ],
    });

    const text = legs.flatMap((leg) => leg.steps).join(" ");
    expect(text).toMatch(/步行/);
    expect(text).toMatch(/米/);
    expect(text).toMatch(/分钟/);
  });

  it("does not show full-walking copy when driving is preferred", () => {
    const legs = buildRouteLegGuidanceForTest({
      transportMode: "driving",
      routePriority: "time",
      periodKey: "evening_rush",
      slots: [
        makeSlot(makePoi({ id: "d1", name: "Hotpot Garden" }), 16, "activity"),
        makeSlot(makePoi({ id: "d2", name: "Mild Pot" }), 18, "food"),
      ],
    });

    const text = legs.flatMap((leg) => leg.steps).join(" ");
    expect(text).not.toMatch(/全程步行/);
    expect(text).toMatch(/打车/);
  });

  it("builds one leg per consecutive route node from agent output", () => {
    const agent = runAgent("晚上和朋友吃饭，吃完想找地方聊天", "", "");
    const guidance = buildRouteGuidance({
      routePlan: agent.routePlan,
      intent: agent.parseResult.intent,
      selectedPlanType: "main",
      selectedFallbackIndex: null,
      travelSettings: {
        date: "today",
        startTime: "18:30",
        duration: "3h",
        transportMode: "transit",
        routePriority: "queue",
        partySize: 4,
        budget: 150,
        maxCommute: 30,
      },
    });

    const slotCount = agent.routePlan.mainPlan?.slots?.filter((s) => s.poi?.name).length ?? 0;
    if (slotCount >= 2) {
      expect(guidance.legs.length).toBe(slotCount - 1);
    }
    expect(guidance.title).toBe("转场路径");
    expect(guidance.legDemoNote).toBe(LEG_DEMO_NOTE);
  });

  it("reflects route priority in leg tips", () => {
    const detour = buildRouteLegGuidanceForTest({
      transportMode: "transit",
      routePriority: "detour",
      slots: [makeSlot(makePoi({ id: "x", name: "A" }), 8), makeSlot(makePoi({ id: "y", name: "B" }), 10)],
    });
    const queue = buildRouteLegGuidanceForTest({
      transportMode: "transit",
      routePriority: "queue",
      slots: [makeSlot(makePoi({ id: "x", name: "A" }), 8), makeSlot(makePoi({ id: "y", name: "B" }), 10)],
    });

    expect(detour[0]?.tip).toMatch(/顺路|折返/);
    expect(queue[0]?.tip).toMatch(/等待/);
  });

  it("handles missing poi fields without undefined or NaN", () => {
    const legs = buildRouteLegGuidanceForTest({
      transportMode: "transit",
      routePriority: "time",
      slots: [
        {
          slotType: "activity",
          startTime: "14:00",
          endTime: "15:00",
          etaMinutes: Number.NaN,
          waitMinutes: 0,
          rationaleNotes: [],
          riskNotes: [],
        },
        makeSlot(makePoi({ id: "ok", name: "OK Place" }), Number.NaN),
      ],
    });

    const blob = serializeGuidance(legs);
    expect(blob).not.toMatch(/undefined/);
    expect(blob).not.toMatch(/NaN/);
    expect(legs.length).toBeGreaterThan(0);
    expect(legs[0]?.steps.length).toBeGreaterThan(0);
  });
});
