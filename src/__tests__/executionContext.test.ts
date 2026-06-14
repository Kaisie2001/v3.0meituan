import { describe, expect, it } from "vitest";
import { runAgent } from "@/lib/runAgent";
import {
  buildContextualDoneSummary,
  buildContextualIdleActions,
  buildContextualRunningSteps,
  buildExecutionPlanLabel,
  buildExecutionScopeLabel,
  buildSelectedPlanSummary,
} from "@/lib/executionContext";
import type { TravelSettings } from "@/lib/preferenceSummary";

const baseTravelSettings: TravelSettings = {
  date: "today",
  startTime: "14:00",
  duration: "3h",
  transportMode: "transit",
  routePriority: "queue",
  partySize: 2,
  budget: 150,
  maxCommute: 30,
};

function serialize(value: unknown) {
  return JSON.stringify(value);
}

describe("executionContext", () => {
  it("exposes four user-facing idle actions", () => {
    const main = buildContextualIdleActions({ travelSettings: baseTravelSettings, selectedPlanType: "main" });
    const fallback = buildContextualIdleActions({ travelSettings: baseTravelSettings, selectedPlanType: "fallback" });

    expect(main).toHaveLength(4);
    expect(fallback).toHaveLength(4);
    expect(main.map((item) => item.label)).toEqual([
      "应用当前方案",
      "检查预约 / 排队风险",
      "更新转场路线",
      "生成可分享计划",
    ]);
    expect(fallback[0]?.label).toMatch(/备选方案/);
  });

  it("labels main vs fallback execution scope without undefined", () => {
    const agent = runAgent("晚上和朋友吃饭，吃完想找地方聊天", "", "");
    const mainLabel = buildExecutionPlanLabel(agent.routePlan, "main", null);
    const fallbackLabel = buildExecutionPlanLabel(agent.routePlan, "fallback", 0);

    const mainScope = buildExecutionScopeLabel("main", mainLabel);
    const fallbackScope = buildExecutionScopeLabel("fallback", fallbackLabel);

    expect(mainScope.scope).toBe("正在执行：主方案");
    expect(fallbackScope.scope).toBe("正在执行：备选方案");
    expect(serialize({ mainScope, fallbackScope })).not.toMatch(/undefined|NaN/);
  });

  it("adds fallback plan note when queue priority is selected", () => {
    const agent = runAgent("下午帮同事买咖啡顺便处理工作", "", "");
    const summary = buildSelectedPlanSummary({
      routePlan: agent.routePlan,
      selectedPlanType: "fallback",
      selectedFallbackIndex: 0,
      travelSettings: baseTravelSettings,
    });

    expect(summary.planNote).toMatch(/少排队|备选/);
    expect(serialize(summary)).not.toMatch(/undefined|NaN/);
  });

  it("returns four done-state result lines", () => {
    const lines = buildContextualDoneSummary({
      selectedPlanType: "main",
      currentPlanLabel: "主方案",
      hasShareText: true,
      hasRoutePlan: true,
      traceHasReservation: true,
      traceHasOrder: false,
    });

    expect(lines).toHaveLength(4);
    expect(lines[0]).toMatch(/已应用/);
    expect(lines[1]).toMatch(/路线衔接/);
    expect(lines[3]).toMatch(/转发/);
  });

  it("uses human-friendly running copy", () => {
    const running = buildContextualRunningSteps({
      travelSettings: baseTravelSettings,
      selectedPlanType: "main",
    });

    expect(running.steps[0]).toMatch(/锁定安排/);
    expect(running.hints[0]).toMatch(/预约余量/);
    expect(serialize(running)).not.toMatch(/undefined|NaN/);
  });
});
