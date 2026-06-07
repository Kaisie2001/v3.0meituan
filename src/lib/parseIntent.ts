import type { Intent, ParseResult } from "./types";
import { ruleBasedParser } from "@/lib/parsers/RuleBasedParser";

const DEFAULT_GOAL =
  "今天下午2点有3小时空，想找个地方轻松待一下，晚点和朋友吃饭，不想排太久，也不想绕路太多。";

const DEFAULT_WECHAT = "朋友说别太远，最好地铁方便，人均150以内。";
const DEFAULT_SEED = "";

export const defaultInputs = {
  goal: DEFAULT_GOAL,
  wechat: DEFAULT_WECHAT,
  seed: DEFAULT_SEED,
};

export function parseInput(
  rawGoal = DEFAULT_GOAL,
  wechatConstraint = "",
  seedContent = "",
): ParseResult {
  return ruleBasedParser.parse(rawGoal, wechatConstraint, seedContent);
}

export function parseIntent(
  rawGoal = DEFAULT_GOAL,
  wechatConstraint = "",
  seedContent = "",
): Intent {
  return parseInput(rawGoal, wechatConstraint, seedContent).intent;
}
