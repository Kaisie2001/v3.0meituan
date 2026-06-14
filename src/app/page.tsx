"use client";

import { useEffect, useMemo, useReducer, useState } from "react";
import dynamic from "next/dynamic";
import { BottomPlanSheet } from "@/components/BottomPlanSheet";
import { PlanningModal } from "@/components/PlanningModal";
import { ExecutionSheet } from "@/components/ExecutionSheet";
import { InputPanel } from "@/components/InputPanel";
import { IntentSummary } from "@/components/IntentSummary";
import { PoiDetailPanel } from "@/components/PoiDetailPanel";
import { RecommendationPanel } from "@/components/RecommendationPanel";
import { RouteTimeline } from "@/components/RouteTimeline";
import { TripPersonaCard } from "@/components/TripPersonaCard";
import { ClarifyModal } from "@/components/ClarifyModal";
import { TravelSettingsSheet } from "@/components/TravelSettingsSheet";
import { defaultInputs } from "@/lib/parseIntent";
import { runAgent, runAgentFromParseResult } from "@/lib/runAgent";
import { applyParseOverrides } from "@/lib/parsers/applyOverrides";
import { applyRoutePrefs } from "@/lib/parsers/applyRoutePrefs";
import {
  buildGoalWithTravelSettings,
  buildTravelSettingsSummary,
  DEFAULT_TRAVEL_SETTINGS,
  travelSettingsToPreferencePayload,
  type TravelSettings,
} from "@/lib/preferenceSummary";
import { buildExecutionPlanLabel, buildSelectedPlanSummary } from "@/lib/executionContext";
import { DEMO_DEFAULT_STATE, getDemoScenarioById, type DemoScenarioId } from "@/lib/demoScenarios";
import { buildMapPresentation } from "@/lib/mapPresentation";
import {
  appFlowReducer,
  initialAppFlowState,
  type AppFlowAction,
  type AppFlowState,
} from "@/lib/appFlowMachine";
import { applyTravelSettingsToAgentResult } from "@/lib/applyTravelSettingsToPlan";
import type { AgentResult, ParseResult, ScoredPoi } from "@/lib/types";

type PageFlowAction =
  | AppFlowAction
  | { type: "CLEAR_SELECTED_POI" }
  | { type: "SET_SELECTED_POI"; poiId: string };

function pageFlowReducer(state: AppFlowState, action: PageFlowAction): AppFlowState {
  if (action.type === "CLEAR_SELECTED_POI") {
    return { ...state, selectedPoiId: null };
  }
  if (action.type === "SET_SELECTED_POI") {
    return { ...state, selectedPoiId: action.poiId };
  }
  return appFlowReducer(state, action);
}

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
  const [flowState, dispatchFlow] = useReducer(pageFlowReducer, initialAppFlowState);
  const {
    screen,
    activeSheetTab,
    selectedPlanType,
    selectedFallbackIndex,
    isPlanning,
    executionStatus,
  } = flowState;
  const selectedPoiId = flowState.selectedPoiId ?? undefined;

  const [goal, setGoal] = useState(defaultInputs.goal);
  const [wechat, setWechat] = useState(defaultInputs.wechat);
  const [seed, setSeed] = useState(defaultInputs.seed);
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [agentResult, setAgentResult] = useState<AgentResult>(() =>
    runAgent(defaultInputs.goal, defaultInputs.wechat, defaultInputs.seed),
  );
  const [clarifyOpen, setClarifyOpen] = useState(false);
  const [pendingParse, setPendingParse] = useState<ParseResult | null>(null);
  const [travelSettings, setTravelSettings] = useState<TravelSettings>(DEFAULT_TRAVEL_SETTINGS);
  const [travelSettingsOpen, setTravelSettingsOpen] = useState(false);
  const [planningStep, setPlanningStep] = useState(0);
  const [activeDemoScenarioId, setActiveDemoScenarioId] = useState<DemoScenarioId | null>(null);
  const [executionPanelKey, setExecutionPanelKey] = useState(0);

  const adjustedAgent = useMemo(
    () => applyTravelSettingsToAgentResult(agentResult, travelSettings),
    [agentResult, travelSettings],
  );

  const result = adjustedAgent;
  const settingImpactSummary = adjustedAgent.planningAdjustment.settingImpactSummary;

  const travelSettingsSummary = useMemo(() => buildTravelSettingsSummary(travelSettings), [travelSettings]);

  const executionPlanLabel = useMemo(
    () => buildExecutionPlanLabel(result.routePlan, selectedPlanType, selectedFallbackIndex),
    [result.routePlan, selectedPlanType, selectedFallbackIndex],
  );

  const selectedPlanSummary = useMemo(
    () =>
      buildSelectedPlanSummary({
        routePlan: result.routePlan,
        selectedPlanType,
        selectedFallbackIndex,
        travelSettings,
      }),
    [result.routePlan, selectedPlanType, selectedFallbackIndex, travelSettings],
  );

  useEffect(() => {
    if (selectedPlanType !== "fallback") return;
    const count = result.routePlan.fallbackPlans?.length ?? 0;
    if (selectedFallbackIndex === null || selectedFallbackIndex < 0 || selectedFallbackIndex >= count) {
      dispatchFlow({ type: "RESTORE_MAIN_PLAN" });
    }
  }, [result.routePlan.fallbackPlans, selectedPlanType, selectedFallbackIndex]);

  function resetDemoState() {
    setGoal(DEMO_DEFAULT_STATE.goal);
    setWechat(DEMO_DEFAULT_STATE.wechat);
    setSeed(DEMO_DEFAULT_STATE.seed);
    setTravelSettings(DEMO_DEFAULT_STATE.travelSettings);
    setActiveDemoScenarioId(null);
    setActiveStep(0);
    setLoading(false);
    setClarifyOpen(false);
    setPendingParse(null);
    setTravelSettingsOpen(false);
    setPlanningStep(0);
    setExecutionPanelKey((key) => key + 1);
    setAgentResult(runAgent(DEMO_DEFAULT_STATE.goal, DEMO_DEFAULT_STATE.wechat, DEMO_DEFAULT_STATE.seed));
    dispatchFlow({ type: "RESET_DEMO" });
  }

  function handleSelectDemoScenario(scenarioId: DemoScenarioId) {
    const scenario = getDemoScenarioById(scenarioId);
    if (!scenario) return;

    setGoal(scenario.goal);
    setWechat(scenario.wechat);
    setSeed(scenario.seed);
    setTravelSettings(scenario.travelSettings);
    setActiveDemoScenarioId(scenarioId);
    setActiveStep(0);
    setLoading(false);
    setClarifyOpen(false);
    setPendingParse(null);
    setPlanningStep(0);
    setExecutionPanelKey((key) => key + 1);
    dispatchFlow({ type: "BACK_TO_INPUT" });
    dispatchFlow({ type: "RESTORE_MAIN_PLAN" });
    dispatchFlow({ type: "CLEAR_SELECTED_POI" });
    dispatchFlow({ type: "PLAN_FAILED" });
  }

  function handleSelectFallbackPlan(index: number) {
    const count = result.routePlan.fallbackPlans?.length ?? 0;
    if (index < 0 || index >= count) return;
    dispatchFlow({ type: "SELECT_FALLBACK", index });
  }

  function handleSelectMainPlan() {
    dispatchFlow({ type: "RESTORE_MAIN_PLAN" });
  }

  function applyTravelSettingsToResult(parseResult: ParseResult, settings: TravelSettings) {
    const payload = travelSettingsToPreferencePayload(settings);
    const withTime = applyParseOverrides(parseResult, payload.intentPatch);
    const withPrefs = applyRoutePrefs(withTime, payload.routePrefs);
    return runAgentFromParseResult(withPrefs);
  }

  function openTravelSettings() {
    setTravelSettingsOpen(true);
  }

  function handleTravelSettingsSubmit(nextSettings: TravelSettings) {
    setTravelSettings(nextSettings);
    setTravelSettingsOpen(false);

    if (screen === "result" || screen === "execute" || screen === "details") {
      const payload = travelSettingsToPreferencePayload(nextSettings);
      setAgentResult((prev) => ({
        ...prev,
        parseResult: applyParseOverrides(prev.parseResult, payload.intentPatch),
      }));
      setActiveStep(STEP_COUNT);
      dispatchFlow({ type: "CLEAR_SELECTED_POI" });
      dispatchFlow({ type: "RESTORE_MAIN_PLAN" });
      if (screen === "execute" || screen === "details") {
        dispatchFlow({ type: "OPEN_RESULT" });
      }
    }
  }

  const mapPresentation = useMemo(
    () =>
      buildMapPresentation({
        routePlan: result.routePlan,
        rankedPois: result.rankedPois,
        parseResult: result.parseResult,
        selectedPlanType,
        selectedFallbackIndex,
        selectedPoiId,
        travelSettings,
      }),
    [result.routePlan, result.rankedPois, result.parseResult, selectedPlanType, selectedFallbackIndex, selectedPoiId, travelSettings],
  );

  const mapPois = useMemo(() => mapPresentation.visiblePois, [mapPresentation]);
  const selectedPoi = useMemo(() => {
    if (!selectedPoiId) return undefined;
    return mapPois.find((poi) => poi.id === selectedPoiId) ?? result.rankedPois.find((poi) => poi.id === selectedPoiId);
  }, [mapPois, result.rankedPois, selectedPoiId]);

  function handleSelectPoi(poi: ScoredPoi) {
    if (screen === "result") {
      dispatchFlow({ type: "SELECT_POI", poiId: poi.id });
      return;
    }
    dispatchFlow({ type: "SET_SELECTED_POI", poiId: poi.id });
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
    setAgentResult(nextResult);
    setActiveStep(STEP_COUNT);
    dispatchFlow({ type: "CLEAR_SELECTED_POI" });
    dispatchFlow({ type: "RESTORE_MAIN_PLAN" });
  }

  function finishPlanning(nextResult: AgentResult) {
    setAgentResult(nextResult);
    setActiveStep(STEP_COUNT);
    setLoading(false);
    dispatchFlow({ type: "PLAN_SUCCEEDED" });
    dispatchFlow({ type: "RESTORE_MAIN_PLAN" });
  }

  function handleGenerate() {
    setLoading(true);
    setActiveStep(1);
    dispatchFlow({ type: "CLEAR_SELECTED_POI" });
    dispatchFlow({ type: "RESTORE_MAIN_PLAN" });

    const goalForAgent = buildGoalWithTravelSettings(goal, travelSettings);
    const baseResult = runAgent(goalForAgent, wechat, seed);
    const nextResult = applyTravelSettingsToResult(baseResult.parseResult, travelSettings);

    if (nextResult.parseResult.missingFields.length) {
      dispatchFlow({ type: "PLAN_FAILED" });
      setPendingParse(nextResult.parseResult);
      setClarifyOpen(true);
      setLoading(false);
      setActiveStep(0);
      return;
    }

    dispatchFlow({ type: "START_PLANNING" });
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
                  travelSettingsSummary={travelSettingsSummary}
                  activeDemoScenarioId={activeDemoScenarioId}
                  onGoalChange={(value) => {
                    setGoal(value);
                    setActiveDemoScenarioId(null);
                  }}
                  onWechatChange={setWechat}
                  onSeedChange={setSeed}
                  onOpenTravelSettings={openTravelSettings}
                  onSelectDemoScenario={handleSelectDemoScenario}
                  onResetDemo={resetDemoState}
                  onGenerate={handleGenerate}
                />
              </div>
            ) : null}

            {screen === "result" || screen === "execute" ? (
              <div data-testid="result-screen" className="relative h-full overflow-hidden bg-white">
                <div className="absolute inset-0 z-0 pb-16 [&_.leaflet-bottom]:!z-[1] [&_.leaflet-control-attribution]:!z-[1] [&_.leaflet-pane]:!z-[1] [&_.leaflet-top]:!z-[1]">
                  <LeafletPlannerMap
                    variant="hero"
                    className="h-full w-full"
                    pois={mapPois}
                    selectedPoiId={selectedPoiId}
                    onSelectPoi={handleSelectPoi}
                    mapPresentation={mapPresentation}
                  />
                </div>

                <div className="pointer-events-auto absolute inset-x-0 bottom-0 z-[9999] flex h-[45%] max-h-[48%] min-h-[280px] flex-col overflow-hidden">
                  <BottomPlanSheet
                    routePlan={result.routePlan}
                    rankedPois={result.rankedPois}
                    parseResult={result.parseResult}
                    selectedPoi={selectedPoi}
                    activeTab={activeSheetTab}
                    onTabChange={(tab) => dispatchFlow({ type: "SET_SHEET_TAB", tab })}
                    selectedPlanType={selectedPlanType}
                    selectedFallbackIndex={selectedFallbackIndex}
                    onSelectMainPlan={handleSelectMainPlan}
                    onSelectFallbackPlan={handleSelectFallbackPlan}
                    onConfirmExecute={() => {
                      setExecutionPanelKey((key) => key + 1);
                      dispatchFlow({ type: "OPEN_EXECUTE" });
                    }}
                    travelSettings={travelSettings}
                    travelSettingsSummary={travelSettingsSummary}
                    settingImpactSummary={settingImpactSummary}
                    onOpenTravelSettings={openTravelSettings}
                  />
                </div>

                <header className="relative z-30 flex shrink-0 items-center gap-2 border-b border-black/5 bg-white/95 px-3 py-2.5 backdrop-blur-sm">
                  <button
                    type="button"
                    onClick={() => dispatchFlow({ type: "BACK_TO_INPUT" })}
                    className="rounded-lg px-1 py-1 text-sm font-bold text-black/62 transition hover:text-black/85"
                  >
                    ← 返回
                  </button>
                  <h1 className="min-w-0 flex-1 truncate text-sm font-extrabold text-meituan-ink">你的路线已就绪</h1>
                </header>
                <div className="relative z-30 shrink-0 bg-white/95 backdrop-blur-sm">
                  <TripPersonaCard parseResult={result.parseResult} variant="compact" />
                </div>

                <ExecutionSheet
                  key={executionPanelKey}
                  open={screen === "execute"}
                  onClose={() => dispatchFlow({ type: "OPEN_RESULT" })}
                  routePlan={result.routePlan}
                  intent={result.parseResult.intent}
                  selectedPlanType={selectedPlanType}
                  selectedFallbackIndex={selectedFallbackIndex}
                  travelSettings={travelSettings}
                  currentPlanLabel={executionPlanLabel}
                  selectedPlanSummary={selectedPlanSummary}
                  onViewFinalPlan={() => dispatchFlow({ type: "OPEN_RESULT" })}
                />
              </div>
            ) : null}

            {screen === "details" ? (
              <div className="h-full space-y-3 overflow-y-auto px-3 pb-5 pt-3">
                <ScreenBackButton label="返回主方案" onClick={() => dispatchFlow({ type: "OPEN_RESULT" })} />
                <LeafletPlannerMap
                  pois={mapPois}
                  selectedPoiId={selectedPoiId}
                  onSelectPoi={handleSelectPoi}
                  mapPresentation={mapPresentation}
                />
                <RouteTimeline
                  routePlan={result.routePlan}
                  parseResult={result.parseResult}
                  selectedPlanType={selectedPlanType}
                  selectedFallbackIndex={selectedFallbackIndex}
                />
                {selectedPoi ? (
                  <PoiDetailPanel
                    poi={selectedPoi}
                    onClose={() => dispatchFlow({ type: "CLEAR_SELECTED_POI" })}
                    onDislike={handleDislikePoi}
                  />
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

            <TravelSettingsSheet
              open={travelSettingsOpen}
              value={travelSettings}
              onClose={() => setTravelSettingsOpen(false)}
              onSubmit={handleTravelSettingsSubmit}
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
                const nextResult = applyTravelSettingsToResult(patchedParse, travelSettings);
                setAgentResult(nextResult);
                setClarifyOpen(false);
                setPendingParse(null);
                setActiveStep(STEP_COUNT);
                dispatchFlow({ type: "PLAN_SUCCEEDED" });
                dispatchFlow({ type: "RESTORE_MAIN_PLAN" });
                dispatchFlow({ type: "CLEAR_SELECTED_POI" });
              }}
            />
            <PlanningModal open={isPlanning} step={planningStep} />
          </div>
        </div>
      </main>
    </div>
  );
}
