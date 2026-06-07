"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { getFallbackPersonaReason, getPersonaConfig, getPersonaSlotLabel } from "@/lib/persona";
import {
  buildPlanComparison,
  getActivePlanLabels,
  getActivePlanScores,
  getFallbackDisplay,
  type FallbackPlanDisplay,
  type PlanComparisonSummary,
} from "@/lib/planComparison";
import { buildRouteGuidance, type RouteGuidanceSummary } from "@/lib/routeGuidance";
import {
  buildFallbackSwitchNoteWithSettings,
  buildTravelSettingEffects,
  getFallbackCardSettingHint,
  getPoiTravelSettingHint,
  type TravelSettingEffectsSummary,
} from "@/lib/travelSettingEffects";
import type { TravelSettings } from "@/lib/preferenceSummary";
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
  travelSettings?: TravelSettings;
  travelSettingsSummary?: string;
  onOpenTravelSettings?: () => void;
};

type CurrentPlanSummary = {
  usageLabel: string;
  isFallback: boolean;
  planTitle: string;
  triggerNote?: string;
  mapNote?: string;
  overallScore: number;
  safetyScore?: number;
  experienceLabel?: string;
  riskSummary?: string;
  solvedRisk?: string;
  tradeoffSummary?: string;
  comparisonSummaryLine?: string;
  totalMinutes: number | string;
  totalBudget: number | string;
  totalWaitMinutes: number | string;
  slots: RouteSlot[];
  slotFallbackText?: string;
  reasons: string[];
  strategyNote: string;
};

type RouteStepPreview = {
  label: string;
  name: string;
  timeRange?: string;
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
  comparison: PlanComparisonSummary,
): CurrentPlanSummary {
  const personaConfig = getPersonaConfig(parseResult);
  const fallbackPlans = routePlan.fallbackPlans ?? [];
  const activeScores = getActivePlanScores(comparison, selectedPlanType, selectedFallbackIndex);
  const activeLabels = getActivePlanLabels(comparison, selectedPlanType, selectedFallbackIndex);
  const strategyNote = comparison.strategyNote;

  if (selectedPlanType === "fallback" && selectedFallbackIndex !== null) {
    const plan = fallbackPlans[selectedFallbackIndex];
    const fallbackDisplay = getFallbackDisplay(comparison, selectedFallbackIndex);
    if (plan && fallbackDisplay) {
      const slots = plan.slots ?? [];
      const rationaleNotes = plan.slots?.flatMap((slot) => slot.rationaleNotes) ?? [];

      return {
        usageLabel: `当前使用：${plan.title}`,
        isFallback: true,
        planTitle: plan.title,
        triggerNote: "已切换为等待更短的备选方案。",
        mapNote: `地图仍显示整体候选路线，当前执行方案已切换为${plan.title}。`,
        overallScore: fallbackDisplay.overallScore,
        safetyScore: fallbackDisplay.safetyScore,
        solvedRisk: fallbackDisplay.solvedRisk,
        tradeoffSummary: fallbackDisplay.tradeoffSummary,
        comparisonSummaryLine: fallbackDisplay.summaryLine,
        totalMinutes: formatMetric(plan.totalMinutes, FALLBACK_METRIC_TEXT),
        totalBudget: formatMetric(plan.totalBudget, FALLBACK_METRIC_TEXT),
        totalWaitMinutes: formatMetric(plan.totalWaitMinutes, FALLBACK_METRIC_TEXT),
        slots,
        slotFallbackText: slots.length ? undefined : FALLBACK_SLOT_TEXT,
        reasons: rationaleNotes.length ? rationaleNotes.slice(0, 3) : [getFallbackPersonaReason(parseResult)],
        strategyNote,
      };
    }
  }

  const mainPlan = routePlan.mainPlan;
  const slots = mainPlan?.slots ?? [];

  return {
    usageLabel: "当前使用：主方案",
    isFallback: false,
    planTitle: personaConfig.planTitle,
    triggerNote: undefined,
    mapNote: undefined,
    overallScore: activeScores.overallScore,
    safetyScore: undefined,
    experienceLabel: activeLabels.experienceLabel,
    riskSummary: activeLabels.riskSummary,
    comparisonSummaryLine: undefined,
    totalMinutes: formatMetric(mainPlan?.totalMinutes, routePlan.totalMinutes),
    totalBudget: formatMetric(mainPlan?.totalBudget, routePlan.totalBudget),
    totalWaitMinutes: formatMetric(mainPlan?.totalWaitMinutes, routePlan.totalWaitMinutes),
    slots,
    slotFallbackText: slots.length ? undefined : "暂无路线节点",
    reasons: personaConfig.bestPlanReasons.slice(0, 3),
    strategyNote,
  };
}

function buildRouteThreeSteps(slots: RouteSlot[], parseResult: ParseResult): RouteStepPreview[] {
  if (!slots.length) {
    return [{ label: "路线", name: "暂无节点" }];
  }

  const activitySlot = slots.find((slot) => slot.slotType === "activity") ?? slots[0];
  const foodSlot = slots.find((slot) => slot.slotType === "food");
  const extraSlot = slots.find((slot) => slot.slotType === "extra") ?? slots[slots.length - 1];

  const steps: RouteStepPreview[] = [
    {
      label: "先去哪里",
      name: activitySlot.poi?.name ?? "待定地点",
      timeRange: `${activitySlot.startTime}-${activitySlot.endTime}`,
    },
  ];

  if (foodSlot && foodSlot !== activitySlot) {
    steps.push({
      label: "吃饭 / 活动",
      name: foodSlot.poi?.name ?? "待定地点",
      timeRange: `${foodSlot.startTime}-${foodSlot.endTime}`,
    });
  } else if (slots[1] && slots[1] !== activitySlot) {
    steps.push({
      label: getPersonaSlotLabel(parseResult, slots[1].slotType),
      name: slots[1].poi?.name ?? "待定地点",
      timeRange: `${slots[1].startTime}-${slots[1].endTime}`,
    });
  }

  const tailSlot =
    extraSlot && extraSlot !== foodSlot && extraSlot !== activitySlot
      ? extraSlot
      : slots.length > 2
        ? slots[slots.length - 1]
        : undefined;

  if (tailSlot && !steps.some((step) => step.name === (tailSlot.poi?.name ?? ""))) {
    steps.push({
      label: tailSlot.slotType === "extra" ? "收尾 / 饭后" : getPersonaSlotLabel(parseResult, tailSlot.slotType),
      name: tailSlot.poi?.name ?? "待定地点",
      timeRange: `${tailSlot.startTime}-${tailSlot.endTime}`,
    });
  }

  return steps.slice(0, 3);
}

function buildCompactGuidanceLines(guidance: RouteGuidanceSummary) {
  const lines: string[] = [];
  if (guidance.steps[0]) lines.push(guidance.steps[0]);
  const hint = guidance.timeHint?.split(/[。；]/)[0]?.trim();
  if (hint && lines.length < 2 && !lines.includes(hint)) lines.push(hint);
  return lines.slice(0, 2);
}

function CollapseSection({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="rounded-lg border border-black/8 bg-meituan-gray/40">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        <span className="text-xs font-extrabold text-black/70">{title}</span>
        <span className="shrink-0 text-[10px] font-bold text-black/45">{open ? "收起" : "展开"}</span>
      </button>
      {open ? <div className="space-y-2 border-t border-black/6 px-3 pb-3 pt-2">{children}</div> : null}
    </div>
  );
}

function DynamicFeasibilityBlock({ effects }: { effects: TravelSettingEffectsSummary }) {
  return (
    <div className="rounded-lg border border-black/8 bg-white px-3 py-2.5">
      <p className="text-xs font-extrabold text-meituan-ink">动态可行性</p>
      <p className="mt-1 text-sm font-bold text-meituan-ink">{effects.windowHeadline}</p>
      <p className="mt-1 text-[11px] font-semibold leading-5 text-black/62">{effects.riskSummaryLine}</p>
      <div className="mt-2 flex flex-wrap gap-1">
        {effects.dynamicBadges.map((badge) => (
          <span key={badge} className="rounded-full bg-meituan-gray px-2 py-0.5 text-[10px] font-bold text-black/55">
            {badge}
          </span>
        ))}
      </div>
      <p className="mt-2 text-[11px] leading-5 text-black/58">{effects.planningAdvice}</p>
      {effects.preferenceReason ? (
        <p className="mt-1.5 text-[11px] leading-5 text-black/55">{effects.preferenceReason}</p>
      ) : null}
    </div>
  );
}

function CompactGuidanceBlock({ guidance }: { guidance: RouteGuidanceSummary }) {
  const lines = buildCompactGuidanceLines(guidance);

  return (
    <div className="rounded-lg border border-meituan-yellow/50 bg-meituan-yellow/10 px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-extrabold text-meituan-ink">出行指引</p>
        <span className="shrink-0 rounded-full bg-meituan-yellow/70 px-2 py-0.5 text-[10px] font-bold text-meituan-ink">
          {guidance.transportLabel}
        </span>
      </div>
      <ul className="mt-1.5 space-y-1">
        {lines.map((line) => (
          <li key={line} className="text-[11px] font-semibold leading-5 text-black/68">
            · {line}
          </li>
        ))}
      </ul>
    </div>
  );
}

function RouteThreeStepsBlock({ steps }: { steps: RouteStepPreview[] }) {
  return (
    <div className="space-y-1">
      {steps.map((step, index) => (
        <div key={`${step.label}-${step.name}-${index}`} className="flex items-center gap-2 rounded-lg bg-meituan-gray/70 px-2.5 py-1.5">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-meituan-yellow/80 text-[10px] font-extrabold text-meituan-ink">
            {index + 1}
          </span>
          <span className="w-[72px] shrink-0 text-[10px] font-bold text-black/50">{step.label}</span>
          <span className="min-w-0 truncate text-[11px] font-bold text-black/78">{step.name}</span>
        </div>
      ))}
    </div>
  );
}

function MainTabContent({
  summary,
  guidance,
  settingEffects,
  parseResult,
  travelSettingsSummary,
  onOpenTravelSettings,
  switchFeedback,
  onConfirmExecute,
  onViewFallback,
  onSelectMainPlan,
}: {
  summary: CurrentPlanSummary;
  guidance: RouteGuidanceSummary;
  settingEffects: TravelSettingEffectsSummary;
  parseResult: ParseResult;
  travelSettingsSummary?: string;
  onOpenTravelSettings?: () => void;
  switchFeedback: string | null;
  onConfirmExecute?: () => void;
  onViewFallback: () => void;
  onSelectMainPlan: () => void;
}) {
  const constraintText = travelSettingsSummary ?? "今天 14:00 · 3小时 · 系统综合规划";
  const routeSteps = buildRouteThreeSteps(summary.slots, parseResult);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto pb-2">
        {switchFeedback ? (
          <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800">{switchFeedback}</p>
        ) : null}

        <div className="rounded-lg border border-black/8 bg-meituan-gray/50 px-3 py-2.5">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-extrabold text-meituan-ink">{summary.usageLabel}</p>
              {summary.isFallback && summary.triggerNote ? (
                <p className="mt-1 text-[11px] font-semibold leading-5 text-amber-900">{summary.triggerNote}</p>
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
            ) : onOpenTravelSettings ? (
              <button
                type="button"
                onClick={() => onOpenTravelSettings?.()}
                className="shrink-0 rounded-lg border border-black/10 bg-white px-2.5 py-1 text-[11px] font-bold text-black/62 hover:bg-black/5"
              >
                调整
              </button>
            ) : null}
          </div>
        </div>

        <div className="grid grid-cols-4 gap-1.5 text-center text-[10px] text-black/55">
          <div className="rounded-lg bg-meituan-yellow/75 px-1 py-1.5">
            <b className="block text-sm font-extrabold text-meituan-ink">{summary.overallScore}</b>
            成行分
          </div>
          <div className="rounded-lg bg-meituan-gray px-1 py-1.5">
            <b className="block text-sm font-extrabold text-meituan-ink">{summary.totalMinutes}</b>
            总耗时
          </div>
          <div className="rounded-lg bg-meituan-gray px-1 py-1.5">
            <b className="block text-sm font-extrabold text-meituan-ink">{summary.totalBudget}</b>
            预算
          </div>
          <div className="rounded-lg bg-meituan-gray px-1 py-1.5">
            <b className="block text-sm font-extrabold text-meituan-ink">{summary.totalWaitMinutes}</b>
            等待
          </div>
        </div>

        <p className="truncate rounded-lg bg-white px-3 py-2 text-[11px] font-semibold text-black/62">{constraintText}</p>

        <RouteThreeStepsBlock steps={routeSteps} />

        <CompactGuidanceBlock guidance={guidance} />

        <CollapseSection title="查看规划依据">
          <DynamicFeasibilityBlock effects={settingEffects} />

          <div>
            <p className="mb-1 text-[11px] font-extrabold text-black/62">为什么适合你这次</p>
            <ul className="space-y-0.5">
              {summary.reasons.map((reason) => (
                <li key={reason} className="text-[11px] leading-5 text-black/58">
                  · {reason}
                </li>
              ))}
            </ul>
          </div>

          <p className="text-[10px] leading-4 text-black/42">{guidance.mapDemoNote}</p>

          <div>
            <p className="mb-1 text-[11px] font-bold text-black/45">完整路线节点</p>
            <div className="space-y-1">
              {summary.slots.length ? (
                summary.slots.map((slot) => (
                  <div
                    key={`${slot.slotType}-${slot.startTime}`}
                    className="flex items-center gap-2 rounded-lg bg-meituan-gray/70 px-2 py-1.5"
                  >
                    <span className="w-[68px] shrink-0 text-[10px] font-bold text-black/50">
                      {slot.startTime}-{slot.endTime}
                    </span>
                    <span className="rounded-full bg-meituan-yellow/70 px-1.5 py-0.5 text-[10px] font-bold text-meituan-ink">
                      {getPersonaSlotLabel(parseResult, slot.slotType)}
                    </span>
                    <span className="min-w-0 truncate text-[11px] font-bold text-black/78">{slot.poi?.name ?? "待定地点"}</span>
                  </div>
                ))
              ) : (
                <p className="rounded-lg bg-meituan-gray/70 px-2 py-1.5 text-[11px] leading-5 text-black/55">
                  {summary.slotFallbackText ?? "暂无路线节点"}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-1 text-[11px] leading-5 text-black/58">
            {summary.experienceLabel ? (
              <p>
                <span className="font-bold text-black/65">体验标签：</span>
                {summary.experienceLabel}
              </p>
            ) : null}
            {summary.riskSummary ? (
              <p>
                <span className="font-bold text-black/65">风险摘要：</span>
                {summary.riskSummary}
              </p>
            ) : null}
            {typeof summary.safetyScore === "number" ? (
              <p>
                <span className="font-bold text-black/65">稳妥度：</span>
                {summary.safetyScore}
              </p>
            ) : null}
            {summary.comparisonSummaryLine ? (
              <p>
                <span className="font-bold text-black/65">对比说明：</span>
                {summary.comparisonSummaryLine}
              </p>
            ) : null}
            {summary.solvedRisk ? (
              <p>
                <span className="font-bold text-black/65">解决的问题：</span>
                {summary.solvedRisk}
              </p>
            ) : null}
            {summary.tradeoffSummary ? (
              <p>
                <span className="font-bold text-black/65">代价：</span>
                {summary.tradeoffSummary}
              </p>
            ) : null}
            <p>
              <span className="font-bold text-black/65">策略说明：</span>
              {summary.strategyNote}
            </p>
          </div>

          <div className="rounded-lg border border-meituan-yellow/40 bg-meituan-yellow/10 px-3 py-2">
            <p className="text-[11px] font-extrabold text-meituan-ink">完整出行指引</p>
            <ol className="mt-1.5 space-y-1">
              {guidance.steps.map((step, index) => (
                <li key={`${index}-${step}`} className="text-[11px] leading-5 text-black/65">
                  {index + 1}. {step}
                </li>
              ))}
            </ol>
            {guidance.timeHint ? <p className="mt-1.5 text-[11px] leading-5 text-black/58">{guidance.timeHint}</p> : null}
            {guidance.preferenceHint ? <p className="mt-1 text-[11px] leading-5 text-black/55">{guidance.preferenceHint}</p> : null}
          </div>
        </CollapseSection>
      </div>

      <div className="shrink-0 border-t border-black/6 bg-white pt-2">
        <div className="flex gap-2">
          <button
            type="button"
            className="flex-1 rounded-lg bg-meituan-yellow px-3 py-2.5 text-sm font-extrabold text-meituan-ink transition hover:brightness-95"
            onClick={() => onConfirmExecute?.()}
          >
            确认并执行
          </button>
          <button
            type="button"
            className="flex-1 rounded-lg border border-black/10 bg-white px-3 py-2.5 text-sm font-bold text-black/62 hover:bg-black/5"
            onClick={summary.isFallback ? onSelectMainPlan : onViewFallback}
          >
            {summary.isFallback ? "恢复主方案" : "查看备选方案"}
          </button>
        </div>
      </div>
    </div>
  );
}

function FallbackCard({
  plan,
  display,
  parseResult,
  settingEffects,
  travelSettings,
  fallbackIndex,
  isSelected,
  onSelectPlan,
}: {
  plan: ItineraryPlan;
  display: FallbackPlanDisplay;
  parseResult: ParseResult;
  settingEffects: TravelSettingEffectsSummary;
  travelSettings?: TravelSettings;
  fallbackIndex: number;
  isSelected: boolean;
  onSelectPlan: () => void;
}) {
  const [diffOpen, setDiffOpen] = useState(false);
  const personaFallbackLine = getFallbackPersonaReason(parseResult);
  const settingFallbackLine = getFallbackCardSettingHint(settingEffects, travelSettings, fallbackIndex);
  const diff = plan.diffFromMain;
  const riskNotes = plan.slots.flatMap((slot) => slot.riskNotes);

  return (
    <div className={`rounded-lg border p-3 ${isSelected ? "border-meituan-yellow bg-meituan-yellow/10" : "border-black/8 bg-meituan-gray/60"}`}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-extrabold text-meituan-ink">{plan.title}</p>
        {isSelected ? (
          <span className="shrink-0 rounded-full bg-meituan-yellow px-2 py-0.5 text-[10px] font-bold text-meituan-ink">已选择</span>
        ) : null}
      </div>
      <p className="mt-2 text-xs font-bold text-meituan-ink">
        成行分 {display.overallScore} · 稳妥度 {display.safetyScore}
      </p>
      <p className="mt-1.5 text-[11px] leading-5 text-black/62">
        <span className="font-bold text-black/70">解决的问题：</span>
        {display.solvedRisk}
      </p>
      <p className="mt-1 text-[11px] leading-5 text-black/62">
        <span className="font-bold text-black/70">代价：</span>
        {display.tradeoffSummary}
      </p>

      <button
        type="button"
        className="mt-2 flex w-full items-center justify-between rounded-lg bg-white/80 px-2.5 py-1.5 text-left"
        onClick={() => setDiffOpen((open) => !open)}
        aria-expanded={diffOpen}
      >
        <span className="text-[11px] font-bold text-black/60">查看差异</span>
        <span className="text-[10px] font-bold text-black/45">{diffOpen ? "收起" : "展开"}</span>
      </button>

      {diffOpen ? (
        <div className="mt-2 space-y-2 text-[11px] leading-5 text-black/62">
          <p className="text-black/55">{display.summaryLine}</p>
          <p className="rounded-md bg-sky-50 px-2 py-1.5 font-semibold text-sky-900">
            <span className="font-bold text-sky-950">为什么此时需要备选？</span>
            {settingFallbackLine}
          </p>
          {diff ? (
            <>
              <p>
                <span className="font-bold text-black/70">等待变化：</span>
                {formatDelta(diff.deltaWaitMinutes, "分钟")}
              </p>
              <p>
                <span className="font-bold text-black/70">通勤变化：</span>
                {formatDelta(diff.deltaCommuteMinutes, "分钟")}
              </p>
              <p>
                <span className="font-bold text-black/70">预算变化：</span>
                {formatDelta(diff.deltaBudget, "元")}
              </p>
            </>
          ) : null}
          {riskNotes.length ? (
            <p>
              <span className="font-bold text-black/70">风险变化：</span>
              {riskNotes.slice(0, 2).join(" / ")}
            </p>
          ) : null}
          <p>
            <span className="font-bold text-black/70">为什么适合当前出行画像：</span>
            {personaFallbackLine}
          </p>
          <p>
            <span className="font-bold text-black/70">适用条件：</span>
            {display.applicableCondition}
          </p>
        </div>
      ) : null}

      <button
        type="button"
        onClick={onSelectPlan}
        disabled={isSelected}
        className="mt-3 w-full rounded-lg bg-meituan-yellow px-3 py-2 text-xs font-extrabold text-meituan-ink transition hover:brightness-95 disabled:cursor-default disabled:opacity-70"
      >
        {isSelected ? "已选择" : "选择此方案"}
      </button>
    </div>
  );
}

function FallbackTabContent({
  routePlan,
  parseResult,
  comparison,
  settingEffects,
  travelSettings,
  selectedFallbackIndex,
  onSelectFallbackPlan,
}: {
  routePlan: RoutePlan;
  parseResult: ParseResult;
  comparison: PlanComparisonSummary;
  settingEffects: TravelSettingEffectsSummary;
  travelSettings?: TravelSettings;
  selectedFallbackIndex: number | null;
  onSelectFallbackPlan: (index: number) => void;
}) {
  const fallbackPlans = routePlan.fallbackPlans ?? [];

  if (!fallbackPlans.length) {
    return <p className="py-6 text-center text-sm leading-6 text-black/55">当前主方案可行性较高，暂未生成强备选。</p>;
  }

  return (
    <div className="space-y-2">
      {fallbackPlans.map((plan, index) => {
        const display = getFallbackDisplay(comparison, index);
        if (!display) return null;
        return (
          <FallbackCard
            key={plan.id}
            plan={plan}
            display={display}
            parseResult={parseResult}
            settingEffects={settingEffects}
            travelSettings={travelSettings}
            fallbackIndex={index}
            isSelected={selectedFallbackIndex === index}
            onSelectPlan={() => onSelectFallbackPlan(index)}
          />
        );
      })}
    </div>
  );
}

function PoiTabContent({
  poi,
  parseResult,
  settingEffects,
  travelSettings,
  mapSelected,
}: {
  poi: ScoredPoi;
  parseResult: ParseResult;
  settingEffects: TravelSettingEffectsSummary;
  travelSettings?: TravelSettings;
  mapSelected: boolean;
}) {
  const personaConfig = getPersonaConfig(parseResult);
  const poiSettingHint = getPoiTravelSettingHint(settingEffects, travelSettings, poi);
  const topReason = personaConfig.poiReason || poi.reasons[0] || "与当前场景较匹配";
  const topRisk = poi.risks[0];

  return (
    <>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate text-base font-extrabold text-meituan-ink">{poi.name}</h3>
          <p className="mt-1 text-sm font-extrabold text-meituan-ink">成行分 {poi.goabilityScore}</p>
        </div>
        <span className="shrink-0 rounded-full bg-meituan-yellow/25 px-2 py-0.5 text-[10px] font-bold text-meituan-ink">
          {levelLabel[poi.level]}
        </span>
      </div>

      {!mapSelected ? <p className="mt-1 text-[11px] text-black/45">点击地图上的点位可切换查看</p> : null}

      <p className="mt-2 rounded-lg bg-meituan-gray/70 px-2.5 py-1.5 text-xs text-black/65">{topReason}</p>

      {topRisk ? (
        <p className="mt-1.5 rounded-lg bg-rose-50 px-2.5 py-1.5 text-xs text-rose-800">{topRisk}</p>
      ) : null}

      <div className="mt-3">
        <CollapseSection title="查看推荐证据">
          <div className="grid grid-cols-4 gap-1.5 text-center text-[10px] text-black/55">
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

          <div>
            <p className="mb-1 text-xs font-extrabold text-black/70">场景匹配</p>
            <ul className="space-y-1">
              {[personaConfig.poiReason, ...poi.reasons.filter((reason) => reason !== personaConfig.poiReason)].slice(0, 3).map((reason) => (
                <li key={reason} className="rounded-lg bg-meituan-gray/70 px-2.5 py-1.5 text-xs text-black/65">
                  {reason}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="mb-1 text-xs font-extrabold text-black/70">动态可行性</p>
            <p className="rounded-lg bg-sky-50 px-2.5 py-1.5 text-xs font-semibold text-sky-900">{poiSettingHint}</p>
            <p className="mt-1 rounded-lg bg-meituan-gray/70 px-2.5 py-1.5 text-xs text-black/65">{personaConfig.availabilityHint}</p>
            <p className="mt-1 rounded-lg bg-meituan-gray/70 px-2.5 py-1.5 text-xs text-black/65">
              ETA {poi.routeEtaMinutes} 分钟 · 排队 {poi.queueMinutes} 分钟 · 人均 {poi.pricePerPerson} 元
              {poi.reservationAvailable ? " · 当前可订" : ""}
            </p>
          </div>

          <div>
            <p className="mb-1 text-xs font-extrabold text-black/70">路线衔接</p>
            <p className="rounded-lg bg-meituan-gray/70 px-2.5 py-1.5 text-xs text-black/65">{personaConfig.routeLinkHint}</p>
          </div>

          {poi.risks.length > 1 ? (
            <div>
              <p className="mb-1 text-xs font-extrabold text-black/70">更多风险提示</p>
              <ul className="space-y-1">
                {poi.risks.slice(1, 3).map((risk) => (
                  <li key={risk} className="rounded-lg bg-rose-50 px-2.5 py-1.5 text-xs text-rose-800">
                    {risk}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </CollapseSection>
      </div>
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
  travelSettings,
  travelSettingsSummary,
  onOpenTravelSettings,
}: BottomPlanSheetProps) {
  const displayPoi = selectedPoi ?? rankedPois[0];
  const [switchFeedback, setSwitchFeedback] = useState<string | null>(null);

  const settingEffects = useMemo(() => buildTravelSettingEffects(travelSettings), [travelSettings]);

  const planComparison = useMemo(
    () => buildPlanComparison(routePlan, rankedPois, parseResult.intent),
    [routePlan, rankedPois, parseResult.intent],
  );

  const currentPlanSummary = useMemo(
    () => buildCurrentPlanSummary(routePlan, rankedPois, parseResult, selectedPlanType, selectedFallbackIndex, planComparison),
    [routePlan, rankedPois, parseResult, selectedPlanType, selectedFallbackIndex, planComparison],
  );

  const routeGuidance = useMemo(
    () =>
      buildRouteGuidance({
        routePlan,
        intent: parseResult.intent,
        selectedPlanType,
        selectedFallbackIndex,
        travelSettings,
      }),
    [routePlan, parseResult.intent, selectedPlanType, selectedFallbackIndex, travelSettings],
  );

  useEffect(() => {
    if (!switchFeedback) return;
    const timer = window.setTimeout(() => setSwitchFeedback(null), 3000);
    return () => window.clearTimeout(timer);
  }, [switchFeedback]);

  function handleSelectFallbackPlan(index: number) {
    onSelectFallbackPlan(index);
    const planTitle = routePlan.fallbackPlans?.[index]?.title ?? "备选方案";
    setSwitchFeedback(buildFallbackSwitchNoteWithSettings(planTitle, settingEffects));
    onTabChange("main");
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

      <div className={`min-h-0 flex-1 ${activeTab === "main" ? "flex flex-col px-4 pb-2 pt-3" : "overflow-y-auto px-4 pb-4 pt-3"}`}>
        {activeTab === "main" ? (
          <MainTabContent
            summary={currentPlanSummary}
            guidance={routeGuidance}
            settingEffects={settingEffects}
            parseResult={parseResult}
            travelSettingsSummary={travelSettingsSummary}
            onOpenTravelSettings={onOpenTravelSettings}
            switchFeedback={switchFeedback}
            onConfirmExecute={onConfirmExecute}
            onViewFallback={() => onTabChange("fallback")}
            onSelectMainPlan={onSelectMainPlan}
          />
        ) : null}

        {activeTab === "fallback" ? (
          <FallbackTabContent
            routePlan={routePlan}
            parseResult={parseResult}
            comparison={planComparison}
            settingEffects={settingEffects}
            travelSettings={travelSettings}
            selectedFallbackIndex={selectedPlanType === "fallback" ? selectedFallbackIndex : null}
            onSelectFallbackPlan={handleSelectFallbackPlan}
          />
        ) : null}

        {activeTab === "poi" ? (
          displayPoi ? (
            <PoiTabContent
              poi={displayPoi}
              parseResult={parseResult}
              settingEffects={settingEffects}
              travelSettings={travelSettings}
              mapSelected={Boolean(selectedPoi)}
            />
          ) : (
            <p className="py-6 text-center text-sm text-black/55">暂无推荐点详情</p>
          )
        ) : null}
      </div>
    </div>
  );
}
