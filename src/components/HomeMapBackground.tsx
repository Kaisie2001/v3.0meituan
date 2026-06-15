"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import { mockPois } from "@/lib/mockPois";
import type { Poi } from "@/lib/types";
import { HomeMapPlaceholder } from "@/components/HomeMapPlaceholder";

type HomeMapBackgroundProps = {
  className?: string;
};

const MAP_CENTER: L.LatLngExpression = [39.909, 116.397];
const MAP_ZOOM = 13;

const tileProviders = [
  {
    label: "OpenStreetMap",
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: "© OpenStreetMap contributors",
  },
  {
    label: "OpenStreetMap.de",
    url: "https://{s}.tile.openstreetmap.de/{z}/{x}/{y}.png",
    attribution: "© OpenStreetMap contributors",
  },
  {
    label: "OSM HOT",
    url: "https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png",
    attribution: "© OpenStreetMap contributors",
  },
] as const;

/** Visual-only home markers. Not passed to planning / routing. */
const HOME_VISUAL_MARKER_SPECS = [
  { poiId: "plain-table", label: "餐厅", color: "#FFC300" },
  { poiId: "tree-cafe", label: "咖啡", color: "#F59E0B" },
  { poiId: "book-nook", label: "公园", color: "#4ADE80" },
  { poiId: "metro-mall", label: "商场", color: "#94A3B8" },
  { poiId: "art-walk", label: "展览", color: "#A78BFA" },
  { poiId: "kid-zone", label: "亲子", color: "#FB7185" },
  { poiId: "easy-pick", label: "办事点", color: "#64748B" },
] as const;

function toLatLng(poi: Poi) {
  if (typeof poi.lat === "number" && typeof poi.lng === "number") return L.latLng(poi.lat, poi.lng);
  const centerLat = 39.909;
  const centerLng = 116.397;
  const dx = (poi.x - 50) / 1800;
  const dy = (poi.y - 50) / 1800;
  return L.latLng(centerLat + dy, centerLng + dx);
}

function refreshMapSize(map: L.Map) {
  try {
    map.invalidateSize({ animate: false });
  } catch {}
}

function hasLayoutSize(element: HTMLElement) {
  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

function MapFallback({ className = "" }: { className?: string }) {
  return (
    <div
      data-testid="home-map-fallback"
      aria-hidden="true"
      className={`h-full w-full bg-[#eef1e8] ${className}`}
    />
  );
}

export function HomeMapBackground({ className = "" }: HomeMapBackgroundProps) {
  const [mounted, setMounted] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerLayerRef = useRef<L.LayerGroup | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const tileIndexRef = useRef(0);
  const tileErrorCountRef = useRef(0);
  const [tileFailed, setTileFailed] = useState(false);
  const [mapError, setMapError] = useState(false);
  const [mapReady, setMapReady] = useState(false);

  const visualMarkers = useMemo(() => {
    const poiById = new Map(mockPois.map((poi) => [poi.id, poi]));
    return HOME_VISUAL_MARKER_SPECS.flatMap((spec) => {
      const poi = poiById.get(spec.poiId);
      if (!poi) return [];
      return [{ ...spec, poi, latlng: toLatLng(poi) }];
    });
  }, []);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    const wrapper = wrapperRef.current;
    const host = hostRef.current;
    if (!wrapper || !host) return;

    let disposed = false;
    let resizeObserver: ResizeObserver | null = null;

    const mountMap = () => {
      if (disposed || mapRef.current || mapError || !hasLayoutSize(wrapper)) return;

      try {
        const map = L.map(host, {
          zoomControl: false,
          attributionControl: true,
          dragging: true,
          scrollWheelZoom: true,
          doubleClickZoom: true,
          boxZoom: false,
          keyboard: false,
          touchZoom: true,
        });

        L.control.zoom({ position: "topright" }).addTo(map);

        const createLayer = (index: number) => {
          const provider = tileProviders[index] ?? tileProviders[0];
          const layer = L.tileLayer(provider.url, {
            maxZoom: 19,
            attribution: provider.attribution,
          });
          layer.on("load", () => {
            tileErrorCountRef.current = 0;
            setTileFailed(false);
          });
          layer.on("tileerror", () => {
            tileErrorCountRef.current += 1;
            if (tileErrorCountRef.current < 24) return;
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
            tileErrorCountRef.current = 0;
            nextLayer.addTo(map);
          });
          return layer;
        };

        tileIndexRef.current = 0;
        tileLayerRef.current = createLayer(0);
        tileLayerRef.current.addTo(map);

        markerLayerRef.current = L.layerGroup().addTo(map);

        for (const marker of visualMarkers) {
          L.circleMarker(marker.latlng, {
            radius: 7,
            color: "#ffffff",
            weight: 2,
            fillColor: marker.color,
            fillOpacity: 0.92,
            interactive: false,
          }).addTo(markerLayerRef.current);

          const icon = L.divIcon({
            className: "home-map-marker-label",
            html: `<span style="display:inline-block;padding:2px 7px;border-radius:9999px;background:rgba(255,255,255,0.92);border:1px solid rgba(15,23,42,0.08);font-size:10px;font-weight:700;color:rgba(15,23,42,0.62);box-shadow:0 1px 2px rgba(15,23,42,0.08);white-space:nowrap;">${marker.label}</span>`,
            iconSize: [0, 0],
            iconAnchor: [0, -14],
          });
          L.marker(marker.latlng, { icon, interactive: false }).addTo(markerLayerRef.current);
        }

        map.setView(MAP_CENTER, MAP_ZOOM);
        mapRef.current = map;

        map.whenReady(() => {
          if (disposed) return;
          refreshMapSize(map);
          window.requestAnimationFrame(() => refreshMapSize(map));
          window.setTimeout(() => refreshMapSize(map), 120);
          window.setTimeout(() => refreshMapSize(map), 400);
          setMapReady(true);
        });
      } catch {
        setMapError(true);
        try {
          mapRef.current?.remove();
        } catch {}
        mapRef.current = null;
      }
    };

    const handleResize = () => {
      if (!mapRef.current) {
        mountMap();
        return;
      }
      refreshMapSize(mapRef.current);
    };

    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(handleResize);
      resizeObserver.observe(wrapper);
    }

    handleResize();
    window.setTimeout(handleResize, 120);

    return () => {
      disposed = true;
      resizeObserver?.disconnect();
      setMapReady(false);
      try {
        mapRef.current?.remove();
      } catch {}
      mapRef.current = null;
      markerLayerRef.current = null;
      tileLayerRef.current = null;
    };
  }, [mounted, visualMarkers, mapError]);

  useLayoutEffect(() => {
    if (!mapRef.current || !wrapperRef.current) return;
    refreshMapSize(mapRef.current);
  }, [mapReady, className]);

  if (!mounted) {
    return <MapFallback className={className} />;
  }

  if (mapError) {
    return <MapFallback className={className} />;
  }

  if (tileFailed) {
    return <HomeMapPlaceholder className={className} />;
  }

  return (
    <div
      ref={wrapperRef}
      data-testid="home-map-background"
      aria-hidden="true"
      className={`h-full w-full overflow-hidden ${className}`}
    >
      <div
        ref={hostRef}
        className="absolute inset-0 h-full w-full [&_.leaflet-container]:!h-full [&_.leaflet-container]:!w-full [&_.leaflet-control-zoom]:!mt-2"
      />
    </div>
  );
}

export default HomeMapBackground;
