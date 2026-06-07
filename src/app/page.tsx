"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { AgentStepper } from "@/components/AgentStepper";
import { BestPlanCard } from "@/components/BestPlanCard";
import { ExecutionPanel } from "@/components/ExecutionPanel";
import { InputPanel } from "@/components/InputPanel";
import { IntentSummary } from "@/components/IntentSummary";
import { PoiDetailPanel } from "@/components/PoiDetailPanel";
import { RecommendationPanel } from "@/components/RecommendationPanel";
import { RouteTimeline } from "@/components/RouteTimeline";
import { TripPersonaCard } from "@/components/TripPersonaCard";
import { ClarifyModal } from "@/components/ClarifyModal";
import { RoutePreferenceModal } from "@/components/RoutePreferenceModal";
import { defaultInputs } from "@/lib/parseIntent";
import { runAgent, runAgentFromParseResult } from "@/lib/runAgent";
import { applyParseOverrides } from "@/lib/parsers/applyOverrides";
import { applyRoutePrefs } from "@/lib/parsers/applyRoutePrefs";
import type { AgentResult, ParseResult, ScoredPoi } from "@/lib/types";

const STEP_COUNT = 6;
const LeafletPlannerMap = dynamic(() => import("@/components/LeafletPlannerMap").then((mod) => mod.LeafletPlannerMap), { ssr: false });

export default function Home() {
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
  const [pendingRoutePrefParse, setPendingRoutePrefParse] = useState<ParseResult | null>(null);

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
  }

  function handleGenerate() {
    setLoading(true);
    setActiveStep(1);
    setSelectedPoiId(undefined);

    const nextResult = runAgent(goal, wechat, seed);
    if (nextResult.parseResult.missingFields.length) {
      setPendingParse(nextResult.parseResult);
      setClarifyOpen(true);
      setLoading(false);
      setActiveStep(0);
      return;
    }

    setResult(nextResult);
    setPendingRoutePrefParse(null);
    setActiveStep(STEP_COUNT);
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-100 via-[#f5f6f8] to-slate-200 px-3 py-4">
      <main className="mx-auto flex h-[844px] max-h-[calc(100vh-32px)] w-full max-w-[390px] flex-col overflow-hidden rounded-[32px] border border-white/70 bg-[#f5f6f8] shadow-2xl">
        <div className="flex shrink-0 items-center justify-center bg-white/85 px-4 py-3">
          <div className="h-1.5 w-24 rounded-full bg-black/12" />
        </div>
        <div className="flex-1 space-y-3 overflow-y-auto px-3 pb-5 pt-3">
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
          const nextResult = runAgentFromParseResult(patchedParse);
          setResult(nextResult);
          setSelectedPoiId(undefined);
          setClarifyOpen(false);
          setPendingParse(null);
          setPendingRoutePrefParse(null);
          setActiveStep(STEP_COUNT);
        }}
      />
      <RoutePreferenceModal
        open={routePrefOpen}
        onClose={() => {
          if (!pendingRoutePrefParse) {
            setRoutePrefOpen(false);
            return;
          }
          const nextResult = runAgentFromParseResult(pendingRoutePrefParse);
          setResult(nextResult);
          setSelectedPoiId(undefined);
          setRoutePrefOpen(false);
          setPendingRoutePrefParse(null);
          setActiveStep(STEP_COUNT);
        }}
        onSubmit={(prefs) => {
          if (!pendingRoutePrefParse) return;
          const patchedParse = applyRoutePrefs(pendingRoutePrefParse, prefs);
          const nextResult = runAgentFromParseResult(patchedParse);
          setResult(nextResult);
          setSelectedPoiId(undefined);
          setRoutePrefOpen(false);
          setPendingRoutePrefParse(null);
          setActiveStep(STEP_COUNT);
        }}
      />
      <InputPanel
        goal={goal}
        wechat={wechat}
        seed={seed}
        loading={loading}
        onGoalChange={setGoal}
        onWechatChange={setWechat}
        onSeedChange={setSeed}
        onGenerate={handleGenerate}
      />

      <AgentStepper activeStep={activeStep} completed={!loading && activeStep >= STEP_COUNT} />
      <TripPersonaCard parseResult={result.parseResult} />
      <BestPlanCard routePlan={result.routePlan} rankedPois={result.rankedPois} parseResult={result.parseResult} />

      <LeafletPlannerMap pois={mapPois} selectedPoiId={selectedPoiId} onSelectPoi={handleSelectPoi} routePoiIds={routePoiIds} />
      <RouteTimeline routePlan={result.routePlan} parseResult={result.parseResult} />

      {selectedPoi ? <PoiDetailPanel poi={selectedPoi} onClose={() => setSelectedPoiId(undefined)} onDislike={handleDislikePoi} /> : null}

      <RecommendationPanel pois={result.rankedPois} parseResult={result.parseResult} selectedPoiId={selectedPoiId} onSelectPoi={handleSelectPoi} />
      <div id="execution-panel" className="scroll-mt-3">
        <ExecutionPanel actions={result.executionActions} routePlan={result.routePlan} intent={result.parseResult.intent} />
      </div>

      <IntentSummary parseResult={result.parseResult} />
        </div>
      </main>
    </div>
  );
}
