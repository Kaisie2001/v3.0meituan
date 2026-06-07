"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import type { ScoredPoi } from "@/lib/types";

type LeafletPlannerMapProps = {
  pois: ScoredPoi[];
  selectedPoiId?: string;
  onSelectPoi: (poi: ScoredPoi) => void;
  routePoiIds: string[];
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

const levelColor = {
  green: "#10b981",
  yellow: "#f59e0b",
  red: "#f43f5e",
  gray: "#94a3b8",
};

export function LeafletPlannerMap({ pois, selectedPoiId, onSelectPoi, routePoiIds }: LeafletPlannerMapProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerLayerRef = useRef<L.LayerGroup | null>(null);
  const routeLayerRef = useRef<L.LayerGroup | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const tileIndexRef = useRef(0);
  const tileErrorCountRef = useRef(0);
  const [tileLabel, setTileLabel] = useState(tileProviders[0]?.label ?? "OpenStreetMap");
  const [tileFailed, setTileFailed] = useState(false);

  const poiById = useMemo(() => new Map(pois.map((poi) => [poi.id, poi])), [pois]);
  const routeLatLngs = useMemo(() => {
    return routePoiIds
      .map((id) => poiById.get(id))
      .filter(Boolean)
      .map((poi) => toLatLng(poi as ScoredPoi));
  }, [poiById, routePoiIds]);

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

    map.setView([39.909, 116.397], 13);
    map.whenReady(() => {
      try {
        map.invalidateSize();
      } catch {}
    });
    mapRef.current = map;
  }, []);

  useEffect(() => {
    if (!mapRef.current || !markerLayerRef.current) return;
    markerLayerRef.current.clearLayers();

    for (const poi of pois) {
      const latlng = toLatLng(poi);
      const selected = poi.id === selectedPoiId;
      const color = levelColor[poi.level];

      const marker = L.circleMarker(latlng, {
        radius: selected ? 10 : 7,
        color: selected ? "#111827" : color,
        weight: selected ? 3 : 2,
        fillColor: color,
        fillOpacity: 0.9,
      });

      marker.on("click", () => onSelectPoi(poi));
      marker.bindTooltip(`${poi.name} · ${poi.goabilityScore}分`, { direction: "top", offset: [0, -8] });
      marker.addTo(markerLayerRef.current);
    }
  }, [pois, onSelectPoi, selectedPoiId]);

  useEffect(() => {
    if (!mapRef.current || !routeLayerRef.current) return;
    routeLayerRef.current.clearLayers();

    if (routeLatLngs.length >= 2) {
      const polyline = L.polyline(routeLatLngs, { color: "#2563eb", weight: 4, opacity: 0.85 });
      polyline.addTo(routeLayerRef.current);
      mapRef.current.fitBounds(polyline.getBounds().pad(0.2));
    }
  }, [routeLatLngs]);

  return (
    <section className="rounded-lg border border-black/5 bg-white p-3 shadow-soft">
      <div className="mb-3 flex flex-col gap-2">
        <div>
          <h2 className="text-base font-bold">动态规划地图</h2>
          <p className="text-xs text-black/58">底图：{tileLabel}（本地 Demo），点位与信息为 mock。</p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs text-black/60">
          <span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-full" style={{ background: levelColor.green }} />推荐</span>
          <span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-full" style={{ background: levelColor.yellow }} />可选</span>
          <span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-full" style={{ background: levelColor.red }} />不建议</span>
          <span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-full" style={{ background: levelColor.gray }} />不可用</span>
        </div>
      </div>
      <div className="relative h-[260px] w-full overflow-hidden rounded-lg border border-black/10">
        <div ref={hostRef} className="absolute inset-0" />
        {tileFailed ? (
          <div className="absolute inset-0 grid place-items-center bg-slate-50 text-center">
            <div className="max-w-md px-6">
              <p className="text-sm font-bold text-black/75">底图加载失败</p>
              <p className="mt-2 text-sm text-black/60">可能是网络限制导致 OSM 瓦片请求失败。已自动尝试切换多个公开镜像。</p>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
