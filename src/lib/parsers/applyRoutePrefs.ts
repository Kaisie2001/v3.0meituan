import type { ParseResult } from "@/lib/types";
import type { RoutePreferences } from "@/lib/types";

export function applyRoutePrefs(parseResult: ParseResult, prefs: RoutePreferences): ParseResult {
  return {
    ...parseResult,
    intent: {
      ...parseResult.intent,
      routePrefs: {
        transport: prefs.transport,
        goal: prefs.goal,
        customGoal: prefs.customGoal,
      },
    },
  };
}
