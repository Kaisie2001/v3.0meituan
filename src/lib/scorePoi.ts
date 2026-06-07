import type { Intent, Poi, ScoredPoi } from "./types";
import { stableJitter } from "@/lib/semanticHash";

function clamp(score: number) {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function countMatches(source: string[], targets: string[]) {
  const joined = source.join(" ");
  return targets.filter((target) => joined.includes(target)).length;
}

function buildReasons(poi: Poi, intent: Intent) {
  const reasons: string[] = [];
  const positiveText = [...poi.sceneTags, ...poi.reviewPositive].join(" ");

  if (countMatches(poi.sceneTags, intent.needTags) > 0) {
    reasons.push(`匹配 ${poi.sceneTags.filter((tag) => intent.needTags.includes(tag)).slice(0, 3).join(" / ")} 等需求标签`);
  }
  if (/安静|插座|适合|清淡|地铁|可提前订位|预算/.test(positiveText)) {
    reasons.push("点评证据包含安静、插座、清淡或交通便利等关键词");
  }
  if (poi.distanceMeters <= 900 || poi.routeEtaMinutes <= 12) {
    reasons.push(`距离 ${poi.distanceMeters}m，路线 ETA ${poi.routeEtaMinutes} 分钟，绕路成本低`);
  }
  if (poi.reservationAvailable || poi.queueMinutes <= 10) {
    reasons.push(poi.reservationAvailable ? "当前支持预订，履约确定性更高" : "当前排队较短，可直接前往");
  }
  if (intent.seededNames.includes(poi.name)) {
    reasons.push("来自用户收藏内容，并通过本次需求重新校验");
  }

  return reasons.slice(0, 4);
}

function buildRisks(poi: Poi, intent: Intent) {
  const risks: string[] = [];
  const negativeText = [...poi.reviewNegative, ...poi.riskTags].join(" ");

  if (poi.queueMinutes >= 15) risks.push(`排队约 ${poi.queueMinutes} 分钟，可能压缩活动时间`);
  if (/座位少|太吵|音乐偏大|插座少|网红/.test(negativeText)) {
    risks.push("评论或风险标签中出现座位少、太吵、插座少等信号");
  }
  if (!poi.reservationAvailable && poi.category === "restaurant") risks.push("不支持预订，晚餐履约风险偏高");
  if (poi.distanceMeters > 1000 || poi.routeEtaMinutes > 16) risks.push("距离或 ETA 偏高，可能不满足少走路约束");
  if (poi.pricePerPerson > intent.budgetPerPerson) risks.push(`人均 ${poi.pricePerPerson} 元，超过预算 ${intent.budgetPerPerson} 元`);
  if (!poi.openNow) risks.push("当前不可用，不能纳入执行方案");

  return risks.length ? risks : ["暂无明显风险，建议按当前路线执行"];
}

export function scorePoi(poi: Poi, intent: Intent): ScoredPoi {
  const seed = intent.semantic?.seed ?? 0;
  const dims = intent.semantic?.dims;
  const preferActivity = (dims?.activityFirst ?? 0.5) > 0.55;
  const queueTolerance = dims?.queueTolerance ?? 0.5;
  const goal = intent.routePrefs?.goal ?? "time";
  const customGoal = intent.routePrefs?.customGoal ?? "";
  const normalizedGoal =
    goal !== "custom"
      ? goal
      : /省钱|便宜|预算|人均|优惠/.test(customGoal)
        ? "cost"
        : /距离|就近|少走|不折返|绕路/.test(customGoal)
          ? "distance"
          : /时间|用时|快点|尽快|少排队/.test(customGoal)
            ? "time"
            : "custom";

  const needMatches = countMatches([...poi.sceneTags, ...poi.reviewPositive], intent.needTags);
  const avoidMatches = countMatches([...poi.sceneTags, ...poi.reviewNegative, ...poi.riskTags], intent.avoidTags);
  const categoryBoost = intent.desiredCategories.includes(poi.category) ? 12 : 0;
  const activityBoost = preferActivity && (poi.category === "activity" || poi.category === "mall") ? 10 : 0;
  const foodBoost = !preferActivity && poi.category === "restaurant" ? 8 : 0;
  const quietBoost = (intent.preferQuiet || (dims?.quietPreference ?? 0.5) > 0.6) && poi.sceneTags.includes("安静") ? 12 : 0;
  const lightBoost = (intent.preferLightDinner || (dims?.budgetLevel ?? 0.5) < 0.55) && (poi.sceneTags.includes("清淡") || poi.sceneTags.includes("轻食")) ? 12 : 0;

  const sceneFitScore = clamp(46 + needMatches * 9 + categoryBoost + activityBoost + foodBoost + quietBoost + lightBoost - avoidMatches * 13);
  const objectivePenalty =
    normalizedGoal === "time"
      ? poi.routeEtaMinutes * 1.6 + poi.queueMinutes * 1.2
      : normalizedGoal === "distance"
        ? poi.distanceMeters / 240
        : normalizedGoal === "cost"
          ? poi.pricePerPerson / 6
          : (poi.routeEtaMinutes * 1.2 + poi.queueMinutes * 0.9 + stableJitter(seed, `custom:${customGoal}:${poi.id}`) * 6);

  const routeScore = clamp(100 - poi.routeEtaMinutes * 3.0 - Math.max(0, poi.distanceMeters - 700) / 25 - objectivePenalty + (poi.nearMetro ? 12 : 0));
  const availabilityScore = clamp((poi.openNow ? 55 : 0) + (poi.reservationAvailable ? 25 : 0) + (poi.dealAvailable ? 10 : 0) + (poi.crowdLevel === "low" ? 10 : poi.crowdLevel === "medium" ? 4 : -8));
  const waitPenalty = (2.4 + (1 - queueTolerance) * 2.4) * poi.queueMinutes;
  const waitRiskScore = clamp(100 - waitPenalty - (poi.crowdLevel === "high" ? 20 : 0));
  const preferenceScore = clamp(
    58 +
      (poi.pricePerPerson <= intent.budgetPerPerson ? 12 : -18) +
      (intent.preferMetro && poi.nearMetro ? 14 : 0) +
      (intent.seededNames.includes(poi.name) ? 8 : 0) -
      avoidMatches * 8,
  );

  const rawGoabilityScore =
    sceneFitScore * 0.4 +
    routeScore * 0.25 +
    availabilityScore * 0.2 +
    waitRiskScore * 0.1 +
    preferenceScore * 0.05;

  const jitter = stableJitter(seed, poi.id) * 6.5;
  const goabilityScore = poi.openNow ? clamp(rawGoabilityScore + jitter) : 0;
  const level = !poi.openNow ? "gray" : goabilityScore >= 80 ? "green" : goabilityScore >= 60 ? "yellow" : "red";

  return {
    ...poi,
    sceneFitScore,
    routeScore,
    availabilityScore,
    waitRiskScore,
    preferenceScore,
    goabilityScore,
    level,
    reasons: buildReasons(poi, intent),
    risks: buildRisks(poi, intent),
  };
}

export function sortByGoability(pois: ScoredPoi[]) {
  return [...pois].sort((a, b) => b.goabilityScore - a.goabilityScore);
}
