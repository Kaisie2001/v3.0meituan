import { getPersonaSlotLabel } from "./persona";
import {
  ROUTE_PRIORITY_LABELS,
  TRANSPORT_MODE_LABELS,
  type TravelSettings,
} from "./preferenceSummary";
import type { TravelSettingEffectsSummary } from "./travelSettingEffects";
import type { ParseResult, RouteSlot, ScoredPoi } from "./types";

export type SelectedPlanType = "main" | "fallback";

export type RouteNodeBasis = {
  poiName: string;
  roleLabel: string;
  reason: string;
  riskNote: string;
};

export type RouteBasisSummary = {
  planIntro?: string;
  nodes: RouteNodeBasis[];
  dynamicHint?: string;
};

const CATEGORY_LABELS: Record<string, string> = {
  cafe: "咖啡/轻停留",
  restaurant: "餐饮",
  mall: "商场/室内",
  activity: "活动",
};

function safeText(value: unknown, fallback: string) {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : fallback;
}

function pickTagHighlight(poi: ScoredPoi) {
  const tag = poi.sceneTags.find(Boolean);
  if (tag) return `标签「${tag}」与当前场景匹配`;
  const category = CATEGORY_LABELS[poi.category];
  if (category) return `${category}类型更贴合本节点`;
  return "综合成行分与路线衔接选出";
}

function buildTravelPreferenceLine(travelSettings?: TravelSettings) {
  if (!travelSettings) return "";
  const transport = TRANSPORT_MODE_LABELS[travelSettings.transportMode] ?? "系统综合推荐";
  const priority = ROUTE_PRIORITY_LABELS[travelSettings.routePriority] ?? "时间最短";
  return `已按${transport}、${priority}偏好筛选`;
}

function buildNodeReason(params: {
  slot: RouteSlot;
  parseResult: ParseResult;
  travelSettings?: TravelSettings;
  onActiveRoute: boolean;
}) {
  const { slot, travelSettings, onActiveRoute } = params;
  const poi = slot.poi;
  const rationale = slot.rationaleNotes?.find((note) => note.trim().length);
  const parts: string[] = [];

  if (rationale) parts.push(rationale);
  if (poi) parts.push(pickTagHighlight(poi));
  const travelLine = buildTravelPreferenceLine(travelSettings);
  if (travelLine) parts.push(travelLine);
  if (onActiveRoute && poi) parts.push(`地图路线已纳入 ${poi.name}`);

  const unique = [...new Set(parts.filter(Boolean))];
  return unique[0] ?? "按当前出行设置与场景画像匹配该节点";
}

function buildNodeRisk(params: {
  slot: RouteSlot;
  settingEffects?: TravelSettingEffectsSummary;
}) {
  const { slot, settingEffects } = params;
  const poi = slot.poi;
  const slotRisk = slot.riskNotes?.find((note) => note.trim().length);
  if (slotRisk) return slotRisk;

  if (poi?.risks?.length) return poi.risks[0];

  if (poi && typeof poi.queueMinutes === "number" && poi.queueMinutes >= 15) {
    return `预计排队约 ${poi.queueMinutes} 分钟，建议关注可订状态`;
  }

  if (settingEffects?.periodKey === "evening_rush") {
    return safeText(settingEffects.bookingRisk, "中") === "高"
      ? "晚高峰可订座更稀缺，建议预留转场时间"
      : "晚高峰交通不确定性更高，注意转场缓冲";
  }

  if (poi && !poi.reservationAvailable && poi.category === "restaurant") {
    return "当前不可订，执行前需确认座位";
  }

  return "执行前确认营业时间与现场排队";
}

function selectBasisSlots(slots: RouteSlot[]) {
  if (!slots.length) return [];

  const activitySlot = slots.find((slot) => slot.slotType === "activity") ?? slots[0];
  const foodSlot = slots.find((slot) => slot.slotType === "food");
  const extraSlot = slots.find((slot) => slot.slotType === "extra") ?? slots[slots.length - 1];

  const selected: RouteSlot[] = [activitySlot];
  if (foodSlot && foodSlot !== activitySlot) selected.push(foodSlot);
  if (extraSlot && !selected.includes(extraSlot)) selected.push(extraSlot);

  while (selected.length < 3 && selected.length < slots.length) {
    const next = slots[selected.length];
    if (next && !selected.includes(next)) selected.push(next);
    else break;
  }

  return selected.slice(0, 3);
}

function buildDynamicHint(settingEffects?: TravelSettingEffectsSummary) {
  if (!settingEffects?.hasCompleteSettings) return undefined;
  const parts = [settingEffects.riskSummaryLine, settingEffects.planningAdvice].filter(Boolean);
  const line = parts.join(" · ");
  return line.trim().length ? line : undefined;
}

function buildFallbackIntro(params: {
  selectedPlanType: SelectedPlanType;
  fallbackPlanTitle?: string;
  settingEffects?: TravelSettingEffectsSummary;
}) {
  if (params.selectedPlanType !== "fallback") return undefined;

  const title = params.fallbackPlanTitle?.trim();
  if (params.settingEffects?.periodKey === "evening_rush") {
    return title
      ? `已切换为${title}，替换等待更短的节点，减少晚高峰排队风险。`
      : "已替换等待更短的节点，减少晚高峰排队风险。";
  }

  return title
    ? `已切换为${title}，优先降低等待或绕路风险。`
    : "已替换等待更短的节点，减少晚高峰排队风险。";
}

export function buildRouteBasis(params: {
  slots: RouteSlot[];
  parseResult: ParseResult;
  selectedPlanType: SelectedPlanType;
  selectedFallbackIndex?: number | null;
  travelSettings?: TravelSettings;
  settingEffects?: TravelSettingEffectsSummary;
  fallbackPlanTitle?: string;
  activeRoutePoiIds?: string[];
}): RouteBasisSummary {
  const activeRouteSet = new Set(params.activeRoutePoiIds ?? []);
  const basisSlots = selectBasisSlots(params.slots);

  const nodes: RouteNodeBasis[] = basisSlots.map((slot) => {
    const poi = slot.poi;
    const poiName = safeText(poi?.name, "待定地点");
    const roleLabel = getPersonaSlotLabel(params.parseResult, slot.slotType);
    const onActiveRoute = Boolean(poi?.id && activeRouteSet.has(poi.id));

    return {
      poiName,
      roleLabel,
      reason: buildNodeReason({
        slot,
        parseResult: params.parseResult,
        travelSettings: params.travelSettings,
        onActiveRoute,
      }),
      riskNote: buildNodeRisk({ slot, settingEffects: params.settingEffects }),
    };
  });

  if (!nodes.length) {
    nodes.push({
      poiName: "待定地点",
      roleLabel: "路线节点",
      reason: "按当前出行设置生成路线骨架",
      riskNote: "补充出发时间与人均预算后可细化节点",
    });
  }

  while (nodes.length < 3) {
    nodes.push({
      poiName: "待补充节点",
      roleLabel: nodes.length === 1 ? "吃饭 / 活动" : "收尾 / 饭后",
      reason: "当前方案节点较少，执行前可替换临近 POI",
      riskNote: "确认现场开放与排队情况",
    });
  }

  return {
    planIntro: buildFallbackIntro({
      selectedPlanType: params.selectedPlanType,
      fallbackPlanTitle: params.fallbackPlanTitle,
      settingEffects: params.settingEffects,
    }),
    nodes: nodes.slice(0, 3),
    dynamicHint: buildDynamicHint(params.settingEffects),
  };
}

export function summarizeRouteBasisText(summary: RouteBasisSummary) {
  return [summary.planIntro, ...summary.nodes.map((node) => `${node.poiName}:${node.reason}`)].filter(Boolean).join("|");
}
