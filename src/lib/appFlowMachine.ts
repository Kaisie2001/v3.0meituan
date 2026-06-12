export type AppScreen = "input" | "result" | "details" | "execute";

export type SheetTab = "main" | "fallback" | "poi";

export type SelectedPlanType = "main" | "fallback";

export type ExecutionStatus = "idle" | "running" | "done" | "error";

export type AppFlowState = {
  screen: AppScreen;
  activeSheetTab: SheetTab;
  selectedPlanType: SelectedPlanType;
  selectedFallbackIndex: number | null;
  selectedPoiId: string | null;
  executionStatus: ExecutionStatus;
  isPlanning: boolean;
  hasResult: boolean;
};

export type AppFlowAction =
  | { type: "START_PLANNING" }
  | { type: "PLAN_SUCCEEDED" }
  | { type: "PLAN_FAILED" }
  | { type: "OPEN_RESULT" }
  | { type: "OPEN_DETAILS" }
  | { type: "OPEN_EXECUTE" }
  | { type: "BACK_TO_INPUT" }
  | { type: "SET_SHEET_TAB"; tab: SheetTab }
  | { type: "SELECT_FALLBACK"; index: number }
  | { type: "RESTORE_MAIN_PLAN" }
  | { type: "SELECT_POI"; poiId: string }
  | { type: "START_EXECUTION" }
  | { type: "FINISH_EXECUTION" }
  | { type: "FAIL_EXECUTION" }
  | { type: "RESET_DEMO" };

export const initialAppFlowState: AppFlowState = {
  screen: "input",
  activeSheetTab: "main",
  selectedPlanType: "main",
  selectedFallbackIndex: null,
  selectedPoiId: null,
  executionStatus: "idle",
  isPlanning: false,
  hasResult: false,
};

export function appFlowReducer(state: AppFlowState, action: AppFlowAction): AppFlowState {
  switch (action.type) {
    case "START_PLANNING":
      return {
        ...state,
        isPlanning: true,
        executionStatus: "idle",
      };

    case "PLAN_SUCCEEDED":
      return {
        ...state,
        isPlanning: false,
        hasResult: true,
        screen: "result",
        activeSheetTab: "main",
      };

    case "PLAN_FAILED":
      return {
        ...state,
        isPlanning: false,
      };

    case "OPEN_RESULT":
      return {
        ...state,
        screen: "result",
      };

    case "OPEN_DETAILS":
      return {
        ...state,
        screen: "details",
      };

    case "OPEN_EXECUTE":
      return {
        ...state,
        screen: "execute",
        executionStatus: "idle",
      };

    case "BACK_TO_INPUT":
      return {
        ...state,
        screen: "input",
      };

    case "SET_SHEET_TAB":
      return {
        ...state,
        activeSheetTab: action.tab,
      };

    case "SELECT_FALLBACK":
      return {
        ...state,
        selectedPlanType: "fallback",
        selectedFallbackIndex: action.index,
        activeSheetTab: "main",
      };

    case "RESTORE_MAIN_PLAN":
      return {
        ...state,
        selectedPlanType: "main",
        selectedFallbackIndex: null,
        activeSheetTab: "main",
      };

    case "SELECT_POI":
      return {
        ...state,
        selectedPoiId: action.poiId,
        activeSheetTab: "poi",
      };

    case "START_EXECUTION":
      return {
        ...state,
        executionStatus: "running",
      };

    case "FINISH_EXECUTION":
      return {
        ...state,
        executionStatus: "done",
      };

    case "FAIL_EXECUTION":
      return {
        ...state,
        executionStatus: "error",
      };

    case "RESET_DEMO":
      return { ...initialAppFlowState };

    default: {
      const _exhaustive: never = action;
      return _exhaustive;
    }
  }
}
