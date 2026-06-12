import { describe, expect, it } from "vitest";
import {
  appFlowReducer,
  initialAppFlowState,
  type AppFlowState,
} from "@/lib/appFlowMachine";

function reduce(state: AppFlowState, ...actions: Parameters<typeof appFlowReducer>[1][]) {
  return actions.reduce((next, action) => appFlowReducer(next, action), state);
}

describe("appFlowMachine", () => {
  it("starts on the input screen", () => {
    expect(initialAppFlowState.screen).toBe("input");
    expect(initialAppFlowState.isPlanning).toBe(false);
    expect(initialAppFlowState.hasResult).toBe(false);
    expect(initialAppFlowState.executionStatus).toBe("idle");
  });

  it("sets isPlanning after START_PLANNING", () => {
    const next = appFlowReducer(initialAppFlowState, { type: "START_PLANNING" });
    expect(next.isPlanning).toBe(true);
    expect(next.executionStatus).toBe("idle");
  });

  it("enters result with main tab after PLAN_SUCCEEDED", () => {
    const planning = appFlowReducer(initialAppFlowState, { type: "START_PLANNING" });
    const next = appFlowReducer(planning, { type: "PLAN_SUCCEEDED" });

    expect(next.isPlanning).toBe(false);
    expect(next.hasResult).toBe(true);
    expect(next.screen).toBe("result");
    expect(next.activeSheetTab).toBe("main");
  });

  it("selects fallback plan and returns to main tab", () => {
    const withResult = reduce(
      initialAppFlowState,
      { type: "PLAN_SUCCEEDED" },
      { type: "SET_SHEET_TAB", tab: "fallback" },
    );

    const next = appFlowReducer(withResult, { type: "SELECT_FALLBACK", index: 2 });

    expect(next.selectedPlanType).toBe("fallback");
    expect(next.selectedFallbackIndex).toBe(2);
    expect(next.activeSheetTab).toBe("main");
  });

  it("restores main plan selection", () => {
    const withFallback = reduce(
      initialAppFlowState,
      { type: "PLAN_SUCCEEDED" },
      { type: "SELECT_FALLBACK", index: 1 },
    );

    const next = appFlowReducer(withFallback, { type: "RESTORE_MAIN_PLAN" });

    expect(next.selectedPlanType).toBe("main");
    expect(next.selectedFallbackIndex).toBe(null);
    expect(next.activeSheetTab).toBe("main");
  });

  it("switches to poi tab when selecting a poi", () => {
    const withResult = appFlowReducer(initialAppFlowState, { type: "PLAN_SUCCEEDED" });
    const next = appFlowReducer(withResult, { type: "SELECT_POI", poiId: "poi-123" });

    expect(next.selectedPoiId).toBe("poi-123");
    expect(next.activeSheetTab).toBe("poi");
  });

  it("completes execute flow: OPEN_EXECUTE → START_EXECUTION → FINISH_EXECUTION", () => {
    const withResult = appFlowReducer(initialAppFlowState, { type: "PLAN_SUCCEEDED" });

    const onExecute = appFlowReducer(withResult, { type: "OPEN_EXECUTE" });
    expect(onExecute.screen).toBe("execute");
    expect(onExecute.executionStatus).toBe("idle");

    const running = appFlowReducer(onExecute, { type: "START_EXECUTION" });
    expect(running.executionStatus).toBe("running");

    const done = appFlowReducer(running, { type: "FINISH_EXECUTION" });
    expect(done.executionStatus).toBe("done");
  });

  it("resets to initial state with RESET_DEMO", () => {
    const dirty = reduce(
      initialAppFlowState,
      { type: "START_PLANNING" },
      { type: "PLAN_SUCCEEDED" },
      { type: "SELECT_FALLBACK", index: 0 },
      { type: "SELECT_POI", poiId: "poi-99" },
      { type: "OPEN_EXECUTE" },
      { type: "START_EXECUTION" },
      { type: "FINISH_EXECUTION" },
    );

    const reset = appFlowReducer(dirty, { type: "RESET_DEMO" });
    expect(reset).toEqual(initialAppFlowState);
  });

  it("does not mutate the previous state object", () => {
    const before = { ...initialAppFlowState };
    const snapshot = JSON.stringify(before);

    appFlowReducer(before, { type: "START_PLANNING" });
    appFlowReducer(before, { type: "PLAN_SUCCEEDED" });
    appFlowReducer(before, { type: "SELECT_FALLBACK", index: 1 });

    expect(JSON.stringify(before)).toBe(snapshot);
    expect(before).toEqual(initialAppFlowState);
  });
});
