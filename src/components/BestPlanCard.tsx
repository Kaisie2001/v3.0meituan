"use client";

import { getPersonaConfig } from "@/lib/persona";
import type { ParseResult, RoutePlan, ScoredPoi } from "@/lib/types";

type BestPlanCardProps = {
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

function buildPlanReasons(routePlan: RoutePlan, topPoi?: ScoredPoi) {
  const reasons = ["更符合本次出行画像，而不是单纯按评分排序"];

  if ((routePlan.mainPlan?.slots.length ?? 0) >= 2) reasons.unshift("路线顺，不需要频繁折返");
  if (routePlan.restaurant?.reservationAvailable || topPoi?.reservationAvailable) {
    reasons.push("当前可订座，等待风险较低");
  } else if (routePlan.totalWaitMinutes <= 15) {
    reasons.push("等待风险较低，适合直接出发");
  }
  if ((routePlan.fallbackPlans?.length ?? 0) > 0) reasons.push("备选方案已准备好，满座或排队时可替换");

  return reasons.slice(0, 4);
}

export function BestPlanCard({ routePlan, rankedPois, parseResult, onViewDetails, onConfirmExecute }: BestPlanCardProps) {
  const topPoi = rankedPois[0];
  const slots = routePlan.mainPlan?.slots.slice(0, 4) ?? [];
  const personaConfig = getPersonaConfig(parseResult);
  const reasons = buildPlanReasons(routePlan, topPoi);
  const score = topPoi?.goabilityScore ?? 0;

  return (
    <section className="rounded-lg border border-meituan-yellow/40 bg-white p-3 shadow-soft">
      <div className="flex flex-col gap-3">
        <div>
          <p className="text-xs font-bold text-black/45">AI 推荐最佳方案</p>
          <h2 className="mt-1 text-xl font-extrabold tracking-normal text-meituan-ink">{personaConfig.planTitle}</h2>
          <p className="mt-2 text-sm leading-6 text-black/62">先看结论：这是当前最适合直接出发的一套安排，后面仍保留地图、路线和备选细节。</p>
        </div>
        <div className="grid grid-cols-4 gap-2 text-center text-xs">
          <div className="rounded-lg bg-meituan-yellow/80 p-3">
            <b className="block text-lg text-meituan-ink">{score}</b>
            成行分
          </div>
          <div className="rounded-lg bg-meituan-gray p-3">
            <b className="block text-lg text-meituan-ink">{routePlan.totalMinutes}</b>
            分钟
          </div>
          <div className="rounded-lg bg-meituan-gray p-3">
            <b className="block text-lg text-meituan-ink">{routePlan.totalBudget}</b>
            元预算
          </div>
          <div className="rounded-lg bg-meituan-gray p-3">
            <b className="block text-lg text-meituan-ink">{routePlan.totalWaitMinutes}</b>
            分等待
          </div>
        </div>
      </div>

      <div className="mt-3 grid gap-3">
        <div className="rounded-lg bg-meituan-gray p-3">
          <p className="mb-3 text-sm font-extrabold text-black/78">路线节点</p>
          <div className="space-y-2">
            {slots.map((slot) => (
              <div key={`${slot.slotType}-${slot.startTime}`} className="flex items-center gap-3 rounded-lg bg-white px-3 py-2">
                <span className="w-24 shrink-0 text-xs font-bold text-black/55">
                  {slot.startTime}-{slot.endTime}
                </span>
                <span className="rounded-full bg-meituan-yellow/70 px-2 py-1 text-xs font-bold text-meituan-ink">{slotTypeLabel[slot.slotType]}</span>
                <span className="min-w-0 truncate text-sm font-bold text-black/78">{slot.poi?.name ?? "待定地点"}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg bg-meituan-gray p-3">
          <div className="space-y-4">
            <div>
              <p className="mb-3 text-sm font-extrabold text-black/78">为什么适合你这次</p>
              <ul className="space-y-2 text-sm text-black/68">
                {personaConfig.bestPlanReasons.slice(0, 3).map((reason) => (
                  <li key={reason} className="rounded-lg bg-white px-3 py-2">
                    {reason}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="mb-3 text-sm font-extrabold text-black/78">为什么推荐</p>
              <ul className="space-y-2 text-sm text-black/68">
                {reasons.slice(0, 3).map((reason) => (
                  <li key={reason} className="rounded-lg bg-white px-3 py-2">
                    {reason}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-2">
        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            className="rounded-lg bg-meituan-yellow px-5 py-3 text-sm font-extrabold text-meituan-ink transition hover:brightness-95"
            onClick={onConfirmExecute}
          >
            确认并执行
          </button>
          <button
            type="button"
            className="rounded-lg border border-black/10 bg-white px-5 py-3 text-sm font-bold text-black/62 hover:bg-black/5"
            onClick={onViewDetails}
          >
            查看地图与备选
          </button>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <button type="button" className="rounded-lg border border-black/10 bg-white px-5 py-3 text-sm font-bold text-black/62 hover:bg-black/5">
            换一个更近的
          </button>
          <button type="button" className="rounded-lg border border-black/10 bg-white px-5 py-3 text-sm font-bold text-black/62 hover:bg-black/5">
            避开排队
          </button>
        </div>
      </div>
    </section>
  );
}
