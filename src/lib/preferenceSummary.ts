import type { Intent, OptimizeGoal, ParseResult, RoutePreferences } from "./types";

export const DEFAULT_PREFERENCE_SUMMARY = "系统按时间、距离、排队风险综合规划";

export const DEFAULT_TIME_WINDOW_SUMMARY = "时间未明确 · 系统按默认短时活动规划";

export type TripDateOption = "today" | "tomorrow" | "saturday" | "sunday";
export type TripDurationOption = "2h" | "3h" | "4h" | "halfday";

export type TimePickerValue = {
  date: TripDateOption;
  startTime: string;
  duration: TripDurationOption;
};

export const DATE_OPTIONS: { id: TripDateOption; label: string }[] = [
  { id: "today", label: "今天" },
  { id: "tomorrow", label: "明天" },
  { id: "saturday", label: "周六" },
  { id: "sunday", label: "周日" },
];

export const DURATION_OPTIONS: { id: TripDurationOption; label: string }[] = [
  { id: "2h", label: "2小时" },
  { id: "3h", label: "3小时" },
  { id: "4h", label: "4小时" },
  { id: "halfday", label: "半天" },
];

export const DEFAULT_TIME_PICKER: TimePickerValue = {
  date: "today",
  startTime: "14:00",
  duration: "3h",
};

export type TransportModeChoice = "transit" | "walking" | "driving" | "auto";
export type RoutePriorityChoice = "time" | "distance" | "cost" | "queue" | "detour" | "experience";

export type TravelSettings = {
  date: TripDateOption;
  startTime: string;
  duration: TripDurationOption;
  transportMode: TransportModeChoice;
  routePriority: RoutePriorityChoice;
  partySize: number;
  budget: number;
  maxCommute: number;
};

export const TRANSPORT_MODE_LABELS: Record<TransportModeChoice, string> = {
  transit: "公共交通优先",
  walking: "步行优先",
  driving: "打车/驾车",
  auto: "系统综合推荐",
};

export const ROUTE_PRIORITY_LABELS: Record<RoutePriorityChoice, string> = {
  time: "时间最短",
  distance: "少走路",
  cost: "预算优先",
  queue: "少排队",
  detour: "少绕路",
  experience: "体验优先",
};

export const DEFAULT_TRAVEL_SETTINGS: TravelSettings = {
  date: "today",
  startTime: "14:00",
  duration: "3h",
  transportMode: "transit",
  routePriority: "queue",
  partySize: 2,
  budget: 150,
  maxCommute: 30,
};

export type PreferenceSubmitPayload = {
  routePrefs: RoutePreferences;
  intentPatch: {
    startTime?: string;
    durationMinutes?: number;
    maxCommuteMinutes?: number;
    partySize?: number;
    budgetPerPerson?: number;
  };
  displaySummary: string;
};

export function buildPreferenceSummaryFromLabels(labels: string[]) {
  const filtered = labels.filter((label) => typeof label === "string" && label.length > 0);
  return filtered.length ? filtered.join(" · ") : DEFAULT_PREFERENCE_SUMMARY;
}

export function buildPreferenceSummaryFromIntent(intent: Intent, configured = false) {
  if (!configured) {
    return DEFAULT_PREFERENCE_SUMMARY;
  }

  const transportLabels: Record<string, string> = {
    transit: "公共交通优先",
    walking: "步行优先",
    driving: "打车/驾车",
  };

  const goalLabels: Record<string, string> = {
    time: "时间最短",
    distance: "少走路",
    cost: "预算优先",
    queue: "少排队",
    detour: "少绕路",
    experience: "体验优先",
  };

  const parts: string[] = [];
  const prefs = intent.routePrefs;
  const transport = prefs?.transport ?? "transit";
  parts.push(transportLabels[transport] ?? "系统综合推荐");

  const goal = prefs?.goal ?? "time";
  const customGoal = prefs?.customGoal ?? "";
  if (goal === "custom") {
    if (/排队/.test(customGoal)) parts.push(goalLabels.queue);
    else if (/绕路/.test(customGoal)) parts.push(goalLabels.detour);
    else if (/体验/.test(customGoal)) parts.push(goalLabels.experience);
    else if (customGoal) parts.push(customGoal);
  } else {
    parts.push(goalLabels[goal] ?? goalLabels.time);
  }

  if ((intent.semantic?.dims?.queueTolerance ?? 0.5) < 0.4 || /不排|少排|不想排/.test(intent.rawGoal)) {
    parts.push("不想排太久");
  }

  return buildPreferenceSummaryFromLabels(parts);
}

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

export function buildTimeSlotOptions(startHour = 9, endHour = 22, stepMinutes = 30) {
  const slots: string[] = [];
  for (let hour = startHour; hour <= endHour; hour += 1) {
    for (let minute = 0; minute < 60; minute += stepMinutes) {
      if (hour === endHour && minute > 0) break;
      slots.push(`${pad2(hour)}:${pad2(minute)}`);
    }
  }
  return slots;
}

export const TIME_SLOT_OPTIONS = buildTimeSlotOptions();

export function getDateLabel(date: TripDateOption) {
  return DATE_OPTIONS.find((option) => option.id === date)?.label ?? "今天";
}

export function getDurationLabel(duration: TripDurationOption) {
  return DURATION_OPTIONS.find((option) => option.id === duration)?.label ?? "3小时";
}

export function durationToMinutes(duration: TripDurationOption) {
  switch (duration) {
    case "2h":
      return 120;
    case "3h":
      return 180;
    case "4h":
      return 240;
    case "halfday":
      return 300;
    default:
      return 180;
  }
}

export function inferDefaultStartTime(goalText = "") {
  if (/晚饭|晚上|今晚|夜间|聚餐/.test(goalText)) return "18:30";
  return "14:00";
}

export function buildTimePickerCardSummary(value: TimePickerValue) {
  return `${getDateLabel(value.date)} ${value.startTime} 出发 · ${getDurationLabel(value.duration)}`;
}

function timeToParseablePhrase(value: TimePickerValue) {
  const [hourRaw, minuteRaw] = value.startTime.split(":").map(Number);
  if (!Number.isFinite(hourRaw) || !Number.isFinite(minuteRaw)) {
    return `${getDateLabel(value.date)}14点出发`;
  }

  let period = "上午";
  let hour12 = hourRaw;
  if (hourRaw >= 18) {
    period = "晚上";
    hour12 = hourRaw > 12 ? hourRaw - 12 : hourRaw;
  } else if (hourRaw >= 12) {
    period = "下午";
    hour12 = hourRaw === 12 ? 12 : hourRaw - 12;
  } else if (hourRaw < 5) {
    period = "凌晨";
  }

  const minutePart = minuteRaw > 0 ? `${minuteRaw}分` : "";
  return `${getDateLabel(value.date)}${period}${hour12}点${minutePart}出发`;
}

export function buildTimeGoalSuffix(value: TimePickerValue) {
  const durationText = getDurationLabel(value.duration);
  return `出发时间：${getDateLabel(value.date)} ${value.startTime}；可用时长：${durationText}。`;
}

export function buildGoalWithTimeContext(goal: string, value: TimePickerValue) {
  const trimmed = goal.trim();
  const formalSuffix = buildTimeGoalSuffix(value);
  const parseableClause = `${timeToParseablePhrase(value)}，计划玩${getDurationLabel(value.duration)}`;
  if (!trimmed) {
    return `${formalSuffix}${parseableClause}。`;
  }
  return `${trimmed}。${formalSuffix}${parseableClause}。`;
}

export function inferDepartureLabelFromParse(parseResult: ParseResult) {
  const startTime = parseResult.draft.startTime ?? parseResult.intent.startTime;
  if (!startTime) return null;

  const text = `${parseResult.intent.rawGoal} ${parseResult.intent.wechatConstraint}`;
  if (/周末|周六|周日/.test(text)) return `周末 ${startTime}`;
  if (/明天/.test(text)) return `明天 ${startTime}`;
  if (/今晚|晚上|夜间/.test(text)) return `今晚 ${startTime}`;
  if (/今天|下午/.test(text)) return `今天 ${startTime}`;
  return `${startTime} 出发`;
}

export function inferDurationLabelFromMinutes(minutes?: number) {
  if (typeof minutes !== "number" || !Number.isFinite(minutes) || minutes <= 0) return null;
  if (minutes === 120) return "2小时";
  if (minutes === 180) return "3小时";
  if (minutes === 240) return "4小时";
  if (minutes === 300) return "半天";
  if (minutes % 60 === 0) return `${minutes / 60}小时`;
  return `${minutes}分钟`;
}

export function hasExplicitTimeWindowFromParse(parseResult: ParseResult) {
  const startTime = parseResult.draft.startTime ?? parseResult.intent.startTime;
  const durationMinutes = parseResult.draft.durationMinutes ?? parseResult.intent.durationMinutes;
  const missing = parseResult.missingFields ?? [];
  const hasStart = Boolean(startTime) && !missing.includes("startTime");
  const hasDuration = Boolean(durationMinutes) && !missing.includes("durationMinutes");
  return hasStart && hasDuration;
}

export function buildResultStatusSummary(params: {
  departureLabel?: string | null;
  durationLabel?: string | null;
  preferenceSummary?: string;
  hasExplicitTimeWindow: boolean;
}) {
  if (!params.hasExplicitTimeWindow) {
    return DEFAULT_TIME_WINDOW_SUMMARY;
  }

  const segments = [params.departureLabel, params.durationLabel].filter(
    (part): part is string => typeof part === "string" && part.length > 0,
  );
  const preference = params.preferenceSummary?.trim();
  if (preference && preference.length > 0) {
    segments.push(preference);
  }

  return segments.length ? segments.join(" · ") : DEFAULT_TIME_WINDOW_SUMMARY;
}

export function buildTimeWindowSummary(params: {
  timePicker: TimePickerValue;
  preferenceSummary?: string;
}) {
  const departureLabel = `${getDateLabel(params.timePicker.date)} ${params.timePicker.startTime}`;
  const durationLabel = getDurationLabel(params.timePicker.duration);

  return buildResultStatusSummary({
    departureLabel,
    durationLabel,
    preferenceSummary: params.preferenceSummary,
    hasExplicitTimeWindow: true,
  });
}

export function travelSettingsToTimePickerValue(settings: TravelSettings): TimePickerValue {
  return {
    date: settings.date,
    startTime: settings.startTime,
    duration: settings.duration,
  };
}

function routePriorityToRoutePrefs(priority: RoutePriorityChoice): Pick<RoutePreferences, "goal" | "customGoal"> {
  switch (priority) {
    case "queue":
      return { goal: "custom", customGoal: "少排队" };
    case "detour":
      return { goal: "custom", customGoal: "少绕路" };
    case "experience":
      return { goal: "custom", customGoal: "体验优先" };
    case "distance":
      return { goal: "distance" };
    case "cost":
      return { goal: "cost" };
    default:
      return { goal: "time" };
  }
}

export function buildTravelSettingsSummary(settings: TravelSettings) {
  const transportShort: Record<string, string> = {
    transit: "地铁公交",
    walking: "步行",
    driving: "打车",
    auto: "智能推荐",
  };
  const priorityShort: Record<string, string> = {
    time: "省时",
    distance: "少走路",
    cost: "控预算",
    queue: "少排队",
    detour: "少绕路",
    experience: "重体验",
  };
  const parts = [
    `${getDateLabel(settings.date)} ${settings.startTime}`,
    getDurationLabel(settings.duration),
    transportShort[settings.transportMode] ?? TRANSPORT_MODE_LABELS[settings.transportMode],
    priorityShort[settings.routePriority] ?? ROUTE_PRIORITY_LABELS[settings.routePriority],
  ];
  return buildPreferenceSummaryFromLabels(parts);
}

export function travelSettingsToPreferencePayload(settings: TravelSettings): PreferenceSubmitPayload {
  const routeGoal = routePriorityToRoutePrefs(settings.routePriority);
  const resolvedTransport = settings.transportMode === "auto" ? "transit" : settings.transportMode;
  const summaryLabels = [
    settings.transportMode === "auto" ? TRANSPORT_MODE_LABELS.auto : TRANSPORT_MODE_LABELS[resolvedTransport],
    ROUTE_PRIORITY_LABELS[settings.routePriority],
  ];
  if (settings.routePriority === "queue") {
    summaryLabels.push("不想排太久");
  }

  return {
    routePrefs: {
      transport: resolvedTransport,
      goal: routeGoal.goal as OptimizeGoal,
      customGoal: routeGoal.customGoal,
    },
    intentPatch: {
      startTime: settings.startTime,
      durationMinutes: durationToMinutes(settings.duration),
      maxCommuteMinutes: settings.maxCommute,
      partySize: settings.partySize,
      budgetPerPerson: settings.budget,
    },
    displaySummary: buildTravelSettingsSummary(settings),
  };
}

export function buildGoalWithTravelSettings(goal: string, settings: TravelSettings) {
  const withTime = buildGoalWithTimeContext(goal, travelSettingsToTimePickerValue(settings)).trim();
  const transportLabel = TRANSPORT_MODE_LABELS[settings.transportMode] ?? TRANSPORT_MODE_LABELS.auto;
  const priorityLabel = ROUTE_PRIORITY_LABELS[settings.routePriority] ?? ROUTE_PRIORITY_LABELS.time;
  const constraintSuffix = `出行方式：${transportLabel}；路线优先级：${priorityLabel}；预算：人均${settings.budget}以内；人数：${settings.partySize}人；最远通勤：${settings.maxCommute}分钟。`;
  const base = withTime.endsWith("。") ? withTime.slice(0, -1) : withTime;
  return `${base}；${constraintSuffix}`;
}
