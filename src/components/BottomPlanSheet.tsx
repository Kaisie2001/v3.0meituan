"use client";

import { getPersonaConfig } from "@/lib/persona";
import type { ParseResult, RoutePlan, ScoredPoi } from "@/lib/types";

type BottomPlanSheetProps = {
  routePlan: RoutePlan;
  rankedPois: ScoredPoi[];
  parseResult: ParseResult;
  onViewDetails?: () => void;
  onConfirmExecute?: () => void;
};

const slotTypeLabel = {
  activity: "活动",
  food: "用餐",
  extra: "饭后活动",
};

export function BottomPlanSheet({ routePlan, rankedPois, parseResult, onViewDetails, onConfirmExecute }: BottomPlanSheetProps) {
  const topPoi = rankedPois[0];
  const slots = routePlan.mainPlan?.slots.slice(0, 4) ?? [];
  const personaConfig = getPersonaConfig(parseResult);
  const score = topPoi?.goabilityScore ?? 0;

  return (
    <div className="flex max-h-full flex-col rounded-t-2xl border border-black/6 bg-white shadow-[0_-10px_28px_rgba(15,23,42,0.14)]">
      <div className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-black/12" />
      <div className="overflow-y-auto px-4 pb-4 pt-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wide text-black/45">AI 推荐最佳方案</p>
            <h2 className="mt-0.5 truncate text-base font-extrabold text-meituan-ink">{personaConfig.planTitle}</h2>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-4 gap-1.5 text-center text-[10px] text-black/55">
          <div className="rounded-lg bg-meituan-yellow/75 px-1 py-2">
            <b className="block text-base text-meituan-ink">{score}</b>
            成行分
          </div>
          <div className="rounded-lg bg-meituan-gray px-1 py-2">
            <b className="block text-base text-meituan-ink">{routePlan.totalMinutes}</b>
            分钟
          </div>
          <div className="rounded-lg bg-meituan-gray px-1 py-2">
            <b className="block text-base text-meituan-ink">{routePlan.totalBudget}</b>
            元预算
          </div>
          <div className="rounded-lg bg-meituan-gray px-1 py-2">
            <b className="block text-base text-meituan-ink">{routePlan.totalWaitMinutes}</b>
            分等待
          </div>
        </div>

        <div className="mt-3 space-y-1.5">
          {slots.map((slot) => (
            <div key={`${slot.slotType}-${slot.startTime}`} className="flex items-center gap-2 rounded-lg bg-meituan-gray/80 px-2.5 py-2">
              <span className="w-[72px] shrink-0 text-[10px] font-bold text-black/50">
                {slot.startTime}-{slot.endTime}
              </span>
              <span className="rounded-full bg-meituan-yellow/70 px-1.5 py-0.5 text-[10px] font-bold text-meituan-ink">
                {slotTypeLabel[slot.slotType]}
              </span>
              <span className="min-w-0 truncate text-xs font-bold text-black/78">{slot.poi?.name ?? "待定地点"}</span>
            </div>
          ))}
        </div>

        <div className="mt-3">
          <p className="mb-1.5 text-xs font-extrabold text-black/70">为什么适合你这次</p>
          <ul className="space-y-1">
            {personaConfig.bestPlanReasons.slice(0, 3).map((reason) => (
              <li key={reason} className="rounded-lg bg-meituan-gray/70 px-2.5 py-1.5 text-xs leading-5 text-black/65">
                {reason}
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            className="flex-1 rounded-lg bg-meituan-yellow px-3 py-2.5 text-sm font-extrabold text-meituan-ink transition hover:brightness-95"
            onClick={onConfirmExecute}
          >
            确认并执行
          </button>
          <button
            type="button"
            className="flex-1 rounded-lg border border-black/10 bg-white px-3 py-2.5 text-sm font-bold text-black/62 hover:bg-black/5"
            onClick={onViewDetails}
          >
            查看备选方案
          </button>
        </div>
      </div>
    </div>
  );
}
