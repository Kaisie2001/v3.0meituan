"use client";

import { useEffect, useMemo, useState } from "react";
import { getPersonaConfig, inferPersona } from "@/lib/persona";
import type { ItineraryPlan, ParseResult, RoutePlan, RouteSlot, ScoredPoi } from "@/lib/types";

export type SheetTab = "main" | "fallback" | "poi";
export type SelectedPlanType = "main" | "fallback";

type BottomPlanSheetProps = {
  routePlan: RoutePlan;
  rankedPois: ScoredPoi[];
  parseResult: ParseResult;
  selectedPoi?: ScoredPoi;
  activeTab: SheetTab;
  onTabChange: (tab: SheetTab) => void;
  selectedPlanType: SelectedPlanType;
  selectedFallbackIndex: number | null;
  onSelectMainPlan: () => void;
  onSelectFallbackPlan: (index: number) => void;
  onConfirmExecute?: () => void;
};

type CurrentPlanSummary = {
  usageLabel: string;
  isFallback: boolean;
  planTitle: string;
  triggerNote?: string;
  mapNote?: string;
  score: number | string;
  totalMinutes: number | string;
  totalBudget: number | string;
  totalWaitMinutes: number | string;
  slots: RouteSlot[];
  slotFallbackText?: string;
  reasons: string[];
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

const fallbackPersonaCopy = {
  friends: "这个替代方案离集合点更近，减少等人和临时改约成本。",
  family: "这个替代方案转场更少，更适合带孩子时快速切换。",
  date: "这个替代方案节奏更松，适合保留聊天和散步时间。",
  work: "这个替代方案等待更短，不压缩学习/办公/准备时间。",
  errand: "这个替代方案更顺路，方便先办事再停留或用餐。",
  casual: "这个替代方案更灵活，适合按排队、天气或心情随时替换。",
};

const FALLBACK_SLOT_TEXT = "该备选方案将替换风险较高节点，降低等待或绕路风险。";
const FALLBACK_METRIC_TEXT = "已按备选策略优化";

function formatDelta(value: number, unit: string) {
  if (value === 0) return "与主方案相同";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value} ${unit}`;
}

function formatMetric(value: number | undefined, fallback: number | string): number | string {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return fallback;
}

function buildCurrentPlanSummary(
  routePlan: RoutePlan,
  rankedPois: ScoredPoi[],
  parseResult: ParseResult,
  selectedPlanType: SelectedPlanType,
  selectedFallbackIndex: number | null,
): CurrentPlanSummary {
  const personaConfig = getPersonaConfig(parseResult);
  const topPoi = rankedPois[0];
  const fallbackPlans = routePlan.fallbackPlans ?? [];

  if (selectedPlanType === "fallback" && selectedFallbackIndex !== null) {
    const plan = fallbackPlans[selectedFallbackIndex];
    if (plan) {
      const slots = plan.slots?.slice(0, 3) ?? [];
      const rationaleNotes = plan.slots?.flatMap((slot) => slot.rationaleNotes) ?? [];
      const firstPoiId = slots[0]?.poi?.id;
      const scorePoi = firstPoiId ? rankedPois.find((poi) => poi.id === firstPoiId) : topPoi;

      return {
        usageLabel: `当前使用：${plan.title}`,
        isFallback: true,
        planTitle: plan.title,
        triggerNote: plan.trigger
          ? `因${plan.trigger}，已切换为等待更短的备选。`
          : "因主方案可能排队过长，已切换为等待更短的备选。",
        mapNote: `地图仍显示整体候选路线，当前执行方案已切换为${plan.title}。`,
        score: scorePoi?.goabilityScore ?? topPoi?.goabilityScore ?? "可行",
        totalMinutes: formatMetric(plan.totalMinutes, FALLBACK_METRIC_TEXT),
        totalBudget: formatMetric(plan.totalBudget, FALLBACK_METRIC_TEXT),
        totalWaitMinutes: formatMetric(plan.totalWaitMinutes, FALLBACK_METRIC_TEXT),
        slots,
        slotFallbackText: slots.length ? undefined : FALLBACK_SLOT_TEXT,
        reasons: rationaleNotes.length
          ? rationaleNotes.slice(0, 3)
          : [fallbackPersonaCopy[inferPersona(parseResult)]],
      };
    }
  }

  const mainPlan = routePlan.mainPlan;
  const slots = mainPlan?.slots?.slice(0, 3) ?? [];

  return {
    usageLabel: "当前使用：主方案",
    isFallback: false,
    planTitle: personaConfig.planTitle,
    triggerNote: undefined,
    mapNote: undefined,
    score: topPoi?.goabilityScore ?? 0,
    totalMinutes: formatMetric(mainPlan?.totalMinutes, routePlan.totalMinutes),
    totalBudget: formatMetric(mainPlan?.totalBudget, routePlan.totalBudget),
    totalWaitMinutes: formatMetric(mainPlan?.totalWaitMinutes, routePlan.totalWaitMinutes),
    slots,
    slotFallbackText: slots.length ? undefined : "暂无路线节点",
    reasons: personaConfig.bestPlanReasons.slice(0, 3),
  };
}

function MainTabContent({
  summary,
  switchFeedback,
  onConfirmExecute,
  onViewFallback,
  onSelectMainPlan,
}: {
  summary: CurrentPlanSummary;
  switchFeedback: string | null;
  onConfirmExecute?: () => void;
  onViewFallback: () => void;
  onSelectMainPlan: () => void;
}) {
  return (
    <>
      {switchFeedback ? (
        <p className="mb-3 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800">{switchFeedback}</p>
      ) : null}

      <div className="mb-3 rounded-lg border border-black/8 bg-meituan-gray/50 px-3 py-2.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs font-extrabold text-meituan-ink">{summary.usageLabel}</p>
            {summary.isFallback && summary.triggerNote ? (
              <p className="mt-1 text-[11px] leading-5 text-black/60">{summary.triggerNote}</p>
            ) : null}
          </div>
          {summary.isFallback ? (
            <button
              type="button"
              onClick={onSelectMainPlan}
              className="shrink-0 rounded-lg border border-black/10 bg-white px-2.5 py-1 text-[11px] font-bold text-black/62 hover:bg-black/5"
            >
              恢复主方案
            </button>
          ) : null}
        </div>
        {summary.isFallback && summary.mapNote ? (
          <p className="mt-2 border-t border-black/6 pt-2 text-[11px] leading-5 text-black/50">{summary.mapNote}</p>
        ) : null}
      </div>

      <div className="min-w-0">
        <p className="text-[11px] font-bold text-black/45">{summary.isFallback ? "当前执行方案" : "AI 推荐最佳方案"}</p>
        <h2 className="mt-0.5 truncate text-base font-extrabold text-meituan-ink">{summary.planTitle}</h2>
      </div>

      <div className="mt-3 grid grid-cols-4 gap-1.5 text-center text-[10px] text-black/55">
        <div className="rounded-lg bg-meituan-yellow/75 px-1 py-2">
          <b className="block text-base text-meituan-ink">{summary.score}</b>
          成行分
        </div>
        <div className="rounded-lg bg-meituan-gray px-1 py-2">
          <b className="block text-base text-meituan-ink">{summary.totalMinutes}</b>
          分钟
        </div>
        <div className="rounded-lg bg-meituan-gray px-1 py-2">
          <b className="block text-base text-meituan-ink">{summary.totalBudget}</b>
          元预算
        </div>
        <div className="rounded-lg bg-meituan-gray px-1 py-2">
          <b className="block text-base text-meituan-ink">{summary.totalWaitMinutes}</b>
          分等待
        </div>
      </div>

      <div className="mt-3 space-y-1.5">
        {summary.slots.length ? (
          summary.slots.map((slot) => (
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
          <p className="rounded-lg bg-meituan-gray/70 px-2.5 py-2 text-xs leading-5 text-black/65">
            {summary.slotFallbackText ?? "暂无路线节点"}
          </p>
        )}
      </div>

      <div className="mt-3">
        <p className="mb-1.5 text-xs font-extrabold text-black/70">为什么适合你这次</p>
        <ul className="space-y-1">
          {summary.reasons.map((reason) => (
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

function FallbackCard({
  plan,
  isSelected,
  onViewDetail,
  onSelectPlan,
}: {
  plan: ItineraryPlan;
  isSelected: boolean;
  onViewDetail: () => void;
  onSelectPlan: () => void;
}) {
  const foodSlot = plan.slots.find((slot) => slot.slotType === "food");
  const activitySlot = plan.slots.find((slot) => slot.slotType === "activity");
  const replaceName = foodSlot?.poi?.name ?? activitySlot?.poi?.name ?? plan.title;
  const riskNotes = plan.slots.flatMap((slot) => slot.riskNotes).slice(0, 1);
  const diff = plan.diffFromMain;

  return (
    <div className={`rounded-lg border p-3 ${isSelected ? "border-meituan-yellow bg-meituan-yellow/10" : "border-black/8 bg-meituan-gray/60"}`}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-extrabold text-meituan-ink">{plan.title}</p>
        {isSelected ? (
          <span className="shrink-0 rounded-full bg-meituan-yellow px-2 py-0.5 text-[10px] font-bold text-meituan-ink">已选择</span>
        ) : null}
      </div>
      {plan.trigger ? <p className="mt-1 text-xs text-black/55">触发：{plan.trigger}</p> : null}
      <p className="mt-2 text-xs leading-5 text-black/65">替换节点：{replaceName}</p>
      <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] font-bold text-black/55">
        <span className="rounded-full bg-white px-2 py-0.5">耗时 {formatMetric(plan.totalMinutes, FALLBACK_METRIC_TEXT)} 分钟</span>
        <span className="rounded-full bg-white px-2 py-0.5">等待 {formatMetric(plan.totalWaitMinutes, FALLBACK_METRIC_TEXT)} 分钟</span>
        <span className="rounded-full bg-white px-2 py-0.5">预算 {formatMetric(plan.totalBudget, FALLBACK_METRIC_TEXT)} 元</span>
      </div>
      {diff ? (
        <p className="mt-2 text-[11px] text-black/50">
          较主方案：{formatDelta(diff.deltaWaitMinutes, "分钟等待")} · {formatDelta(diff.deltaBudget, "元预算")}
        </p>
      ) : null}
      {riskNotes.length ? (
        <p className="mt-2 rounded-md bg-rose-50 px-2 py-1.5 text-[11px] text-rose-800">风险：{riskNotes[0]}</p>
      ) : null}
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={onSelectPlan}
          disabled={isSelected}
          className="flex-1 rounded-lg bg-meituan-yellow px-3 py-2 text-xs font-extrabold text-meituan-ink transition hover:brightness-95 disabled:cursor-default disabled:opacity-70"
        >
          {isSelected ? "已选择" : "选择此方案"}
        </button>
        <button
          type="button"
          onClick={onViewDetail}
          className="rounded-lg border border-black/10 bg-white px-3 py-2 text-xs font-bold text-black/62 hover:bg-black/5"
        >
          详情
        </button>
      </div>
    </div>
  );
}

function FallbackDetailContent({
  plan,
  parseResult,
  mainPlanMinutes,
  isSelected,
  onBack,
  onSelectPlan,
}: {
  plan: ItineraryPlan;
  parseResult: ParseResult;
  mainPlanMinutes?: number;
  isSelected: boolean;
  onBack: () => void;
  onSelectPlan: () => void;
}) {
  const personaType = inferPersona(parseResult);
  const personaLine = fallbackPersonaCopy[personaType];
  const riskNotes = plan.slots.flatMap((slot) => slot.riskNotes);
  const rationaleNotes = plan.slots.flatMap((slot) => slot.rationaleNotes);
  const diff = plan.diffFromMain;

  return (
    <>
      <button
        type="button"
        onClick={onBack}
        className="mb-3 flex items-center gap-1 text-sm font-bold text-black/62 transition hover:text-black/85"
      >
        <span aria-hidden="true">←</span>
        返回备选列表
      </button>

      <h3 className="text-base font-extrabold text-meituan-ink">{plan.title}</h3>

      <div className="mt-3 space-y-3">
        <div className="rounded-lg bg-meituan-gray/70 px-3 py-2.5">
          <p className="text-xs font-extrabold text-black/70">触发原因</p>
          <p className="mt-1 text-xs leading-5 text-black/65">{plan.trigger ?? "主方案临时不可行时启用"}</p>
        </div>

        <div className="rounded-lg bg-meituan-gray/70 px-3 py-2.5">
          <p className="text-xs font-extrabold text-black/70">替换节点</p>
          {plan.slots.length ? (
            <div className="mt-2 space-y-1.5">
              {plan.slots.map((slot) => (
                <div key={`${slot.slotType}-${slot.startTime}`} className="flex items-center gap-2 rounded-lg bg-white px-2.5 py-2">
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
          ) : (
            <p className="mt-1 text-xs leading-5 text-black/65">{FALLBACK_SLOT_TEXT}</p>
          )}
        </div>

        <div className="grid grid-cols-1 gap-2 text-xs">
          <div className="rounded-lg bg-meituan-gray/70 px-3 py-2.5">
            <p className="font-extrabold text-black/70">时间变化</p>
            <p className="mt-1 text-black/65">
              总耗时 {formatMetric(plan.totalMinutes, FALLBACK_METRIC_TEXT)} 分钟
              {typeof mainPlanMinutes === "number" ? `（主方案 ${mainPlanMinutes} 分钟）` : ""}
            </p>
            {diff ? <p className="mt-1 text-black/55">通勤变化：{formatDelta(diff.deltaCommuteMinutes, "分钟")}</p> : null}
          </div>
          <div className="rounded-lg bg-meituan-gray/70 px-3 py-2.5">
            <p className="font-extrabold text-black/70">等待变化</p>
            <p className="mt-1 text-black/65">预计等待 {formatMetric(plan.totalWaitMinutes, FALLBACK_METRIC_TEXT)} 分钟</p>
            {diff ? <p className="mt-1 text-black/55">较主方案：{formatDelta(diff.deltaWaitMinutes, "分钟")}</p> : null}
          </div>
          <div className="rounded-lg bg-meituan-gray/70 px-3 py-2.5">
            <p className="font-extrabold text-black/70">预算变化</p>
            <p className="mt-1 text-black/65">预计预算 {formatMetric(plan.totalBudget, FALLBACK_METRIC_TEXT)} 元</p>
            {diff ? <p className="mt-1 text-black/55">较主方案：{formatDelta(diff.deltaBudget, "元")}</p> : null}
          </div>
        </div>

        {riskNotes.length ? (
          <div className="rounded-lg bg-rose-50 px-3 py-2.5">
            <p className="text-xs font-extrabold text-rose-900">风险提示</p>
            <ul className="mt-1 space-y-1">
              {riskNotes.map((note) => (
                <li key={note} className="text-xs text-rose-800">
                  {note}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="rounded-lg bg-meituan-gray/70 px-3 py-2.5">
          <p className="text-xs font-extrabold text-black/70">为什么适合当前出行画像</p>
          <p className="mt-1 text-xs leading-5 text-black/65">{personaLine}</p>
          {rationaleNotes.length ? (
            <ul className="mt-2 space-y-1">
              {rationaleNotes.slice(0, 3).map((note) => (
                <li key={note} className="rounded-md bg-white px-2 py-1.5 text-xs text-black/62">
                  {note}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>

      <button
        type="button"
        disabled={isSelected}
        onClick={onSelectPlan}
        className="mt-4 w-full rounded-lg bg-meituan-yellow px-3 py-2.5 text-sm font-extrabold text-meituan-ink transition hover:brightness-95 disabled:cursor-default disabled:opacity-70"
      >
        {isSelected ? "已选择" : "选择此方案"}
      </button>
    </>
  );
}

function FallbackTabContent({
  routePlan,
  parseResult,
  fallbackDetailIndex,
  selectedFallbackIndex,
  onSelectFallbackDetail,
  onBackToList,
  onSelectFallbackPlan,
}: {
  routePlan: RoutePlan;
  parseResult: ParseResult;
  fallbackDetailIndex: number | null;
  selectedFallbackIndex: number | null;
  onSelectFallbackDetail: (index: number) => void;
  onBackToList: () => void;
  onSelectFallbackPlan: (index: number) => void;
}) {
  const fallbackPlans = routePlan.fallbackPlans ?? [];

  if (!fallbackPlans.length) {
    return <p className="py-6 text-center text-sm leading-6 text-black/55">当前主方案可行性较高，暂未生成强备选。</p>;
  }

  const detailPlan = fallbackDetailIndex !== null ? fallbackPlans[fallbackDetailIndex] : undefined;

  if (detailPlan && fallbackDetailIndex !== null) {
    return (
      <FallbackDetailContent
        plan={detailPlan}
        parseResult={parseResult}
        mainPlanMinutes={routePlan.mainPlan?.totalMinutes}
        isSelected={selectedPlanTypeIsFallback(selectedFallbackIndex, fallbackDetailIndex)}
        onBack={onBackToList}
        onSelectPlan={() => onSelectFallbackPlan(fallbackDetailIndex)}
      />
    );
  }

  return (
    <div className="space-y-2">
      {fallbackPlans.map((plan, index) => (
        <FallbackCard
          key={plan.id}
          plan={plan}
          isSelected={selectedPlanTypeIsFallback(selectedFallbackIndex, index)}
          onViewDetail={() => onSelectFallbackDetail(index)}
          onSelectPlan={() => onSelectFallbackPlan(index)}
        />
      ))}
    </div>
  );
}

function selectedPlanTypeIsFallback(selectedFallbackIndex: number | null, index: number) {
  return selectedFallbackIndex === index;
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
  selectedPlanType,
  selectedFallbackIndex,
  onSelectMainPlan,
  onSelectFallbackPlan,
  onConfirmExecute,
}: BottomPlanSheetProps) {
  const displayPoi = selectedPoi ?? rankedPois[0];
  const [fallbackDetailIndex, setFallbackDetailIndex] = useState<number | null>(null);
  const [switchFeedback, setSwitchFeedback] = useState<string | null>(null);

  const currentPlanSummary = useMemo(
    () => buildCurrentPlanSummary(routePlan, rankedPois, parseResult, selectedPlanType, selectedFallbackIndex),
    [routePlan, rankedPois, parseResult, selectedPlanType, selectedFallbackIndex],
  );

  useEffect(() => {
    if (activeTab !== "fallback") {
      setFallbackDetailIndex(null);
    }
  }, [activeTab]);

  useEffect(() => {
    if (!switchFeedback) return;
    const timer = window.setTimeout(() => setSwitchFeedback(null), 3000);
    return () => window.clearTimeout(timer);
  }, [switchFeedback]);

  function handleSelectFallbackPlan(index: number) {
    onSelectFallbackPlan(index);
    setSwitchFeedback("已切换为该备选方案，可直接确认执行。");
  }

  return (
    <div className="pointer-events-auto flex h-full min-h-[280px] w-full flex-col overflow-hidden">
      <div className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-black/12" aria-hidden="true" />

      <div className="flex shrink-0 gap-1 border-b border-black/6 px-3 pb-0 pt-1">
        {tabs.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                if (tab.id !== "fallback") setFallbackDetailIndex(null);
                onTabChange(tab.id);
              }}
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
            summary={currentPlanSummary}
            switchFeedback={switchFeedback}
            onConfirmExecute={onConfirmExecute}
            onViewFallback={() => {
              setFallbackDetailIndex(null);
              onTabChange("fallback");
            }}
            onSelectMainPlan={onSelectMainPlan}
          />
        ) : null}

        {activeTab === "fallback" ? (
          <FallbackTabContent
            routePlan={routePlan}
            parseResult={parseResult}
            fallbackDetailIndex={fallbackDetailIndex}
            selectedFallbackIndex={selectedPlanType === "fallback" ? selectedFallbackIndex : null}
            onSelectFallbackDetail={setFallbackDetailIndex}
            onBackToList={() => setFallbackDetailIndex(null)}
            onSelectFallbackPlan={handleSelectFallbackPlan}
          />
        ) : null}

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
