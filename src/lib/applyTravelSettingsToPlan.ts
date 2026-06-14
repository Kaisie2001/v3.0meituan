import { inferPersona } from "./persona";
import {
  ROUTE_PRIORITY_LABELS,
  TRANSPORT_MODE_LABELS,
  type TravelSettings,
} from "./preferenceSummary";
import { generateExecutionActions } from "./planRoute";
import type {
  Intent,
  ItineraryPlan,
  ParseResult,
  RoutePlan,
  RouteSlot,
  RouteStep,
  ScoredPoi,
} from "./types";

export type TimePeriodKey = "morning" | "afternoon" | "evening_rush" | "night" | "unknown";

export type PlanningSignals = {
  routePriority: string;
  transportMode: string;
  timeWindow: string;
  impacts: string[];
};

export type ApplyTravelSettingsResult = {
  adjustedRankedPois: ScoredPoi[];
  adjustedRoutePlan: RoutePlan;
  adjustedFallbackPlans: ItineraryPlan[];
  planningSignals: PlanningSignals;
  settingImpactSummary: string;
};

type BookingStatus = "available" | "limited" | "full";

function safeNumber(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function sanitizePoi(poi: ScoredPoi): ScoredPoi {
  return {
    ...poi,
    queueMinutes: safeNumber(poi.queueMinutes, 0),
    pricePerPerson: safeNumber(poi.pricePerPerson, 0),
    routeEtaMinutes: safeNumber(poi.routeEtaMinutes, 0),
    distanceMeters: safeNumber(poi.distanceMeters, 0),
    goabilityScore: safeNumber(poi.goabilityScore, 0),
  };
}

function parseStartMinutes(startTime?: string) {
  if (typeof startTime !== "string" || !startTime.includes(":")) return null;
  const [hourRaw, minuteRaw] = startTime.split(":").map(Number);
  if (!Number.isFinite(hourRaw) || !Number.isFinite(minuteRaw)) return null;
  return hourRaw * 60 + minuteRaw;
}

export function classifyTimePeriod(startTime?: string): TimePeriodKey {
  const minutes = parseStartMinutes(startTime);
  if (minutes === null) return "unknown";
  if (minutes >= 18 * 60 && minutes < 20 * 60) return "evening_rush";
  if (minutes >= 14 * 60 && minutes < 17 * 60) return "afternoon";
  if (minutes >= 20 * 60) return "night";
  if (minutes >= 9 * 60 && minutes < 14 * 60) return "morning";
  return "unknown";
}

function clampScore(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function poiQueueMinutes(poi: ScoredPoi) {
  return safeNumber(poi.queueMinutes, 0);
}

function poiPrice(poi: ScoredPoi) {
  return safeNumber(poi.pricePerPerson, 0);
}

function poiEta(poi: ScoredPoi) {
  return safeNumber(poi.routeEtaMinutes, 0);
}

function poiDistanceMeters(poi: ScoredPoi) {
  return safeNumber(poi.distanceMeters, 0);
}

function bookingStatus(poi: ScoredPoi): BookingStatus {
  const queueMinutes = poiQueueMinutes(poi);
  if (poi.reservationAvailable && queueMinutes <= 8) return "available";
  if (!poi.reservationAvailable && queueMinutes >= 15) return "full";
  if (!poi.reservationAvailable || queueMinutes >= 10) return "limited";
  return "available";
}

function poiDistance(a: ScoredPoi, b: ScoredPoi) {
  if (
    typeof a.lat === "number" &&
    typeof a.lng === "number" &&
    typeof b.lat === "number" &&
    typeof b.lng === "number"
  ) {
    const dx = (a.lng - b.lng) * 9600;
    const dy = (a.lat - b.lat) * 111000;
    return Math.sqrt(dx * dx + dy * dy);
  }
  const dx = (a.x ?? 50) - (b.x ?? 50);
  const dy = (a.y ?? 50) - (b.y ?? 50);
  return Math.sqrt(dx * dx + dy * dy) * 12;
}

function routeSpread(pois: ScoredPoi[]) {
  if (pois.length < 2) return 0;
  let total = 0;
  for (let i = 1; i < pois.length; i += 1) {
    total += poiDistance(pois[i - 1], pois[i]);
  }
  return total;
}

function computePoiAdjustment(
  poi: ScoredPoi,
  settings: TravelSettings,
  period: TimePeriodKey,
  intent: Intent,
) {
  let delta = 0;
  const budget = settings.budget ?? intent.budgetPerPerson ?? 150;
  const maxCommute = settings.maxCommute ?? intent.maxCommuteMinutes ?? 30;
  const booking = bookingStatus(poi);

  const queueMinutes = poiQueueMinutes(poi);
  const price = poiPrice(poi);
  const eta = poiEta(poi);
  const distance = poiDistanceMeters(poi);

  switch (settings.routePriority) {
    case "queue":
      delta -= queueMinutes * 2.2;
      if (booking === "full") delta -= 22;
      if (booking === "limited") delta -= 10;
      if (poi.reservationAvailable) delta += 12;
      if (queueMinutes <= 8) delta += 8;
      break;
    case "distance":
      delta -= distance / 120;
      delta -= eta * 1.8;
      break;
    case "detour":
      delta -= distance / 150;
      delta -= eta * 1.2;
      if (poi.nearMetro) delta += 4;
      break;
    case "time":
      delta -= eta * 2.4;
      delta -= queueMinutes * 0.8;
      break;
    case "cost":
      delta -= Math.max(0, price - budget) * 2.5;
      if (price <= budget) delta += 10;
      break;
    case "experience":
      delta += safeNumber(poi.sceneFitScore, 0) * 0.18;
      delta -= queueMinutes * 0.6;
      delta -= eta * 0.4;
      break;
    default:
      break;
  }

  switch (settings.transportMode) {
    case "walking":
      if (eta > Math.min(maxCommute, 20)) delta -= 18;
      if (eta <= 12) delta += 10;
      if (distance > 900) delta -= 12;
      break;
    case "transit":
      if (poi.nearMetro) delta += 10;
      if (eta > maxCommute + 5) delta -= 8;
      break;
    case "driving":
      if (eta <= maxCommute + 8) delta += 6;
      if (eta >= 14) delta += 8;
      if (period === "evening_rush") delta -= 4;
      break;
    default:
      if (eta <= maxCommute) delta += 3;
      break;
  }

  if (period === "evening_rush") {
    if (settings.routePriority === "queue") {
      delta -= queueMinutes * 1.2;
      if (booking !== "available") delta -= 8;
    }
    if (settings.transportMode === "driving") delta -= 6;
  }

  if (period === "night" && poi.category === "restaurant" && !poi.openNow) {
    delta -= 30;
  }

  if (period === "night" && !poi.reservationAvailable && poi.category === "restaurant") {
    delta -= 6;
  }

  return delta;
}

function computeAdjustedScore(
  poi: ScoredPoi,
  settings: TravelSettings,
  period: TimePeriodKey,
  intent: Intent,
) {
  const base = poi.goabilityScore ?? 0;
  return clampScore(base + computePoiAdjustment(poi, settings, period, intent));
}

function buildPlanningImpacts(settings: TravelSettings, period: TimePeriodKey): string[] {
  const impacts: string[] = [];
  switch (settings.routePriority) {
    case "queue":
      impacts.push("已优先降低排队风险");
      break;
    case "distance":
      impacts.push("已优先减少步行距离");
      break;
    case "detour":
      impacts.push("已优化顺路节点");
      break;
    case "time":
      impacts.push("已压缩转场时间");
      break;
    case "cost":
      impacts.push("已控制人均预算匹配");
      break;
    case "experience":
      impacts.push("已保留更高场景匹配度");
      break;
    default:
      impacts.push("已综合平衡距离、等待与预算");
      break;
  }

  switch (settings.transportMode) {
    case "walking":
      impacts.push("步行优先选择更紧凑路线");
      break;
    case "transit":
      impacts.push("公共交通优先稳定换乘");
      break;
    case "driving":
      impacts.push(period === "evening_rush" ? "驾车方案已考虑晚高峰交通风险" : "驾车方案保留更远但少转场节点");
      break;
    default:
      impacts.push("系统综合推荐平衡各因素");
      break;
  }

  if (period === "evening_rush" && settings.routePriority === "queue") {
    impacts.push("晚高峰备选优先等待更短节点");
  }
  if (period === "night") {
    impacts.push("夜间方案关注营业与收尾开放");
  }

  return impacts;
}

export function buildSettingImpactSummary(settings: TravelSettings, period: TimePeriodKey) {
  const priorityLabel = ROUTE_PRIORITY_LABELS[settings.routePriority] ?? "时间最短";
  const transportLabel = TRANSPORT_MODE_LABELS[settings.transportMode] ?? "系统综合推荐";

  switch (settings.routePriority) {
    case "queue":
      return period === "evening_rush"
        ? `已按「${priorityLabel}」优先降低晚高峰等待风险`
        : `已按「${priorityLabel}」优先降低等待风险`;
    case "distance":
      return settings.transportMode === "walking"
        ? `已按「${transportLabel}」选择更紧凑路线`
        : `已按「${priorityLabel}」优先减少步行距离`;
    case "detour":
      return `已按「${priorityLabel}」优化顺路节点`;
    case "time":
      return `已按「${priorityLabel}」压缩转场时间`;
    case "cost":
      return `已按「${priorityLabel}」控制人均 ¥${settings.budget} 以内节点`;
    case "experience":
      return `已按「${priorityLabel}」保留氛围匹配，可能牺牲最短路径`;
    default:
      return `已按「${transportLabel}」与「${priorityLabel}」综合调整方案`;
  }
}

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

function toMinutes(time: string) {
  const [h, m] = time.split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return 0;
  return h * 60 + m;
}

function toTime(minutes: number) {
  const value = ((minutes % (24 * 60)) + 24 * 60) % (24 * 60);
  return `${pad2(Math.floor(value / 60))}:${pad2(value % 60)}`;
}

function buildSlot(params: {
  slotType: RouteSlot["slotType"];
  poi?: ScoredPoi;
  transportMode: TravelSettings["transportMode"];
  startTime: string;
  durationMinutes: number;
  rationaleNotes?: string[];
  riskNotes?: string[];
}): { slot: RouteSlot; endTime: string } {
  const baseEta = params.poi ? poiEta(params.poi) : 0;
  const etaMultiplier =
    params.transportMode === "driving" ? 0.82 : params.transportMode === "walking" ? 1.6 : 1;
  const etaMinutes = Math.max(0, Math.round(baseEta * etaMultiplier));
  const waitMinutes = params.poi ? poiQueueMinutes(params.poi) : 0;
  const endMinutes = toMinutes(params.startTime) + etaMinutes + waitMinutes + params.durationMinutes;
  const endTime = toTime(endMinutes);

  return {
    slot: {
      slotType: params.slotType,
      poi: params.poi,
      startTime: params.startTime,
      endTime,
      etaMinutes,
      waitMinutes,
      rationaleNotes: params.rationaleNotes ?? [],
      riskNotes: params.riskNotes ?? [],
    },
    endTime,
  };
}

function buildStepsFromSlots(slots: RouteSlot[]): RouteStep[] {
  if (!slots.length) return [];
  const steps: RouteStep[] = [];
  const first = slots[0];
  steps.push({
    time: first.startTime,
    title: "从当前位置出发",
    detail: first.poi ? `前往 ${first.poi.name}，预计通勤 ${first.etaMinutes} 分钟` : "等待推荐点位",
    poiId: first.poi?.id,
  });
  for (const slot of slots) {
    const title = slot.slotType === "activity" ? "活动" : slot.slotType === "food" ? "用餐" : "加餐/散步";
    steps.push({
      time: `${slot.startTime}-${slot.endTime}`,
      title: `${title}：${slot.poi?.name ?? "推荐点位"}`,
      detail: slot.poi
        ? `ETA ${slot.etaMinutes} 分钟，等待 ${slot.waitMinutes} 分钟，人均 ${poiPrice(slot.poi)} 元`
        : "待补充点位",
      poiId: slot.poi?.id,
    });
  }
  return steps;
}

function sumSlots(slots: RouteSlot[]) {
  return slots.reduce(
    (acc, slot) => {
      acc.totalCommuteMinutes += slot.etaMinutes;
      acc.totalWaitMinutes += slot.waitMinutes;
      if (slot.poi) acc.totalBudget += slot.poi.pricePerPerson;
      return acc;
    },
    { totalCommuteMinutes: 0, totalWaitMinutes: 0, totalBudget: 0 },
  );
}

function sortCandidates(
  candidates: ScoredPoi[],
  settings: TravelSettings,
  period: TimePeriodKey,
  intent: Intent,
  anchor?: ScoredPoi,
) {
  return [...candidates].sort((a, b) => {
    const scoreA = computeAdjustedScore(a, settings, period, intent);
    const scoreB = computeAdjustedScore(b, settings, period, intent);
    if (scoreB !== scoreA) return scoreB - scoreA;

    if (settings.routePriority === "queue") return poiQueueMinutes(a) - poiQueueMinutes(b);
    if (settings.routePriority === "distance" || settings.routePriority === "detour") {
      return poiDistanceMeters(a) - poiDistanceMeters(b);
    }
    if (settings.routePriority === "cost") return poiPrice(a) - poiPrice(b);
    if (anchor) return poiDistance(a, anchor) - poiDistance(b, anchor);
    return poiEta(a) - poiEta(b);
  });
}

function pickFromCategory(
  ranked: ScoredPoi[],
  category: ScoredPoi["category"] | ScoredPoi["category"][],
  settings: TravelSettings,
  period: TimePeriodKey,
  intent: Intent,
  excludeIds: Set<string>,
  anchor?: ScoredPoi,
) {
  const categories = Array.isArray(category) ? category : [category];
  const maxCommute = settings.maxCommute ?? intent.maxCommuteMinutes ?? 30;
  const candidates = ranked.filter(
    (poi) =>
      poi.openNow &&
      categories.includes(poi.category) &&
      poi.routeEtaMinutes <= maxCommute + (settings.transportMode === "driving" ? 8 : 0) &&
      !excludeIds.has(poi.id),
  );
  return sortCandidates(candidates, settings, period, intent, anchor)[0];
}

function buildRationale(poi: ScoredPoi, settings: TravelSettings, period: TimePeriodKey) {
  const notes: string[] = [`通勤 ${poiEta(poi)} 分钟`];
  if (settings.routePriority === "queue" && poiQueueMinutes(poi) <= 10) notes.push("排队较短");
  if (settings.routePriority === "cost" && poiPrice(poi) <= settings.budget) notes.push("人均在预算内");
  if (settings.transportMode === "walking" && poiEta(poi) <= 15) notes.push("适合步行转场");
  if (settings.transportMode === "transit" && poi.nearMetro) notes.push("近地铁便于公共交通");
  if (period === "evening_rush" && poi.reservationAvailable) notes.push("晚高峰建议可订座");
  return notes.slice(0, 3);
}

function rebuildRoutePlan(
  rankedPois: ScoredPoi[],
  intent: Intent,
  settings: TravelSettings,
  period: TimePeriodKey,
): RoutePlan {
  const startTime = settings.startTime ?? intent.startTime ?? intent.timeWindow.start ?? "14:00";
  const durationMinutes = intent.durationMinutes ?? 180;
  const partySize = settings.partySize ?? intent.partySize ?? 2;
  const queueLimit = settings.routePriority === "queue" ? 10 : 15;

  const activity = pickFromCategory(rankedPois, ["activity", "mall"], settings, period, intent, new Set());
  const restaurant = pickFromCategory(rankedPois, "restaurant", settings, period, intent, new Set(), activity);
  const exclude = new Set([activity?.id, restaurant?.id].filter(Boolean) as string[]);
  const fallbackActivity = pickFromCategory(rankedPois, ["activity", "mall"], settings, period, intent, exclude, activity);
  exclude.add(fallbackActivity?.id ?? "");
  const fallbackRestaurant = pickFromCategory(rankedPois, "restaurant", settings, period, intent, exclude, activity);

  const activityDuration = Math.min(150, Math.max(90, Math.round(durationMinutes * 0.4)));
  const foodDuration = 75;
  const extraDuration = Math.max(0, durationMinutes - activityDuration - foodDuration);

  const slotA = buildSlot({
    slotType: "activity",
    poi: activity,
    transportMode: settings.transportMode,
    startTime,
    durationMinutes: activityDuration,
    rationaleNotes: activity ? buildRationale(activity, settings, period) : [],
    riskNotes: activity && poiQueueMinutes(activity) > queueLimit ? [`排队可能超过 ${queueLimit} 分钟`] : [],
  });
  const slotB = buildSlot({
    slotType: "food",
    poi: restaurant,
    transportMode: settings.transportMode,
    startTime: slotA.endTime,
    durationMinutes: foodDuration,
    rationaleNotes: restaurant ? buildRationale(restaurant, settings, period) : [],
    riskNotes:
      restaurant && !restaurant.reservationAvailable && period === "evening_rush"
        ? ["晚高峰建议提前订座"]
        : [],
  });

  const slots: RouteSlot[] = [slotA.slot, slotB.slot];
  if (extraDuration >= 45 && fallbackActivity) {
    const extra = buildSlot({
      slotType: "extra",
      poi: fallbackActivity,
      transportMode: settings.transportMode,
      startTime: slotB.endTime,
      durationMinutes: Math.min(90, extraDuration),
      rationaleNotes: buildRationale(fallbackActivity, settings, period),
    });
    slots.push(extra.slot);
  }

  const totals = sumSlots(slots);
  const mainPlan: ItineraryPlan = {
    id: "main",
    title: "主方案",
    slots,
    steps: buildStepsFromSlots(slots),
    totalMinutes: durationMinutes + totals.totalWaitMinutes,
    totalBudget: totals.totalBudget * partySize,
    totalWaitMinutes: totals.totalWaitMinutes,
    totalCommuteMinutes: totals.totalCommuteMinutes,
  };

  const fallbackPlans: ItineraryPlan[] = [];

  const buildFallback = (
    id: string,
    title: string,
    trigger: string,
    fbSlots: RouteSlot[],
    mainTotals: typeof totals,
  ) => {
    const fbTotals = sumSlots(fbSlots);
    fallbackPlans.push({
      id,
      title,
      trigger,
      diffFromMain: {
        deltaBudget: fbTotals.totalBudget * partySize - mainTotals.totalBudget * partySize,
        deltaWaitMinutes: fbTotals.totalWaitMinutes - mainTotals.totalWaitMinutes,
        deltaCommuteMinutes: fbTotals.totalCommuteMinutes - mainTotals.totalCommuteMinutes,
      },
      slots: fbSlots,
      steps: buildStepsFromSlots(fbSlots),
      totalMinutes: durationMinutes + fbTotals.totalWaitMinutes,
      totalBudget: fbTotals.totalBudget * partySize,
      totalWaitMinutes: fbTotals.totalWaitMinutes,
      totalCommuteMinutes: fbTotals.totalCommuteMinutes,
    });
  };

  if (fallbackRestaurant && restaurant && fallbackRestaurant.id !== restaurant.id) {
    const fbRestaurant =
      settings.routePriority === "queue" || period === "evening_rush"
        ? sortCandidates(
            rankedPois
              .filter(
                (poi) =>
                  poi.category === "restaurant" &&
                  poi.openNow &&
                  poi.id !== restaurant.id &&
                  poiQueueMinutes(poi) < poiQueueMinutes(restaurant),
              ),
            settings,
            period,
            intent,
            activity,
          )[0] ?? fallbackRestaurant
        : fallbackRestaurant;

    const fbB = buildSlot({
      slotType: "food",
      poi: fbRestaurant,
      transportMode: settings.transportMode,
      startTime: slotA.endTime,
      durationMinutes: foodDuration,
      rationaleNotes: fbRestaurant ? buildRationale(fbRestaurant, settings, period) : [],
      riskNotes:
        settings.routePriority === "queue" || period === "evening_rush"
          ? ["已替换等待更短的节点，减少晚高峰排队风险"]
          : ["主餐厅不可订/排队过长时切换"],
    });
    const fbSlots = [slotA.slot, fbB.slot];
    if (extraDuration >= 45 && fallbackActivity) {
      fbSlots.push(
        buildSlot({
          slotType: "extra",
          poi: fallbackActivity,
          transportMode: settings.transportMode,
          startTime: fbB.endTime,
          durationMinutes: Math.min(90, extraDuration),
          rationaleNotes: buildRationale(fallbackActivity, settings, period),
        }).slot,
      );
    }
    buildFallback(
      "fallback-restaurant",
      settings.routePriority === "detour" ? "备选：更顺路餐厅" : "备选：替换餐厅",
      settings.routePriority === "queue" ? "排队偏长 / 不可订时切换等待更短节点" : "订位失败 / 排队超阈值 / 超预算",
      fbSlots,
      totals,
    );
  }

  if (fallbackActivity && activity && fallbackActivity.id !== activity.id) {
    const fbActivity =
      settings.routePriority === "distance" || settings.transportMode === "walking"
        ? sortCandidates(
            rankedPois.filter(
              (poi) =>
                (poi.category === "activity" || poi.category === "mall") &&
                poi.openNow &&
                poi.id !== activity.id,
            ),
            settings,
            period,
            intent,
          )[0] ?? fallbackActivity
        : fallbackActivity;

    const fbA = buildSlot({
      slotType: "activity",
      poi: fbActivity,
      transportMode: settings.transportMode,
      startTime,
      durationMinutes: activityDuration,
      rationaleNotes: fbActivity ? buildRationale(fbActivity, settings, period) : [],
      riskNotes: settings.routePriority === "detour" ? ["减少折返，顺路衔接"] : ["主活动不可用/排队过长时切换"],
    });
    const fbSlots = [fbA.slot, slotB.slot];
    if (extraDuration >= 45 && activity) {
      fbSlots.push(
        buildSlot({
          slotType: "extra",
          poi: activity,
          transportMode: settings.transportMode,
          startTime: slotB.endTime,
          durationMinutes: Math.min(90, extraDuration),
          rationaleNotes: buildRationale(activity, settings, period),
        }).slot,
      );
    }
    buildFallback("fallback-activity", "备选：替换活动", "活动关闭 / 排队超阈值 / 不适合人群", fbSlots, totals);
  }

  return {
    activity,
    fallbackActivity,
    restaurant,
    fallbackRestaurant,
    totalMinutes: mainPlan.totalMinutes,
    totalBudget: mainPlan.totalBudget,
    totalWaitMinutes: mainPlan.totalWaitMinutes,
    fitsTimeWindow: mainPlan.totalWaitMinutes <= queueLimit + 12,
    steps: mainPlan.steps,
    mainPlan,
    fallbackPlans,
  };
}

export function applyTravelSettingsToPlan(params: {
  routePlan: RoutePlan;
  rankedPois: ScoredPoi[];
  parseResult: ParseResult;
  travelSettings: TravelSettings;
}): ApplyTravelSettingsResult {
  const { parseResult, travelSettings } = params;
  const intent = parseResult.intent;
  const period = classifyTimePeriod(travelSettings.startTime);
  const ranked = (params.rankedPois ?? []).map(sanitizePoi);

  if (!ranked.length) {
    return {
      adjustedRankedPois: [],
      adjustedRoutePlan: params.routePlan,
      adjustedFallbackPlans: params.routePlan.fallbackPlans ?? [],
      planningSignals: {
        routePriority: ROUTE_PRIORITY_LABELS[travelSettings.routePriority],
        transportMode: TRANSPORT_MODE_LABELS[travelSettings.transportMode],
        timeWindow: period,
        impacts: ["暂无 POI 数据，保留原方案"],
      },
      settingImpactSummary: buildSettingImpactSummary(travelSettings, period),
    };
  }

  const adjustedRankedPois = [...ranked]
    .map((poi) => ({
      ...poi,
      goabilityScore: computeAdjustedScore(poi, travelSettings, period, intent),
    }))
    .sort((a, b) => b.goabilityScore - a.goabilityScore);

  const adjustedRoutePlan = rebuildRoutePlan(adjustedRankedPois, intent, travelSettings, period);
  const impacts = buildPlanningImpacts(travelSettings, period);

  void inferPersona(parseResult);

  return {
    adjustedRankedPois,
    adjustedRoutePlan,
    adjustedFallbackPlans: adjustedRoutePlan.fallbackPlans ?? [],
    planningSignals: {
      routePriority: ROUTE_PRIORITY_LABELS[travelSettings.routePriority],
      transportMode: TRANSPORT_MODE_LABELS[travelSettings.transportMode],
      timeWindow: period,
      impacts,
    },
    settingImpactSummary: buildSettingImpactSummary(travelSettings, period),
  };
}

export function applyTravelSettingsToAgentResult(
  agentResult: {
    routePlan: RoutePlan;
    rankedPois: ScoredPoi[];
    parseResult: ParseResult;
    executionActions?: ReturnType<typeof generateExecutionActions>;
  },
  travelSettings: TravelSettings,
) {
  const adjusted = applyTravelSettingsToPlan({
    routePlan: agentResult.routePlan,
    rankedPois: agentResult.rankedPois,
    parseResult: agentResult.parseResult,
    travelSettings,
  });

  return {
    ...agentResult,
    rankedPois: adjusted.adjustedRankedPois,
    routePlan: adjusted.adjustedRoutePlan,
    executionActions: generateExecutionActions(adjusted.adjustedRoutePlan),
    planningAdjustment: adjusted,
  };
}

export function computeRouteSpreadFromPlan(routePlan: RoutePlan) {
  const pois =
    routePlan.mainPlan?.slots.map((slot) => slot.poi).filter((poi): poi is ScoredPoi => Boolean(poi?.id)) ?? [];
  return routeSpread(pois);
}

export function getTravelSettingsPoiAdjustment(
  poi: ScoredPoi,
  settings: TravelSettings,
  intent: Intent,
) {
  const period = classifyTimePeriod(settings.startTime);
  return computePoiAdjustment(sanitizePoi(poi), settings, period, intent);
}

export function computeAdjustedScoreForSettings(
  poi: ScoredPoi,
  settings: TravelSettings,
  intent: Intent,
) {
  const period = classifyTimePeriod(settings.startTime);
  return computeAdjustedScore(sanitizePoi(poi), settings, period, intent);
}

export { routeSpread, computeAdjustedScore, bookingStatus };
