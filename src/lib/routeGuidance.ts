import type { Intent, ItineraryPlan, RoutePlan, TransportMode } from "./types";
import type { TravelSettings } from "./preferenceSummary";
import { TRANSPORT_MODE_LABELS } from "./preferenceSummary";
import { buildTravelSettingEffects } from "./travelSettingEffects";

export const MAP_DEMO_NOTE = "路线为示意，出发前可在美团查看真实导航。";

export const FALLBACK_GUIDANCE_NOTE = "已按备选方案重新组织转场顺序。";

export const GUIDANCE_FALLBACK_STEP = "AI 将按当前偏好生成转场建议。";

export type RouteGuidanceSummary = {
  title: string;
  transportLabel: string;
  steps: string[];
  mapDemoNote: string;
  fallbackNote?: string;
  timeHint?: string;
  preferenceHint?: string;
};

type GuidanceMode = TransportMode | "auto";

function clampMinutes(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, Math.round(value)));
}

function safeNumber(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function sanitizeStep(step: string) {
  if (typeof step !== "string" || !step.trim()) return "";
  if (/undefined|NaN|null/i.test(step)) return "";
  return step.trim();
}

function sanitizeSteps(steps: string[]) {
  const cleaned = steps.map(sanitizeStep).filter(Boolean);
  if (cleaned.length >= 3) return cleaned.slice(0, 3);
  return [...cleaned, GUIDANCE_FALLBACK_STEP].slice(0, 3);
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

function sumCommuteMinutes(plan?: ItineraryPlan, fallback = 12) {
  if (!plan) return fallback;
  const total = safeNumber(plan.totalCommuteMinutes, NaN);
  if (Number.isFinite(total) && total > 0) return total;
  const fromSlots = plan.slots.reduce((sum, slot) => sum + safeNumber(slot.etaMinutes, 0), 0);
  return fromSlots > 0 ? fromSlots : fallback;
}

function destinationHint(plan?: ItineraryPlan) {
  const lastSlot = plan?.slots[plan.slots.length - 1];
  const name = lastSlot?.poi?.name;
  return typeof name === "string" && name.trim() ? name.trim() : "目的地";
}

function buildTransitSteps(
  commuteMinutes: number,
  destination: string,
  isFallback: boolean,
  isEveningRush: boolean,
) {
  const walkToStop = clampMinutes(commuteMinutes * 0.35, 6, 10);
  const walkToDest = clampMinutes(commuteMinutes * 0.25, 4, 8);
  const prefix = isFallback ? "备选方案：" : "";
  const steps = [
    `${prefix}步行 ${walkToStop} 分钟到最近地铁/公交站`,
    "乘坐 2–3 站到目标片区",
    `步行 ${walkToDest} 分钟到${destination}`,
  ];
  if (isEveningRush) {
    return steps;
  }
  return steps;
}

function buildWalkingSteps(commuteMinutes: number, isFallback: boolean, periodKey: string) {
  const low = clampMinutes(commuteMinutes * 0.8, 12, 18);
  const high = clampMinutes(commuteMinutes * 1.2, low + 2, 22);
  const prefix = isFallback ? "备选方案全程" : "全程";
  const steps = [
    `${prefix}步行约 ${low}–${high} 分钟`,
    "优先减少换乘，选择短距离转场",
    "适合附近轻松衔接各节点",
  ];
  if (periodKey === "night" || periodKey === "evening_rush") {
    return steps;
  }
  return steps;
}

function buildDrivingSteps(commuteMinutes: number, budgetPerPerson: number, isFallback: boolean) {
  const low = clampMinutes(commuteMinutes * 0.9, 15, 22);
  const high = clampMinutes(commuteMinutes * 1.3, low + 3, 28);
  const fareLow = clampMinutes(budgetPerPerson * 0.15, 25, 80);
  const fareHigh = clampMinutes(budgetPerPerson * 0.28, fareLow + 5, 120);
  const prefix = isFallback ? "备选方案预计" : "预计";
  return [
    `${prefix}车程约 ${low}–${high} 分钟`,
    `费用约 ¥${fareLow}–${fareHigh}`,
    "晚高峰可能增加等车或堵车时间",
  ];
}

function buildAutoSteps(isFallback: boolean) {
  const prefix = isFallback ? "备选方案：" : "";
  return [
    `${prefix}AI 综合比较时间、距离、等待和预算`,
    "默认选择当前更稳妥的转场方式",
    "如遇排队或拥堵，可切换备选方案",
  ];
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
  const commuteMinutes = sumCommuteMinutes(activePlan, safeNumber(routePlan.mainPlan?.totalCommuteMinutes, 12));
  const destination = destinationHint(activePlan);
  const budget = safeNumber(travelSettings?.budget ?? intent.budgetPerPerson, 150);

  const effects = buildTravelSettingEffects(travelSettings ?? null);
  const isEveningRush = effects.periodKey === "evening_rush";

  let steps: string[];
  switch (mode) {
    case "walking":
      steps = buildWalkingSteps(commuteMinutes, isFallback, effects.periodKey);
      break;
    case "driving":
      steps = buildDrivingSteps(commuteMinutes, budget, isFallback);
      break;
    case "transit":
      steps = buildTransitSteps(commuteMinutes, destination, isFallback, isEveningRush);
      break;
    default:
      steps = buildAutoSteps(isFallback);
      break;
  }

  const timeHint = buildTimeHintForMode(mode, effects, travelSettings);

  return {
    title: "出行指引",
    transportLabel: transportLabel(mode, travelSettings),
    steps: sanitizeSteps(steps),
    mapDemoNote: MAP_DEMO_NOTE,
    fallbackNote: isFallback ? FALLBACK_GUIDANCE_NOTE : undefined,
    timeHint: timeHint || undefined,
    preferenceHint: effects.preferenceReason || undefined,
  };
}
