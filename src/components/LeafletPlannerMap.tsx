"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import type { MapPresentation } from "@/lib/mapPresentation";
import type { ScoredPoi } from "@/lib/types";

type LeafletPlannerMapProps = {
  pois: ScoredPoi[];
  selectedPoiId?: string;
  onSelectPoi: (poi: ScoredPoi) => void;
  mapPresentation?: MapPresentation;
  /** @deprecated use mapPresentation.activeRoutePoiIds */
  routePoiIds?: string[];
  /** Visual-only: styles active route as main vs fallback. */
  selectedPlanType?: "main" | "fallback";
  variant?: "default" | "hero";
  className?: string;
};

function toLatLng(poi: ScoredPoi) {
  if (typeof poi.lat === "number" && typeof poi.lng === "number") return L.latLng(poi.lat, poi.lng);
  const centerLat = 39.909;
  const centerLng = 116.397;
  const dx = (poi.x - 50) / 1800;
  const dy = (poi.y - 50) / 1800;
  return L.latLng(centerLat + dy, centerLng + dx);
}

const tileProviders = [
  { label: "OpenStreetMap", url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", attribution: "© OpenStreetMap contributors" },
  { label: "OpenStreetMap.de", url: "https://{s}.tile.openstreetmap.de/{z}/{x}/{y}.png", attribution: "© OpenStreetMap contributors" },
  { label: "OSM HOT", url: "https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png", attribution: "© OpenStreetMap contributors" },
];

const ROUTE_COLOR = "#E2B84A";
const ROUTE_COLOR_ALT = "#D9C48A";
const ROUTE_COLOR_FALLBACK = "#C8B88A";
const ROUTE_OUTLINE_COLOR = "#ffffff";
const MARKER_ROUTE = "#E2B84A";
const MARKER_HIGHLIGHT = "#CBD5E1";
const MARKER_ALTERNATE = "#D4C4B0";
const MARKER_DIMMED = "#E2E8F0";
const MARKER_SELECTED_RING = "#3D4450";

function addRouteSegment(
  layer: L.LayerGroup,
  latlngs: L.LatLng[],
  options: {
    color: string;
    weight: number;
    opacity: number;
    dashArray?: string;
  },
) {
  L.polyline(latlngs, {
    color: ROUTE_OUTLINE_COLOR,
    weight: options.weight + 3.5,
    opacity: 0.9,
    lineCap: "round",
    lineJoin: "round",
  }).addTo(layer);

  L.polyline(latlngs, {
    color: options.color,
    weight: options.weight,
    opacity: options.opacity,
    dashArray: options.dashArray,
    lineCap: "round",
    lineJoin: "round",
  }).addTo(layer);
}

export function LeafletPlannerMap({
  pois,
  selectedPoiId,
  onSelectPoi,
  mapPresentation,
  routePoiIds = [],
  selectedPlanType = "main",
  variant = "default",
  className = "",
}: LeafletPlannerMapProps) {
  const isHero = variant === "hero";
  const isFallbackPlan = selectedPlanType === "fallback";
  const hostRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerLayerRef = useRef<L.LayerGroup | null>(null);
  const routeLayerRef = useRef<L.LayerGroup | null>(null);
  const labelLayerRef = useRef<L.LayerGroup | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const tileIndexRef = useRef(0);
  const tileErrorCountRef = useRef(0);
  const [tileLabel, setTileLabel] = useState(tileProviders[0]?.label ?? "OpenStreetMap");
  const [tileFailed, setTileFailed] = useState(false);

  const poiById = useMemo(() => new Map(pois.map((poi) => [poi.id, poi])), [pois]);

  const activeRoutePoiIds = mapPresentation?.activeRoutePoiIds ?? routePoiIds;
  const routeSegments = mapPresentation?.routeSegments ?? [];
  const highlightedSet = useMemo(() => new Set(mapPresentation?.highlightedPoiIds ?? []), [mapPresentation?.highlightedPoiIds]);
  const dimmedSet = useMemo(() => new Set(mapPresentation?.dimmedPoiIds ?? []), [mapPresentation?.dimmedPoiIds]);
  const alternateSet = useMemo(() => new Set(mapPresentation?.alternatePoiIds ?? []), [mapPresentation?.alternatePoiIds]);
  const routeOrderMap = useMemo(() => new Map(activeRoutePoiIds.map((id, index) => [id, index + 1])), [activeRoutePoiIds]);
  const mapHint = mapPresentation?.mapHint;

  const segmentGeometries = useMemo(() => {
    if (routeSegments.length) {
      return routeSegments
        .map((segment) => {
          const from = poiById.get(segment.fromPoiId);
          const to = poiById.get(segment.toPoiId);
          if (!from || !to) return null;
          return {
            segmentIndex: segment.segmentIndex,
            latlngs: [toLatLng(from), toLatLng(to)],
          };
        })
        .filter(Boolean) as { segmentIndex: number; latlngs: L.LatLng[] }[];
    }

    const latlngs = activeRoutePoiIds
      .map((id) => poiById.get(id))
      .filter(Boolean)
      .map((poi) => toLatLng(poi as ScoredPoi));

    if (latlngs.length < 2) return [];
    const fallbackSegments: { segmentIndex: number; latlngs: L.LatLng[] }[] = [];
    for (let i = 0; i < latlngs.length - 1; i += 1) {
      fallbackSegments.push({ segmentIndex: i + 1, latlngs: [latlngs[i], latlngs[i + 1]] });
    }
    return fallbackSegments;
  }, [activeRoutePoiIds, poiById, routeSegments]);

  useEffect(() => {
    if (!hostRef.current || mapRef.current) return;

    const map = L.map(hostRef.current, {
      zoomControl: true,
      attributionControl: true,
    });

    const createLayer = (index: number) => {
      const provider = tileProviders[index] ?? tileProviders[0];
      const layer = L.tileLayer(provider.url, { maxZoom: 19, attribution: provider.attribution });
      layer.on("load", () => {
        tileErrorCountRef.current = 0;
        setTileFailed(false);
      });
      layer.on("tileerror", () => {
        tileErrorCountRef.current += 1;
        if (tileErrorCountRef.current < 8) return;
        if (tileIndexRef.current >= tileProviders.length - 1) {
          setTileFailed(true);
          return;
        }
        tileIndexRef.current += 1;
        const nextLayer = createLayer(tileIndexRef.current);
        try {
          tileLayerRef.current?.removeFrom(map);
        } catch {}
        tileLayerRef.current = nextLayer;
        setTileLabel(tileProviders[tileIndexRef.current]?.label ?? "OpenStreetMap");
        tileErrorCountRef.current = 0;
        nextLayer.addTo(map);
      });
      return layer;
    };

    tileIndexRef.current = 0;
    tileLayerRef.current = createLayer(0);
    tileLayerRef.current.addTo(map);

    markerLayerRef.current = L.layerGroup().addTo(map);
    routeLayerRef.current = L.layerGroup().addTo(map);
    labelLayerRef.current = L.layerGroup().addTo(map);

    map.setView([39.909, 116.397], 13);
    map.whenReady(() => {
      try {
        map.invalidateSize();
      } catch {}
    });
    mapRef.current = map;
  }, []);

  useEffect(() => {
    if (!mapRef.current || !markerLayerRef.current || !labelLayerRef.current) return;
    markerLayerRef.current.clearLayers();
    labelLayerRef.current.clearLayers();

    for (const poi of pois) {
      const latlng = toLatLng(poi);
      const selected = poi.id === selectedPoiId;
      const onRoute = routeOrderMap.has(poi.id);
      const isAlternate = alternateSet.has(poi.id);
      const isDimmed = dimmedSet.has(poi.id) && !onRoute && !selected;
      const isHighlighted = highlightedSet.has(poi.id) || onRoute;

      let fillColor = MARKER_HIGHLIGHT;
      if (onRoute) fillColor = MARKER_ROUTE;
      else if (isAlternate) fillColor = MARKER_ALTERNATE;
      else if (isDimmed) fillColor = MARKER_DIMMED;

      const radius = selected ? 10 : onRoute ? 9 : isHighlighted ? 7 : 5.5;
      const weight = selected ? 2.5 : onRoute ? 2 : 1.5;
      const fillOpacity = isDimmed ? 0.42 : onRoute ? 0.9 : isAlternate ? 0.68 : 0.78;
      const color = selected ? MARKER_SELECTED_RING : "#ffffff";

      const marker = L.circleMarker(latlng, {
        radius,
        color,
        weight,
        fillColor,
        fillOpacity,
      });

      marker.on("click", () => onSelectPoi(poi));
      const routeLabel = routeOrderMap.get(poi.id);
      const tooltip = routeLabel
        ? `${routeLabel}. ${poi.name} · ${poi.goabilityScore}分`
        : `${poi.name} · ${poi.goabilityScore}分`;
      marker.bindTooltip(tooltip, { direction: "top", offset: [0, -10] });
      marker.addTo(markerLayerRef.current);

      if (routeLabel) {
        const badge = L.divIcon({
          className: `planner-map-route-badge${selected ? " is-selected" : ""}`,
          html: `<span>${routeLabel}</span>`,
          iconSize: selected ? [19, 19] : [17, 17],
          iconAnchor: [selected ? 9.5 : 8.5, 22],
        });
        L.marker(latlng, { icon: badge, interactive: false, zIndexOffset: 500 }).addTo(labelLayerRef.current);
      }
    }
  }, [pois, onSelectPoi, selectedPoiId, routeOrderMap, highlightedSet, dimmedSet, alternateSet]);

  useEffect(() => {
    if (!mapRef.current || !routeLayerRef.current) return;
    routeLayerRef.current.clearLayers();

    const boundsPoints: L.LatLng[] = [];
    for (const segment of segmentGeometries) {
      const isAltSegment = segment.segmentIndex % 2 === 0;
      const color = isFallbackPlan
        ? ROUTE_COLOR_FALLBACK
        : isAltSegment
          ? ROUTE_COLOR_ALT
          : ROUTE_COLOR;

      addRouteSegment(routeLayerRef.current, segment.latlngs, {
        color,
        weight: isFallbackPlan ? 3.5 : 4,
        opacity: isFallbackPlan ? 0.72 : 0.9,
        dashArray: isFallbackPlan ? "9 7" : undefined,
      });
      boundsPoints.push(...segment.latlngs);
    }

    if (boundsPoints.length >= 2) {
      mapRef.current.fitBounds(L.latLngBounds(boundsPoints).pad(0.18));
    }
  }, [segmentGeometries, isFallbackPlan]);

  useEffect(() => {
    if (!mapRef.current) return;
    const timer = window.setTimeout(() => {
      try {
        mapRef.current?.invalidateSize();
      } catch {}
    }, 120);
    return () => window.clearTimeout(timer);
  }, [variant, className]);

  const legend = (
    <div className={`flex flex-wrap gap-x-3 gap-y-1 text-black/50 ${isHero ? "text-[10px]" : "text-xs"}`}>
      <span className="inline-flex items-center gap-1">
        <i className="inline-block h-0.5 w-4 rounded-full" style={{ background: ROUTE_COLOR }} />
        推荐路线
      </span>
      <span className="inline-flex items-center gap-1">
        <i className="inline-block h-2 w-2 rounded-full border border-white shadow-sm" style={{ background: MARKER_ROUTE }} />
        途经点
      </span>
      <span className="inline-flex items-center gap-1">
        <i className="inline-block h-2 w-2 rounded-full border border-white/90" style={{ background: MARKER_ALTERNATE }} />
        可替换
      </span>
    </div>
  );

  if (isHero) {
    return (
      <div
        data-testid="map-container"
        className={`planner-map-soft-theme relative z-0 h-full w-full overflow-hidden bg-[#f3f4f0] ${className}`}
      >
        <div
          ref={hostRef}
          className="absolute inset-0 z-0 [&_.leaflet-bottom]:!z-[1] [&_.leaflet-control-attribution]:!z-[1] [&_.leaflet-control]:!z-[2] [&_.leaflet-pane]:!z-[1] [&_.leaflet-top]:!z-[2]"
        />
        <div className="pointer-events-none absolute left-2 top-2 z-[3] max-w-[calc(100%-1rem)] rounded-xl border border-black/5 bg-white/90 px-2.5 py-2 shadow-sm backdrop-blur-sm">
          {legend}
          {mapHint ? <p className="mt-1 max-w-[240px] text-[10px] leading-4 text-black/45">{mapHint}</p> : null}
        </div>
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 z-[3] h-24 bg-gradient-to-t from-white/75 via-white/28 to-transparent"
          aria-hidden="true"
        />
        {tileFailed ? (
          <div className="absolute inset-0 z-[4] grid place-items-center bg-[#f3f4f0] text-center">
            <div className="max-w-md px-6">
              <p className="text-sm font-bold text-black/70">底图加载失败</p>
              <p className="mt-2 text-sm text-black/55">可能是网络限制导致 OSM 瓦片请求失败。已自动尝试切换多个公开镜像。</p>
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <section
      data-testid="map-container"
      className={`planner-map-soft-theme rounded-lg border border-black/5 bg-white p-3 shadow-soft ${className}`}
    >
      <div className="mb-3 flex flex-col gap-2">
        <div>
          <h2 className="text-base font-bold">动态规划地图</h2>
          <p className="text-xs text-black/58">底图：{tileLabel}（本地 Demo），点位与信息为 mock。</p>
          {mapHint ? <p className="mt-1 text-[10px] leading-4 text-black/45">{mapHint}</p> : null}
        </div>
        {legend}
      </div>
      <div className="relative h-[260px] w-full overflow-hidden rounded-lg border border-black/8 bg-[#f3f4f0]">
        <div ref={hostRef} className="absolute inset-0" />
        {tileFailed ? (
          <div className="absolute inset-0 grid place-items-center bg-[#f3f4f0] text-center">
            <div className="max-w-md px-6">
              <p className="text-sm font-bold text-black/70">底图加载失败</p>
              <p className="mt-2 text-sm text-black/55">可能是网络限制导致 OSM 瓦片请求失败。已自动尝试切换多个公开镜像。</p>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
