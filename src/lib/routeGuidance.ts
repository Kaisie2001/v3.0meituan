import type { Intent, ItineraryPlan, RoutePlan, TransportMode } from "./types";
import type { TimePickerValue } from "./preferenceSummary";
import { buildTimeWindowEffects } from "./timeWindowEffects";

export const MAP_DEMO_NOTE = "地图路线为 demo 示意，实际导航可接入美团/地图路径服务。";

export const FALLBACK_GUIDANCE_NOTE = "已按备选方案重新组织转场顺序。";

export const GUIDANCE_FALLBACK_STEP = "AI 将按当前偏好生成转场建议。";

export type RouteGuidanceSummary = {
  title: string;
  transportLabel: string;
  steps: string[];
  mapDemoNote: string;
  fallbackNote?: string;
  timeHint?: string;
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

function resolveGuidanceMode(intent: Intent): GuidanceMode {
  const transport = intent.routePrefs?.transport;
  if (transport === "walking") return "walking";
  if (transport === "driving") return "driving";
  if (transport === "transit" && intent.preferMetro) return "transit";
  if (!intent.routePrefs) return "auto";
  if (transport === "transit") return "transit";
  return "auto";
}

function transportLabel(mode: GuidanceMode) {
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

function buildTransitSteps(commuteMinutes: number, destination: string, isFallback: boolean) {
  const walkToStop = clampMinutes(commuteMinutes * 0.35, 6, 10);
  const walkToDest = clampMinutes(commuteMinutes * 0.25, 4, 8);
  const prefix = isFallback ? "备选方案：" : "";
  return [
    `${prefix}步行 ${walkToStop} 分钟到最近地铁/公交站`,
    "乘坐 2–3 站到目标片区",
    `步行 ${walkToDest} 分钟到${destination}`,
  ];
}

function buildWalkingSteps(commuteMinutes: number, isFallback: boolean) {
  const low = clampMinutes(commuteMinutes * 0.8, 8, 30);
  const high = clampMinutes(commuteMinutes * 1.2, low + 4, 35);
  const prefix = isFallback ? "备选方案全程" : "全程";
  return [
    `${prefix}步行约 ${low}–${high} 分钟`,
    "优先选择短距离、少换乘路线",
    "适合附近轻松转场",
  ];
}

function buildDrivingSteps(commuteMinutes: number, budgetPerPerson: number, isFallback: boolean) {
  const low = clampMinutes(commuteMinutes * 0.9, 10, 40);
  const high = clampMinutes(commuteMinutes * 1.3, low + 5, 50);
  const fareLow = clampMinutes(budgetPerPerson * 0.15, 18, 80);
  const fareHigh = clampMinutes(budgetPerPerson * 0.28, fareLow + 8, 120);
  const prefix = isFallback ? "备选方案预计" : "预计";
  return [
    `${prefix}车程约 ${low}–${high} 分钟`,
    `费用约 ¥${fareLow}–${fareHigh}`,
    "上下车点建议选择商场 / 路口 / 地铁口附近",
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

export function buildRouteGuidance(params: {
  routePlan: RoutePlan;
  intent: Intent;
  selectedPlanType: "main" | "fallback";
  selectedFallbackIndex: number | null;
  timePicker?: TimePickerValue | null;
}): RouteGuidanceSummary {
  const { routePlan, intent, selectedPlanType, selectedFallbackIndex, timePicker } = params;
  const activePlan = resolveActivePlan(routePlan, selectedPlanType, selectedFallbackIndex);
  const isFallback = selectedPlanType === "fallback" && selectedFallbackIndex !== null;
  const mode = resolveGuidanceMode(intent);
  const commuteMinutes = sumCommuteMinutes(activePlan, safeNumber(routePlan.mainPlan?.totalCommuteMinutes, 12));
  const destination = destinationHint(activePlan);
  const budget = safeNumber(intent.budgetPerPerson, 150);

  let steps: string[];
  switch (mode) {
    case "walking":
      steps = buildWalkingSteps(commuteMinutes, isFallback);
      break;
    case "driving":
      steps = buildDrivingSteps(commuteMinutes, budget, isFallback);
      break;
    case "transit":
      steps = buildTransitSteps(commuteMinutes, destination, isFallback);
      break;
    default:
      steps = buildAutoSteps(isFallback);
      break;
  }

  const timeEffects = buildTimeWindowEffects(timePicker);

  return {
    title: "出行指引",
    transportLabel: transportLabel(mode),
    steps: sanitizeSteps(steps),
    mapDemoNote: MAP_DEMO_NOTE,
    fallbackNote: isFallback ? FALLBACK_GUIDANCE_NOTE : undefined,
    timeHint: timeEffects.routeGuidanceHint,
  };
}
