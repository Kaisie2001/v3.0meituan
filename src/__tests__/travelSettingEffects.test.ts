import { describe, expect, it } from "vitest";
import {
  buildTravelSettingEffects,
  type TravelSettingEffectsSummary,
} from "@/lib/travelSettingEffects";
import { DEFAULT_TRAVEL_SETTINGS, type TravelSettings } from "@/lib/preferenceSummary";

const KEY_STRING_FIELDS: (keyof TravelSettingEffectsSummary)[] = [
  "windowHeadline",
  "periodLabel",
  "periodKey",
  "crowdRisk",
  "trafficRisk",
  "bookingRisk",
  "planningAdvice",
  "fallbackReasonHint",
  "routeGuidanceHint",
  "preferenceReason",
  "riskSummaryLine",
  "fallbackCardHint",
  "poiDynamicHint",
  "transportMode",
  "routePriority",
];

function baseSettings(overrides: Partial<TravelSettings> = {}): TravelSettings {
  return { ...DEFAULT_TRAVEL_SETTINGS, ...overrides };
}

function assertNoNullishKeyFields(effects: TravelSettingEffectsSummary) {
  for (const field of KEY_STRING_FIELDS) {
    expect(effects[field], `${field} should be defined`).not.toBeUndefined();
    expect(effects[field], `${field} should not be null`).not.toBeNull();
    if (typeof effects[field] === "string") {
      expect((effects[field] as string).trim().length).toBeGreaterThan(0);
    }
  }
  expect(Array.isArray(effects.dynamicBadges)).toBe(true);
  expect(effects.dynamicBadges.length).toBeGreaterThan(0);
}

function riskRank(label: string) {
  if (label === "高") return 3;
  if (label === "中") return 2;
  if (label === "中低") return 1;
  if (label === "低") return 0;
  return -1;
}

describe("travelSettingEffects", () => {
  it("returns higher queue/traffic/booking risk for evening rush 18:30", () => {
    const effects = buildTravelSettingEffects(
      baseSettings({ startTime: "18:30", routePriority: "queue" }),
    );

    expect(effects.periodKey).toBe("evening_rush");
    expect(riskRank(effects.crowdRisk)).toBeGreaterThanOrEqual(riskRank("中"));
    expect(riskRank(effects.trafficRisk)).toBeGreaterThanOrEqual(riskRank("中"));
    expect(riskRank(effects.bookingRisk)).toBeGreaterThanOrEqual(riskRank("中"));
    assertNoNullishKeyFields(effects);
  });

  it("returns relatively stable planning advice for afternoon 14:00", () => {
    const effects = buildTravelSettingEffects(baseSettings({ startTime: "14:00" }));

    expect(effects.periodKey).toBe("afternoon");
    expect(effects.crowdRisk).toBe("中");
    expect(effects.trafficRisk).toBe("中");
    expect(effects.bookingRisk).toBe("中");
    expect(effects.planningAdvice).toMatch(/稳定|下午/);
    assertNoNullishKeyFields(effects);
  });

  it("produces different route guidance for different transport modes", () => {
    const transit = buildTravelSettingEffects(
      baseSettings({ transportMode: "transit", startTime: "14:00" }),
    );
    const walking = buildTravelSettingEffects(
      baseSettings({ transportMode: "walking", startTime: "14:00" }),
    );
    const driving = buildTravelSettingEffects(
      baseSettings({ transportMode: "driving", startTime: "14:00" }),
    );

    const hints = new Set([
      transit.routeGuidanceHint,
      walking.routeGuidanceHint,
      driving.routeGuidanceHint,
    ]);
    expect(hints.size).toBeGreaterThan(1);

    assertNoNullishKeyFields(transit);
    assertNoNullishKeyFields(walking);
    assertNoNullishKeyFields(driving);
  });

  it("does not leave critical fields undefined or null", () => {
    const effects = buildTravelSettingEffects(baseSettings());
    assertNoNullishKeyFields(effects);
  });
});
