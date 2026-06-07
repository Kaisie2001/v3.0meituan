import type { Intent, ParseResult } from "./types";
import { ruleBasedParser } from "@/lib/parsers/RuleBasedParser";

const DEFAULT_GOAL =
  "今天下午是空的，想和家人/朋友出去玩几个小时，别离家太远，帮我安排一下。";

const DEFAULT_WECHAT = "希望通勤不超过30分钟，人均预算150以内，尽量别排队。";
const DEFAULT_SEED = "如果适合亲子/展览/逛街/citywalk 都可以，也可以顺便安排轻食晚餐。";

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
