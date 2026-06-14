import { describe, expect, it } from "vitest";
import { parseInput } from "@/lib/parseIntent";
import { runAgent } from "@/lib/runAgent";
import { MAP_DEMO_NOTE } from "@/lib/routeGuidance";
import {
  buildMapPresentation,
  EMPTY_MAP_PRESENTATION,
  hasMapCoords,
} from "@/lib/mapPresentation";
import type { RoutePlan, ScoredPoi } from "@/lib/types";

const EMPTY_ROUTE_PLAN: RoutePlan = {
  steps: [],
  totalMinutes: 0,
  totalBudget: 0,
  totalWaitMinutes: 0,
  fitsTimeWindow: true,
};

function buildPresentation(
  goal: string,
  selectedPlanType: "main" | "fallback" = "main",
  selectedFallbackIndex: number | null = null,
) {
  const result = runAgent(goal, "", "");
  return buildMapPresentation({
    routePlan: result.routePlan,
    rankedPois: result.rankedPois,
    parseResult: result.parseResult,
    selectedPlanType,
    selectedFallbackIndex,
  });
}

describe("mapPresentation", () => {
  it("generates different activeRoutePois for main vs fallback plans", () => {
    const result = runAgent("晚上和朋友吃饭，吃完想找地方聊天", "", "");
    const main = buildMapPresentation({
      routePlan: result.routePlan,
      rankedPois: result.rankedPois,
      parseResult: result.parseResult,
      selectedPlanType: "main",
      selectedFallbackIndex: null,
    });
    const fallback = buildMapPresentation({
      routePlan: result.routePlan,
      rankedPois: result.rankedPois,
      parseResult: result.parseResult,
      selectedPlanType: "fallback",
      selectedFallbackIndex: 0,
    });

    expect(main.activeRoutePois.length).toBeGreaterThanOrEqual(2);
    expect(fallback.activeRoutePois.length).toBeGreaterThanOrEqual(2);
    expect(main.activeRoutePoiIds.join(",")).not.toBe(fallback.activeRoutePoiIds.join(","));
    expect(fallback.mapHint).toMatch(/备选|当前查看/);
    expect(fallback.mapHint.length).toBeGreaterThan(0);
  });

  it("highlights different POIs for different personas", () => {
    const friends = buildPresentation("晚上和朋友吃饭，吃完想找地方聊天");
    const work = buildPresentation("我下午要准备面试，想找个安静能坐两小时的地方");
    const family = buildPresentation("周末下午带孩子出去玩3小时");

    expect(friends.highlightedPoiIds.length).toBeGreaterThan(0);
    expect(work.highlightedPoiIds.length).toBeGreaterThan(0);
    expect(family.highlightedPoiIds.length).toBeGreaterThan(0);
    expect(friends.highlightedPoiIds).not.toEqual(work.highlightedPoiIds);
    expect(family.highlightedPoiIds).not.toEqual(work.highlightedPoiIds);
  });

  it("does not throw when POIs are missing coordinates", () => {
    const result = runAgent("今天想安排一个轻松约会", "", "");
    const brokenPoi: ScoredPoi = {
      ...result.rankedPois[0],
      lat: undefined,
      lng: undefined,
      x: undefined as unknown as number,
      y: undefined as unknown as number,
    };

    expect(hasMapCoords(brokenPoi)).toBe(false);
    expect(() =>
      buildMapPresentation({
        routePlan: result.routePlan,
        rankedPois: [brokenPoi, ...result.rankedPois.slice(1)],
        parseResult: result.parseResult,
        selectedPlanType: "main",
        selectedFallbackIndex: null,
      }),
    ).not.toThrow();
  });

  it("includes at least one route segment for a normal plan", () => {
    const presentation = buildPresentation("我先去学校拿东西，再找地方坐坐，晚上和朋友吃饭");
    expect(presentation.routeSegments.length).toBeGreaterThanOrEqual(1);
    expect(presentation.activeRoutePois.length).toBeGreaterThanOrEqual(2);
  });

  it("returns fallback output for empty input without throwing", () => {
    expect(() =>
      buildMapPresentation({
        routePlan: EMPTY_ROUTE_PLAN,
        rankedPois: [],
        parseResult: parseInput(""),
        selectedPlanType: "main",
        selectedFallbackIndex: null,
      }),
    ).not.toThrow();

    const empty = buildMapPresentation({
      routePlan: EMPTY_ROUTE_PLAN,
      rankedPois: [],
      parseResult: parseInput(""),
      selectedPlanType: "main",
      selectedFallbackIndex: null,
    });

    expect(empty).toEqual(EMPTY_MAP_PRESENTATION);
    expect(empty.mapHint).toBe(MAP_DEMO_NOTE);
    expect(Array.isArray(empty.visiblePois)).toBe(true);
    expect(Array.isArray(empty.routeSegments)).toBe(true);
  });
});
