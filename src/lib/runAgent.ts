import type { AgentResult, ParseResult } from "./types";
import { mockPois } from "./mockPois";
import { parseInput } from "./parseIntent";
import { generateExecutionActions, planRoute } from "./planRoute";
import { scorePoi, sortByGoability } from "./scorePoi";

export function runAgentFromParseResult(parseResult: ParseResult): AgentResult {
  const intent = parseResult.intent;
  const excluded = new Set(intent.excludedPoiIds ?? []);
  const scoredPois = mockPois.filter((poi) => !excluded.has(poi.id)).map((poi) => scorePoi(poi, intent));
  const rankedPois = sortByGoability(scoredPois);
  const routePlan = planRoute(rankedPois, intent);

  return {
    parseResult,
    rankedPois,
    routePlan,
    executionActions: generateExecutionActions(routePlan),
  };
}

export function runAgent(userInput: string, wechatInput: string, seedInput: string): AgentResult {
  const parseResult = parseInput(userInput, wechatInput, seedInput);
  return runAgentFromParseResult(parseResult);
}
