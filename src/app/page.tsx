"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { BottomPlanSheet, type SelectedPlanType, type SheetTab } from "@/components/BottomPlanSheet";
import { PlanningModal } from "@/components/PlanningModal";
import { ExecutionPanel } from "@/components/ExecutionPanel";
import { InputPanel } from "@/components/InputPanel";
import { IntentSummary } from "@/components/IntentSummary";
import { PoiDetailPanel } from "@/components/PoiDetailPanel";
import { RecommendationPanel } from "@/components/RecommendationPanel";
import { RouteTimeline } from "@/components/RouteTimeline";
import { TripPersonaCard } from "@/components/TripPersonaCard";
import { ClarifyModal } from "@/components/ClarifyModal";
import { TimePickerSheet } from "@/components/TimePickerSheet";
import { RoutePreferenceModal } from "@/components/RoutePreferenceModal";
import { defaultInputs, parseInput } from "@/lib/parseIntent";
import { runAgent, runAgentFromParseResult } from "@/lib/runAgent";
import { applyParseOverrides } from "@/lib/parsers/applyOverrides";
import { applyRoutePrefs } from "@/lib/parsers/applyRoutePrefs";
import {
  buildGoalWithTimeContext,
  buildTimePickerCardSummary,
  buildTimeWindowSummary,
  DEFAULT_PREFERENCE_SUMMARY,
  DEFAULT_TIME_PICKER,
  DEFAULT_TIME_WINDOW_SUMMARY,
  inferDefaultStartTime,
  type PreferenceSubmitPayload,
  type TimePickerValue,
} from "@/lib/preferenceSummary";
import type { AgentResult, ParseResult, ScoredPoi } from "@/lib/types";

type AppScreen = "input" | "result" | "details" | "execute";

const STEP_COUNT = 6;
const PLANNING_STEP_MS = 500;
const LeafletPlannerMap = dynamic(() => import("@/components/LeafletPlannerMap").then((mod) => mod.LeafletPlannerMap), { ssr: false });

function ScreenBackButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mb-2 flex items-center gap-1 rounded-lg px-1 py-2 text-sm font-bold text-black/62 transition hover:text-black/85"
    >
      <span aria-hidden="true">←</span>
      {label}
    </button>
  );
}

export default function Home() {
  const [screen, setScreen] = useState<AppScreen>("input");
  const [goal, setGoal] = useState(defaultInputs.goal);
  const [wechat, setWechat] = useState(defaultInputs.wechat);
  const [seed, setSeed] = useState(defaultInputs.seed);
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AgentResult>(() => runAgent(defaultInputs.goal, defaultInputs.wechat, defaultInputs.seed));
  const [selectedPoiId, setSelectedPoiId] = useState<string | undefined>(undefined);
  const [clarifyOpen, setClarifyOpen] = useState(false);
  const [pendingParse, setPendingParse] = useState<ParseResult | null>(null);
  const [routePrefOpen, setRoutePrefOpen] = useState(false);
  const [preferencesConfigured, setPreferencesConfigured] = useState(false);
  const [preferenceSummaryText, setPreferenceSummaryText] = useState(DEFAULT_PREFERENCE_SUMMARY);
  const [timeWindowSummaryText, setTimeWindowSummaryText] = useState(
    buildTimeWindowSummary({ timePicker: DEFAULT_TIME_PICKER, preferenceSummary: DEFAULT_PREFERENCE_SUMMARY }),
  );
  const [timePickerValue, setTimePickerValue] = useState<TimePickerValue>(DEFAULT_TIME_PICKER);
  const [timePickerOpen, setTimePickerOpen] = useState(false);
  const [savedPreferencePayload, setSavedPreferencePayload] = useState<PreferenceSubmitPayload | null>(null);
  const [isPlanningOpen, setIsPlanningOpen] = useState(false);
  const [planningStep, setPlanningStep] = useState(0);
  const [activeSheetTab, setActiveSheetTab] = useState<SheetTab>("main");
  const [selectedPlanType, setSelectedPlanType] = useState<SelectedPlanType>("main");
  const [selectedFallbackIndex, setSelectedFallbackIndex] = useState<number | null>(null);

  const executionPlanLabel = useMemo(() => {
    if (selectedPlanType === "fallback" && selectedFallbackIndex !== null) {
      return result.routePlan.fallbackPlans?.[selectedFallbackIndex]?.title ?? "备选方案";
    }
    return "主方案";
  }, [result.routePlan.fallbackPlans, selectedPlanType, selectedFallbackIndex]);

  useEffect(() => {
    if (selectedPlanType !== "fallback") return;
    const count = result.routePlan.fallbackPlans?.length ?? 0;
    if (selectedFallbackIndex === null || selectedFallbackIndex < 0 || selectedFallbackIndex >= count) {
      setSelectedPlanType("main");
      setSelectedFallbackIndex(null);
    }
  }, [result.routePlan.fallbackPlans, selectedPlanType, selectedFallbackIndex]);

  function resetPlanSelection() {
    setSelectedPlanType("main");
    setSelectedFallbackIndex(null);
  }

  function handleSelectFallbackPlan(index: number) {
    const count = result.routePlan.fallbackPlans?.length ?? 0;
    if (index < 0 || index >= count) return;
    setSelectedPlanType("fallback");
    setSelectedFallbackIndex(index);
    setActiveSheetTab("main");
  }

  function handleSelectMainPlan() {
    resetPlanSelection();
  }

  const timePickerCardSummary = useMemo(() => buildTimePickerCardSummary(timePickerValue), [timePickerValue]);

  function refreshTimeWindowSummary(preferenceSummary = preferenceSummaryText) {
    setTimeWindowSummaryText(
      buildTimeWindowSummary({
        timePicker: timePickerValue,
        preferenceSummary,
      }),
    );
  }

  function openTimePicker() {
    setTimePickerValue((prev) => ({
      ...prev,
      startTime: prev.startTime || inferDefaultStartTime(goal),
    }));
    setTimePickerOpen(true);
  }

  function handleTimePickerConfirm(nextValue: TimePickerValue) {
    setTimePickerValue(nextValue);
    setTimePickerOpen(false);
    refreshTimeWindowSummary();
  }

  function applyPreferencePayload(parseResult: ParseResult, payload: PreferenceSubmitPayload) {
    const withTime = applyParseOverrides(parseResult, payload.intentPatch);
    const withPrefs = applyRoutePrefs(withTime, payload.routePrefs);
    return runAgentFromParseResult(withPrefs);
  }

  function openRoutePreferences() {
    setRoutePrefOpen(true);
  }

  function handlePreferenceSubmit(payload: PreferenceSubmitPayload) {
    setSavedPreferencePayload(payload);
    setPreferencesConfigured(true);
    setPreferenceSummaryText(payload.displaySummary);
    setRoutePrefOpen(false);

    if (screen === "result" || screen === "execute" || screen === "details") {
      const nextResult = applyPreferencePayload(result.parseResult, payload);
      setResult(nextResult);
      refreshTimeWindowSummary(payload.displaySummary);
      setSelectedPoiId(undefined);
      setActiveStep(STEP_COUNT);
      setActiveSheetTab("main");
      resetPlanSelection();
      if (screen === "execute" || screen === "details") {
        setScreen("result");
      }
    }
  }

  function resetPreferences() {
    setSavedPreferencePayload(null);
    setPreferencesConfigured(false);
    setPreferenceSummaryText(DEFAULT_PREFERENCE_SUMMARY);
    setTimeWindowSummaryText(
      buildTimeWindowSummary({ timePicker: timePickerValue, preferenceSummary: DEFAULT_PREFERENCE_SUMMARY }),
    );
  }

  const routePrefInitialDraft = useMemo(() => parseInput(goal, wechat, seed).draft, [goal, wechat, seed]);

  const mapPois = useMemo(() => result.rankedPois, [result]);
  const selectedPoi = useMemo(() => {
    if (!selectedPoiId) return undefined;
    return result.rankedPois.find((poi) => poi.id === selectedPoiId);
  }, [result, selectedPoiId]);
  const routePoiIds = useMemo(() => {
    const ids =
      result.routePlan.mainPlan?.slots.map((slot) => slot.poi?.id).filter((id): id is string => typeof id === "string" && id.length > 0) ?? [];
    if (ids.length >= 2) return [...ids, ids[0]];
    return ids;
  }, [result.routePlan]);

  function handleSelectPoi(poi: ScoredPoi) {
    setSelectedPoiId(poi.id);
    if (screen === "result") {
      setActiveSheetTab("poi");
    }
  }

  function handleDislikePoi(poi: ScoredPoi) {
    const excluded = new Set(result.parseResult.intent.excludedPoiIds ?? []);
    excluded.add(poi.id);
    const patchedParse: ParseResult = {
      ...result.parseResult,
      intent: {
        ...result.parseResult.intent,
        excludedPoiIds: [...excluded],
      },
    };
    const nextResult = runAgentFromParseResult(patchedParse);
    setResult(nextResult);
    setSelectedPoiId(undefined);
    setActiveStep(STEP_COUNT);
    resetPlanSelection();
  }

  function finishPlanning(nextResult: AgentResult) {
    setResult(nextResult);
    setActiveStep(STEP_COUNT);
    setIsPlanningOpen(false);
    setLoading(false);
    setActiveSheetTab("main");
    resetPlanSelection();
    setScreen("result");
  }

  function handleGenerate() {
    setLoading(true);
    setActiveStep(1);
    setSelectedPoiId(undefined);
    resetPlanSelection();

    const goalForAgent = buildGoalWithTimeContext(goal, timePickerValue);
    const baseResult = runAgent(goalForAgent, wechat, seed);
    const nextResult = savedPreferencePayload ? applyPreferencePayload(baseResult.parseResult, savedPreferencePayload) : baseResult;
    refreshTimeWindowSummary();

    if (nextResult.parseResult.missingFields.length) {
      setIsPlanningOpen(false);
      setPendingParse(nextResult.parseResult);
      setClarifyOpen(true);
      setLoading(false);
      setActiveStep(0);
      return;
    }

    setIsPlanningOpen(true);
    setPlanningStep(0);

    let step = 0;
    const tick = () => {
      if (step < 3) {
        step += 1;
        setPlanningStep(step);
        setActiveStep(step + 1);
        window.setTimeout(tick, PLANNING_STEP_MS);
        return;
      }
      window.setTimeout(() => finishPlanning(nextResult), PLANNING_STEP_MS);
    };
    window.setTimeout(tick, PLANNING_STEP_MS);
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-100 via-[#f5f6f8] to-slate-200 px-3 py-4">
      <main className="relative mx-auto flex h-[844px] max-h-[calc(100vh-32px)] w-full max-w-[390px] flex-col overflow-hidden rounded-[32px] border border-white/70 bg-[#f5f6f8] shadow-2xl">
        <div className="flex shrink-0 items-center justify-center bg-white/85 px-4 py-3">
          <div className="h-1.5 w-24 rounded-full bg-black/12" />
        </div>
        <div className="relative min-h-0 flex-1 overflow-hidden">
          <div className="relative h-full overflow-hidden">
            {screen === "input" ? (
              <div className="h-full space-y-3 overflow-y-auto px-3 pb-5 pt-3">
                <InputPanel
                  goal={goal}
                  wechat={wechat}
                  seed={seed}
                  loading={loading}
                  timeSummary={timePickerCardSummary}
                  onGoalChange={setGoal}
                  onWechatChange={setWechat}
                  onSeedChange={setSeed}
                  onOpenTimePicker={openTimePicker}
                  onGenerate={handleGenerate}
                  onOpenRoutePreferences={openRoutePreferences}
                  hasRoutePreferences={preferencesConfigured}
                />
              </div>
            ) : null}

            {screen === "result" ? (
              <div className="relative h-full overflow-hidden bg-white">
                <div className="absolute inset-0 z-0 pb-16 [&_.leaflet-bottom]:!z-[1] [&_.leaflet-control-attribution]:!z-[1] [&_.leaflet-pane]:!z-[1] [&_.leaflet-top]:!z-[1]">
                  <LeafletPlannerMap
                    variant="hero"
                    className="h-full w-full"
                    pois={mapPois}
                    selectedPoiId={selectedPoiId}
                    onSelectPoi={handleSelectPoi}
                    routePoiIds={routePoiIds}
                  />
                </div>

                <div className="pointer-events-auto absolute inset-x-0 bottom-0 z-[9999] flex h-[45%] max-h-[48%] min-h-[280px] flex-col overflow-hidden rounded-t-[28px] bg-white shadow-2xl">
                  <BottomPlanSheet
                    routePlan={result.routePlan}
                    rankedPois={result.rankedPois}
                    parseResult={result.parseResult}
                    selectedPoi={selectedPoi}
                    activeTab={activeSheetTab}
                    onTabChange={setActiveSheetTab}
                    selectedPlanType={selectedPlanType}
                    selectedFallbackIndex={selectedFallbackIndex}
                    onSelectMainPlan={handleSelectMainPlan}
                    onSelectFallbackPlan={handleSelectFallbackPlan}
                    onConfirmExecute={() => setScreen("execute")}
                    preferenceSummary={preferenceSummaryText}
                    timeWindowSummary={timeWindowSummaryText}
                    timePickerValue={timePickerValue}
                    onOpenRoutePreferences={openRoutePreferences}
                  />
                </div>

                <header className="relative z-30 flex shrink-0 items-center gap-2 border-b border-black/5 bg-white/95 px-3 py-2.5 backdrop-blur-sm">
                  <button
                    type="button"
                    onClick={() => setScreen("input")}
                    className="rounded-lg px-1 py-1 text-sm font-bold text-black/62 transition hover:text-black/85"
                  >
                    ← 返回
                  </button>
                  <h1 className="min-w-0 flex-1 truncate text-sm font-extrabold text-meituan-ink">AI 已为你规划好</h1>
                </header>
                <div className="relative z-30 shrink-0 bg-white/95 backdrop-blur-sm">
                  <TripPersonaCard parseResult={result.parseResult} variant="compact" />
                </div>
              </div>
            ) : null}

            {screen === "details" ? (
              <div className="h-full space-y-3 overflow-y-auto px-3 pb-5 pt-3">
                <ScreenBackButton label="返回主方案" onClick={() => setScreen("result")} />
                <LeafletPlannerMap pois={mapPois} selectedPoiId={selectedPoiId} onSelectPoi={handleSelectPoi} routePoiIds={routePoiIds} />
                <RouteTimeline
                  routePlan={result.routePlan}
                  parseResult={result.parseResult}
                  selectedPlanType={selectedPlanType}
                  selectedFallbackIndex={selectedFallbackIndex}
                />
                {selectedPoi ? (
                  <PoiDetailPanel poi={selectedPoi} onClose={() => setSelectedPoiId(undefined)} onDislike={handleDislikePoi} />
                ) : null}
                <RecommendationPanel
                  pois={result.rankedPois}
                  parseResult={result.parseResult}
                  selectedPoiId={selectedPoiId}
                  onSelectPoi={handleSelectPoi}
                />
                <div className="opacity-80">
                  <IntentSummary parseResult={result.parseResult} />
                </div>
              </div>
            ) : null}

            {screen === "execute" ? (
              <div className="h-full space-y-3 overflow-y-auto px-3 pb-5 pt-3">
                <ScreenBackButton label="返回方案" onClick={() => setScreen("result")} />
                <ExecutionPanel
                  actions={result.executionActions}
                  routePlan={result.routePlan}
                  intent={result.parseResult.intent}
                  selectedPlanLabel={executionPlanLabel}
                />
              </div>
            ) : null}

            <TimePickerSheet
              open={timePickerOpen}
              value={timePickerValue}
              onClose={() => setTimePickerOpen(false)}
              onConfirm={handleTimePickerConfirm}
            />
            <ClarifyModal
              open={clarifyOpen}
              missingFields={pendingParse?.missingFields ?? []}
              draft={pendingParse?.draft ?? { rawGoal: goal, wechatConstraint: wechat, seedContent: seed }}
              onClose={() => {
                setClarifyOpen(false);
                setPendingParse(null);
              }}
              onSubmit={(patch) => {
                if (!pendingParse) return;
                const patchedParse = applyParseOverrides(pendingParse, patch);
                let nextResult = runAgentFromParseResult(patchedParse);
                if (savedPreferencePayload) {
                  nextResult = applyPreferencePayload(nextResult.parseResult, savedPreferencePayload);
                }
                setResult(nextResult);
                refreshTimeWindowSummary();
                setSelectedPoiId(undefined);
                setClarifyOpen(false);
                setPendingParse(null);
                setActiveStep(STEP_COUNT);
                setActiveSheetTab("main");
                resetPlanSelection();
                setScreen("result");
              }}
            />
            <RoutePreferenceModal
              open={routePrefOpen}
              initialIntent={result.parseResult.intent}
              initialDraft={routePrefInitialDraft}
              onClose={() => setRoutePrefOpen(false)}
              onSubmit={handlePreferenceSubmit}
            />
            <PlanningModal open={isPlanningOpen} step={planningStep} />
          </div>
        </div>
      </main>
    </div>
  );
}
