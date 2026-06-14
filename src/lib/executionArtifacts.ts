import { buildQrSeed } from "./qrSeed";
import { getDateLabel } from "./preferenceSummary";
import type { RoutePriorityChoice, TravelSettings } from "./preferenceSummary";
import type {
  ExecutionCapability,
  PoiBookingStatus,
  RoutePlan,
  RouteSlot,
  ScoredPoi,
} from "./types";
import type { SelectedPlanType } from "./executionContext";

export type QueueStatusStep = {
  label: string;
  state: "done" | "active" | "pending";
};

type ArtifactBase = {
  id: string;
};

export type QueueExecutionArtifact = ArtifactBase & {
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

export type ScheduledQueueExecutionArtifact = ArtifactBase & {
  type: "scheduledQueue";
  title: "已设置自动取号";
  venueName: string;
  plannedArrivalTime: string;
  scheduledQueueTime: string;
  triggerReason: string;
  statusSteps: QueueStatusStep[];
  note: string;
};

export type ReservationExecutionArtifact = ArtifactBase & {
  type: "reservation";
  title: "已模拟预约";
  venueName: string;
  timeLabel: string;
  partySize: number;
  status: string;
  note: string;
};

export type VoucherExecutionArtifact = ArtifactBase & {
  type: "voucher";
  title: "已生成核销码";
  venueName: string;
  code: string;
  qrPayload: string;
  note: string;
};

export type ShareExecutionArtifact = ArtifactBase & {
  type: "share";
  title: "已生成可分享计划";
  summary: string;
  shareText: string;
  note: string;
};

export type ExecutionArtifact =
  | QueueExecutionArtifact
  | ScheduledQueueExecutionArtifact
  | ReservationExecutionArtifact
  | VoucherExecutionArtifact
  | ShareExecutionArtifact;

/**
 * Phase 1 bundle: full artifact list with primary fields copied onto the array
 * for legacy single-artifact UI consumers (phase 2 will read the list directly).
 */
export type ExecutionArtifactsResult = ExecutionArtifact[] & ExecutionArtifact;

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
  "亲子",
  "亲子馆",
  "乐园",
  "kid",
];

const QUEUE_DINING_SIGNALS = [/排队/, /等位/, /高峰/, /热门/];

const PRIMARY_TYPE_ORDER: ExecutionArtifact["type"][] = [
  "scheduledQueue",
  "queue",
  "reservation",
  "voucher",
  "share",
];

const SCHEDULED_QUEUE_LEAD_MIN = 45;
const IMMEDIATE_QUEUE_ARRIVAL_MAX_MIN = 30;

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

function safeQueueMinutes(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.round(value) : fallback;
}

function parseTimeToMinutes(time: string | undefined): number | null {
  if (typeof time !== "string") return null;
  const trimmed = time.trim();
  const match = trimmed.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hour = Number.parseInt(match[1] ?? "", 10);
  const minute = Number.parseInt(match[2] ?? "", 10);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return hour * 60 + minute;
}

function formatMinutesToTime(totalMinutes: number) {
  const normalized = ((totalMinutes % (24 * 60)) + 24 * 60) % (24 * 60);
  const hour = Math.floor(normalized / 60);
  const minute = normalized % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function minutesBetweenTimes(from: string | undefined, to: string | undefined) {
  const fromMin = parseTimeToMinutes(from);
  const toMin = parseTimeToMinutes(to);
  if (fromMin === null || toMin === null) return null;
  let diff = toMin - fromMin;
  if (diff < 0) diff += 24 * 60;
  return diff;
}

function resolveSimulatedNowTime(travelSettings: TravelSettings) {
  const parsed = parseTimeToMinutes(travelSettings.startTime);
  return parsed === null ? "14:00" : formatMinutesToTime(parsed);
}

function resolveAccumulatedMinutesBeforeSlot(slots: RouteSlot[], slotIndex: number) {
  let total = 0;
  for (let index = 0; index < slotIndex; index += 1) {
    const slot = slots[index];
    total += safeQueueMinutes(slot?.etaMinutes, 0) + safeQueueMinutes(slot?.waitMinutes, 0);
  }
  return total;
}

function resolvePlannedArrivalTime(params: {
  slot: RouteSlot;
  slots: RouteSlot[];
  slotIndex: number;
  travelSettings: TravelSettings;
}) {
  const slotMinutes = parseTimeToMinutes(params.slot.startTime);
  if (slotMinutes !== null) {
    return formatMinutesToTime(slotMinutes);
  }

  const startMinutes = parseTimeToMinutes(params.travelSettings.startTime);
  if (startMinutes !== null) {
    return formatMinutesToTime(startMinutes + resolveAccumulatedMinutesBeforeSlot(params.slots, params.slotIndex));
  }

  return "18:30";
}

function resolveMinutesUntilArrival(params: {
  slot: RouteSlot;
  slots: RouteSlot[];
  slotIndex: number;
  travelSettings: TravelSettings;
}) {
  const simulatedNow = resolveSimulatedNowTime(params.travelSettings);
  const plannedArrival = resolvePlannedArrivalTime(params);
  const diff = minutesBetweenTimes(simulatedNow, plannedArrival);
  if (diff !== null) return diff;

  const accumulated = resolveAccumulatedMinutesBeforeSlot(params.slots, params.slotIndex);
  if (accumulated > 0) return accumulated;

  return IMMEDIATE_QUEUE_ARRIVAL_MAX_MIN;
}

function shouldScheduleQueueInsteadOfImmediate(params: {
  slot: RouteSlot;
  slots: RouteSlot[];
  slotIndex: number;
  travelSettings: TravelSettings;
}) {
  const minutesUntilArrival = resolveMinutesUntilArrival(params);
  if (minutesUntilArrival > SCHEDULED_QUEUE_LEAD_MIN) return true;
  if (minutesUntilArrival <= IMMEDIATE_QUEUE_ARRIVAL_MAX_MIN) return false;
  return true;
}

function resolveQueueLeadMinutes(poi: ScoredPoi, seed: string) {
  const queueMinutes = Math.max(10, safeQueueMinutes(poi.queueMinutes, 10));
  const routeEta = safeQueueMinutes(poi.routeEtaMinutes, 12);
  const jitter = stablePick(seed, 11, 0, 10);
  return Math.max(15, Math.min(45, Math.round(queueMinutes * 0.8 + routeEta * 0.5) + jitter));
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
  if (!poi) return false;
  if (poi.requiresVoucher) return true;
  const blob = poiSignalBlob(poi);
  if (!blob) return false;
  return VOUCHER_SIGNALS.some((signal) => blob.includes(signal.toLowerCase()));
}

function isDiningContext(poi?: ScoredPoi, slotType?: RouteSlot["slotType"]) {
  if (!poi) return false;
  if (slotType === "food") return poi.category === "restaurant" || poi.category === "cafe";
  return poi.category === "restaurant" || poi.category === "cafe";
}

function deriveBookingStatus(poi: ScoredPoi): PoiBookingStatus {
  if (poi.bookingStatus) return poi.bookingStatus;
  const queueMinutes = safeQueueMinutes(poi.queueMinutes);
  if (poi.reservationAvailable && queueMinutes <= 8) return "available";
  if (!poi.reservationAvailable && queueMinutes >= 15) return "full";
  if (!poi.reservationAvailable || queueMinutes >= 10) return "limited";
  return "available";
}

function deriveExecutionCapabilities(poi: ScoredPoi): ExecutionCapability[] {
  if (poi.executionCapabilities?.length) return poi.executionCapabilities;

  if (poi.category === "restaurant") return ["queue", "reservation"];
  if (poi.category === "cafe") return ["reservation"];
  if (isVoucherPoi(poi)) return ["voucher"];
  return [];
}

function supportsCapability(poi: ScoredPoi, capability: ExecutionCapability) {
  return deriveExecutionCapabilities(poi).includes(capability);
}

function hasHotDiningQueueSignals(poi: ScoredPoi) {
  const blob = poiSignalBlob(poi);
  if (QUEUE_DINING_SIGNALS.some((pattern) => pattern.test(blob))) return true;
  return poi.crowdLevel === "high" && safeQueueMinutes(poi.queueMinutes) > 0;
}

function shouldGenerateQueue(poi: ScoredPoi, routePriority: RoutePriorityChoice) {
  if (!supportsCapability(poi, "queue")) return false;
  if (routePriority === "queue") return true;

  const queueMinutes = safeQueueMinutes(poi.queueMinutes);
  if (queueMinutes >= 10) return true;

  if (deriveBookingStatus(poi) === "limited") return true;

  if (hasHotDiningQueueSignals(poi)) return true;

  if (poi.preferredExecution === "queue") return true;

  return false;
}

function shouldGenerateVoucher(poi: ScoredPoi) {
  return supportsCapability(poi, "voucher") || isVoucherPoi(poi) || poi.requiresVoucher === true;
}

function resolvePreferredDiningArtifact(
  poi: ScoredPoi,
  routePriority: RoutePriorityChoice,
  slot: RouteSlot,
  slots: RouteSlot[],
  slotIndex: number,
  travelSettings: TravelSettings,
  seed: string,
): "queue" | "scheduledQueue" | "reservation" | null {
  if (poi.category === "cafe") {
    return supportsCapability(poi, "reservation") ? "reservation" : null;
  }

  if (poi.category === "restaurant") {
    if (shouldGenerateQueue(poi, routePriority)) {
      if (
        shouldScheduleQueueInsteadOfImmediate({
          slot,
          slots,
          slotIndex,
          travelSettings,
        })
      ) {
        return "scheduledQueue";
      }
      return "queue";
    }
    if (supportsCapability(poi, "reservation")) return "reservation";
    if (supportsCapability(poi, "queue")) {
      if (
        shouldScheduleQueueInsteadOfImmediate({
          slot,
          slots,
          slotIndex,
          travelSettings,
        })
      ) {
        return "scheduledQueue";
      }
      return "queue";
    }
  }

  return null;
}

function selectPrimaryExecutionArtifact(artifacts: ExecutionArtifact[]) {
  for (const type of PRIMARY_TYPE_ORDER) {
    const match = artifacts.find((artifact) => artifact.type === type);
    if (match) return match;
  }
  return artifacts[0];
}

function buildArtifactId(poiId: string, type: ExecutionArtifact["type"], slotIndex: number) {
  return `${poiId}-${type}-${slotIndex}`;
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

function buildScheduledQueueArtifact(params: {
  id: string;
  poi: ScoredPoi;
  seed: string;
  slot: RouteSlot;
  slots: RouteSlot[];
  slotIndex: number;
  travelSettings: TravelSettings;
}): ScheduledQueueExecutionArtifact {
  const plannedArrivalTime = resolvePlannedArrivalTime({
    slot: params.slot,
    slots: params.slots,
    slotIndex: params.slotIndex,
    travelSettings: params.travelSettings,
  });
  const leadMinutes = resolveQueueLeadMinutes(params.poi, params.seed);
  const plannedArrivalMinutes = parseTimeToMinutes(plannedArrivalTime) ?? 18 * 60 + 30;
  const scheduledQueueTime = formatMinutesToTime(plannedArrivalMinutes - leadMinutes);
  const queueMinutes = Math.max(10, safeQueueMinutes(params.poi.queueMinutes, 10));

  return {
    id: params.id,
    type: "scheduledQueue",
    title: "已设置自动取号",
    venueName: safeName(params.poi.name, "餐厅"),
    plannedArrivalTime,
    scheduledQueueTime,
    triggerReason: `到店前约 ${leadMinutes} 分钟，且当前排队等待超过 ${queueMinutes} 分钟`,
    statusSteps: [
      { label: "已设置", state: "done" },
      { label: "等待触发", state: "active" },
      { label: "取号成功", state: "pending" },
      { label: "到店确认", state: "pending" },
    ],
    note: "到点后 Agent 将模拟为你取号，并更新排队进度。",
  };
}

function buildQueueArtifact(params: {
  id: string;
  poi: ScoredPoi;
  seed: string;
  travelSettings: TravelSettings;
  partySize: number;
}): QueueExecutionArtifact {
  const queueMinutes = safeQueueMinutes(params.poi.queueMinutes, 15);
  const low = Math.max(8, queueMinutes - 4);
  const high = low + 7;
  const tableType = resolveQueueTableType(safePartySize(params.partySize, params.travelSettings.partySize));
  const letter = resolveQueueLetter(tableType);
  const number = stablePick(params.seed, 2, 18, 99);

  return {
    id: params.id,
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
  id: string;
  poi: ScoredPoi;
  travelSettings: TravelSettings;
  partySize: number;
  seed: string;
}): ReservationExecutionArtifact {
  return {
    id: params.id,
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
  id: string;
  poi: ScoredPoi;
  seed: string;
  receiptIds: Record<string, string>;
  currentPlanLabel: string;
  slotIndex: number;
}): VoucherExecutionArtifact {
  const ticketId =
    params.receiptIds.ticketId ??
    stableMockCode(`${params.seed}-ticket-${params.slotIndex}`);
  const qrPayload = buildQrSeed({
    planLabel: params.currentPlanLabel,
    ticketId,
    orderId: params.receiptIds.orderId,
  });

  return {
    id: params.id,
    type: "voucher",
    title: "已生成核销码",
    venueName: safeName(params.poi.name, "活动场地"),
    code: ticketId,
    qrPayload,
    note: "到店/入场前出示二维码核销。",
  };
}

function buildShareArtifact(params: {
  id: string;
  summary: string;
  shareText: string;
}): ShareExecutionArtifact {
  return {
    id: params.id,
    type: "share",
    title: "已生成可分享计划",
    summary: params.summary,
    shareText: params.shareText.trim() || "已为你整理好行程，出发前可再次确认节点顺序。",
    note: "可复制文案发给同行人，或返回方案继续调整。",
  };
}

function buildSlotArtifact(params: {
  slot: RouteSlot;
  slotIndex: number;
  slots: RouteSlot[];
  baseSeed: string;
  travelSettings: TravelSettings;
  partySize: number;
  currentPlanLabel: string;
  receiptIds: Record<string, string>;
  routePriority: RoutePriorityChoice;
}): ExecutionArtifact | null {
  const poi = params.slot.poi;
  if (!poi) return null;

  const slotSeed = `${params.baseSeed}|${poi.id}|${params.slotIndex}`;

  if (params.slot.slotType === "activity" || params.slot.slotType === "extra") {
    if (shouldGenerateVoucher(poi)) {
      return buildVoucherArtifact({
        id: buildArtifactId(poi.id, "voucher", params.slotIndex),
        poi,
        seed: slotSeed,
        receiptIds: params.receiptIds,
        currentPlanLabel: params.currentPlanLabel,
        slotIndex: params.slotIndex,
      });
    }
    return null;
  }

  if (!isDiningContext(poi, params.slot.slotType)) return null;

  const diningType = resolvePreferredDiningArtifact(
    poi,
    params.routePriority,
    params.slot,
    params.slots,
    params.slotIndex,
    params.travelSettings,
    slotSeed,
  );

  if (diningType === "scheduledQueue") {
    return buildScheduledQueueArtifact({
      id: buildArtifactId(poi.id, "scheduledQueue", params.slotIndex),
      poi,
      seed: slotSeed,
      slot: params.slot,
      slots: params.slots,
      slotIndex: params.slotIndex,
      travelSettings: params.travelSettings,
    });
  }

  if (diningType === "queue") {
    return buildQueueArtifact({
      id: buildArtifactId(poi.id, "queue", params.slotIndex),
      poi,
      seed: slotSeed,
      travelSettings: params.travelSettings,
      partySize: params.partySize,
    });
  }

  if (diningType === "reservation") {
    return buildReservationArtifact({
      id: buildArtifactId(poi.id, "reservation", params.slotIndex),
      poi,
      travelSettings: params.travelSettings,
      partySize: params.partySize,
      seed: slotSeed,
    });
  }

  return null;
}

function buildExecutionArtifactList(params: {
  routePlan: RoutePlan;
  travelSettings: TravelSettings;
  selectedPlanType: SelectedPlanType;
  selectedFallbackIndex: number | null;
  currentPlanLabel: string;
  partySize: number;
  shareText: string;
  planSummary: string;
  receiptIds?: Record<string, string>;
}): ExecutionArtifact[] {
  const slots = resolveActiveSlots(params.routePlan, params.selectedPlanType, params.selectedFallbackIndex);
  const receiptIds = params.receiptIds ?? {};
  const routePriority = params.travelSettings.routePriority;

  const baseSeed = [
    params.currentPlanLabel,
    params.selectedPlanType,
    String(params.selectedFallbackIndex ?? "main"),
    routePriority,
  ].join("|");

  const nodeArtifacts: ExecutionArtifact[] = [];

  slots.forEach((slot, slotIndex) => {
    const artifact = buildSlotArtifact({
      slot,
      slotIndex,
      slots,
      baseSeed,
      travelSettings: params.travelSettings,
      partySize: params.partySize,
      currentPlanLabel: params.currentPlanLabel,
      receiptIds,
      routePriority,
    });
    if (artifact) nodeArtifacts.push(artifact);
  });

  const shareArtifact = buildShareArtifact({
    id: `${params.currentPlanLabel}-share`,
    summary: params.planSummary || "已按当前方案生成可执行行程。",
    shareText: params.shareText,
  });

  if (nodeArtifacts.length === 0) {
    return [shareArtifact];
  }

  return [...nodeArtifacts, shareArtifact];
}

function bundleExecutionArtifacts(artifacts: ExecutionArtifact[]): ExecutionArtifactsResult {
  const primary = selectPrimaryExecutionArtifact(artifacts);
  return Object.assign(artifacts, primary) as ExecutionArtifactsResult;
}

export function getExecutionArtifactPrimaryActionLabel(type: ExecutionArtifact["type"]) {
  if (type === "queue" || type === "scheduledQueue" || type === "reservation" || type === "voucher") {
    return "查看路线";
  }
  return "查看最终行程";
}

export function pickPrimaryExecutionArtifact(artifacts: ExecutionArtifact[]) {
  return selectPrimaryExecutionArtifact(artifacts);
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
}): ExecutionArtifactsResult {
  return bundleExecutionArtifacts(buildExecutionArtifactList(params));
}

/** @internal for tests */
export const executionArtifactRules = {
  isVoucherPoi,
  isDiningContext,
  deriveBookingStatus,
  deriveExecutionCapabilities,
  shouldGenerateQueue,
  shouldGenerateVoucher,
  shouldScheduleQueueInsteadOfImmediate,
  resolvePlannedArrivalTime,
  resolveMinutesUntilArrival,
  buildExecutionArtifactList,
};
