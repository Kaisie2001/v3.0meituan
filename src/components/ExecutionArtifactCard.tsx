"use client";

import { MockQrCode } from "@/components/MockQrCode";
import type { ExecutionArtifact } from "@/lib/executionArtifacts";

type ExecutionArtifactCardProps = {
  artifact: ExecutionArtifact;
  compactTop?: boolean;
  onCancelQueue?: () => void;
};

export function ExecutionArtifactCard({ artifact, compactTop = false, onCancelQueue }: ExecutionArtifactCardProps) {
  const topSpacing = compactTop ? "mt-0" : "mt-3";
  if (artifact.type === "queue") {
    const queueLabel = `${artifact.queueTableType} ${artifact.queueNumber}`;

    return (
      <div data-testid="execution-artifact-queue" className={`${topSpacing} overflow-hidden rounded-xl border border-black/8 bg-white`}>
        <div className="border-b border-black/6 px-3 py-2.5">
          <p className="text-sm font-extrabold text-meituan-ink">{artifact.title}</p>
        </div>

        <div className="space-y-3 px-3 py-3">
          <div className="rounded-xl bg-gradient-to-br from-meituan-yellow/25 via-orange-50 to-white px-3 py-3">
            <div className="flex items-center justify-between gap-2 text-[10px] text-black/45">
              <span>取号时间 {artifact.queueStartedAt}</span>
              <span className="rounded-full bg-orange-100 px-2 py-0.5 font-bold text-orange-700">待叫号</span>
            </div>
            <p
              data-testid="execution-queue-number"
              className="mt-2 text-[28px] font-extrabold leading-none tracking-wide text-meituan-ink"
            >
              {queueLabel}
            </p>
            <p data-testid="execution-queue-ahead-count" className="mt-2 text-sm font-bold text-black/70">
              还需等待 {artifact.aheadCount} 桌
            </p>
            <p className="mt-1 text-xs text-black/55">
              预计等待 <span className="font-bold text-black/70">{artifact.estimatedWaitMinutes}</span>
            </p>
          </div>

          <div data-testid="execution-queue-progress">
            <div className="flex items-center gap-1">
              {artifact.statusSteps.map((step) => (
                <div key={step.label} className="min-w-0 flex-1">
                  <div
                    className={`h-1.5 rounded-full ${
                      step.state === "done"
                        ? "bg-meituan-yellow"
                        : step.state === "active"
                          ? "bg-gradient-to-r from-meituan-yellow to-orange-400"
                          : "bg-black/8"
                    }`}
                  />
                </div>
              ))}
            </div>
            <div className="mt-1.5 flex justify-between gap-1">
              {artifact.statusSteps.map((step) => (
                <p
                  key={`${step.label}-label`}
                  className={`min-w-0 flex-1 text-center text-[10px] leading-4 ${
                    step.state === "active"
                      ? "font-extrabold text-orange-700"
                      : step.state === "done"
                        ? "font-semibold text-meituan-ink"
                        : "text-black/35"
                  }`}
                >
                  {step.label}
                </p>
              ))}
            </div>
          </div>

          <div className="space-y-1.5 rounded-lg bg-meituan-gray/45 px-2.5 py-2 text-xs text-black/62">
            <p>
              <span className="font-bold text-black/70">餐厅：</span>
              {artifact.venueName}
            </p>
            <p>
              <span className="font-bold text-black/70">取号时间：</span>
              {artifact.queueStartedAt}
            </p>
            <p>
              <span className="font-bold text-black/70">手机号：</span>
              {artifact.phoneMasked}
            </p>
            <p>
              <span className="font-bold text-black/70">进度通知：</span>
              {artifact.notificationEnabled ? "已开启" : "未开启"}
            </p>
          </div>

          <p className="text-[11px] leading-4 text-amber-900/85">{artifact.cancelHint}</p>
          <p className="rounded-lg bg-meituan-gray/40 px-2.5 py-2 text-[10px] leading-4 text-black/48">
            商家说明：{artifact.merchantNote}
          </p>
          {onCancelQueue ? (
            <button
              type="button"
              data-testid="execution-cancel-queue-button"
              className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-xs font-bold text-black/60 transition hover:bg-meituan-gray/50"
              onClick={onCancelQueue}
            >
              取消排队
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  if (artifact.type === "scheduledQueue") {
    return (
      <div
        data-testid="execution-artifact-scheduled-queue"
        className={`${topSpacing} overflow-hidden rounded-xl border border-black/8 bg-white`}
      >
        <div className="border-b border-black/6 px-3 py-2.5">
          <p className="text-sm font-extrabold text-meituan-ink">{artifact.title}</p>
        </div>

        <div className="space-y-3 px-3 py-3">
          <div className="rounded-xl bg-gradient-to-br from-sky-50 via-meituan-yellow/15 to-white px-3 py-3">
            <p className="text-[10px] font-bold text-black/45">自动取号任务</p>
            <p className="mt-2 text-lg font-extrabold text-meituan-ink">{artifact.venueName}</p>
            <div className="mt-3 space-y-1.5 text-xs text-black/62">
              <p>
                <span className="font-bold text-black/70">计划到店：</span>
                {artifact.plannedArrivalTime}
              </p>
              <p>
                <span className="font-bold text-black/70">预计取号：</span>
                {artifact.scheduledQueueTime}
              </p>
              <p>
                <span className="font-bold text-black/70">触发条件：</span>
                {artifact.triggerReason}
              </p>
            </div>
          </div>

          <div data-testid="execution-scheduled-queue-progress">
            <div className="flex items-center gap-1">
              {artifact.statusSteps.map((step) => (
                <div key={step.label} className="min-w-0 flex-1">
                  <div
                    className={`h-1.5 rounded-full ${
                      step.state === "done"
                        ? "bg-meituan-yellow"
                        : step.state === "active"
                          ? "bg-gradient-to-r from-meituan-yellow to-sky-400"
                          : "bg-black/8"
                    }`}
                  />
                </div>
              ))}
            </div>
            <div className="mt-1.5 flex justify-between gap-1">
              {artifact.statusSteps.map((step) => (
                <p
                  key={`${step.label}-label`}
                  className={`min-w-0 flex-1 text-center text-[10px] leading-4 ${
                    step.state === "active"
                      ? "font-extrabold text-sky-700"
                      : step.state === "done"
                        ? "font-semibold text-meituan-ink"
                        : "text-black/35"
                  }`}
                >
                  {step.label}
                </p>
              ))}
            </div>
          </div>

          <p className="rounded-lg bg-meituan-gray/40 px-2.5 py-2 text-[10px] leading-4 text-black/48">{artifact.note}</p>
        </div>
      </div>
    );
  }

  if (artifact.type === "scheduledReservation") {
    return (
      <div
        data-testid="execution-artifact-scheduled-reservation"
        className={`${topSpacing} overflow-hidden rounded-xl border border-black/8 bg-white`}
      >
        <div className="border-b border-black/6 px-3 py-2.5">
          <p className="text-sm font-extrabold text-meituan-ink">{artifact.title}</p>
        </div>

        <div className="space-y-3 px-3 py-3">
          <div className="rounded-xl bg-gradient-to-br from-violet-50 via-meituan-yellow/15 to-white px-3 py-3">
            <p className="text-[10px] font-bold text-black/45">自动预约任务</p>
            <p className="mt-2 text-lg font-extrabold text-meituan-ink">{artifact.venueName}</p>
            <div className="mt-3 space-y-1.5 text-xs text-black/62">
              <p>
                <span className="font-bold text-black/70">计划到店：</span>
                {artifact.plannedArrivalTime}
              </p>
              <p>
                <span className="font-bold text-black/70">预计提交预约：</span>
                {artifact.scheduledBookingTime}
              </p>
              <p>
                <span className="font-bold text-black/70">人数：</span>
                {artifact.partySize} 人
              </p>
              <p>
                <span className="font-bold text-black/70">触发条件：</span>
                {artifact.triggerReason}
              </p>
            </div>
          </div>

          <div data-testid="execution-scheduled-reservation-progress">
            <div className="flex items-center gap-1">
              {artifact.statusSteps.map((step) => (
                <div key={step.label} className="min-w-0 flex-1">
                  <div
                    className={`h-1.5 rounded-full ${
                      step.state === "done"
                        ? "bg-meituan-yellow"
                        : step.state === "active"
                          ? "bg-gradient-to-r from-meituan-yellow to-violet-400"
                          : "bg-black/8"
                    }`}
                  />
                </div>
              ))}
            </div>
            <div className="mt-1.5 flex justify-between gap-1">
              {artifact.statusSteps.map((step) => (
                <p
                  key={`${step.label}-label`}
                  className={`min-w-0 flex-1 text-center text-[10px] leading-4 ${
                    step.state === "active"
                      ? "font-extrabold text-violet-700"
                      : step.state === "done"
                        ? "font-semibold text-meituan-ink"
                        : "text-black/35"
                  }`}
                >
                  {step.label}
                </p>
              ))}
            </div>
          </div>

          <p className="rounded-lg bg-meituan-gray/40 px-2.5 py-2 text-[10px] leading-4 text-black/48">{artifact.note}</p>
        </div>
      </div>
    );
  }

  if (artifact.type === "voucher") {
    return (
      <div data-testid="execution-artifact-voucher" className={`${topSpacing} overflow-hidden rounded-xl border border-black/8 bg-white`}>
        <div className="bg-meituan-yellow/15 px-3 py-2.5">
          <p className="text-sm font-extrabold text-meituan-ink">{artifact.title}</p>
          <p className="mt-0.5 text-xs text-black/55">{artifact.venueName}</p>
        </div>
        <div className="space-y-2 px-3 py-3">
          <MockQrCode seed={artifact.qrPayload} className="py-1" />
          <p className="text-center text-xs font-bold text-black/60">核销码：{artifact.code}</p>
          <p className="text-center text-[10px] leading-4 text-black/45">{artifact.note}</p>
        </div>
      </div>
    );
  }

  if (artifact.type === "noBookingNeeded") {
    return (
      <div
        data-testid="execution-artifact-no-booking-needed"
        className={`${topSpacing} overflow-hidden rounded-xl border border-black/8 bg-white`}
      >
        <div className="bg-meituan-yellow/15 px-3 py-2.5">
          <p className="text-sm font-extrabold text-meituan-ink">{artifact.title}</p>
        </div>
        <div className="space-y-2 px-3 py-3">
          <p className="text-xs leading-5 text-black/62">{artifact.summary}</p>
          <p className="whitespace-pre-wrap rounded-lg bg-meituan-gray/50 px-2.5 py-2 text-xs leading-5 text-black/55">
            {artifact.shareText}
          </p>
          <p className="text-[10px] leading-4 text-black/42">{artifact.note}</p>
        </div>
      </div>
    );
  }

  return (
    <div data-testid="execution-artifact-share" className={`${topSpacing} overflow-hidden rounded-xl border border-black/8 bg-white`}>
      <div className="bg-meituan-yellow/15 px-3 py-2.5">
        <p className="text-sm font-extrabold text-meituan-ink">{artifact.title}</p>
      </div>
      <div className="space-y-2 px-3 py-3">
        <p className="text-xs leading-5 text-black/62">{artifact.summary}</p>
        <p className="whitespace-pre-wrap rounded-lg bg-meituan-gray/50 px-2.5 py-2 text-xs leading-5 text-black/55">
          {artifact.shareText}
        </p>
        <p className="text-[10px] leading-4 text-black/42">{artifact.note}</p>
      </div>
    </div>
  );
}
