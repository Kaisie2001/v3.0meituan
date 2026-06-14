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

const CORE_IDLE_ACTIONS: ExecutionAction[] = [
  { id: "apply-plan", label: "应用当前方案" },
  { id: "check-risk", label: "检查预约 / 排队风险" },
  { id: "update-route", label: "更新转场路线" },
  { id: "share-plan", label: "生成可分享计划" },
];

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
    const title = routePlan.fallbackPlans?.[selectedFallbackIndex]?.title?.trim();
    if (title) return title.startsWith("备选") ? title : `备选：${title}`;
    return "备选方案";
  }
  return "主方案";
}

export function buildExecutionScopeLabel(selectedPlanType: SelectedPlanType, currentPlanLabel: string) {
  if (selectedPlanType === "fallback") {
    const detail = currentPlanLabel.startsWith("备选") ? currentPlanLabel : `备选：${currentPlanLabel}`;
    return {
      scope: "正在执行：备选方案",
      planDetail: detail,
    };
  }
  return {
    scope: "正在执行：主方案",
    planDetail: currentPlanLabel,
  };
}

export function buildContextualIdleActions(params: {
  travelSettings: TravelSettings;
  selectedPlanType: SelectedPlanType;
}): ExecutionAction[] {
  if (params.selectedPlanType === "fallback") {
    return CORE_IDLE_ACTIONS.map((action) =>
      action.id === "apply-plan" ? { ...action, label: "应用已选择的备选方案" } : action,
    );
  }
  return CORE_IDLE_ACTIONS;
}

export function buildContextualRunningSteps(params: {
  travelSettings: TravelSettings;
  selectedPlanType: SelectedPlanType;
}) {
  const steps =
    params.selectedPlanType === "fallback"
      ? ["正在应用备选方案", "检查预约余量", "更新路线衔接", "生成分享文案"]
      : ["正在为你锁定安排…", "检查预约余量", "更新路线衔接", "生成分享文案"];

  const hints = ["检查预约余量、路线衔接和分享文案"];
  const effects = buildTravelSettingEffects(params.travelSettings);
  if (effects.periodKey === "evening_rush") {
    hints.push("晚高峰时段，优先校验排队与可订状态。");
  }
  if (params.travelSettings.routePriority === "queue") {
    hints.push("已按少排队优先筛选节点。");
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
  void params.currentPlanLabel;
  void params.hasRoutePlan;
  void params.traceHasReservation;
  void params.traceHasOrder;

  return [
    params.selectedPlanType === "fallback" ? "已应用备选方案" : "已应用当前方案",
    "已更新路线衔接",
    "已模拟锁定餐厅 / 活动预约",
    params.hasShareText ? "已生成可转发计划" : "已生成可转发计划",
  ];
}

export function buildTraceFoldSummary(selectedPlanType: SelectedPlanType) {
  if (selectedPlanType === "fallback") {
    return "备选方案应用、替代节点检查、路线更新、订座/下单 mock、分享文案生成";
  }
  return "可订检查、路线更新、订座/下单 mock、分享文案生成";
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
