import { describe, expect, it } from "vitest";
import { parseInput } from "@/lib/parseIntent";
import { runAgent } from "@/lib/runAgent";
import { buildTravelSettingEffects } from "@/lib/travelSettingEffects";
import { DEFAULT_TRAVEL_SETTINGS } from "@/lib/preferenceSummary";
import { buildMapPresentation } from "@/lib/mapPresentation";
import { buildRouteBasis, summarizeRouteBasisText } from "@/lib/routeBasis";
import type { RouteSlot } from "@/lib/types";

function buildBasisFromGoal(
  goal: string,
  selectedPlanType: "main" | "fallback" = "main",
  selectedFallbackIndex: number | null = null,
) {
  const result = runAgent(goal, "", "");
  const settingEffects = buildTravelSettingEffects(DEFAULT_TRAVEL_SETTINGS);
  const mapPresentation = buildMapPresentation({
    routePlan: result.routePlan,
    rankedPois: result.rankedPois,
    parseResult: result.parseResult,
    selectedPlanType,
    selectedFallbackIndex,
    travelSettings: DEFAULT_TRAVEL_SETTINGS,
  });
  const slots =
    selectedPlanType === "fallback" && selectedFallbackIndex !== null
      ? result.routePlan.fallbackPlans?.[selectedFallbackIndex]?.slots ?? []
      : result.routePlan.mainPlan?.slots ?? [];

  return buildRouteBasis({
    slots,
    parseResult: result.parseResult,
    selectedPlanType,
    selectedFallbackIndex,
    travelSettings: DEFAULT_TRAVEL_SETTINGS,
    settingEffects,
    fallbackPlanTitle: result.routePlan.fallbackPlans?.[selectedFallbackIndex ?? 0]?.title,
    activeRoutePoiIds: mapPresentation.activeRoutePoiIds,
  });
}

describe("routeBasis", () => {
  it("generates reasons for at least 3 route nodes", () => {
    const basis = buildBasisFromGoal("晚上和朋友吃饭，吃完想找地方聊天");

    expect(basis.nodes.length).toBeGreaterThanOrEqual(3);
    for (const node of basis.nodes) {
      expect(node.poiName.trim().length).toBeGreaterThan(0);
      expect(node.roleLabel.trim().length).toBeGreaterThan(0);
      expect(node.reason.trim().length).toBeGreaterThan(0);
      expect(node.riskNote.trim().length).toBeGreaterThan(0);
      expect(node.reason).not.toMatch(/undefined|NaN/i);
      expect(node.riskNote).not.toMatch(/undefined|NaN/i);
    }
  });

  it("produces different basis text for fallback vs main plan", () => {
    const main = buildBasisFromGoal("晚上和朋友吃饭，吃完想找地方聊天", "main", null);
    const fallback = buildBasisFromGoal("晚上和朋友吃饭，吃完想找地方聊天", "fallback", 0);

    expect(summarizeRouteBasisText(main)).not.toBe(summarizeRouteBasisText(fallback));
    expect(fallback.planIntro).toMatch(/备选|替换|等待/);
  });

  it("does not throw for empty or incomplete POI fields", () => {
    const incompleteSlots: RouteSlot[] = [
      {
        slotType: "activity",
        startTime: "14:00",
        endTime: "15:00",
        etaMinutes: 10,
        waitMinutes: 0,
        rationaleNotes: [],
        riskNotes: [],
      },
      {
        slotType: "food",
        poi: undefined,
        startTime: "15:00",
        endTime: "16:00",
        etaMinutes: 8,
        waitMinutes: 5,
        rationaleNotes: [],
        riskNotes: [],
      },
    ];

    expect(() =>
      buildRouteBasis({
        slots: incompleteSlots,
        parseResult: parseInput(""),
        selectedPlanType: "main",
        selectedFallbackIndex: null,
      }),
    ).not.toThrow();

    const basis = buildRouteBasis({
      slots: incompleteSlots,
      parseResult: parseInput(""),
      selectedPlanType: "main",
      selectedFallbackIndex: null,
    });

    expect(basis.nodes.length).toBeGreaterThanOrEqual(3);
    expect(basis.nodes[0].poiName).toBe("待定地点");
  });
});
