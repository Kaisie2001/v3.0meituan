import { buildQrSeed } from "./qrSeed";
import { getDateLabel } from "./preferenceSummary";
import type { RoutePriorityChoice, TravelSettings } from "./preferenceSummary";
import type { RoutePlan, RouteSlot, ScoredPoi } from "./types";
import type { SelectedPlanType } from "./executionContext";

export type QueueStatusStep = {
  label: string;
  state: "done" | "active" | "pending";
};

export type QueueExecutionArtifact = {
  type: "queue";
  title: "排队详情";
  venueName: string;
  queueTableType: "小桌" | "中桌" | "大桌";
  queueNumber: string;
  aheadCount: number;
  estimatedWaitMinutes: string;
  queueStartedAt: string;
  phoneMasked: string;
  notificationEnabled: boolean;
  merchantNote: string;
  cancelHint: string;
  statusSteps: QueueStatusStep[];
};

export type ReservationExecutionArtifact = {
  type: "reservation";
  title: "已模拟预约";
  venueName: string;
  timeLabel: string;
  partySize: number;
  status: string;
  note: string;
};

export type VoucherExecutionArtifact = {
  type: "voucher";
  title: "已生成核销码";
  venueName: string;
  code: string;
  qrPayload: string;
  note: string;
};

export type ShareExecutionArtifact = {
  type: "share";
  title: "已生成可分享计划";
  summary: string;
  shareText: string;
  note: string;
};

export type ExecutionArtifact =
  | QueueExecutionArtifact
  | ReservationExecutionArtifact
  | VoucherExecutionArtifact
  | ShareExecutionArtifact;

const VOUCHER_SIGNALS = [
  "ticket",
  "event",
  "voucher",
  "show",
  "exhibition",
  "门票",
  "展览",
  "演出",
  "团购",
  "核销",
  "入场",
];

function hashSeed(seed: string) {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function stablePick(seed: string, salt: number, min: number, max: number) {
  const value = hashSeed(`${seed}:${salt}`);
  const span = Math.max(1, max - min + 1);
  return min + (value % span);
}

function safeName(value: unknown, fallback: string) {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : fallback;
}

function safePartySize(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.round(value) : fallback;
}

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

function poiSignalBlob(poi?: ScoredPoi) {
  if (!poi) return "";
  return [poi.category, poi.name, ...(poi.sceneTags ?? []), ...(poi.riskTags ?? []), ...(poi.reviewPositive ?? [])]
    .join(" ")
    .toLowerCase();
}

function isVoucherPoi(poi?: ScoredPoi) {
  const blob = poiSignalBlob(poi);
  if (!blob) return false;
  return VOUCHER_SIGNALS.some((signal) => blob.includes(signal.toLowerCase()));
}

function isDiningContext(poi?: ScoredPoi, slotType?: RouteSlot["slotType"]) {
  if (!poi) return false;
  if (slotType === "food") return poi.category === "restaurant" || poi.category === "cafe";
  return poi.category === "restaurant";
}

function hasQueueContext(poi: ScoredPoi | undefined, routePriority: RoutePriorityChoice) {
  if (!poi) return false;
  if (routePriority === "queue") return true;

  const queueMinutes = poi.queueMinutes;
  const blob = poiSignalBlob(poi);
  if (/排队长|排队久|高峰等位|等位久|排队/.test(blob)) return true;
  if (poi.crowdLevel === "high" && typeof queueMinutes === "number" && queueMinutes > 0) return true;

  if (routePriority === "detour" || routePriority === "experience" || routePriority === "distance") {
    return typeof queueMinutes === "number" && Number.isFinite(queueMinutes) && queueMinutes >= 15;
  }

  return typeof queueMinutes === "number" && Number.isFinite(queueMinutes) && queueMinutes >= 8;
}

const MEAL_ROUTE_PRIORITIES: RoutePriorityChoice[] = ["time", "experience", "cost", "detour", "queue"];

function shouldPreferRestaurantDining(slots: RouteSlot[], routePriority: RoutePriorityChoice) {
  const restaurantSlot = pickRestaurantFoodSlot(slots);
  if (!restaurantSlot?.poi) return false;
  if (routePriority === "queue") return true;

  const foodIndex = slots.findIndex((slot) => slot.slotType === "food" && slot.poi?.category === "restaurant");
  if (foodIndex < 0) return false;
  if (foodIndex === 0) return true;

  const leadInSlots = slots.slice(0, foodIndex);
  const onlyLeadInNodes = leadInSlots.every(
    (slot) =>
      slot.slotType === "activity" ||
      slot.slotType === "extra" ||
      slot.poi?.category === "mall" ||
      slot.poi?.category === "activity",
  );

  return onlyLeadInNodes && MEAL_ROUTE_PRIORITIES.includes(routePriority);
}

function pickPrimarySlot(slots: RouteSlot[]) {
  return slots.find((slot) => slot.slotType === "food") ?? slots.find((slot) => slot.slotType === "activity") ?? slots[0];
}

function pickVoucherSlot(slots: RouteSlot[]) {
  return slots.find((slot) => isVoucherPoi(slot.poi)) ?? null;
}

function pickRestaurantFoodSlot(slots: RouteSlot[]) {
  return slots.find((slot) => slot.slotType === "food" && slot.poi?.category === "restaurant") ?? null;
}

function pickCafeFoodSlot(slots: RouteSlot[]) {
  return slots.find((slot) => slot.slotType === "food" && slot.poi?.category === "cafe") ?? null;
}

function buildDiningArtifact(params: {
  poi: ScoredPoi;
  seed: string;
  travelSettings: TravelSettings;
  partySize: number;
  routePriority: RoutePriorityChoice;
}): QueueExecutionArtifact | ReservationExecutionArtifact {
  if (hasQueueContext(params.poi, params.routePriority)) {
    return buildQueueArtifact({
      poi: params.poi,
      seed: params.seed,
      travelSettings: params.travelSettings,
      partySize: params.partySize,
    });
  }
  return buildReservationArtifact({
    poi: params.poi,
    travelSettings: params.travelSettings,
    partySize: params.partySize,
    seed: params.seed,
  });
}

function formatTimeLabel(travelSettings: TravelSettings) {
  const dateLabel = getDateLabel(travelSettings.date);
  const time = travelSettings.startTime?.trim() || "14:00";
  return `${dateLabel} ${time}`;
}

function stableMockCode(seed: string) {
  const num = stablePick(seed, 3, 100000, 999999);
  return `MT-${num}`;
}

function stableMockPhone(seed: string) {
  const tail = stablePick(seed, 8, 1000, 9999);
  return `187****${tail}`;
}

function resolveQueueTableType(partySize: number): QueueExecutionArtifact["queueTableType"] {
  if (partySize >= 5) return "大桌";
  if (partySize >= 3) return "中桌";
  return "小桌";
}

function resolveQueueLetter(tableType: QueueExecutionArtifact["queueTableType"]) {
  if (tableType === "大桌") return "C";
  if (tableType === "中桌") return "B";
  return "A";
}

function formatQueueStartedAt(travelSettings: TravelSettings) {
  const time = travelSettings.startTime?.trim() || "18:00";
  const [hourText, minuteText] = time.split(":");
  const hour = Number.parseInt(hourText ?? "18", 10);
  const minute = Number.parseInt(minuteText ?? "0", 10);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return "17:30";
  const total = Math.max(0, hour * 60 + minute - 12);
  const nextHour = Math.floor(total / 60);
  const nextMinute = total % 60;
  return `${String(nextHour).padStart(2, "0")}:${String(nextMinute).padStart(2, "0")}`;
}

function buildQueueArtifact(params: {
  poi: ScoredPoi;
  seed: string;
  travelSettings: TravelSettings;
  partySize: number;
}): QueueExecutionArtifact {
  const queueMinutes = safePartySize(params.poi.queueMinutes, 15);
  const low = Math.max(8, queueMinutes - 4);
  const high = low + 7;
  const tableType = resolveQueueTableType(safePartySize(params.partySize, params.travelSettings.partySize));
  const letter = resolveQueueLetter(tableType);
  const number = stablePick(params.seed, 2, 18, 99);

  return {
    type: "queue",
    title: "排队详情",
    venueName: safeName(params.poi.name, "餐厅"),
    queueTableType: tableType,
    queueNumber: `${letter}${number}`,
    aheadCount: stablePick(params.seed, 4, 4, 18),
    estimatedWaitMinutes: `${low}–${high} 分钟`,
    queueStartedAt: formatQueueStartedAt(params.travelSettings),
    phoneMasked: stableMockPhone(params.seed),
    notificationEnabled: true,
    merchantNote: "听到叫号请到迎宾台，过号不作废，延三桌安排。",
    cancelHint: "如无法到店就餐，请及时取消",
    statusSteps: [
      { label: "取号成功", state: "done" },
      { label: "待叫号", state: "active" },
      { label: "已就餐", state: "pending" },
    ],
  };
}

function buildReservationArtifact(params: {
  poi: ScoredPoi;
  travelSettings: TravelSettings;
  partySize: number;
  seed: string;
}): ReservationExecutionArtifact {
  return {
    type: "reservation",
    title: "已模拟预约",
    venueName: safeName(params.poi.name, "餐厅"),
    timeLabel: formatTimeLabel(params.travelSettings),
    partySize: safePartySize(params.partySize, params.travelSettings.partySize),
    status: params.poi.reservationAvailable ? "待商家确认" : "已提交预约请求",
    note: "商家确认后会同步到消息中心，建议出发前再次确认。",
  };
}

function buildVoucherArtifact(params: {
  poi: ScoredPoi;
  seed: string;
  receiptIds: Record<string, string>;
  currentPlanLabel: string;
}): VoucherExecutionArtifact {
  const ticketId = params.receiptIds.ticketId ?? stableMockCode(`${params.seed}-ticket`);
  const qrPayload = buildQrSeed({
    planLabel: params.currentPlanLabel,
    ticketId,
    orderId: params.receiptIds.orderId,
  });

  return {
    type: "voucher",
    title: "已生成核销码",
    venueName: safeName(params.poi.name, "活动场地"),
    code: ticketId,
    qrPayload,
    note: "到店/入场前出示二维码核销。",
  };
}

function buildShareArtifact(params: {
  summary: string;
  shareText: string;
}): ShareExecutionArtifact {
  return {
    type: "share",
    title: "已生成可分享计划",
    summary: params.summary,
    shareText: params.shareText.trim() || "已为你整理好行程，出发前可再次确认节点顺序。",
    note: "可复制文案发给同行人，或返回方案继续调整。",
  };
}

export function getExecutionArtifactPrimaryActionLabel(type: ExecutionArtifact["type"]) {
  if (type === "queue" || type === "reservation" || type === "voucher") return "查看路线";
  return "查看最终行程";
}

export function buildExecutionArtifacts(params: {
  routePlan: RoutePlan;
  travelSettings: TravelSettings;
  selectedPlanType: SelectedPlanType;
  selectedFallbackIndex: number | null;
  currentPlanLabel: string;
  partySize: number;
  shareText: string;
  planSummary: string;
  receiptIds?: Record<string, string>;
}): ExecutionArtifact {
  const slots = resolveActiveSlots(params.routePlan, params.selectedPlanType, params.selectedFallbackIndex);
  const primarySlot = pickPrimarySlot(slots);
  const primaryPoi = primarySlot?.poi;
  const restaurantFoodSlot = pickRestaurantFoodSlot(slots);
  const cafeFoodSlot = pickCafeFoodSlot(slots);
  const voucherSlot = pickVoucherSlot(slots);
  const receiptIds = params.receiptIds ?? {};
  const routePriority = params.travelSettings.routePriority;

  const seed = [
    params.currentPlanLabel,
    params.selectedPlanType,
    String(params.selectedFallbackIndex ?? "main"),
    restaurantFoodSlot?.poi?.id ?? cafeFoodSlot?.poi?.id ?? voucherSlot?.poi?.id ?? primaryPoi?.id ?? "plan",
    routePriority,
  ].join("|");

  if (restaurantFoodSlot?.poi && shouldPreferRestaurantDining(slots, routePriority)) {
    return buildDiningArtifact({
      poi: restaurantFoodSlot.poi,
      seed,
      travelSettings: params.travelSettings,
      partySize: params.partySize,
      routePriority,
    });
  }

  if (voucherSlot?.poi) {
    return buildVoucherArtifact({
      poi: voucherSlot.poi,
      seed,
      receiptIds,
      currentPlanLabel: params.currentPlanLabel,
    });
  }

  if (cafeFoodSlot?.poi) {
    return buildReservationArtifact({
      poi: cafeFoodSlot.poi,
      travelSettings: params.travelSettings,
      partySize: params.partySize,
      seed,
    });
  }

  if (primaryPoi?.category === "cafe") {
    return buildReservationArtifact({
      poi: primaryPoi,
      travelSettings: params.travelSettings,
      partySize: params.partySize,
      seed,
    });
  }

  return buildShareArtifact({
    summary: params.planSummary || "已按当前方案生成可执行行程。",
    shareText: params.shareText,
  });
}

/** @internal for tests */
export const executionArtifactRules = {
  isVoucherPoi,
  isDiningContext,
  hasQueueContext,
  shouldPreferRestaurantDining,
};
