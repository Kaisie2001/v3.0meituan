import type { ParseResult } from "@/lib/types";

export type IntentParser = {
  parse: (rawGoal: string, wechatConstraint: string, seedContent: string) => ParseResult;
};

