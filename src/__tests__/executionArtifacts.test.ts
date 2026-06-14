import { describe, expect, it } from "vitest";
import { runAgent } from "@/lib/runAgent";
import { applyTravelSettingsToPlan } from "@/lib/applyTravelSettingsToPlan";
import {
  buildExecutionArtifacts,
  executionArtifactRules,
  getExecutionArtifactPrimaryActionLabel,
  type ExecutionArtifact,
} from "@/lib/executionArtifacts";
import { scenarioFixtures } from "@/lib/scenarioFixtures";
import type { RoutePlan, RouteSlot, ScoredPoi } from "@/lib/types";
import { DEFAULT_TRAVEL_SETTINGS } from "@/lib/preferenceSummary";

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

function typesOf(artifacts: ExecutionArtifact[]) {
  return artifacts.map((artifact) => artifact.type);
}

function assertArtifactsValid(artifacts: ExecutionArtifact[]) {
  expect(Array.isArray(artifacts)).toBe(true);
  expect(artifacts.length).toBeGreaterThan(0);
  expect(JSON.stringify(artifacts)).not.toMatch(/undefined|NaN/);

  for (const artifact of artifacts) {
    expect(artifact.id.trim().length).toBeGreaterThan(0);
    expect(artifact.title.trim().length).toBeGreaterThan(0);
    if (artifact.type === "share") {
      expect(artifact.summary.trim().length).toBeGreaterThan(0);
    } else {
      expect(artifact.venueName.trim().length).toBeGreaterThan(0);
    }
  }
}

describe("executionArtifacts", () => {
  it("returns an array with queue and share for restaurant queue priority", () => {
    const artifacts = buildExecutionArtifacts({
      ...baseParams,
      routePlan: makePlan([
        makeSlot(makePoi({ id: "r1", name: "Hotpot Garden", queueMinutes: 20, riskTags: ["排队长"] })),
      ]),
      travelSettings: { ...DEFAULT_TRAVEL_SETTINGS, routePriority: "queue" },
    });

    assertArtifactsValid(artifacts);
    expect(typesOf(artifacts)).toEqual(["queue", "share"]);

    const queue = artifacts.find((artifact) => artifact.type === "queue");
    expect(queue?.title).toBe("排队详情");
    if (queue?.type === "queue") {
      expect(queue.queueNumber).toMatch(/^[ABC]\d+$/);
      expect(queue.queueTableType).toMatch(/小桌|中桌|大桌/);
      expect(queue.aheadCount).toBeGreaterThan(0);
      expect(queue.estimatedWaitMinutes).toMatch(/分钟/);
      expect(queue.queueStartedAt).toMatch(/^\d{2}:\d{2}$/);
      expect(queue.phoneMasked).toMatch(/^\d{3}\*{4}\d{4}$/);
      expect(queue.statusSteps[1]?.state).toBe("active");
      expect(JSON.stringify(queue)).not.toContain("已模拟预约");
    }
  });

  it("returns reservation and share for restaurant without strong queue context", () => {
    const artifacts = buildExecutionArtifacts({
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

    assertArtifactsValid(artifacts);
    expect(typesOf(artifacts)).toEqual(["reservation", "share"]);

    const reservation = artifacts.find((artifact) => artifact.type === "reservation");
    if (reservation?.type === "reservation") {
      expect(reservation.title).toBe("已模拟预约");
      expect(reservation.status).toMatch(/确认|预约/);
      expect(reservation.partySize).toBe(2);
    }
  });

  it("generates queue, voucher, and share for restaurant plus ticket activity", () => {
    const artifacts = buildExecutionArtifacts({
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

    assertArtifactsValid(artifacts);
    expect(artifacts.length).toBeGreaterThanOrEqual(3);
    expect(typesOf(artifacts)).toEqual(["voucher", "queue", "share"]);

    const queue = artifacts.find((artifact) => artifact.type === "queue");
    const voucher = artifacts.find((artifact) => artifact.type === "voucher");
    if (queue?.type === "queue") {
      expect(queue.venueName).toBe("Plain Table");
      expect(queue.title).toBe("排队详情");
    }
    if (voucher?.type === "voucher") {
      expect(voucher.venueName).toBe("Kid Zone 奇趣亲子馆");
    }
  });

  it("builds voucher artifact for ticket-like activity nodes", () => {
    const artifacts = buildExecutionArtifacts({
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

    assertArtifactsValid(artifacts);
    expect(typesOf(artifacts)).toEqual(["voucher", "share"]);

    const voucher = artifacts.find((artifact) => artifact.type === "voucher");
    if (voucher?.type === "voucher") {
      expect(voucher.code).toMatch(/^MT-/);
      expect(voucher.qrPayload.length).toBeGreaterThan(0);
    }
  });

  it("builds share artifact for general itinerary plans", () => {
    const artifacts = buildExecutionArtifacts({
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

    assertArtifactsValid(artifacts);
    expect(typesOf(artifacts)).toEqual(["share"]);
    const share = artifacts[0];
    if (share?.type === "share") {
      expect(share.shareText).toContain("今晚安排如下");
    }
  });

  it("handles missing poi fields without undefined or NaN", () => {
    const agent = runAgent("下午帮同事买咖啡顺便处理工作", "", "");
    const artifacts = buildExecutionArtifacts({
      ...baseParams,
      routePlan: agent.routePlan,
      travelSettings: DEFAULT_TRAVEL_SETTINGS,
      shareText: "",
      planSummary: "",
    });

    assertArtifactsValid(artifacts);
    expect(typesOf(artifacts).every((type) => ["queue", "reservation", "voucher", "share"].includes(type))).toBe(true);
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

  it("builds voucher without restaurant artifact when meal priority is low", () => {
    const artifacts = buildExecutionArtifacts({
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

    assertArtifactsValid(artifacts);
    expect(typesOf(artifacts)).toEqual(["voucher", "share"]);
    expect(artifacts.find((artifact) => artifact.type === "voucher")?.venueName).toBe("Kid Zone 奇趣亲子馆");
  });

  it("builds reservation and share for work-like cafe food slot", () => {
    const artifacts = buildExecutionArtifacts({
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

    assertArtifactsValid(artifacts);
    expect(typesOf(artifacts)).toEqual(["reservation", "share"]);
    expect(artifacts.find((artifact) => artifact.type === "reservation")?.venueName).toBe("WorkHub Cafe");
  });

  it.each(scenarioFixtures.map((fixture) => [fixture.id, fixture] as const))(
    "scenario fixture %s builds valid execution artifacts",
    (_id, fixture) => {
      const agent = runAgent(fixture.goal, fixture.wechat, fixture.seed);
      const adjusted = applyTravelSettingsToPlan({
        routePlan: agent.routePlan,
        rankedPois: agent.rankedPois,
        parseResult: agent.parseResult,
        travelSettings: fixture.travelSettings,
      });

      const artifacts = buildExecutionArtifacts({
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

      assertArtifactsValid(artifacts);
      expect(artifacts.some((artifact) => artifact.type === "share")).toBe(true);
    },
  );

  it("classifies golden scenarios across multiple artifact types", () => {
    const expectations: Record<string, ExecutionArtifact["type"][]> = {
      friendsEvening: ["queue", "reservation", "voucher"],
      dateEvening: ["queue", "reservation"],
      familyWeekend: ["share", "voucher"],
      workAfternoon: ["reservation", "share"],
      errandAfternoon: ["queue", "reservation"],
      rushTaxi: ["queue", "reservation"],
    };

    const allTypes = new Set<ExecutionArtifact["type"]>();

    for (const fixture of scenarioFixtures) {
      const agent = runAgent(fixture.goal, fixture.wechat, fixture.seed);
      const adjusted = applyTravelSettingsToPlan({
        routePlan: agent.routePlan,
        rankedPois: agent.rankedPois,
        parseResult: agent.parseResult,
        travelSettings: fixture.travelSettings,
      });
      const artifacts = buildExecutionArtifacts({
        selectedPlanType: "main",
        selectedFallbackIndex: null,
        currentPlanLabel: "主方案",
        partySize: fixture.travelSettings.partySize,
        shareText: "",
        planSummary: "",
        routePlan: adjusted.adjustedRoutePlan,
        travelSettings: fixture.travelSettings,
      });

      const types = typesOf(artifacts);
      for (const type of types) allTypes.add(type);

      const allowed = expectations[fixture.id];
      expect(allowed, fixture.id).toBeDefined();
      expect(types.some((type) => allowed!.includes(type)), `${fixture.id}: ${types.join(",")}`).toBe(true);
      expect(artifacts.some((artifact) => artifact.type === "share")).toBe(true);

      if (fixture.id === "workAfternoon") {
        expect(types).not.toContain("voucher");
      }
    }

    expect(allTypes.has("queue")).toBe(true);
    expect(allTypes.has("reservation")).toBe(true);
    expect(allTypes.has("share")).toBe(true);
  });
});
