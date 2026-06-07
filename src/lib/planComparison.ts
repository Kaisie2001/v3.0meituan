import type { SemanticDims } from "./semanticHash";
import type { Intent, ItineraryPlan, RoutePlan, ScoredPoi } from "./types";

type ItineraryPlanWithScore = ItineraryPlan & { score?: number };

export type DiffChip = {
  label: string;
  value: string;
};

export type MainPlanDisplay = {
  overallScore: number;
  experienceLabel: string;
  riskSummary: string;
};

export type FallbackPlanDisplay = {
  index: number;
  planId: string;
  title: string;
  overallScore: number;
  safetyScore: number;
  triggerReason: string;
  applicableCondition: string;
  solvedRisk: string;
  tradeoffSummary: string;
  summaryLine: string;
  diffChips: DiffChip[];
  /** @deprecated use solvedRisk */
  solvedProblem: string;
  /** @deprecated use tradeoffSummary */
  tradeoff: string;
};

export type PlanComparisonSummary = {
  main: MainPlanDisplay;
  fallbacks: FallbackPlanDisplay[];
  strategyNote: string;
};

const FALLBACK_DEFAULT = "该备选方案用于降低主方案的排队或满座风险。";

function clamp(value: number, min = 55, max = 98) {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, Math.round(value)));
}

function avgGoability(plan?: ItineraryPlan) {
  if (!plan) return null;
  const scores = plan.slots
    .map((slot) => slot.poi?.goabilityScore)
    .filter((score): score is number => typeof score === "number" && Number.isFinite(score));
  if (!scores.length) return null;
  return scores.reduce((sum, score) => sum + score, 0) / scores.length;
}

function avgRouteScore(plan?: ItineraryPlan) {
  if (!plan) return null;
  const scores = plan.slots
    .map((slot) => slot.poi?.routeScore)
    .filter((score): score is number => typeof score === "number" && Number.isFinite(score));
  if (!scores.length) return null;
  return scores.reduce((sum, score) => sum + score, 0) / scores.length;
}

function avgSceneFit(plan?: ItineraryPlan) {
  if (!plan) return null;
  const scores = plan.slots
    .map((slot) => slot.poi?.sceneFitScore)
    .filter((score): score is number => typeof score === "number" && Number.isFinite(score));
  if (!scores.length) return null;
  return scores.reduce((sum, score) => sum + score, 0) / scores.length;
}

function planHasIndoor(plan: ItineraryPlan) {
  return plan.slots.some(
    (slot) =>
      slot.poi?.category === "mall" ||
      slot.poi?.sceneTags.includes("室内") ||
      slot.poi?.sceneTags.includes("安静"),
  );
}

function planHasQuiet(plan: ItineraryPlan) {
  return plan.slots.some((slot) => slot.poi?.sceneTags.includes("安静"));
}

export function getMainOverallScore(mainPlan: ItineraryPlan | undefined, rankedPois: ScoredPoi[]) {
  const planScore = (mainPlan as ItineraryPlanWithScore | undefined)?.score;
  if (typeof planScore === "number" && Number.isFinite(planScore)) {
    return clamp(planScore);
  }
  const mainAvg = avgGoability(mainPlan);
  if (mainAvg !== null) {
    return clamp(mainAvg);
  }
  const topScore = rankedPois[0]?.goabilityScore;
  if (typeof topScore === "number" && Number.isFinite(topScore)) {
    return clamp(topScore);
  }
  return 88;
}

function buildMainExperienceLabel(mainPlan: ItineraryPlan | undefined, dims?: SemanticDims) {
  if ((dims?.activityFirst ?? 0.5) > 0.55) {
    return "活动体验优先";
  }
  const route = avgRouteScore(mainPlan);
  const scene = avgSceneFit(mainPlan);
  if (route !== null && scene !== null) {
    if (route > scene + 3) return "路线最顺";
    if (scene > route + 3) return "场景最匹配";
  }
  return "体验最优";
}

function buildMainRiskSummary(
  mainPlan: ItineraryPlan | undefined,
  routePlan: RoutePlan,
  dims?: SemanticDims,
) {
  const risks = mainPlan?.slots.flatMap((slot) => slot.riskNotes).filter(Boolean) ?? [];
  if (risks.length) {
    return risks[0];
  }

  const waitMinutes = mainPlan?.totalWaitMinutes ?? routePlan.totalWaitMinutes;
  const foodSlot = mainPlan?.slots.find((slot) => slot.slotType === "food");
  const queueMinutes = foodSlot?.waitMinutes ?? foodSlot?.poi?.queueMinutes;

  if (typeof queueMinutes === "number" && queueMinutes >= 20) {
    return `晚餐高峰可能排队 ${Math.round(queueMinutes)} 分钟`;
  }
  if (typeof waitMinutes === "number" && waitMinutes >= 25) {
    return `整体等待可能达到 ${Math.round(waitMinutes)} 分钟`;
  }
  if ((dims?.queueTolerance ?? 0.5) < 0.4) {
    return "排队敏感场景，高峰时段需留意满座风险";
  }
  return "常规出行风险可控，高峰时需留意订位";
}

function formatWaitChip(delta?: number): DiffChip {
  if (typeof delta !== "number" || !Number.isFinite(delta)) {
    return { label: "等待", value: "待估" };
  }
  if (delta === 0) return { label: "等待", value: "持平" };
  const sign = delta > 0 ? "+" : "";
  return { label: "等待", value: `${sign}${delta} 分钟` };
}

function formatCommuteChip(delta?: number): DiffChip {
  if (typeof delta !== "number" || !Number.isFinite(delta)) {
    return { label: "通勤", value: "待估" };
  }
  if (delta === 0) return { label: "通勤", value: "持平" };
  const sign = delta > 0 ? "+" : "";
  return { label: "通勤", value: `${sign}${delta} 分钟` };
}

function formatBudgetChip(delta?: number): DiffChip {
  if (typeof delta !== "number" || !Number.isFinite(delta)) {
    return { label: "预算", value: "待估" };
  }
  if (delta === 0) return { label: "预算", value: "持平" };
  const sign = delta > 0 ? "+" : "";
  return { label: "预算", value: `${sign}¥${Math.abs(delta)}` };
}

function formatSceneChip(mainPlan: ItineraryPlan | undefined, plan: ItineraryPlan): DiffChip {
  const mainScene = avgSceneFit(mainPlan);
  const fallbackScene = avgSceneFit(plan);
  if (mainScene === null || fallbackScene === null) {
    return { label: "场景匹配", value: "待估" };
  }
  const diff = fallbackScene - mainScene;
  if (diff >= 5) return { label: "场景匹配", value: "略强" };
  if (diff <= -5) return { label: "场景匹配", value: "略弱" };
  if (diff <= -2) return { label: "场景匹配", value: "稍弱" };
  if (diff >= 2) return { label: "场景匹配", value: "稍强" };
  return { label: "场景匹配", value: "相当" };
}

function formatRiskChip(plan: ItineraryPlan, diff?: ItineraryPlan["diffFromMain"]) {
  const trigger = plan.trigger ?? "";
  if (diff && diff.deltaWaitMinutes < -5) return { label: "风险", value: "更低" };
  if (diff && diff.deltaWaitMinutes > 5) return { label: "风险", value: "略高" };
  if (/满座|排队|超时|不可订|失败/.test(trigger)) return { label: "风险", value: "更低" };
  return { label: "风险", value: "相当" };
}

function buildApplicableCondition(trigger?: string) {
  if (!trigger) return "当主方案临时不可行时使用";
  if (/满座|排队/.test(trigger)) return "当主餐厅满座 / 排队过长时使用";
  if (/活动|关闭/.test(trigger)) return "当主活动关闭 / 排队过长时使用";
  if (/超时/.test(trigger)) return "当主方案可能超时时使用";
  const first = trigger.split("/")[0]?.trim();
  return first ? `当${first}时使用` : "当主方案临时不可行时使用";
}

function buildBaseSolvedRisk(plan: ItineraryPlan) {
  const diff = plan.diffFromMain;
  const trigger = plan.trigger ?? "";
  if (diff && diff.deltaWaitMinutes < 0) return "等待风险降低";
  if (/满座|排队|不可订|失败/.test(trigger)) return "满座或排队失败风险降低";
  if (/超时/.test(trigger)) return "通勤或行程超时风险降低";
  return FALLBACK_DEFAULT;
}

function buildSolvedRisk(plan: ItineraryPlan, dims?: SemanticDims) {
  const base = buildBaseSolvedRisk(plan);
  const diff = plan.diffFromMain;
  const extras: string[] = [];

  if ((dims?.queueTolerance ?? 0.5) < 0.4) {
    if (diff && diff.deltaWaitMinutes < 0) extras.push("少排队且更易订座");
    else extras.push("稳妥度更高");
  }
  if ((dims?.indoorPreference ?? 0.5) > 0.6 && planHasIndoor(plan)) {
    extras.push("室内优先，天气风险更低");
  }
  if ((dims?.quietPreference ?? 0.5) > 0.6 && planHasQuiet(plan)) {
    extras.push("更安静，适合停留");
  }

  if (!extras.length) return base;
  if (base === FALLBACK_DEFAULT) {
    return `${FALLBACK_DEFAULT.replace("。", "")}，${extras.join("，")}。`;
  }
  return `${base}，${extras.join("，")}`;
}

function buildTradeoffSummary(plan: ItineraryPlan, mainPlan: ItineraryPlan | undefined, dims?: SemanticDims) {
  const diff = plan.diffFromMain;
  const parts: string[] = [];

  if (diff) {
    if (diff.deltaCommuteMinutes > 0) parts.push(`多走 ${diff.deltaCommuteMinutes} 分钟`);
    else if (diff.deltaCommuteMinutes < 0) parts.push(`少走 ${Math.abs(diff.deltaCommuteMinutes)} 分钟`);
    if (diff.deltaBudget > 0) parts.push(`预算 +¥${diff.deltaBudget}`);
    else if (diff.deltaBudget < 0) parts.push(`预算 -¥${Math.abs(diff.deltaBudget)}`);
  }

  const sceneChip = formatSceneChip(mainPlan, plan);
  if (sceneChip.value === "略弱" || sceneChip.value === "稍弱") parts.push("氛围稍弱");

  if ((dims?.budgetLevel ?? 0.5) < 0.45 && diff && diff.deltaBudget > 0 && diff.deltaWaitMinutes < 0) {
    return "预算略高但等待更短，更适合控预算场景下的稳妥回退";
  }
  if ((dims?.budgetLevel ?? 0.5) < 0.45 && diff && diff.deltaBudget > 0) {
    parts.push("预算压力略增");
  }

  if (!parts.length) return "体验略低于主方案，但容错更高";
  return parts.join("，");
}

function buildSummaryLine(plan: ItineraryPlan, dims?: SemanticDims) {
  const diff = plan.diffFromMain;
  const parts: string[] = [];

  if (diff) {
    if (diff.deltaCommuteMinutes !== 0) {
      parts.push(`比主方案${diff.deltaCommuteMinutes > 0 ? "多" : "少"} ${Math.abs(diff.deltaCommuteMinutes)} 分钟`);
    }
    if (diff.deltaWaitMinutes !== 0) {
      parts.push(`预计${diff.deltaWaitMinutes < 0 ? "少等" : "多等"} ${Math.abs(diff.deltaWaitMinutes)} 分钟`);
    }
    if (diff.deltaBudget !== 0) {
      parts.push(`预算${diff.deltaBudget > 0 ? "+" : "-"}¥${Math.abs(diff.deltaBudget)}`);
    }
  }

  if ((dims?.queueTolerance ?? 0.5) < 0.4 && diff && diff.deltaWaitMinutes < 0) {
    parts.push("更符合低排队容忍画像");
  }

  if (!parts.length) return "与主方案节奏接近，侧重降低突发风险。";
  return `${parts.join("，")}。`;
}

function computeFallbackScores(
  mainScore: number,
  plan: ItineraryPlan,
  mainPlan: ItineraryPlan | undefined,
  dims?: SemanticDims,
) {
  const diff = plan.diffFromMain;
  const fallbackAvg = avgGoability(plan);
  let overall = fallbackAvg !== null ? Math.round(fallbackAvg) : mainScore - 7;

  if (diff) {
    if (diff.deltaWaitMinutes < 0) {
      overall += Math.min(3, Math.floor(Math.abs(diff.deltaWaitMinutes) / 10));
    } else if (diff.deltaWaitMinutes > 0) {
      overall -= Math.min(5, Math.floor(diff.deltaWaitMinutes / 5));
    }
    if (diff.deltaCommuteMinutes > 0) {
      overall -= Math.min(8, diff.deltaCommuteMinutes);
    } else if (diff.deltaCommuteMinutes < 0) {
      overall += Math.min(2, Math.floor(Math.abs(diff.deltaCommuteMinutes) / 4));
    }
    if (diff.deltaBudget > 0) {
      overall -= Math.min(5, Math.floor(diff.deltaBudget / 12));
    }
  }

  const mainScene = avgSceneFit(mainPlan);
  const fallbackScene = avgSceneFit(plan);
  if (mainScene !== null && fallbackScene !== null && fallbackScene < mainScene - 3) {
    overall -= Math.min(6, Math.round(mainScene - fallbackScene));
  }

  overall = Math.min(overall, mainScore - 2);

  let safety = mainScore;
  if (diff && diff.deltaWaitMinutes < 0) {
    safety += Math.min(12, Math.round(Math.abs(diff.deltaWaitMinutes) / 2));
  }

  const trigger = plan.trigger ?? "";
  if (/满座|排队|超时|不可订|失败/.test(trigger)) {
    safety += 4;
  }

  const riskNotes = plan.slots.flatMap((slot) => slot.riskNotes);
  safety += Math.min(6, riskNotes.filter((note) => /切换|不可|排队|满座/.test(note)).length * 2);

  if ((dims?.queueTolerance ?? 0.5) < 0.4) {
    if (diff && diff.deltaWaitMinutes < 0) safety += 4;
    if (/排队|满座/.test(trigger)) safety += 3;
  }

  if ((dims?.indoorPreference ?? 0.5) > 0.6 && planHasIndoor(plan)) {
    safety += 2;
  }

  if (diff && diff.deltaCommuteMinutes > 0) {
    safety -= Math.min(4, Math.floor(diff.deltaCommuteMinutes / 4));
  }

  overall = clamp(overall, 55, 94);
  safety = clamp(safety, 60, 98);

  if (diff && diff.deltaWaitMinutes < 0) {
    safety = Math.max(safety, overall + 3);
  }

  return { overallScore: overall, safetyScore: safety };
}

function buildStrategyNote(dims?: SemanticDims) {
  const base = "主方案优先体验最优；备选方案优先降低排队、满座或通勤超时风险。";
  if ((dims?.activityFirst ?? 0.5) > 0.55) {
    return `${base} 当前画像偏活动体验优先。`;
  }
  if ((dims?.queueTolerance ?? 0.5) < 0.4) {
    return `${base} 当前画像对排队较敏感，备选侧重少排队与可订座。`;
  }
  return base;
}

function buildFallbackDisplay(
  plan: ItineraryPlan,
  index: number,
  mainScore: number,
  mainPlan: ItineraryPlan | undefined,
  dims?: SemanticDims,
): FallbackPlanDisplay {
  const { overallScore, safetyScore } = computeFallbackScores(mainScore, plan, mainPlan, dims);
  const diff = plan.diffFromMain;
  const solvedRisk = buildSolvedRisk(plan, dims);
  const tradeoffSummary = buildTradeoffSummary(plan, mainPlan, dims);

  return {
    index,
    planId: plan.id,
    title: plan.title,
    overallScore,
    safetyScore,
    triggerReason: plan.trigger ?? "主方案临时不可行时启用",
    applicableCondition: buildApplicableCondition(plan.trigger),
    solvedRisk,
    tradeoffSummary,
    solvedProblem: solvedRisk,
    tradeoff: tradeoffSummary,
    summaryLine: buildSummaryLine(plan, dims),
    diffChips: [
      formatWaitChip(diff?.deltaWaitMinutes),
      formatCommuteChip(diff?.deltaCommuteMinutes),
      formatBudgetChip(diff?.deltaBudget),
      formatSceneChip(mainPlan, plan),
      formatRiskChip(plan, diff),
    ],
  };
}

export function buildPlanComparison(routePlan: RoutePlan, rankedPois: ScoredPoi[], intent?: Intent): PlanComparisonSummary {
  const mainPlan = routePlan.mainPlan;
  const dims = intent?.semantic?.dims;
  const mainScore = getMainOverallScore(mainPlan, rankedPois);
  const fallbackPlans = routePlan.fallbackPlans ?? [];

  return {
    main: {
      overallScore: mainScore,
      experienceLabel: buildMainExperienceLabel(mainPlan, dims),
      riskSummary: buildMainRiskSummary(mainPlan, routePlan, dims),
    },
    fallbacks: fallbackPlans.map((plan, index) => buildFallbackDisplay(plan, index, mainScore, mainPlan, dims)),
    strategyNote: buildStrategyNote(dims),
  };
}

export function getFallbackDisplay(
  comparison: PlanComparisonSummary,
  index: number | null,
): FallbackPlanDisplay | undefined {
  if (index === null || index < 0) return undefined;
  return comparison.fallbacks[index];
}

export function getActivePlanScores(
  comparison: PlanComparisonSummary,
  selectedPlanType: "main" | "fallback",
  selectedFallbackIndex: number | null,
) {
  if (selectedPlanType === "fallback" && selectedFallbackIndex !== null) {
    const fallback = getFallbackDisplay(comparison, selectedFallbackIndex);
    if (fallback) {
      return { overallScore: fallback.overallScore, safetyScore: fallback.safetyScore };
    }
  }
  return { overallScore: comparison.main.overallScore, safetyScore: undefined };
}

export function getActivePlanLabels(
  comparison: PlanComparisonSummary,
  selectedPlanType: "main" | "fallback",
  selectedFallbackIndex: number | null,
) {
  if (selectedPlanType === "fallback" && selectedFallbackIndex !== null) {
    const fallback = getFallbackDisplay(comparison, selectedFallbackIndex);
    if (fallback) {
      return {
        experienceLabel: undefined,
        riskSummary: undefined,
        solvedRisk: fallback.solvedRisk,
        tradeoffSummary: fallback.tradeoffSummary,
      };
    }
  }
  return {
    experienceLabel: comparison.main.experienceLabel,
    riskSummary: comparison.main.riskSummary,
    solvedRisk: undefined,
    tradeoffSummary: undefined,
  };
}
