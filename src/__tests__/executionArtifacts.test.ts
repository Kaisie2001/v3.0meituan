import { describe, expect, it } from "vitest";
import { runAgent } from "@/lib/runAgent";
import { applyTravelSettingsToPlan } from "@/lib/applyTravelSettingsToPlan";
import { buildExecutionArtifacts, executionArtifactRules, getExecutionArtifactPrimaryActionLabel, type ExecutionArtifact } from "@/lib/executionArtifacts";
import { scenarioFixtures } from "@/lib/scenarioFixtures";
import type { RoutePlan, RouteSlot, ScoredPoi } from "@/lib/types";
import { DEFAULT_TRAVEL_SETTINGS, type TravelSettings } from "@/lib/preferenceSummary";

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
    sceneFitScore: 80,
    routeScore: 72,
    availabilityScore: 70,
    waitRiskScore: 20,
    preferenceScore: 75,
    goabilityScore: 80,
    level: "green",
    reasons: ["mock"],
    risks: [],
    ...overrides,
  };
}

function makePlan(slots: RouteSlot[]): RoutePlan {
  return {
    fitsTimeWindow: true,
    totalMinutes: 180,
    totalBudget: 300,
    totalWaitMinutes: 10,
    steps: [],
    mainPlan: {
      id: "main",
      title: "主方案",
      slots,
      steps: [],
      totalMinutes: 180,
      totalBudget: 300,
      totalWaitMinutes: 10,
      totalCommuteMinutes: 20,
    },
    fallbackPlans: [],
  };
}

function makeSlot(poi: ScoredPoi, slotType: RouteSlot["slotType"] = "food"): RouteSlot {
  return {
    slotType,
    poi,
    startTime: "18:00",
    endTime: "19:00",
    etaMinutes: 12,
    waitMinutes: 5,
    rationaleNotes: [],
    riskNotes: [],
  };
}

const baseParams = {
  selectedPlanType: "main" as const,
  selectedFallbackIndex: null,
  currentPlanLabel: "主方案",
  partySize: 2,
  shareText: "今晚安排如下",
  planSummary: "先去活动，之后去餐厅吃饭",
  receiptIds: {},
};

describe("executionArtifacts", () => {
  it("builds queue artifact for restaurant with queue priority", () => {
    const artifact = buildExecutionArtifacts({
      ...baseParams,
      routePlan: makePlan([
        makeSlot(makePoi({ id: "r1", name: "Hotpot Garden", queueMinutes: 20, riskTags: ["排队长"] })),
      ]),
      travelSettings: { ...DEFAULT_TRAVEL_SETTINGS, routePriority: "queue" },
    });

    expect(artifact.type).toBe("queue");
    if (artifact.type === "queue") {
      expect(artifact.title).toBe("排队详情");
      expect(artifact.queueNumber).toMatch(/^[ABC]\d+$/);
      expect(artifact.queueTableType).toMatch(/小桌|中桌|大桌/);
      expect(artifact.aheadCount).toBeGreaterThan(0);
      expect(artifact.estimatedWaitMinutes).toMatch(/分钟/);
      expect(artifact.queueStartedAt).toMatch(/^\d{2}:\d{2}$/);
      expect(artifact.phoneMasked).toMatch(/^\d{3}\*{4}\d{4}$/);
      expect(artifact.statusSteps[1]?.state).toBe("active");
      expect(JSON.stringify(artifact)).not.toMatch(/undefined|NaN/);
      expect(JSON.stringify(artifact)).not.toContain("已模拟预约");
    }
  });

  it("builds reservation artifact for restaurant without strong queue context", () => {
    const artifact = buildExecutionArtifacts({
      ...baseParams,
      routePlan: makePlan([
        makeSlot(
          makePoi({
            id: "r2",
            name: "Plain Table",
            queueMinutes: 4,
            reservationAvailable: true,
            sceneTags: ["可订位"],
          }),
        ),
      ]),
      travelSettings: { ...DEFAULT_TRAVEL_SETTINGS, routePriority: "time" },
    });

    expect(artifact.type).toBe("reservation");
    if (artifact.type === "reservation") {
      expect(artifact.title).toBe("已模拟预约");
      expect(artifact.status).toMatch(/确认|预约/);
      expect(artifact.partySize).toBe(2);
    }
  });

  it("prefers queue artifact over voucher when plan includes restaurant food slot", () => {
    const artifact = buildExecutionArtifacts({
      ...baseParams,
      routePlan: makePlan([
        makeSlot(
          makePoi({
            id: "kid-zone",
            name: "Kid Zone 奇趣亲子馆",
            category: "activity",
            reviewPositive: ["入场流程清楚"],
            queueMinutes: 5,
          }),
          "activity",
        ),
        makeSlot(
          makePoi({
            id: "plain-table",
            name: "Plain Table",
            queueMinutes: 5,
            reservationAvailable: true,
          }),
          "food",
        ),
      ]),
      travelSettings: { ...DEFAULT_TRAVEL_SETTINGS, routePriority: "queue", partySize: 4 },
      partySize: 4,
    });

    expect(artifact.type).toBe("queue");
    if (artifact.type === "queue") {
      expect(artifact.venueName).toBe("Plain Table");
      expect(artifact.title).toBe("排队详情");
      expect(JSON.stringify(artifact)).not.toContain("已模拟预约");
    }
  });

  it("builds voucher artifact for ticket-like activity nodes", () => {
    const artifact = buildExecutionArtifacts({
      ...baseParams,
      routePlan: makePlan([
        makeSlot(
          makePoi({
            id: "show1",
            name: "Light Show 夜场",
            category: "activity",
            sceneTags: ["演出", "门票"],
            queueMinutes: 0,
          }),
          "activity",
        ),
      ]),
      travelSettings: DEFAULT_TRAVEL_SETTINGS,
    });

    expect(artifact.type).toBe("voucher");
    if (artifact.type === "voucher") {
      expect(artifact.code).toMatch(/^MT-/);
      expect(artifact.qrPayload.length).toBeGreaterThan(0);
    }
  });

  it("builds share artifact for general itinerary plans", () => {
    const artifact = buildExecutionArtifacts({
      ...baseParams,
      routePlan: makePlan([
        makeSlot(
          makePoi({
            id: "easy-pick",
            name: "Easy Pick 附近轻松点",
            category: "activity",
            queueMinutes: 0,
            sceneTags: ["灵活", "轻活动"],
          }),
          "activity",
        ),
      ]),
      travelSettings: { ...DEFAULT_TRAVEL_SETTINGS, routePriority: "distance" },
    });

    expect(artifact.type).toBe("share");
    if (artifact.type === "share") {
      expect(artifact.shareText).toContain("今晚安排如下");
    }
  });

  it("handles missing poi fields without undefined or NaN", () => {
    const agent = runAgent("下午帮同事买咖啡顺便处理工作", "", "");
    const artifact = buildExecutionArtifacts({
      ...baseParams,
      routePlan: agent.routePlan,
      travelSettings: DEFAULT_TRAVEL_SETTINGS,
      shareText: "",
      planSummary: "",
    });

    expect(JSON.stringify(artifact)).not.toMatch(/undefined|NaN/);
    expect(["queue", "reservation", "voucher", "share"]).toContain(artifact.type);
  });

  it("detects voucher signals from exhibition tags", () => {
    const poi = makePoi({ id: "a1", name: "Art Walk", category: "activity", sceneTags: ["展览"] });
    expect(executionArtifactRules.isVoucherPoi(poi)).toBe(true);
  });

  it("uses route action label for voucher completion", () => {
    expect(getExecutionArtifactPrimaryActionLabel("voucher")).toBe("查看路线");
    expect(getExecutionArtifactPrimaryActionLabel("queue")).toBe("查看路线");
    expect(getExecutionArtifactPrimaryActionLabel("reservation")).toBe("查看路线");
    expect(getExecutionArtifactPrimaryActionLabel("share")).toBe("查看最终行程");
  });

  it("builds voucher for ticket-first activity plans without meal priority", () => {
    const artifact = buildExecutionArtifacts({
      ...baseParams,
      routePlan: makePlan([
        makeSlot(
          makePoi({
            id: "kid-zone",
            name: "Kid Zone 奇趣亲子馆",
            category: "activity",
            reviewPositive: ["入场流程清楚"],
            queueMinutes: 5,
          }),
          "activity",
        ),
        makeSlot(
          makePoi({
            id: "mood-dine",
            name: "Mood Dine 暖光小馆",
            queueMinutes: 14,
          }),
          "food",
        ),
      ]),
      travelSettings: { ...DEFAULT_TRAVEL_SETTINGS, routePriority: "distance", partySize: 3 },
      partySize: 3,
    });

    expect(artifact.type).toBe("voucher");
    if (artifact.type === "voucher") {
      expect(artifact.venueName).toBe("Kid Zone 奇趣亲子馆");
      expect(artifact.title).toBe("已生成核销码");
    }
  });

  it("builds reservation for work-like cafe food slot", () => {
    const artifact = buildExecutionArtifacts({
      ...baseParams,
      routePlan: makePlan([
        makeSlot(
          makePoi({
            id: "workhub",
            name: "WorkHub Cafe",
            category: "cafe",
            queueMinutes: 9,
            sceneTags: ["插座", "适合办公"],
          }),
          "food",
        ),
      ]),
      travelSettings: { ...DEFAULT_TRAVEL_SETTINGS, routePriority: "detour", partySize: 1 },
      partySize: 1,
    });

    expect(artifact.type).toBe("reservation");
    if (artifact.type === "reservation") {
      expect(artifact.venueName).toBe("WorkHub Cafe");
      expect(artifact.title).toBe("已模拟预约");
    }
  });

  it.each(
    scenarioFixtures.map((fixture) => [fixture.id, fixture] as const),
  )("scenario fixture %s builds a valid execution artifact", (_id, fixture) => {
    const agent = runAgent(fixture.goal, fixture.wechat, fixture.seed);
    const adjusted = applyTravelSettingsToPlan({
      routePlan: agent.routePlan,
      rankedPois: agent.rankedPois,
      parseResult: agent.parseResult,
      travelSettings: fixture.travelSettings,
    });

    const artifact = buildExecutionArtifacts({
      selectedPlanType: "main",
      selectedFallbackIndex: null,
      currentPlanLabel: "主方案",
      partySize: fixture.travelSettings.partySize,
      shareText: "demo share",
      planSummary: adjusted.settingImpactSummary ?? "demo summary",
      receiptIds: {},
      routePlan: adjusted.adjustedRoutePlan,
      travelSettings: fixture.travelSettings,
    });

    expect(["queue", "reservation", "voucher", "share"]).toContain(artifact.type);
    expect(artifact.title.trim().length).toBeGreaterThan(0);
    expect(JSON.stringify(artifact)).not.toMatch(/undefined|NaN/);

    if (artifact.type === "share") {
      expect(artifact.summary.trim().length).toBeGreaterThan(0);
    } else {
      expect(artifact.venueName.trim().length).toBeGreaterThan(0);
    }
  });

  it("classifies golden scenarios without relying on a single fixture", () => {
    const expectations: Record<string, ExecutionArtifact["type"][]> = {
      friendsEvening: ["queue"],
      dateEvening: ["reservation", "queue"],
      familyWeekend: ["share", "voucher"],
      workAfternoon: ["reservation", "share"],
      errandAfternoon: ["reservation", "queue"],
      rushTaxi: ["reservation", "queue"],
    };

    for (const fixture of scenarioFixtures) {
      const agent = runAgent(fixture.goal, fixture.wechat, fixture.seed);
      const adjusted = applyTravelSettingsToPlan({
        routePlan: agent.routePlan,
        rankedPois: agent.rankedPois,
        parseResult: agent.parseResult,
        travelSettings: fixture.travelSettings,
      });
      const artifact = buildExecutionArtifacts({
        selectedPlanType: "main",
        selectedFallbackIndex: null,
        currentPlanLabel: "主方案",
        partySize: fixture.travelSettings.partySize,
        shareText: "",
        planSummary: "",
        routePlan: adjusted.adjustedRoutePlan,
        travelSettings: fixture.travelSettings,
      });

      const allowed = expectations[fixture.id];
      expect(allowed, fixture.id).toBeDefined();
      expect(allowed).toContain(artifact.type);

      if (fixture.id === "workAfternoon") {
        expect(artifact.type).not.toBe("voucher");
      }
    }
  });
});
