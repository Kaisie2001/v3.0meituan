import { inferPersona, type PersonaType } from "./persona";
import { MAP_DEMO_NOTE } from "./routeGuidance";
import type { TravelSettings } from "./preferenceSummary";
import type { ItineraryPlan, ParseResult, RoutePlan, ScoredPoi } from "./types";

export type MapRouteSegment = {
  fromPoiId: string;
  toPoiId: string;
  segmentIndex: number;
};

export type MapPresentation = {
  visiblePois: ScoredPoi[];
  activeRoutePois: ScoredPoi[];
  activeRoutePoiIds: string[];
  routeSegments: MapRouteSegment[];
  highlightedPoiIds: string[];
  dimmedPoiIds: string[];
  alternatePoiIds: string[];
  mapHint: string;
};

export type SelectedPlanType = "main" | "fallback";

export const EMPTY_MAP_PRESENTATION: MapPresentation = {
  visiblePois: [],
  activeRoutePois: [],
  activeRoutePoiIds: [],
  routeSegments: [],
  highlightedPoiIds: [],
  dimmedPoiIds: [],
  alternatePoiIds: [],
  mapHint: MAP_DEMO_NOTE,
};

export function hasMapCoords(poi: ScoredPoi) {
  const hasLatLng = typeof poi.lat === "number" && typeof poi.lng === "number";
  const hasXY = typeof poi.x === "number" && typeof poi.y === "number";
  return hasLatLng || hasXY;
}

function poiText(poi: ScoredPoi) {
  return `${poi.name} ${poi.category} ${poi.sceneTags.join(" ")} ${poi.reasons?.join(" ") ?? ""}`;
}

function scorePoiForPersona(poi: ScoredPoi, persona: PersonaType, travelSettings?: TravelSettings) {
  const text = poiText(poi);
  let score = poi.goabilityScore ?? 0;

  if (travelSettings?.transportMode === "walking" && poi.routeEtaMinutes <= 20) score += 2;
  if (travelSettings?.transportMode === "transit" && poi.nearMetro) score += 2;
  if (travelSettings?.routePriority === "queue" && poi.queueMinutes <= 12) score += 2;

  switch (persona) {
    case "friends":
      if (poi.category === "restaurant") score += 8;
      if (/聊天|聚餐|续摊|集合|轻食/.test(text)) score += 5;
      if (poi.category === "cafe" && /聊天/.test(text)) score += 3;
      if (poi.category === "mall") score += 2;
      break;
    case "family":
      if (poi.category === "mall") score += 8;
      if (poi.category === "activity") score += 7;
      if (/亲子|室内|少转场|休息/.test(text)) score += 5;
      if (poi.queueMinutes <= 12) score += 2;
      break;
    case "date":
      if (/展览|甜品|散步|氛围|拍照|浪漫/.test(text)) score += 6;
      if (poi.category === "restaurant") score += 4;
      if (poi.category === "cafe") score += 3;
      if (poi.category === "activity") score += 4;
      break;
    case "work":
      if (/安静|插座|办公|久坐|学习|面试/.test(text)) score += 8;
      if (poi.category === "cafe" && poi.crowdLevel === "low") score += 5;
      if (poi.category === "restaurant" && /简餐|轻食/.test(text)) score += 3;
      break;
    case "errand":
      if (/顺路|办事|途经|学校|停留/.test(text)) score += 5;
      if (poi.nearMetro) score += 3;
      if (poi.category === "restaurant") score += 4;
      if (poi.routeEtaMinutes <= 15) score += 2;
      break;
    default:
      if (poi.level === "green") score += 4;
      if (poi.category === "cafe" || poi.category === "activity") score += 2;
      break;
  }

  return score;
}

function rankByPersona(pois: ScoredPoi[], persona: PersonaType, travelSettings?: TravelSettings) {
  return [...pois].sort(
    (a, b) => scorePoiForPersona(b, persona, travelSettings) - scorePoiForPersona(a, persona, travelSettings),
  );
}

function uniquePois(pois: ScoredPoi[]) {
  const seen = new Set<string>();
  const result: ScoredPoi[] = [];
  for (const poi of pois) {
    if (!poi?.id || seen.has(poi.id)) continue;
    seen.add(poi.id);
    result.push(poi);
  }
  return result;
}

function extractSlotPois(plan?: ItineraryPlan) {
  if (!plan?.slots?.length) return [];
  return plan.slots.map((slot) => slot.poi).filter((poi): poi is ScoredPoi => Boolean(poi?.id));
}

function pickStartPoi(
  rankedPois: ScoredPoi[],
  persona: PersonaType,
  excludeIds: Set<string>,
  travelSettings?: TravelSettings,
) {
  const candidates = rankByPersona(
    rankedPois.filter((poi) => hasMapCoords(poi) && !excludeIds.has(poi.id)),
    persona,
    travelSettings,
  );
  const nearMetro = candidates.find((poi) => poi.nearMetro);
  return nearMetro ?? candidates[0];
}

function supplementRoutePois(
  rankedPois: ScoredPoi[],
  persona: PersonaType,
  existing: ScoredPoi[],
  targetCount: number,
  travelSettings?: TravelSettings,
) {
  const existingIds = new Set(existing.map((poi) => poi.id));
  const extras = rankByPersona(
    rankedPois.filter((poi) => hasMapCoords(poi) && !existingIds.has(poi.id)),
    persona,
    travelSettings,
  );
  return uniquePois([...existing, ...extras]).slice(0, targetCount);
}

function samePoiSet(a: ScoredPoi[], b: ScoredPoi[]) {
  if (!a.length || !b.length) return false;
  const idsA = new Set(a.map((poi) => poi.id));
  const idsB = new Set(b.map((poi) => poi.id));
  if (idsA.size !== idsB.size) return false;
  for (const id of idsA) {
    if (!idsB.has(id)) return false;
  }
  return true;
}

function buildActiveRoutePois(params: {
  routePlan: RoutePlan;
  rankedPois: ScoredPoi[];
  persona: PersonaType;
  selectedPlanType: SelectedPlanType;
  selectedFallbackIndex: number | null;
  travelSettings?: TravelSettings;
}) {
  const { routePlan, rankedPois, persona, selectedPlanType, selectedFallbackIndex, travelSettings } = params;
  const mainSlotPois = extractSlotPois(routePlan.mainPlan);
  const fallbackPlan =
    selectedPlanType === "fallback" && selectedFallbackIndex !== null
      ? routePlan.fallbackPlans?.[selectedFallbackIndex]
      : undefined;
  const fallbackSlotPois = extractSlotPois(fallbackPlan);

  let corePois =
    selectedPlanType === "fallback" && fallbackSlotPois.length
      ? fallbackSlotPois
      : mainSlotPois.length
        ? mainSlotPois
        : rankByPersona(
            rankedPois.filter((poi) => hasMapCoords(poi)),
            persona,
            travelSettings,
          ).slice(0, 3);

  if (selectedPlanType === "fallback" && fallbackSlotPois.length) {
    corePois = fallbackSlotPois;
    if (uniquePois(corePois).length < 2 || samePoiSet(corePois, mainSlotPois)) {
      const mainIds = new Set(mainSlotPois.map((poi) => poi.id));
      const replacement =
        rankByPersona(
          rankedPois.filter((poi) => hasMapCoords(poi) && !mainIds.has(poi.id)),
          persona,
          travelSettings,
        )[0] ?? routePlan.fallbackRestaurant ?? routePlan.fallbackActivity;
      if (replacement) {
        corePois = uniquePois([...corePois.slice(0, 1), replacement, ...corePois.slice(1)]);
      }
    }
  }

  corePois = supplementRoutePois(rankedPois, persona, uniquePois(corePois), 3, travelSettings);

  const excludeForStart = new Set(corePois.map((poi) => poi.id));
  const startPoi = pickStartPoi(rankedPois, persona, excludeForStart, travelSettings);
  const routePois = uniquePois(startPoi ? [startPoi, ...corePois] : corePois).slice(0, 4);

  if (routePois.length < 3) {
    return supplementRoutePois(rankedPois, persona, routePois, 3, travelSettings);
  }

  return routePois;
}

function buildRouteSegments(poiIds: string[]): MapRouteSegment[] {
  const segments: MapRouteSegment[] = [];
  for (let i = 0; i < poiIds.length - 1; i += 1) {
    segments.push({
      fromPoiId: poiIds[i],
      toPoiId: poiIds[i + 1],
      segmentIndex: i + 1,
    });
  }
  return segments;
}

function collectAlternatePoiIds(params: {
  routePlan: RoutePlan;
  mainRouteIds: string[];
  activeRouteIds: string[];
  selectedPlanType: SelectedPlanType;
}) {
  const mainSet = new Set(params.mainRouteIds);
  const activeSet = new Set(params.activeRouteIds);
  const alternates = new Set<string>();

  for (const plan of params.routePlan.fallbackPlans ?? []) {
    for (const slot of plan.slots) {
      const id = slot.poi?.id;
      if (id && !mainSet.has(id)) alternates.add(id);
    }
  }

  if (params.routePlan.fallbackRestaurant?.id && !mainSet.has(params.routePlan.fallbackRestaurant.id)) {
    alternates.add(params.routePlan.fallbackRestaurant.id);
  }
  if (params.routePlan.fallbackActivity?.id && !mainSet.has(params.routePlan.fallbackActivity.id)) {
    alternates.add(params.routePlan.fallbackActivity.id);
  }

  if (params.selectedPlanType === "fallback") {
    for (const id of activeSet) {
      if (!mainSet.has(id)) alternates.add(id);
    }
  }

  return [...alternates];
}

function buildMapHint(selectedPlanType: SelectedPlanType, fallbackTitle?: string) {
  if (selectedPlanType === "fallback") {
    return fallbackTitle
      ? `地图已切换为${fallbackTitle}路线示意。${MAP_DEMO_NOTE}`
      : `地图已切换为备选方案路线示意。${MAP_DEMO_NOTE}`;
  }
  return MAP_DEMO_NOTE;
}

export function buildMapPresentation(params: {
  routePlan: RoutePlan;
  rankedPois: ScoredPoi[];
  parseResult: ParseResult;
  selectedPlanType: SelectedPlanType;
  selectedFallbackIndex: number | null;
  selectedPoiId?: string;
  travelSettings?: TravelSettings;
}): MapPresentation {
  if (!params.routePlan || !params.rankedPois?.length) {
    return { ...EMPTY_MAP_PRESENTATION };
  }

  const rankedWithCoords = params.rankedPois.filter((poi) => hasMapCoords(poi));
  const persona = inferPersona(params.parseResult);
  const { travelSettings } = params;

  const activeRoutePois = buildActiveRoutePois({
    routePlan: params.routePlan,
    rankedPois: rankedWithCoords,
    persona,
    selectedPlanType: params.selectedPlanType,
    selectedFallbackIndex: params.selectedFallbackIndex,
    travelSettings,
  });

  const activeRoutePoiIds = activeRoutePois.map((poi) => poi.id);
  const routeSegments = buildRouteSegments(activeRoutePoiIds);

  const mainRoutePois = buildActiveRoutePois({
    routePlan: params.routePlan,
    rankedPois: rankedWithCoords,
    persona,
    selectedPlanType: "main",
    selectedFallbackIndex: null,
    travelSettings,
  });
  const mainRouteIds = mainRoutePois.map((poi) => poi.id);

  const alternatePoiIds = collectAlternatePoiIds({
    routePlan: params.routePlan,
    mainRouteIds,
    activeRouteIds: activeRoutePoiIds,
    selectedPlanType: params.selectedPlanType,
  });

  const personaRanked = rankByPersona(rankedWithCoords, persona, travelSettings);
  const highlightedPoiIds = uniquePois([
    ...activeRoutePois,
    ...personaRanked.slice(0, 4),
    ...(params.selectedPoiId ? rankedWithCoords.filter((poi) => poi.id === params.selectedPoiId) : []),
  ]).map((poi) => poi.id);

  const highlightedSet = new Set(highlightedPoiIds);
  const routeSet = new Set(activeRoutePoiIds);
  const alternateSet = new Set(alternatePoiIds);

  let visiblePois = uniquePois([
    ...activeRoutePois,
    ...personaRanked.slice(0, 8),
    ...rankedWithCoords.filter((poi) => alternateSet.has(poi.id)),
    ...(params.selectedPoiId ? rankedWithCoords.filter((poi) => poi.id === params.selectedPoiId) : []),
  ]).slice(0, 14);

  if (visiblePois.length < 3) {
    visiblePois = uniquePois([...visiblePois, ...rankByPersona(rankedWithCoords, persona, travelSettings)]).slice(
      0,
      Math.max(3, visiblePois.length),
    );
  }

  const dimmedPoiIds = visiblePois
    .filter((poi) => !highlightedSet.has(poi.id) && !routeSet.has(poi.id) && !alternateSet.has(poi.id))
    .map((poi) => poi.id);

  const fallbackTitle =
    params.selectedPlanType === "fallback" && params.selectedFallbackIndex !== null
      ? params.routePlan.fallbackPlans?.[params.selectedFallbackIndex]?.title
      : undefined;

  return {
    visiblePois,
    activeRoutePois,
    activeRoutePoiIds,
    routeSegments,
    highlightedPoiIds: [...new Set(highlightedPoiIds)],
    dimmedPoiIds,
    alternatePoiIds,
    mapHint: buildMapHint(params.selectedPlanType, fallbackTitle),
  };
}
