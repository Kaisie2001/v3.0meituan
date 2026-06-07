import type { Intent, RoutePreferences } from "./types";

export const DEFAULT_PREFERENCE_SUMMARY = "系统按时间、距离、排队风险综合规划";

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
