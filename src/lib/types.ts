export type PoiCategory = "cafe" | "restaurant" | "mall" | "activity";
export type CrowdLevel = "low" | "medium" | "high";
export type GoabilityLevel = "green" | "yellow" | "red" | "gray";

export type TransportMode = "transit" | "driving" | "walking";
export type OptimizeGoal = "time" | "distance" | "cost" | "custom";

export type RoutePreferences = {
  transport: TransportMode;
  goal: OptimizeGoal;
  customGoal?: string;
};

export type Poi = {
  id: string;
  name: string;
  category: PoiCategory;
  x: number;
  y: number;
  lat?: number;
  lng?: number;
  distanceMeters: number;
  rating: number;
  pricePerPerson: number;
  sceneTags: string[];
  reviewPositive: string[];
  reviewNegative: string[];
  riskTags: string[];
  openNow: boolean;
  crowdLevel: CrowdLevel;
  queueMinutes: number;
  reservationAvailable: boolean;
  dealAvailable: boolean;
  routeEtaMinutes: number;
  nearMetro: boolean;
};

export type Intent = {
  rawGoal: string;
  wechatConstraint: string;
  seedContent: string;
  timeWindow: {
    start: string;
    end: string;
    friendArrival?: string;
  };
  startTime?: string;
  durationMinutes?: number;
  partySize?: number;
  maxCommuteMinutes?: number;
  budgetPerPerson: number;
  desiredCategories: PoiCategory[];
  needTags: string[];
  avoidTags: string[];
  preferMetro: boolean;
  preferQuiet: boolean;
  preferLightDinner: boolean;
  seededNames: string[];
  semantic?: {
    seed: number;
    dims: {
      quietPreference: number;
      indoorPreference: number;
      queueTolerance: number;
      activityFirst: number;
      budgetLevel: number;
    };
  };
  routePrefs?: RoutePreferences;
  excludedPoiIds?: string[];
};

export type ParserSource = "rule" | "llm_stub" | "llm";

export type MissingField = "startTime" | "durationMinutes" | "partySize" | "maxCommuteMinutes";

export type IntentDraft = Partial<Pick<Intent, "startTime" | "durationMinutes" | "partySize" | "maxCommuteMinutes" | "budgetPerPerson">> & {
  rawGoal: string;
  wechatConstraint: string;
  seedContent: string;
  preferLightDinner?: boolean;
  preferMetro?: boolean;
  preferQuiet?: boolean;
};

export type ParseResult = {
  intent: Intent;
  draft: IntentDraft;
  missingFields: MissingField[];
  confidence: number;
  source: ParserSource;
};

export type ScoredPoi = Poi & {
  sceneFitScore: number;
  routeScore: number;
  availabilityScore: number;
  waitRiskScore: number;
  preferenceScore: number;
  goabilityScore: number;
  level: GoabilityLevel;
  reasons: string[];
  risks: string[];
};

export type RouteStep = {
  time: string;
  title: string;
  detail: string;
  poiId?: string;
};

export type RouteSlotType = "activity" | "food" | "extra";

export type RouteSlot = {
  slotType: RouteSlotType;
  poi?: ScoredPoi;
  startTime: string;
  endTime: string;
  etaMinutes: number;
  waitMinutes: number;
  rationaleNotes: string[];
  riskNotes: string[];
};

export type ItineraryPlan = {
  id: string;
  title: string;
  trigger?: string;
  diffFromMain?: {
    deltaBudget: number;
    deltaWaitMinutes: number;
    deltaCommuteMinutes: number;
  };
  slots: RouteSlot[];
  steps: RouteStep[];
  totalMinutes: number;
  totalBudget: number;
  totalWaitMinutes: number;
  totalCommuteMinutes: number;
};

export type RoutePlan = {
  steps: RouteStep[];
  activity?: ScoredPoi;
  fallbackActivity?: ScoredPoi;
  cafe?: ScoredPoi;
  restaurant?: ScoredPoi;
  fallbackRestaurant?: ScoredPoi;
  totalMinutes: number;
  totalBudget: number;
  totalWaitMinutes: number;
  fitsTimeWindow: boolean;
  mainPlan?: ItineraryPlan;
  fallbackPlans?: ItineraryPlan[];
};

export type ExecutionAction = {
  id: string;
  label: string;
};

export type ToolStatus = "success" | "failed" | "skipped";

export type ToolPhase = "check" | "plan" | "execute" | "share";

export type ExecutionTraceStep = {
  stepId: string;
  phase: ToolPhase;
  toolName: string;
  request: unknown;
  response?: unknown;
  summary?: string;
  status: ToolStatus;
  retryCount: number;
  error?: {
    code: string;
    message: string;
  };
};

export type AgentResult = {
  parseResult: ParseResult;
  rankedPois: ScoredPoi[];
  routePlan: RoutePlan;
  executionActions: ExecutionAction[];
  executionTrace?: ExecutionTraceStep[];
};
