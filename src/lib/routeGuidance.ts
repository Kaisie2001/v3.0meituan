import type { RoutePriorityChoice, TravelSettings } from "./preferenceSummary";
import { TRANSPORT_MODE_LABELS } from "./preferenceSummary";
import { buildTravelSettingEffects } from "./travelSettingEffects";
import type { Intent, ItineraryPlan, RoutePlan, RouteSlot, ScoredPoi, TransportMode } from "./types";

export const MAP_DEMO_NOTE = "路线为示意，出发前可在美团查看真实导航。";

export const LEG_DEMO_NOTE = "路线为 demo 级转场指引，真实导航可接入地图路径服务。";

export const FALLBACK_GUIDANCE_NOTE = "已按备选方案重新组织转场顺序。";

export const GUIDANCE_FALLBACK_STEP = "按当前节点顺序衔接转场。";

export type RouteLegGuidance = {
  fromName: string;
  toName: string;
  transportLabel: string;
  etaMinutes: number;
  steps: string[];
  tip: string;
};

export type RouteGuidanceSummary = {
  title: string;
  transportLabel: string;
  /** @deprecated flat list — prefer `legs` */
  steps: string[];
  legs: RouteLegGuidance[];
  mapDemoNote: string;
  legDemoNote: string;
  fallbackNote?: string;
  timeHint?: string;
  preferenceHint?: string;
};

type GuidanceMode = TransportMode | "auto";

const MOCK_STATIONS = [
  "景山东街站",
  "灯市口站",
  "东四站",
  "朝阳门站",
  "安定门站",
  "北海北站",
  "南锣鼓巷站",
  "什刹海站",
  "王府井站",
  "西单站",
];

function clampMinutes(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, Math.round(value)));
}

function safeNumber(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function safeName(value: unknown, fallback: string) {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : fallback;
}

function sanitizeStep(step: string) {
  if (typeof step !== "string" || !step.trim()) return "";
  if (/undefined|NaN|null/i.test(step)) return "";
  return step.trim();
}

function sanitizeSteps(steps: string[]) {
  return steps.map(sanitizeStep).filter(Boolean);
}

function stablePick<T>(seed: string, options: T[], salt = 0): T {
  let hash = 2166136261;
  const input = `${seed}:${salt}`;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const index = Math.abs(hash) % options.length;
  return options[index]!;
}

function mockStationName(poi: ScoredPoi | undefined, fallbackSeed: string, salt: number) {
  const seed = poi?.id ?? poi?.name ?? fallbackSeed;
  return stablePick(seed, MOCK_STATIONS, salt);
}

function resolveActivePlan(
  routePlan: RoutePlan,
  selectedPlanType: "main" | "fallback",
  selectedFallbackIndex: number | null,
): ItineraryPlan | undefined {
  if (selectedPlanType === "fallback" && selectedFallbackIndex !== null) {
    return routePlan.fallbackPlans?.[selectedFallbackIndex];
  }
  return routePlan.mainPlan;
}

function resolveGuidanceMode(intent: Intent, travelSettings?: TravelSettings | null): GuidanceMode {
  if (travelSettings?.transportMode) {
    const mode = travelSettings.transportMode;
    if (mode === "walking") return "walking";
    if (mode === "driving") return "driving";
    if (mode === "transit") return "transit";
    if (mode === "auto") return "auto";
  }

  const transport = intent.routePrefs?.transport;
  if (transport === "walking") return "walking";
  if (transport === "driving") return "driving";
  if (transport === "transit" && intent.preferMetro) return "transit";
  if (!intent.routePrefs) return "auto";
  if (transport === "transit") return "transit";
  return "auto";
}

function resolveLegMode(
  globalMode: GuidanceMode,
  etaMinutes: number,
  toPoi?: ScoredPoi,
): GuidanceMode {
  if (globalMode === "walking" || globalMode === "driving" || globalMode === "transit") {
    return globalMode;
  }
  if (etaMinutes <= 14 && (toPoi?.distanceMeters ?? 9999) <= 1200) return "walking";
  if (etaMinutes >= 18) return "driving";
  return "transit";
}

function legTransportLabel(mode: GuidanceMode, travelSettings?: TravelSettings | null) {
  if (mode === "walking") return "步行";
  if (mode === "driving") return "打车/驾车";
  if (mode === "transit") return "公共交通";
  if (travelSettings?.transportMode === "auto") return "智能推荐";
  return TRANSPORT_MODE_LABELS[travelSettings?.transportMode ?? "auto"] ?? "公共交通";
}

function transportLabel(mode: GuidanceMode, travelSettings?: TravelSettings | null) {
  if (travelSettings?.transportMode) {
    return TRANSPORT_MODE_LABELS[travelSettings.transportMode] ?? "系统综合推荐";
  }
  switch (mode) {
    case "walking":
      return "步行优先";
    case "driving":
      return "打车/驾车";
    case "transit":
      return "公共交通优先";
    default:
      return "系统综合推荐";
  }
}

function resolveRoutePriority(travelSettings?: TravelSettings | null): RoutePriorityChoice {
  return travelSettings?.routePriority ?? "time";
}

function buildPriorityTip(mode: GuidanceMode, priority: RoutePriorityChoice, isEveningRush: boolean) {
  switch (priority) {
    case "detour":
      return "本段已顺路串联，减少折返";
    case "queue":
      return "已优先避开高等待节点，转场更可控";
    case "time":
      return "已压缩本段转场时间，便于按时衔接";
    case "distance":
      return mode === "walking" ? "路线较紧凑，适合少换乘" : "优先选择更短转场路径";
    case "cost":
      return "本段转场成本可控，便于控制总预算";
    case "experience":
      return "本段衔接更顺畅，便于保留节点体验";
    default:
      if (mode === "transit") return "优先选择换乘稳定的线路";
      if (mode === "walking") return "路线较紧凑，适合连续步行";
      if (mode === "driving") {
        return isEveningRush ? "晚高峰可能增加 5–8 分钟" : "可按预计时间到达下一节点";
      }
      return "按当前偏好选择较稳妥转场";
  }
}

type LegInput = {
  fromName: string;
  toName: string;
  etaMinutes: number;
  fromPoi?: ScoredPoi;
  toPoi?: ScoredPoi;
};

function buildTransitLegSteps(leg: LegInput) {
  const eta = clampMinutes(leg.etaMinutes, 8, 28);
  const walkToStop = clampMinutes(eta * 0.35, 5, 10);
  const rideStops = clampMinutes(eta * 0.12 + 2, 2, 4);
  const walkToDest = clampMinutes(eta * 0.28, 4, 9);
  const stationFrom = mockStationName(leg.fromPoi, leg.fromName, 0);
  const stationTo = mockStationName(leg.toPoi, leg.toName, 1);
  const lineType = leg.toPoi?.nearMetro || leg.fromPoi?.nearMetro ? "地铁" : "公交";

  return sanitizeSteps([
    `步行约 ${walkToStop} 分钟到「${stationFrom}」`,
    `乘坐${lineType} ${rideStops} 站到「${stationTo}」`,
    `下车后步行约 ${walkToDest} 分钟到 ${leg.toName}`,
  ]);
}

function buildWalkingLegSteps(leg: LegInput) {
  const eta = clampMinutes(leg.etaMinutes, 6, 25);
  const distanceFromPoi = safeNumber(leg.toPoi?.distanceMeters, 0);
  const distance = distanceFromPoi > 0 ? clampMinutes(distanceFromPoi, 300, 1800) : clampMinutes(eta * 75, 400, 1400);
  const low = clampMinutes(eta * 0.85, 6, eta);
  const high = clampMinutes(eta * 1.15, low + 1, eta + 5);

  return sanitizeSteps([
    `沿主路步行约 ${distance} 米`,
    `预计 ${low}–${high} 分钟到达 ${leg.toName}`,
    "路线较紧凑，适合少换乘",
  ]);
}

function buildDrivingLegSteps(leg: LegInput, isEveningRush: boolean) {
  const eta = clampMinutes(leg.etaMinutes, 8, 30);
  const rushLine = isEveningRush ? "晚高峰可能增加 5–8 分钟" : "路况正常时可按预计时间到达";

  return sanitizeSteps([
    `打车约 ${eta} 分钟到 ${leg.toName}`,
    rushLine,
    "上下车点建议选择主路一侧",
  ]);
}

function buildAutoLegSteps(leg: LegInput, isEveningRush: boolean) {
  const mode = resolveLegMode("auto", leg.etaMinutes, leg.toPoi);
  if (mode === "walking") return buildWalkingLegSteps(leg);
  if (mode === "driving") return buildDrivingLegSteps(leg, isEveningRush);
  return buildTransitLegSteps(leg);
}

function buildLegSteps(mode: GuidanceMode, leg: LegInput, isEveningRush: boolean) {
  switch (mode) {
    case "walking":
      return buildWalkingLegSteps(leg);
    case "driving":
      return buildDrivingLegSteps(leg, isEveningRush);
    case "transit":
      return buildTransitLegSteps(leg);
    default:
      return buildAutoLegSteps(leg, isEveningRush);
  }
}

function extractLegInputs(plan?: ItineraryPlan): LegInput[] {
  const slots = plan?.slots ?? [];
  if (!slots.length) return [];

  const legs: LegInput[] = [];
  for (let i = 0; i < slots.length - 1; i += 1) {
    const fromSlot = slots[i];
    const toSlot = slots[i + 1];
    const fromName = safeName(fromSlot?.poi?.name, `节点 ${i + 1}`);
    const toName = safeName(toSlot?.poi?.name, `节点 ${i + 2}`);
    const etaMinutes = clampMinutes(safeNumber(toSlot?.etaMinutes, 10), 5, 35);
    legs.push({
      fromName,
      toName,
      etaMinutes,
      fromPoi: fromSlot?.poi,
      toPoi: toSlot?.poi,
    });
  }

  if (!legs.length && slots[0]) {
    const only = slots[0];
    legs.push({
      fromName: "当前位置",
      toName: safeName(only.poi?.name, "首站"),
      etaMinutes: clampMinutes(safeNumber(only.etaMinutes, 10), 5, 35),
      toPoi: only.poi,
    });
  }

  return legs;
}

function buildRouteLegs(params: {
  plan?: ItineraryPlan;
  globalMode: GuidanceMode;
  travelSettings?: TravelSettings | null;
  priority: RoutePriorityChoice;
  isEveningRush: boolean;
}): RouteLegGuidance[] {
  const legInputs = extractLegInputs(params.plan);
  if (!legInputs.length) {
    return [
      {
        fromName: "当前位置",
        toName: "目的地",
        transportLabel: legTransportLabel(params.globalMode, params.travelSettings),
        etaMinutes: 10,
        steps: sanitizeSteps([GUIDANCE_FALLBACK_STEP]),
        tip: buildPriorityTip(params.globalMode, params.priority, params.isEveningRush),
      },
    ];
  }

  return legInputs.map((leg) => {
    const legMode = resolveLegMode(params.globalMode, leg.etaMinutes, leg.toPoi);
    const steps = buildLegSteps(legMode, leg, params.isEveningRush);
    return {
      fromName: leg.fromName,
      toName: leg.toName,
      transportLabel: legTransportLabel(legMode, params.travelSettings),
      etaMinutes: leg.etaMinutes,
      steps: steps.length ? steps : [GUIDANCE_FALLBACK_STEP],
      tip: buildPriorityTip(legMode, params.priority, params.isEveningRush),
    };
  });
}

function flattenLegSteps(legs: RouteLegGuidance[]) {
  const flat = legs.flatMap((leg) => leg.steps);
  return flat.length ? flat.slice(0, 6) : [GUIDANCE_FALLBACK_STEP];
}

function buildTimeHintForMode(
  mode: GuidanceMode,
  effects: ReturnType<typeof buildTravelSettingEffects>,
  travelSettings?: TravelSettings | null,
) {
  const hints: string[] = [effects.routeGuidanceHint];
  if (mode === "transit" && effects.periodKey === "evening_rush") {
    hints.push("如为晚高峰：建议预留额外 5–8 分钟。");
  }
  if (mode === "walking" && (effects.periodKey === "night" || effects.periodKey === "evening_rush")) {
    hints.push("如为夜间/高峰：可切换公共交通或打车。");
  }
  if (mode === "driving" && effects.periodKey === "evening_rush") {
    hints.push("晚高峰打车等待与路况不确定性更高。");
  }
  if (travelSettings && travelSettings.maxCommute <= 25 && mode === "walking") {
    hints.push("短通勤窗口下，优先少折返。");
  }
  return hints.filter(Boolean).join(" ");
}

export function buildRouteGuidance(params: {
  routePlan: RoutePlan;
  intent: Intent;
  selectedPlanType: "main" | "fallback";
  selectedFallbackIndex: number | null;
  travelSettings?: TravelSettings | null;
}): RouteGuidanceSummary {
  const { routePlan, intent, selectedPlanType, selectedFallbackIndex, travelSettings } = params;
  const activePlan = resolveActivePlan(routePlan, selectedPlanType, selectedFallbackIndex);
  const isFallback = selectedPlanType === "fallback" && selectedFallbackIndex !== null;
  const mode = resolveGuidanceMode(intent, travelSettings);
  const effects = buildTravelSettingEffects(travelSettings ?? null);
  const isEveningRush = effects.periodKey === "evening_rush";
  const priority = resolveRoutePriority(travelSettings);

  const legs = buildRouteLegs({
    plan: activePlan,
    globalMode: mode,
    travelSettings,
    priority,
    isEveningRush,
  });

  const timeHint = buildTimeHintForMode(mode, effects, travelSettings);

  return {
    title: "转场路径",
    transportLabel: transportLabel(mode, travelSettings),
    steps: flattenLegSteps(legs),
    legs,
    mapDemoNote: MAP_DEMO_NOTE,
    legDemoNote: LEG_DEMO_NOTE,
    fallbackNote: isFallback ? FALLBACK_GUIDANCE_NOTE : undefined,
    timeHint: timeHint || undefined,
    preferenceHint: effects.preferenceReason || undefined,
  };
}

/** @internal exported for tests */
export function buildRouteLegGuidanceForTest(params: {
  slots: RouteSlot[];
  transportMode: TravelSettings["transportMode"];
  routePriority: RoutePriorityChoice;
  periodKey?: "evening_rush" | "afternoon";
}) {
  const plan: ItineraryPlan = {
    id: "test",
    title: "test",
    slots: params.slots,
    steps: [],
    totalMinutes: 180,
    totalBudget: 300,
    totalWaitMinutes: 10,
    totalCommuteMinutes: 20,
  };
  const travelSettings: TravelSettings = {
    date: "today",
    startTime: params.periodKey === "evening_rush" ? "18:30" : "14:00",
    duration: "3h",
    transportMode: params.transportMode,
    routePriority: params.routePriority,
    partySize: 2,
    budget: 150,
    maxCommute: 30,
  };
  const mode = resolveGuidanceMode({ routePrefs: { transport: "transit", goal: "time" } } as Intent, travelSettings);
  return buildRouteLegs({
    plan,
    globalMode: mode,
    travelSettings,
    priority: params.routePriority,
    isEveningRush: params.periodKey === "evening_rush",
  });
}
