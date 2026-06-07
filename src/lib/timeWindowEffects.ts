import { getDateLabel, getDurationLabel, type TimePickerValue } from "./preferenceSummary";

export type TimePeriodKey = "morning" | "afternoon" | "evening_rush" | "night" | "unknown";

export type TimeWindowEffectsSummary = {
  hasExplicitTime: boolean;
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
  poiDynamicHint: string;
  fallbackCardHint: string;
  riskSummaryLine: string;
};

const UNKNOWN_SUMMARY: TimeWindowEffectsSummary = {
  hasExplicitTime: false,
  windowHeadline: "时间未明确",
  periodLabel: "默认窗口",
  periodKey: "unknown",
  crowdRisk: "中",
  trafficRisk: "中",
  bookingRisk: "中",
  dynamicBadges: ["默认估算"],
  planningAdvice: "时间未明确，系统按默认短时活动窗口估算。",
  fallbackReasonHint: "当前时间段风险未明确，备选方案用于兜底排队或绕路风险。",
  routeGuidanceHint: "建议确认出发时间后再执行，系统会按默认窗口估算。",
  poiDynamicHint: "时间未明确，动态可行性按默认短时活动窗口估算。",
  fallbackCardHint: "时间未明确时，备选方案主要用于降低排队或绕路风险。",
  riskSummaryLine: "时间未明确 · 系统按默认短时活动窗口估算",
};

function parseStartMinutes(startTime?: string) {
  if (typeof startTime !== "string" || !startTime.includes(":")) return null;
  const [hourRaw, minuteRaw] = startTime.split(":").map(Number);
  if (!Number.isFinite(hourRaw) || !Number.isFinite(minuteRaw)) return null;
  if (hourRaw < 0 || hourRaw > 23 || minuteRaw < 0 || minuteRaw > 59) return null;
  return hourRaw * 60 + minuteRaw;
}

function classifyPeriod(minutes: number): TimePeriodKey {
  if (minutes >= 9 * 60 && minutes <= 11 * 60 + 30) return "morning";
  if (minutes >= 12 * 60 && minutes < 17 * 60 + 30) return "afternoon";
  if (minutes >= 17 * 60 + 30 && minutes < 20 * 60) return "evening_rush";
  if (minutes >= 20 * 60 && minutes <= 22 * 60) return "night";
  if (minutes < 9 * 60) return "morning";
  return "night";
}

function buildDateTimePrefix(date: TimePickerValue["date"], startTime: string, minutes: number) {
  const dateLabel = getDateLabel(date);
  if (minutes >= 18 * 60) {
    if (date === "today") return "今晚";
    if (date === "tomorrow") return "明晚";
    return `${dateLabel}晚`;
  }
  return dateLabel;
}

function buildWindowHeadline(timePicker: TimePickerValue, periodLabel: string) {
  const minutes = parseStartMinutes(timePicker.startTime);
  if (minutes === null) return `时间未明确 · ${periodLabel}`;
  const prefix = buildDateTimePrefix(timePicker.date, timePicker.startTime, minutes);
  return `${prefix} ${timePicker.startTime} · ${periodLabel}`;
}

function buildRiskSummaryLine(params: {
  crowdRisk: string;
  trafficRisk: string;
  bookingRisk: string;
  periodKey: TimePeriodKey;
}) {
  const parts = [`排队风险${params.crowdRisk}`, `交通风险${params.trafficRisk}`];
  if (params.periodKey === "evening_rush") {
    parts.push(`可订风险${params.bookingRisk}`);
    parts.push("建议优先选择可订座方案");
  } else if (params.bookingRisk === "高") {
    parts.push(`可订风险${params.bookingRisk}`);
  }
  return parts.join(" · ");
}

function buildPeriodSummary(timePicker: TimePickerValue, periodKey: TimePeriodKey): TimeWindowEffectsSummary {
  const windowHeadline = buildWindowHeadline(timePicker, periodLabelFor(periodKey));
  const durationLabel = getDurationLabel(timePicker.duration);

  switch (periodKey) {
    case "morning": {
      const crowdRisk = "低";
      const trafficRisk = "中低";
      const bookingRisk = "中低";
      return {
        hasExplicitTime: true,
        windowHeadline,
        periodLabel: "上午",
        periodKey,
        crowdRisk,
        trafficRisk,
        bookingRisk,
        dynamicBadges: ["上午", "人流较低", "适合安静停留"],
        planningAdvice: `上午人流较低，更适合安静停留和短时活动（可用 ${durationLabel}）。`,
        fallbackReasonHint: "上午排队压力较低，备选方案主要用于替换绕路或不可订节点。",
        routeGuidanceHint: "当前人流较低，适合安静停留。",
        poiDynamicHint: "当前时间段人流较低，适合久坐或亲子室内活动。",
        fallbackCardHint: "上午时间较宽松，该备选主要用于避免绕路或不可订节点。",
        riskSummaryLine: buildRiskSummaryLine({ crowdRisk, trafficRisk, bookingRisk, periodKey }),
      };
    }
    case "afternoon": {
      const crowdRisk = "中";
      const trafficRisk = "中";
      const bookingRisk = "中";
      return {
        hasExplicitTime: true,
        windowHeadline,
        periodLabel: "下午",
        periodKey,
        crowdRisk,
        trafficRisk,
        bookingRisk,
        dynamicBadges: ["下午", "窗口稳定", "活动+餐饮"],
        planningAdvice: `下午时间窗口较稳定，适合安排活动 + 餐饮组合（可用 ${durationLabel}）。`,
        fallbackReasonHint: "下午整体较稳定，备选方案主要用于替换排队偏长的节点。",
        routeGuidanceHint: "下午转场相对平稳，可按节点顺序执行。",
        poiDynamicHint: "下午时间窗口较稳定，适合活动与餐饮组合安排。",
        fallbackCardHint: "下午时间较稳定，该备选主要用于避免绕路或替换排队节点。",
        riskSummaryLine: buildRiskSummaryLine({ crowdRisk, trafficRisk, bookingRisk, periodKey }),
      };
    }
    case "evening_rush": {
      const crowdRisk = "高";
      const trafficRisk = "高";
      const bookingRisk = "高";
      return {
        hasExplicitTime: true,
        windowHeadline,
        periodLabel: "晚高峰",
        periodKey,
        crowdRisk,
        trafficRisk,
        bookingRisk,
        dynamicBadges: ["晚高峰", "排队风险高", "建议优先可订座"],
        planningAdvice: "晚高峰排队和交通不确定性更高，已优先准备等待更短的备选方案。",
        fallbackReasonHint: "当前时间段排队风险较高，备选方案更偏稳妥。",
        routeGuidanceHint: "建议预留额外 5–8 分钟转场时间。",
        poiDynamicHint: "当前时间段预计排队较高，建议提前订座。",
        fallbackCardHint: "因为当前是晚高峰，该备选方案优先降低排队风险。",
        riskSummaryLine: buildRiskSummaryLine({ crowdRisk, trafficRisk, bookingRisk, periodKey }),
      };
    }
    case "night": {
      const crowdRisk = "中低";
      const trafficRisk = "中";
      const bookingRisk = "中";
      return {
        hasExplicitTime: true,
        windowHeadline,
        periodLabel: "夜间",
        periodKey,
        crowdRisk,
        trafficRisk,
        bookingRisk,
        dynamicBadges: ["夜间", "低强度收尾", "注意营业时间"],
        planningAdvice: "夜间更适合低强度收尾活动，部分餐饮节点需检查营业时间。",
        fallbackReasonHint: "夜间部分店铺临近打烊，备选方案更偏稳妥可执行。",
        routeGuidanceHint: "请注意部分店铺营业时间，执行前会检查可订/营业状态。",
        poiDynamicHint: "夜间营业时间需执行前确认，优先选择当前可订节点。",
        fallbackCardHint: "夜间部分餐饮可能临近打烊，因此该备选更稳。",
        riskSummaryLine: buildRiskSummaryLine({ crowdRisk, trafficRisk, bookingRisk, periodKey }),
      };
    }
    default:
      return UNKNOWN_SUMMARY;
  }
}

function periodLabelFor(periodKey: TimePeriodKey) {
  switch (periodKey) {
    case "morning":
      return "上午";
    case "afternoon":
      return "下午";
    case "evening_rush":
      return "晚高峰";
    case "night":
      return "夜间";
    default:
      return "默认窗口";
  }
}

export function buildTimeWindowEffects(timePicker?: TimePickerValue | null): TimeWindowEffectsSummary {
  if (!timePicker?.startTime) return UNKNOWN_SUMMARY;
  const minutes = parseStartMinutes(timePicker.startTime);
  if (minutes === null) return UNKNOWN_SUMMARY;
  return buildPeriodSummary(timePicker, classifyPeriod(minutes));
}

export function getFallbackCardTimeHint(effects: TimeWindowEffectsSummary, index = 0) {
  if (!effects.hasExplicitTime) return effects.fallbackCardHint;

  const variants: Record<Exclude<TimePeriodKey, "unknown">, string[]> = {
    morning: [
      "上午人流较低，该备选更适合安静停留或亲子室内。",
      "上午窗口宽松，该备选主要用于替换不可订或绕路节点。",
    ],
    afternoon: [
      "下午时间较稳定，该备选主要用于避免绕路。",
      "下午窗口充裕，该备选可替换排队较长的节点。",
    ],
    evening_rush: [
      "因为当前是晚高峰，该备选方案优先降低排队风险。",
      "晚高峰可订座更稀缺，该备选方案等待更短。",
    ],
    night: [
      "夜间部分餐饮可能临近打烊，因此该备选更稳。",
      "夜间更适合低强度收尾，该备选可替换临近打烊节点。",
    ],
  };

  if (effects.periodKey === "unknown") return effects.fallbackCardHint;
  const options = variants[effects.periodKey];
  return options[index % options.length] ?? effects.fallbackCardHint;
}

export function getPoiTimeDynamicHint(
  effects: TimeWindowEffectsSummary,
  poi: { queueMinutes?: number; reservationAvailable?: boolean; sceneTags?: string[]; category?: string },
) {
  if (!effects.hasExplicitTime) return effects.poiDynamicHint;

  const queueMinutes = typeof poi.queueMinutes === "number" && Number.isFinite(poi.queueMinutes) ? poi.queueMinutes : 0;
  const tags = poi.sceneTags ?? [];

  switch (effects.periodKey) {
    case "evening_rush":
      if (queueMinutes >= 12 || !poi.reservationAvailable) {
        return "当前时间段预计排队较高，建议提前订座。";
      }
      return "晚高峰交通不确定性更高，建议预留转场时间。";
    case "morning":
      if (tags.includes("安静") || tags.includes("适合办公") || tags.includes("插座")) {
        return "当前时间段人流较低，适合久坐。";
      }
      return effects.poiDynamicHint;
    case "night":
      if (poi.category === "restaurant" && !poi.reservationAvailable) {
        return "夜间营业时间需执行前确认，建议优先可订节点。";
      }
      return effects.poiDynamicHint;
    case "afternoon":
      if (queueMinutes >= 15) {
        return "下午热门节点仍可能排队，建议关注可订状态。";
      }
      return effects.poiDynamicHint;
    default:
      return effects.poiDynamicHint;
  }
}

export function buildFallbackSwitchNote(planTitle: string, effects: TimeWindowEffectsSummary) {
  if (!effects.hasExplicitTime) {
    return `已切换为${planTitle}。`;
  }
  if (effects.periodKey === "evening_rush") {
    return `已按当前时间风险切换为${planTitle}。`;
  }
  return `已按当前时间窗口切换为${planTitle}。`;
}
