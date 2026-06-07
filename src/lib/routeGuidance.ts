import type { Intent, ItineraryPlan, RoutePlan, TransportMode } from "./types";

export const MAP_DEMO_NOTE = "地图路线为 demo 示意，实际导航可接入美团/地图路径服务。";

export type RouteGuidanceSummary = {
  title: string;
  transportLabel: string;
  steps: string[];
  mapDemoNote: string;
};

type GuidanceMode = TransportMode | "auto";

function clampMinutes(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.round(value)));
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

function sumCommuteMinutes(plan?: ItineraryPlan, fallback = 0) {
  if (!plan) return fallback;
  if (typeof plan.totalCommuteMinutes === "number" && Number.isFinite(plan.totalCommuteMinutes)) {
    return plan.totalCommuteMinutes;
  }
  const fromSlots = plan.slots.reduce((sum, slot) => sum + (slot.etaMinutes ?? 0), 0);
  return fromSlots > 0 ? fromSlots : fallback;
}

function destinationHint(plan?: ItineraryPlan) {
  const lastSlot = plan?.slots[plan.slots.length - 1];
  return lastSlot?.poi?.name ?? "目的地";
}

function buildTransitSteps(commuteMinutes: number, destination: string, isFallback: boolean) {
  const walkToStop = clampMinutes(commuteMinutes * 0.35, 4, 10);
  const walkToDest = clampMinutes(commuteMinutes * 0.25, 3, 8);
  const prefix = isFallback ? "备选方案：" : "";
  return [
    `${prefix}步行 ${walkToStop} 分钟到最近地铁/公交站`,
    "乘坐 2–3 站到目标片区",
    `步行 ${walkToDest} 分钟到${destination}`,
    "晚高峰可能增加 5–8 分钟",
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
    "雨天或高温时建议切换公共交通 / 打车",
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
    "晚高峰可能增加等待",
    "上下车点建议选择商场 / 路口 / 地铁口附近",
  ];
}

function buildAutoSteps(isFallback: boolean) {
  const prefix = isFallback ? "备选方案：" : "";
  return [
    `${prefix}AI 综合比较时间、距离、等待和预算`,
    "默认选择当前更稳妥的转场方式",
    "如遇排队或拥堵，可切换备选方案",
    "可在「设置出行偏好」中指定出行方式",
  ];
}

export function buildRouteGuidance(params: {
  routePlan: RoutePlan;
  intent: Intent;
  selectedPlanType: "main" | "fallback";
  selectedFallbackIndex: number | null;
}): RouteGuidanceSummary {
  const { routePlan, intent, selectedPlanType, selectedFallbackIndex } = params;
  const activePlan = resolveActivePlan(routePlan, selectedPlanType, selectedFallbackIndex);
  const isFallback = selectedPlanType === "fallback" && selectedFallbackIndex !== null;
  const mode = resolveGuidanceMode(intent);
  const commuteMinutes = sumCommuteMinutes(activePlan, routePlan.mainPlan?.totalCommuteMinutes ?? 12);
  const destination = destinationHint(activePlan);
  const budget = intent.budgetPerPerson ?? 150;

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

  return {
    title: "出行指引",
    transportLabel: transportLabel(mode),
    steps: steps.slice(0, 4),
    mapDemoNote: MAP_DEMO_NOTE,
  };
}
