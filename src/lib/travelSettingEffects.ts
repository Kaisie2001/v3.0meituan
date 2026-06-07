import {
  getDateLabel,
  getDurationLabel,
  ROUTE_PRIORITY_LABELS,
  TRANSPORT_MODE_LABELS,
  travelSettingsToTimePickerValue,
  type RoutePriorityChoice,
  type TransportModeChoice,
  type TravelSettings,
} from "./preferenceSummary";
import {
  buildTimeWindowEffects,
  type TimePeriodKey,
  type TimeWindowEffectsSummary,
} from "./timeWindowEffects";

export type TravelSettingEffectsSummary = {
  hasCompleteSettings: boolean;
  windowHeadline: string;
  periodLabel: string;
  periodKey: TimePeriodKey;
  crowdRisk: string;
  trafficRisk: string;
  bookingRisk: string;
  dynamicBadges: string[];
  planningAdvice: string;
  fallbackReasonHint: string;
  routeGuidanceHint: string;
  preferenceReason: string;
  riskSummaryLine: string;
  fallbackCardHint: string;
  poiDynamicHint: string;
  transportMode: TransportModeChoice;
  routePriority: RoutePriorityChoice;
};

const DEFAULT_SUMMARY_TEXT = "系统按默认短时活动窗口估算。";

function isCompleteSettings(settings?: TravelSettings | null): settings is TravelSettings {
  if (!settings?.startTime) return false;
  if (!Number.isFinite(settings.partySize) || settings.partySize <= 0) return false;
  if (!Number.isFinite(settings.budget) || settings.budget <= 0) return false;
  if (!Number.isFinite(settings.maxCommute) || settings.maxCommute <= 0) return false;
  return true;
}

function buildRiskSummaryLine(params: {
  crowdRisk: string;
  trafficRisk: string;
  bookingRisk: string;
  periodKey: TimePeriodKey;
  routePriority: RoutePriorityChoice;
}) {
  const parts = [`排队风险${params.crowdRisk}`, `交通风险${params.trafficRisk}`];
  if (params.periodKey === "evening_rush" || params.bookingRisk === "高") {
    parts.push(`可订风险${params.bookingRisk}`);
  }
  if (params.routePriority === "queue" || params.periodKey === "evening_rush") {
    parts.push("建议优先可订座");
  } else if (params.routePriority === "time") {
    parts.push("优先时间可控转场");
  }
  return parts.join(" · ");
}

function adjustTrafficRisk(base: string, transportMode: TransportModeChoice, periodKey: TimePeriodKey) {
  if (transportMode === "driving" && periodKey === "evening_rush") return "高";
  if (transportMode === "driving" && periodKey === "afternoon") return base === "中低" ? "中" : base;
  if (transportMode === "walking" && base === "高") return "中";
  return base;
}

function buildTransportGuidanceHint(
  transportMode: TransportModeChoice,
  periodKey: TimePeriodKey,
  maxCommute: number,
) {
  switch (transportMode) {
    case "transit": {
      let hint = "优先地铁/公交，减少停车和打车等待不确定性。";
      if (periodKey === "evening_rush") hint += " 晚高峰建议预留额外 5–8 分钟。";
      return hint;
    }
    case "walking": {
      let hint = "优先短距离转场，减少换乘。";
      if (maxCommute <= 25) hint += " 通勤窗口较短，建议少折返、少转场。";
      return hint;
    }
    case "driving": {
      let hint = "优先减少步行和换乘，但晚高峰可能增加等待。";
      if (periodKey === "evening_rush") hint += " 晚高峰交通风险更高。";
      return hint;
    }
    default:
      return "综合比较时间、距离、等待和预算。";
  }
}

function buildPreferenceReason(priority: RoutePriorityChoice, periodKey: TimePeriodKey, budget: number) {
  switch (priority) {
    case "time":
      return "已按「时间最短」优先安排转场，备选方案可强调时间更可控。";
    case "distance":
      return "已按「少走路」减少步行距离；公共交通场景优先近站点衔接。";
    case "queue":
      if (periodKey === "evening_rush") {
        return "已按「少排队」优先可订座与等待更短节点；晚高峰排队风险更高。";
      }
      return "已按「少排队」优先可订座、等待更短的节点，备选方案更重要。";
    case "cost":
      return `已按「预算优先」控制人均 ¥${budget} 以内与低成本转场。`;
    case "detour":
      return "已按「少绕路」顺路衔接节点，减少折返。";
    case "experience":
      return "已按「体验优先」匹配场景氛围，可能需平衡等待与预算。";
    default:
      return "已按当前路线优先级调整展示与备选说明。";
  }
}

function buildTransportBadges(transportMode: TransportModeChoice) {
  const label = TRANSPORT_MODE_LABELS[transportMode];
  return label ? [label] : [];
}

function buildPriorityBadge(priority: RoutePriorityChoice) {
  const label = ROUTE_PRIORITY_LABELS[priority];
  return label ? [label] : [];
}

function augmentPlanningAdvice(
  baseAdvice: string,
  settings: TravelSettings,
  periodKey: TimePeriodKey,
) {
  let advice = baseAdvice;
  if (settings.routePriority === "queue") {
    advice += periodKey === "evening_rush"
      ? " 已为你准备等待更短的备选方案。"
      : " 备选方案优先降低等待风险。";
  } else if (settings.routePriority === "time") {
    advice += " 转场顺序已偏向节省节点间时间。";
  } else if (settings.routePriority === "cost") {
    advice += ` 人均预算控制在 ¥${settings.budget} 以内。`;
  } else if (settings.routePriority === "distance" && settings.maxCommute <= 25) {
    advice += " 短通勤窗口下，优先减少步行与换乘。";
  }
  return advice;
}

function buildFallbackReasonHint(settings: TravelSettings, timeBase: TimeWindowEffectsSummary) {
  if (timeBase.periodKey === "evening_rush") {
    return "当前时间段排队和交通风险较高，备选方案更偏稳妥可执行。";
  }
  switch (settings.routePriority) {
    case "queue":
      return "少排队优先下，备选方案用于替换等待偏长或不可订节点。";
    case "cost":
      return "预算优先下，备选方案更适合控制人均与转场成本。";
    case "distance":
      return "少走路优先下，备选方案减少步行或换乘负担。";
    case "detour":
      return "少绕路优先下，备选方案减少折返与不顺路转场。";
    case "time":
      return "时间最短优先下，备选方案强调转场时间更可控。";
    case "experience":
      return "体验优先下，备选方案在氛围匹配与可执行性间取更稳平衡。";
    default:
      return timeBase.fallbackReasonHint;
  }
}

function buildFallbackCardHintBySettings(
  settings: TravelSettings,
  timeBase: TimeWindowEffectsSummary,
  index: number,
) {
  const { routePriority } = settings;
  const { periodKey } = timeBase;

  if (periodKey === "evening_rush") {
    const rushHints: Partial<Record<RoutePriorityChoice, string>> = {
      queue: "当前时间段排队和交通风险较高，该备选更稳，优先降低等待风险。",
      time: "晚高峰拥堵不确定，该备选转场时间更可控。",
      cost: "晚高峰打车费用可能上升，该备选更适合控制预算。",
      distance: "晚高峰路况复杂，该备选减少步行或换乘。",
      detour: "晚高峰绕路成本更高，该备选减少折返。",
      experience: "晚高峰体验节点可能排队，该备选更稳妥可执行。",
    };
    return rushHints[routePriority] ?? "当前时间段排队和交通风险较高，该备选更稳。";
  }

  const priorityHints: Record<RoutePriorityChoice, string[]> = {
    queue: [
      "该备选优先降低等待风险，适合少排队偏好。",
      "少排队优先下，该备选替换排队偏长节点。",
    ],
    cost: [
      "该备选更适合控制预算，人均与转场成本更低。",
      "预算优先下，该备选减少高成本转场。",
    ],
    distance: [
      "该备选减少步行或换乘，符合少走路偏好。",
      "少走路优先下，该备选转场距离更短。",
    ],
    detour: [
      "该备选减少折返，顺路衔接更紧凑。",
      "少绕路优先下，该备选避免不顺路转场。",
    ],
    time: [
      "该备选转场时间更可控，符合时间最短偏好。",
      "时间最短优先下，该备选减少节点间耗时。",
    ],
    experience: [
      "该备选在场景氛围与可执行性间更平衡。",
      "体验优先下，该备选保留氛围同时降低等待。",
    ],
  };

  const options = priorityHints[routePriority];
  if (options?.length) return options[index % options.length];

  const periodHints: Record<Exclude<TimePeriodKey, "unknown">, string[]> = {
    morning: ["上午人流较低，该备选更适合安静停留或亲子室内。", "上午窗口宽松，该备选替换不可订节点。"],
    afternoon: ["下午时间较稳定，该备选主要用于避免绕路。", "下午窗口充裕，该备选可替换排队较长节点。"],
    evening_rush: ["因为当前是晚高峰，该备选方案优先降低排队风险。", "晚高峰可订座更稀缺，该备选等待更短。"],
    night: ["夜间部分餐饮可能临近打烊，因此该备选更稳。", "夜间更适合低强度收尾，该备选可替换临近打烊节点。"],
  };

  if (periodKey !== "unknown") {
    const periodOptions = periodHints[periodKey];
    return periodOptions[index % periodOptions.length] ?? timeBase.fallbackCardHint;
  }

  return timeBase.fallbackCardHint;
}

function mapUnknownSummary(timeBase: TimeWindowEffectsSummary): TravelSettingEffectsSummary {
  return {
    hasCompleteSettings: false,
    windowHeadline: timeBase.windowHeadline,
    periodLabel: timeBase.periodLabel,
    periodKey: timeBase.periodKey,
    crowdRisk: timeBase.crowdRisk,
    trafficRisk: timeBase.trafficRisk,
    bookingRisk: timeBase.bookingRisk,
    dynamicBadges: ["默认估算"],
    planningAdvice: DEFAULT_SUMMARY_TEXT,
    fallbackReasonHint: timeBase.fallbackReasonHint,
    routeGuidanceHint: timeBase.routeGuidanceHint,
    preferenceReason: DEFAULT_SUMMARY_TEXT,
    riskSummaryLine: DEFAULT_SUMMARY_TEXT,
    fallbackCardHint: timeBase.fallbackCardHint,
    poiDynamicHint: timeBase.poiDynamicHint,
    transportMode: "auto",
    routePriority: "time",
  };
}

export function buildTravelSettingEffects(settings?: TravelSettings | null): TravelSettingEffectsSummary {
  const timeBase = buildTimeWindowEffects(
    settings ? travelSettingsToTimePickerValue(settings) : null,
  );

  if (!isCompleteSettings(settings)) {
    return mapUnknownSummary(timeBase);
  }

  const trafficRisk = adjustTrafficRisk(timeBase.trafficRisk, settings.transportMode, timeBase.periodKey);
  const routeGuidanceHint = buildTransportGuidanceHint(
    settings.transportMode,
    timeBase.periodKey,
    settings.maxCommute,
  );
  const preferenceReason = buildPreferenceReason(settings.routePriority, timeBase.periodKey, settings.budget);
  const planningAdvice = augmentPlanningAdvice(timeBase.planningAdvice, settings, timeBase.periodKey);
  const fallbackReasonHint = buildFallbackReasonHint(settings, timeBase);

  const dynamicBadges = [...new Set([...timeBase.dynamicBadges.slice(0, 2), ...buildTransportBadges(settings.transportMode), ...buildPriorityBadge(settings.routePriority)])].slice(
    0,
    3,
  );

  const riskSummaryLine = buildRiskSummaryLine({
    crowdRisk: timeBase.crowdRisk,
    trafficRisk,
    bookingRisk: timeBase.bookingRisk,
    periodKey: timeBase.periodKey,
    routePriority: settings.routePriority,
  });

  return {
    hasCompleteSettings: true,
    windowHeadline: timeBase.windowHeadline,
    periodLabel: timeBase.periodLabel,
    periodKey: timeBase.periodKey,
    crowdRisk: timeBase.crowdRisk,
    trafficRisk,
    bookingRisk: timeBase.bookingRisk,
    dynamicBadges,
    planningAdvice,
    fallbackReasonHint,
    routeGuidanceHint,
    preferenceReason,
    riskSummaryLine,
    fallbackCardHint: buildFallbackCardHintBySettings(settings, timeBase, 0),
    poiDynamicHint: timeBase.poiDynamicHint,
    transportMode: settings.transportMode,
    routePriority: settings.routePriority,
  };
}

export function getFallbackCardSettingHint(
  effects: TravelSettingEffectsSummary,
  settings: TravelSettings | undefined,
  index = 0,
) {
  if (!effects.hasCompleteSettings || !settings) {
    return effects.fallbackCardHint || "时间未明确时，备选方案主要用于降低排队或绕路风险。";
  }
  const timeBase = buildTimeWindowEffects(travelSettingsToTimePickerValue(settings));
  return buildFallbackCardHintBySettings(settings, timeBase, index);
}

export function getPoiTravelSettingHint(
  effects: TravelSettingEffectsSummary,
  settings: TravelSettings | undefined,
  poi: {
    queueMinutes?: number;
    reservationAvailable?: boolean;
    sceneTags?: string[];
    category?: string;
    pricePerPerson?: number;
    routeEtaMinutes?: number;
  },
) {
  if (!effects.hasCompleteSettings) {
    return effects.poiDynamicHint || DEFAULT_SUMMARY_TEXT;
  }

  const queueMinutes = typeof poi.queueMinutes === "number" && Number.isFinite(poi.queueMinutes) ? poi.queueMinutes : 0;
  const price = typeof poi.pricePerPerson === "number" && Number.isFinite(poi.pricePerPerson) ? poi.pricePerPerson : 0;
  const eta = typeof poi.routeEtaMinutes === "number" && Number.isFinite(poi.routeEtaMinutes) ? poi.routeEtaMinutes : 0;
  const tags = poi.sceneTags ?? [];
  const budget = settings?.budget ?? 150;
  const maxCommute = settings?.maxCommute ?? 30;

  if (settings?.routePriority === "cost" && price > 0 && price <= budget) {
    return "预算优先下，该点人均更可控。";
  }

  if (settings?.routePriority === "distance" && eta > 0 && eta <= maxCommute) {
    return "少走路优先下，该点转场距离更短。";
  }

  switch (effects.periodKey) {
    case "evening_rush":
      if (queueMinutes >= 12 || !poi.reservationAvailable) {
        return "当前时间段预计排队较高，建议提前订座。";
      }
      if (settings?.routePriority === "queue") {
        return "少排队优先下，建议优先选择可订座或等待更短节点。";
      }
      return "晚高峰交通不确定性更高，建议预留转场时间。";
    case "morning":
      if (tags.includes("安静") || tags.includes("适合办公") || tags.includes("插座")) {
        return "当前时间段人流较低，适合久坐。";
      }
      return effects.poiDynamicHint;
    case "night":
      if (poi.category === "restaurant" && !poi.reservationAvailable) {
        return "夜间需检查营业时间，建议优先可订节点。";
      }
      return "夜间更适合低强度收尾，部分节点需确认营业状态。";
    case "afternoon":
      if (queueMinutes >= 15 && settings?.routePriority === "queue") {
        return "下午热门节点仍可能排队，少排队优先建议关注可订状态。";
      }
      return effects.poiDynamicHint;
    default:
      return effects.poiDynamicHint;
  }
}

export function buildFallbackSwitchNoteWithSettings(planTitle: string, effects: TravelSettingEffectsSummary) {
  if (!effects.hasCompleteSettings) {
    return `已切换为${planTitle}。`;
  }
  return `已按当前出行设置切换为${planTitle}。`;
}

export function buildWindowHeadlineFromSettings(settings: TravelSettings) {
  const dateLabel = getDateLabel(settings.date);
  const durationLabel = getDurationLabel(settings.duration);
  const timeBase = buildTimeWindowEffects(travelSettingsToTimePickerValue(settings));
  return {
    headline: timeBase.windowHeadline,
    durationLabel,
    dateLabel,
  };
}
