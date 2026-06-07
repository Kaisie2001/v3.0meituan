"use client";

import { getPersonaConfig } from "@/lib/persona";
import type { ItineraryPlan, ParseResult, RoutePlan, ScoredPoi } from "@/lib/types";

export type SheetTab = "main" | "fallback" | "poi";

type BottomPlanSheetProps = {
  routePlan: RoutePlan;
  rankedPois: ScoredPoi[];
  parseResult: ParseResult;
  selectedPoi?: ScoredPoi;
  activeTab: SheetTab;
  onTabChange: (tab: SheetTab) => void;
  onConfirmExecute?: () => void;
};

const slotTypeLabel = {
  activity: "活动",
  food: "用餐",
  extra: "饭后活动",
};

const tabs: { id: SheetTab; label: string }[] = [
  { id: "main", label: "主方案" },
  { id: "fallback", label: "备选方案" },
  { id: "poi", label: "推荐点" },
];

const levelLabel = {
  green: "高度推荐",
  yellow: "可选",
  red: "不建议",
  gray: "不可用",
};

function MainTabContent({
  routePlan,
  rankedPois,
  parseResult,
  onConfirmExecute,
  onViewFallback,
}: {
  routePlan: RoutePlan;
  rankedPois: ScoredPoi[];
  parseResult: ParseResult;
  onConfirmExecute?: () => void;
  onViewFallback: () => void;
}) {
  const topPoi = rankedPois[0];
  const slots = routePlan.mainPlan?.slots.slice(0, 3) ?? [];
  const personaConfig = getPersonaConfig(parseResult);
  const score = topPoi?.goabilityScore ?? 0;

  return (
    <>
      <div className="min-w-0">
        <p className="text-[11px] font-bold text-black/45">AI 推荐最佳方案</p>
        <h2 className="mt-0.5 truncate text-base font-extrabold text-meituan-ink">{personaConfig.planTitle}</h2>
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
        {slots.length ? (
          slots.map((slot) => (
            <div key={`${slot.slotType}-${slot.startTime}`} className="flex items-center gap-2 rounded-lg bg-meituan-gray/80 px-2.5 py-2">
              <span className="w-[72px] shrink-0 text-[10px] font-bold text-black/50">
                {slot.startTime}-{slot.endTime}
              </span>
              <span className="rounded-full bg-meituan-yellow/70 px-1.5 py-0.5 text-[10px] font-bold text-meituan-ink">
                {slotTypeLabel[slot.slotType]}
              </span>
              <span className="min-w-0 truncate text-xs font-bold text-black/78">{slot.poi?.name ?? "待定地点"}</span>
            </div>
          ))
        ) : (
          <p className="rounded-lg bg-meituan-gray/70 px-2.5 py-2 text-xs text-black/55">暂无路线节点</p>
        )}
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
          onClick={onViewFallback}
        >
          查看备选方案
        </button>
      </div>
    </>
  );
}

function FallbackCard({ plan }: { plan: ItineraryPlan }) {
  const foodSlot = plan.slots.find((slot) => slot.slotType === "food");
  const riskNotes = plan.slots.flatMap((slot) => slot.riskNotes).slice(0, 2);

  return (
    <div className="rounded-lg border border-black/8 bg-meituan-gray/60 p-3">
      <p className="text-sm font-extrabold text-meituan-ink">{plan.title}</p>
      {plan.trigger ? <p className="mt-1 text-xs text-black/55">触发：{plan.trigger}</p> : null}
      <p className="mt-2 text-xs leading-5 text-black/65">
        替换为 {foodSlot?.poi?.name ?? plan.title}，保留整体节奏，减少临时改约成本。
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] font-bold text-black/55">
        <span className="rounded-full bg-white px-2 py-0.5">耗时 {plan.totalMinutes} 分钟</span>
        <span className="rounded-full bg-white px-2 py-0.5">等待 {plan.totalWaitMinutes} 分钟</span>
        <span className="rounded-full bg-white px-2 py-0.5">预算 {plan.totalBudget} 元</span>
      </div>
      {plan.diffFromMain ? (
        <p className="mt-2 text-[11px] text-black/50">
          较主方案：预算 {plan.diffFromMain.deltaBudget >= 0 ? "+" : ""}
          {plan.diffFromMain.deltaBudget} 元 · 等待 {plan.diffFromMain.deltaWaitMinutes >= 0 ? "+" : ""}
          {plan.diffFromMain.deltaWaitMinutes} 分钟 · 通勤 {plan.diffFromMain.deltaCommuteMinutes >= 0 ? "+" : ""}
          {plan.diffFromMain.deltaCommuteMinutes} 分钟
        </p>
      ) : null}
      {riskNotes.length ? (
        <p className="mt-2 rounded-md bg-rose-50 px-2 py-1.5 text-[11px] text-rose-800">风险：{riskNotes.join(" / ")}</p>
      ) : null}
      <button type="button" className="mt-3 w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-xs font-bold text-black/62">
        选择此备选
      </button>
    </div>
  );
}

function FallbackTabContent({ routePlan }: { routePlan: RoutePlan }) {
  const fallbackPlans = routePlan.fallbackPlans ?? [];

  if (!fallbackPlans.length) {
    return <p className="py-6 text-center text-sm text-black/55">暂无备选方案</p>;
  }

  return (
    <div className="space-y-2">
      {fallbackPlans.map((plan) => (
        <FallbackCard key={plan.id} plan={plan} />
      ))}
    </div>
  );
}

function PoiTabContent({ poi, parseResult, mapSelected }: { poi: ScoredPoi; parseResult: ParseResult; mapSelected: boolean }) {
  const personaReason = getPersonaConfig(parseResult).poiReason;
  const sceneReasons = [personaReason, ...poi.reasons.filter((reason) => reason !== personaReason)].slice(0, 3);

  return (
    <>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate text-base font-extrabold text-meituan-ink">{poi.name}</h3>
          <p className="mt-0.5 text-xs text-black/55">
            {poi.category} · 评分 {poi.rating}
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-meituan-yellow/25 px-2 py-0.5 text-[10px] font-bold text-meituan-ink">
          {levelLabel[poi.level]}
        </span>
      </div>

      {!mapSelected ? <p className="mt-2 text-[11px] text-black/45">点击地图上的点位可切换查看</p> : null}

      <div className="mt-3 grid grid-cols-4 gap-1.5 text-center text-[10px] text-black/55">
        <div className="rounded-lg bg-meituan-yellow/75 px-1 py-2">
          <b className="block text-base text-meituan-ink">{poi.goabilityScore}</b>
          成行分
        </div>
        <div className="rounded-lg bg-meituan-gray px-1 py-2">
          <b className="block text-base text-meituan-ink">{poi.sceneFitScore}</b>
          场景匹配
        </div>
        <div className="rounded-lg bg-meituan-gray px-1 py-2">
          <b className="block text-base text-meituan-ink">{poi.availabilityScore}</b>
          动态可行
        </div>
        <div className="rounded-lg bg-meituan-gray px-1 py-2">
          <b className="block text-base text-meituan-ink">{poi.routeScore}</b>
          路线衔接
        </div>
      </div>

      <div className="mt-3">
        <p className="mb-1 text-xs font-extrabold text-black/70">场景匹配</p>
        <ul className="space-y-1">
          {sceneReasons.map((reason) => (
            <li key={reason} className="rounded-lg bg-meituan-gray/70 px-2.5 py-1.5 text-xs text-black/65">
              {reason}
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-3">
        <p className="mb-1 text-xs font-extrabold text-black/70">动态可行性</p>
        <p className="rounded-lg bg-meituan-gray/70 px-2.5 py-1.5 text-xs text-black/65">
          ETA {poi.routeEtaMinutes} 分钟 · 排队 {poi.queueMinutes} 分钟 · 人均 {poi.pricePerPerson} 元
          {poi.reservationAvailable ? " · 当前可订" : ""}
        </p>
      </div>

      {poi.risks.length ? (
        <div className="mt-3">
          <p className="mb-1 text-xs font-extrabold text-black/70">风险提示</p>
          <ul className="space-y-1">
            {poi.risks.slice(0, 3).map((risk) => (
              <li key={risk} className="rounded-lg bg-rose-50 px-2.5 py-1.5 text-xs text-rose-800">
                {risk}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </>
  );
}

export function BottomPlanSheet({
  routePlan,
  rankedPois,
  parseResult,
  selectedPoi,
  activeTab,
  onTabChange,
  onConfirmExecute,
}: BottomPlanSheetProps) {
  const displayPoi = selectedPoi ?? rankedPois[0];

  return (
    <div className="pointer-events-auto flex min-h-[280px] w-full flex-col overflow-hidden">
      <div className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-black/12" aria-hidden="true" />

      <div className="flex shrink-0 gap-1 border-b border-black/6 px-3 pb-0 pt-1">
        {tabs.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange(tab.id)}
              className={`flex-1 rounded-t-lg px-2 py-2 text-xs font-bold transition ${
                active ? "bg-meituan-yellow/20 text-meituan-ink" : "text-black/45 hover:text-black/65"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 pt-3">
        {activeTab === "main" ? (
          <MainTabContent
            routePlan={routePlan}
            rankedPois={rankedPois}
            parseResult={parseResult}
            onConfirmExecute={onConfirmExecute}
            onViewFallback={() => onTabChange("fallback")}
          />
        ) : null}

        {activeTab === "fallback" ? <FallbackTabContent routePlan={routePlan} /> : null}

        {activeTab === "poi" ? (
          displayPoi ? (
            <PoiTabContent poi={displayPoi} parseResult={parseResult} mapSelected={Boolean(selectedPoi)} />
          ) : (
            <p className="py-6 text-center text-sm text-black/55">暂无推荐点详情</p>
          )
        ) : null}
      </div>
    </div>
  );
}
