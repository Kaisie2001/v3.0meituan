import {
  buildTravelSettingsSummary,
  getDateLabel,
  getDurationLabel,
  TRANSPORT_MODE_LABELS,
  type TravelSettings,
} from "./preferenceSummary";
import { buildTravelSettingEffects } from "./travelSettingEffects";
import type { ExecutionAction, RoutePlan, RouteSlot } from "./types";

export type SelectedPlanType = "main" | "fallback";

export type SelectedPlanSummary = {
  travelSummary: string;
  planNote?: string;
  nodePreview: string;
};

export type ExecutionUiContext = {
  selectedPlanType: SelectedPlanType;
  selectedFallbackIndex: number | null;
  currentPlanLabel: string;
  travelSettings: TravelSettings;
  travelSettingsSummary: string;
  selectedPlanSummary: SelectedPlanSummary;
};

function resolveActiveSlots(
  routePlan: RoutePlan,
  selectedPlanType: SelectedPlanType,
  selectedFallbackIndex: number | null,
): RouteSlot[] {
  if (selectedPlanType === "fallback" && selectedFallbackIndex !== null) {
    return routePlan.fallbackPlans?.[selectedFallbackIndex]?.slots ?? [];
  }
  return routePlan.mainPlan?.slots ?? [];
}

function formatNodeChain(slots: RouteSlot[]) {
  const names = slots.map((slot) => slot.poi?.name).filter((name): name is string => typeof name === "string" && name.length > 0);
  if (!names.length) return "推荐活动与餐饮节点";

  if (names.length === 1) return `先去 ${names[0]}`;
  if (names.length === 2) {
    const foodIndex = slots.findIndex((slot) => slot.slotType === "food");
    if (foodIndex === 1) return `先去 ${names[0]}，之后去 ${names[1]} 吃饭`;
    return `先去 ${names[0]}，之后去 ${names[1]}`;
  }

  const activityName = names[0];
  const foodName = names.find((_, index) => slots[index]?.slotType === "food") ?? names[1];
  const tailName = names[names.length - 1];
  if (tailName === foodName) {
    return `先去 ${activityName}，之后去 ${foodName} 吃饭`;
  }
  return `先去 ${activityName}，之后去 ${foodName} 吃饭，最后可以去 ${tailName} 聊天`;
}

function buildFallbackPlanNote(travelSettings: TravelSettings, selectedPlanType: SelectedPlanType) {
  if (selectedPlanType !== "fallback") return undefined;
  const effects = buildTravelSettingEffects(travelSettings);
  if (effects.periodKey === "evening_rush") {
    return "因晚高峰排队风险较高，已切换为等待更短的备选方案。";
  }
  if (travelSettings.routePriority === "queue") {
    return "因少排队优先，已切换为等待更短的备选方案。";
  }
  if (travelSettings.routePriority === "time") {
    return "因时间最短优先，已切换为转场更可控的备选方案。";
  }
  return effects.fallbackReasonHint || "已切换为更稳妥的备选方案。";
}

export function buildSelectedPlanSummary(params: {
  routePlan: RoutePlan;
  selectedPlanType: SelectedPlanType;
  selectedFallbackIndex: number | null;
  travelSettings: TravelSettings;
}): SelectedPlanSummary {
  const travelSummary = buildTravelSettingsSummary(params.travelSettings);
  const slots = resolveActiveSlots(params.routePlan, params.selectedPlanType, params.selectedFallbackIndex);
  const nodePreview = formatNodeChain(slots);
  const planNote = buildFallbackPlanNote(params.travelSettings, params.selectedPlanType);

  return {
    travelSummary,
    planNote,
    nodePreview,
  };
}

export function buildExecutionPlanLabel(
  routePlan: RoutePlan,
  selectedPlanType: SelectedPlanType,
  selectedFallbackIndex: number | null,
) {
  if (selectedPlanType === "fallback" && selectedFallbackIndex !== null) {
    return routePlan.fallbackPlans?.[selectedFallbackIndex]?.title ?? "备选方案";
  }
  return "主方案";
}

function buildTransportIdleActions(transportMode: TravelSettings["transportMode"]): ExecutionAction[] {
  switch (transportMode) {
    case "transit":
      return [
        { id: "check-open", label: "检查目的地营业/可订状态" },
        { id: "transit-route", label: "生成公共交通转场建议" },
        { id: "lock", label: "锁定餐厅/活动预约" },
        { id: "share", label: "生成可转发计划" },
      ];
    case "driving":
      return [
        { id: "check-open", label: "检查目的地营业/可订状态" },
        { id: "drive-route", label: "估算打车/驾车转场时间" },
        { id: "lock", label: "锁定餐厅/活动预约" },
        { id: "share", label: "生成可转发计划" },
      ];
    case "walking":
      return [
        { id: "walk-distance", label: "检查步行转场距离" },
        { id: "check-open", label: "检查目的地营业/可订状态" },
        { id: "lock", label: "锁定餐厅/活动预约" },
        { id: "share", label: "生成可转发计划" },
      ];
    default:
      return [
        { id: "check-open", label: "检查目的地营业/可订状态" },
        { id: "auto-route", label: "生成综合转场建议" },
        { id: "lock", label: "锁定餐厅/活动预约" },
        { id: "share", label: "生成可转发计划" },
      ];
  }
}

const FALLBACK_IDLE_ACTIONS: ExecutionAction[] = [
  { id: "apply-fallback", label: "应用已选择的备选方案" },
  { id: "replace-node", label: "替换高风险节点" },
  { id: "reconfirm-risk", label: "重新确认预约/排队风险" },
];

export function buildContextualIdleActions(params: {
  travelSettings: TravelSettings;
  selectedPlanType: SelectedPlanType;
}): ExecutionAction[] {
  const base = buildTransportIdleActions(params.travelSettings.transportMode);
  if (params.selectedPlanType === "fallback") {
    return [...FALLBACK_IDLE_ACTIONS, ...base];
  }
  return base;
}

export function buildContextualRunningSteps(params: {
  travelSettings: TravelSettings;
  selectedPlanType: SelectedPlanType;
}) {
  const steps =
    params.selectedPlanType === "fallback"
      ? ["正在应用备选方案", "正在确认替代节点可用", "正在更新路线与预约动作", "正在生成分享文案"]
      : ["正在检查主方案可订状态", "正在锁定推荐餐厅/活动", "正在生成转场路线", "正在生成分享文案"];

  const hints: string[] = [];
  const effects = buildTravelSettingEffects(params.travelSettings);
  if (effects.periodKey === "evening_rush") {
    hints.push("当前为晚高峰，正在优先校验排队和可订风险。");
  }
  if (params.travelSettings.routePriority === "queue") {
    hints.push("已优先选择等待更短或可预约节点。");
  }

  return { steps, hints };
}

export function buildContextualDoneSummary(params: {
  selectedPlanType: SelectedPlanType;
  currentPlanLabel: string;
  hasShareText: boolean;
  hasRoutePlan: boolean;
  traceHasReservation: boolean;
  traceHasOrder: boolean;
}) {
  const items = [
    "已确认当前执行方案",
    params.traceHasReservation || params.traceHasOrder ? "已完成订座 / 下单 / 活动预约 mock" : "已完成可订与预约检查 mock",
    params.hasRoutePlan ? "已生成转场建议" : "已生成执行摘要",
    params.hasShareText ? "已生成可转发文案" : "已准备分享文案",
    "已准备备选方案回退记录",
  ];

  if (params.selectedPlanType === "fallback") {
    items.unshift(`执行方案：${params.currentPlanLabel}`);
  }

  return items;
}

export function buildTraceFoldSummary(selectedPlanType: SelectedPlanType) {
  if (selectedPlanType === "fallback") {
    return "包含备选方案应用、替代节点检查、路线更新、订座/下单和分享文案生成。";
  }
  return "包含可订检查、路线生成、订座/下单和分享文案生成。";
}

export function buildEnhancedShareText(params: {
  originalShareText: string;
  travelSettings: TravelSettings;
  currentPlanLabel: string;
  selectedPlanType: SelectedPlanType;
  routePlan: RoutePlan;
  selectedFallbackIndex: number | null;
}) {
  const dateLabel = getDateLabel(params.travelSettings.date);
  const durationLabel = getDurationLabel(params.travelSettings.duration);
  const transportLabel = TRANSPORT_MODE_LABELS[params.travelSettings.transportMode] ?? "系统综合推荐";
  const slots = resolveActiveSlots(params.routePlan, params.selectedPlanType, params.selectedFallbackIndex);
  const nodeChain = formatNodeChain(slots);
  const planLabel = params.selectedPlanType === "fallback" ? params.currentPlanLabel : "主方案";

  const fallbackNote =
    params.routePlan.fallbackPlans?.length && params.selectedPlanType === "main"
      ? "如果排队过长，已准备备选方案。"
      : params.selectedPlanType === "fallback"
        ? "当前已按备选方案安排，主方案仍可作为回退参考。"
        : "";

  const enhanced = [
    `我帮我们排好了：${dateLabel} ${params.travelSettings.startTime} 出发，预计 ${durationLabel}。`,
    `${nodeChain}。`,
    `路线按${transportLabel}安排（${planLabel}）`,
    fallbackNote,
  ]
    .filter(Boolean)
    .join("");

  const original = params.originalShareText?.trim();
  if (!original) return enhanced;
  if (original.includes(params.travelSettings.startTime) && original.includes(durationLabel)) {
    return original;
  }
  return `${enhanced}\n\n${original}`;
}

export function buildExecutionUiContext(params: {
  routePlan: RoutePlan;
  selectedPlanType: SelectedPlanType;
  selectedFallbackIndex: number | null;
  travelSettings: TravelSettings;
}): ExecutionUiContext {
  const currentPlanLabel = buildExecutionPlanLabel(params.routePlan, params.selectedPlanType, params.selectedFallbackIndex);
  const travelSettingsSummary = buildTravelSettingsSummary(params.travelSettings);
  const selectedPlanSummary = buildSelectedPlanSummary(params);

  return {
    selectedPlanType: params.selectedPlanType,
    selectedFallbackIndex: params.selectedFallbackIndex,
    currentPlanLabel,
    travelSettings: params.travelSettings,
    travelSettingsSummary,
    selectedPlanSummary,
  };
}
