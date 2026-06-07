import type { IntentParser } from "./IntentParser";
import type { IntentDraft, MissingField, ParseResult } from "@/lib/types";
import { ruleBasedParser } from "./RuleBasedParser";

export const llmParserStub: IntentParser = {
  parse(rawGoal: string, wechatConstraint: string, seedContent: string): ParseResult {
    const base = ruleBasedParser.parse(rawGoal, wechatConstraint, seedContent);
    const patchedDraft: IntentDraft = {
      ...base.draft,
      startTime: base.draft.startTime ?? "14:00",
      durationMinutes: base.draft.durationMinutes ?? 300,
      partySize: base.draft.partySize ?? 2,
      maxCommuteMinutes: base.draft.maxCommuteMinutes ?? 30,
    };

    const missingFields: MissingField[] = [];

    return {
      ...base,
      draft: patchedDraft,
      intent: ruleBasedParser.parse(rawGoal, wechatConstraint, seedContent).intent,
      missingFields,
      confidence: Math.max(base.confidence, 0.75),
      source: "llm_stub",
    };
  },
};

