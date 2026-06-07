"use client";

import { MockQrCode, buildQrSeed } from "@/components/MockQrCode";
import { buildTravelSettingsSummary, getDateLabel, type TravelSettings } from "@/lib/preferenceSummary";
import type { RoutePlan, RouteSlot } from "@/lib/types";
import type { SelectedPlanType } from "@/lib/executionContext";

export type BookingVoucherModel = {
  planLabel: string;
  isFallback: boolean;
  travelSummary: string;
  venueName: string;
  secondaryVenue?: string;
  partySize: number;
  reservationTime: string;
  primaryCredential: string;
  reservationId?: string;
  orderId?: string;
  ticketId?: string;
  qrSeed: string;
};

function hashSeed(seed: string) {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function stableMockId(prefix: string, seed: string) {
  const num = (hashSeed(seed) % 9000) + 1000;
  return `${prefix}-${num}`;
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

function pickVenueNames(slots: RouteSlot[], routePlan: RoutePlan) {
  const foodSlot = slots.find((slot) => slot.slotType === "food");
  const activitySlot = slots.find((slot) => slot.slotType === "activity");
  const extraSlot = slots.find((slot) => slot.slotType === "extra");

  const venueName =
    foodSlot?.poi?.name ??
    activitySlot?.poi?.name ??
    routePlan.restaurant?.name ??
    routePlan.activity?.name ??
    "预约地点";

  const secondaryVenue =
    activitySlot?.poi?.name && foodSlot?.poi?.name && activitySlot.poi.name !== foodSlot.poi.name
      ? activitySlot.poi.name
      : extraSlot?.poi?.name;

  return { venueName, secondaryVenue };
}

function formatReservationTime(travelSettings: TravelSettings) {
  const dateLabel = getDateLabel(travelSettings.date);
  const time = travelSettings.startTime?.trim() || "14:00";
  return `${dateLabel} ${time}`;
}

function resolveCredentialIds(
  receiptIds: Record<string, string>,
  seed: string,
): Pick<BookingVoucherModel, "reservationId" | "orderId" | "ticketId" | "primaryCredential"> {
  const reservationId = receiptIds.reservationId ?? stableMockId("RSV", `${seed}-rsv`);
  const orderId = receiptIds.orderId ?? stableMockId("ORD", `${seed}-ord`);
  const ticketId = receiptIds.ticketId;

  const primaryCredential = `凭证号：${reservationId || orderId || ticketId || stableMockId("RSV", seed)}`;

  return { reservationId, orderId, ticketId, primaryCredential };
}

export function buildBookingVoucherModel(params: {
  routePlan: RoutePlan;
  travelSettings: TravelSettings;
  selectedPlanType: SelectedPlanType;
  selectedFallbackIndex: number | null;
  currentPlanLabel: string;
  partySize: number;
  receiptIds: Record<string, string>;
}): BookingVoucherModel {
  const slots = resolveActiveSlots(params.routePlan, params.selectedPlanType, params.selectedFallbackIndex);
  const { venueName, secondaryVenue } = pickVenueNames(slots, params.routePlan);
  const travelSummary = buildTravelSettingsSummary(params.travelSettings) || "按当前出行设置执行";
  const reservationTime = formatReservationTime(params.travelSettings);
  const partySize =
    typeof params.partySize === "number" && Number.isFinite(params.partySize) && params.partySize > 0
      ? params.partySize
      : params.travelSettings.partySize;

  const seed = [
    params.currentPlanLabel,
    params.selectedPlanType,
    String(params.selectedFallbackIndex ?? "main"),
    venueName,
    travelSummary,
  ].join("|");

  const credentials = resolveCredentialIds(params.receiptIds, seed);

  return {
    planLabel: params.currentPlanLabel,
    isFallback: params.selectedPlanType === "fallback",
    travelSummary,
    venueName,
    secondaryVenue,
    partySize,
    reservationTime,
    ...credentials,
    qrSeed: buildQrSeed({
      planLabel: params.currentPlanLabel,
      reservationId: credentials.reservationId,
      orderId: credentials.orderId,
      ticketId: credentials.ticketId,
    }),
  };
}

type BookingVoucherCardProps = {
  voucher: BookingVoucherModel;
};

export function BookingVoucherCard({ voucher }: BookingVoucherCardProps) {
  return (
    <div className="mt-4 overflow-hidden rounded-2xl border border-emerald-200/80 bg-white shadow-sm">
      <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="grid h-6 w-6 place-items-center rounded-full bg-white/20 text-xs font-bold text-white">✓</span>
          <div>
            <p className="text-sm font-extrabold text-white">预订成功</p>
            <p className="text-[11px] font-semibold text-emerald-50">到店出示二维码核销 / 确认预约</p>
          </div>
        </div>
      </div>

      <div className="space-y-3 px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-meituan-yellow/25 px-2.5 py-0.5 text-[10px] font-bold text-meituan-ink">
            已锁定名额
          </span>
          <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700">
            已生成预约凭证
          </span>
        </div>

        <div className="space-y-1.5 text-[11px] leading-5 text-black/62">
          <p>
            <span className="font-bold text-black/70">执行方案：</span>
            {voucher.planLabel}
          </p>
          {voucher.isFallback ? (
            <p className="rounded-md bg-amber-50 px-2 py-1 font-semibold text-amber-900">已按备选方案完成预约确认。</p>
          ) : null}
          <p>
            <span className="font-bold text-black/70">出行时间：</span>
            {voucher.travelSummary}
          </p>
          <p>
            <span className="font-bold text-black/70">预约地点：</span>
            {voucher.venueName}
          </p>
          {voucher.secondaryVenue ? (
            <p>
              <span className="font-bold text-black/70">活动节点：</span>
              {voucher.secondaryVenue}
            </p>
          ) : null}
          <p>
            <span className="font-bold text-black/70">人数：</span>
            {voucher.partySize} 人
          </p>
          <p>
            <span className="font-bold text-black/70">预约时间：</span>
            {voucher.reservationTime}
          </p>
        </div>

        <div className="rounded-lg bg-meituan-gray/60 px-3 py-2 text-[11px] font-bold text-black/65">{voucher.primaryCredential}</div>

        <div className="flex flex-wrap gap-1.5 text-[10px] font-bold text-black/50">
          {voucher.reservationId ? <span>{voucher.reservationId}</span> : null}
          {voucher.orderId ? <span>{voucher.orderId}</span> : null}
          {voucher.ticketId ? <span>{voucher.ticketId}</span> : null}
        </div>

        <MockQrCode seed={voucher.qrSeed} className="py-1" />

        <p className="text-center text-[10px] leading-5 text-black/45">请于预约时间前后 15 分钟内到店确认</p>
      </div>
    </div>
  );
}

export function appendVoucherShareLine(shareText: string) {
  const line = "我这边已经生成预约凭证，到店出示二维码即可。";
  if (!shareText.trim()) return line;
  if (shareText.includes(line)) return shareText;
  return `${shareText.trim()} ${line}`;
}
