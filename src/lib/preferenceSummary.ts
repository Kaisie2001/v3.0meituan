import type { Intent, ParseResult, RoutePreferences } from "./types";

export const DEFAULT_PREFERENCE_SUMMARY = "系统按时间、距离、排队风险综合规划";

export const DEFAULT_TIME_WINDOW_SUMMARY = "时间未明确 · 系统按默认短时活动规划";

export type DepartureChip = "now" | "afternoon" | "tonight" | "weekend" | "custom";
export type DurationChip = "2h" | "3h" | "4h" | "halfday";

export const DEPARTURE_CHIP_OPTIONS: { id: DepartureChip; label: string }[] = [
  { id: "now", label: "现在" },
  { id: "afternoon", label: "今天下午" },
  { id: "tonight", label: "今晚" },
  { id: "weekend", label: "周末下午" },
  { id: "custom", label: "自定义" },
];

export const DURATION_CHIP_OPTIONS: { id: DurationChip; label: string }[] = [
  { id: "2h", label: "2小时" },
  { id: "3h", label: "3小时" },
  { id: "4h", label: "4小时" },
  { id: "halfday", label: "半天" },
];

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

function normalizeCustomTime(value: string) {
  const trimmed = value.trim();
  const match = trimmed.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isFinite(hour) || !Number.isFinite(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return null;
  }
  return `${pad2(hour)}:${pad2(minute)}`;
}

export function departureChipToStartTime(chip: DepartureChip, customTime = "14:00") {
  switch (chip) {
    case "now": {
      const now = new Date();
      return `${pad2(now.getHours())}:${pad2(now.getMinutes())}`;
    }
    case "afternoon":
      return "14:00";
    case "tonight":
      return "18:00";
    case "weekend":
      return "14:00";
    case "custom":
      return normalizeCustomTime(customTime) ?? "14:00";
    default:
      return "14:00";
  }
}

export function durationChipToMinutes(chip: DurationChip) {
  switch (chip) {
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

export function getDepartureChipLabel(chip: DepartureChip | null) {
  if (!chip) return null;
  if (chip === "custom") return "自定义";
  return DEPARTURE_CHIP_OPTIONS.find((option) => option.id === chip)?.label ?? null;
}

export function getDurationChipLabel(chip: DurationChip | null) {
  if (!chip) return null;
  return DURATION_CHIP_OPTIONS.find((option) => option.id === chip)?.label ?? null;
}

export function inferDepartureLabelFromParse(parseResult: ParseResult) {
  const startTime = parseResult.draft.startTime ?? parseResult.intent.startTime;
  if (!startTime) return null;

  const text = `${parseResult.intent.rawGoal} ${parseResult.intent.wechatConstraint}`;
  if (/周末/.test(text)) return "周末下午";
  if (/今晚|晚上|夜间/.test(text)) return "今晚";
  if (/下午/.test(text)) return "今天下午";
  if (/现在|马上|立刻/.test(text)) return "现在";
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

export function buildChipTimePatch(params: {
  departureChip: DepartureChip | null;
  durationChip: DurationChip | null;
  customStartTime?: string;
}) {
  const patch: { startTime?: string; durationMinutes?: number } = {};
  if (params.departureChip) {
    patch.startTime = departureChipToStartTime(params.departureChip, params.customStartTime);
  }
  if (params.durationChip) {
    patch.durationMinutes = durationChipToMinutes(params.durationChip);
  }
  return patch;
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
  parseResult: ParseResult;
  departureChip: DepartureChip | null;
  durationChip: DurationChip | null;
  customStartTime?: string;
  preferenceSummary?: string;
}) {
  const departureLabel =
    params.departureChip != null
      ? params.departureChip === "custom"
        ? `${normalizeCustomTime(params.customStartTime ?? "") ?? params.customStartTime ?? "14:00"} 出发`
        : getDepartureChipLabel(params.departureChip)
      : inferDepartureLabelFromParse(params.parseResult);

  const durationLabel =
    params.durationChip != null
      ? getDurationChipLabel(params.durationChip)
      : inferDurationLabelFromMinutes(params.parseResult.draft.durationMinutes ?? params.parseResult.intent.durationMinutes);

  const hasExplicitTimeWindow =
    Boolean(params.departureChip && params.durationChip) || hasExplicitTimeWindowFromParse(params.parseResult);

  return buildResultStatusSummary({
    departureLabel,
    durationLabel,
    preferenceSummary: params.preferenceSummary,
    hasExplicitTimeWindow,
  });
}
