"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Map, LayerGroup } from "leaflet";
import type * as LeafletNS from "leaflet";
import type { PropertySearchHit } from "./types";

type LeafletModule = { default: typeof LeafletNS };

// Leaflet CSS: loaded so map tiles and controls render correctly.
import "leaflet/dist/leaflet.css";

export type MapViewport = {
  bounds: { south: number; west: number; north: number; east: number } | null;
};

const DEFAULT_CENTER: [number, number] = [51.5, -0.15];
const DEFAULT_ZOOM = 10;
const VIEWPORT_DEBOUNCE_MS = 400;

type Props = {
  viewport: MapViewport;
  onViewportChange: (next: MapViewport) => void;
  results: PropertySearchHit[];
  onMarkerClick?: (docId: string) => void;
  selectedDocId?: string | null;
};

export function ListingsMapPanel({
  viewport,
  onViewportChange,
  results,
  onMarkerClick,
  selectedDocId = null,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<Map | null>(null);
  const layerGroupRef = useRef<LayerGroup | null>(null);
  const leafletRef = useRef<LeafletModule | null>(null);
  const viewportDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onViewportChangeRef = useRef(onViewportChange);
  onViewportChangeRef.current = onViewportChange;
  const [mapReady, setMapReady] = useState(false);

  // Init map once on client (Leaflet requires window/DOM). Do not depend on callback identity
  // so the map is not recreated on parent re-renders (which would cause snap-back).
  useEffect(() => {
    if (!containerRef.current) return;

    let cancelled = false;
    let map: L.Map | null = null;

    void import("leaflet").then((mod) => {
      if (cancelled || !containerRef.current) return;
      const L = (mod as LeafletModule).default;
      leafletRef.current = mod as LeafletModule;
      map = L.map(containerRef.current).setView(DEFAULT_CENTER, DEFAULT_ZOOM);
      mapRef.current = map;

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap contributors",
      }).addTo(map);

      const layerGroup = L.layerGroup().addTo(map);
      layerGroupRef.current = layerGroup;

      map.on("moveend", () => {
        if (!mapRef.current) return;
        if (viewportDebounceRef.current) clearTimeout(viewportDebounceRef.current);
        const b = mapRef.current.getBounds();
        viewportDebounceRef.current = setTimeout(() => {
          viewportDebounceRef.current = null;
          onViewportChangeRef.current({ bounds: { south: b.getSouth(), west: b.getWest(), north: b.getNorth(), east: b.getEast() } });
        }, VIEWPORT_DEBOUNCE_MS);
      });

      setMapReady(true);
    });

    return () => {
      cancelled = true;
      if (viewportDebounceRef.current) {
        clearTimeout(viewportDebounceRef.current);
        viewportDebounceRef.current = null;
      }
      if (map) {
        map.remove();
        mapRef.current = null;
        layerGroupRef.current = null;
        leafletRef.current = null;
      }
      setMapReady(false);
    };
  }, []);

  // Marker layer: plot results with lat/lng. Do not refit map on result change.
  // TODO(clustering): Replace with a clustering layer (e.g. Leaflet.markercluster)
  // when result sets grow; keep same data interface (results, onMarkerClick, selectedDocId).
  useEffect(() => {
    const map = mapRef.current;
    const layer = layerGroupRef.current;
    const L = leafletRef.current?.default;
    if (!map || !layer || !L) return;

    layer.clearLayers();

    const mappable = results.filter(
      (r): r is PropertySearchHit & { lat: number; lng: number } =>
        typeof r.lat === "number" && typeof r.lng === "number"
    );

    mappable.forEach((hit) => {
      const isSelected = hit.docId === selectedDocId;
      const marker = L.circleMarker([hit.lat, hit.lng], {
        radius: isSelected ? 10 : 8,
        fillColor: isSelected ? "#2563eb" : "#18181b",
        color: "#fff",
        weight: 2,
        fillOpacity: 1,
      });
      if (onMarkerClick) {
        marker.on("click", () => onMarkerClick(hit.docId));
      }
      marker.addTo(layer);
    });
  }, [results, selectedDocId, onMarkerClick, mapReady]);

  const withViewport = viewport.bounds != null;
  const mappableCount = results.filter(
    (r) => typeof r.lat === "number" && typeof r.lng === "number"
  ).length;

  return (
    <div className="h-[55vh] sm:h-[60vh] lg:h-[calc(100vh-3.5rem-2rem)] rounded-lg border border-zinc-200 bg-white overflow-hidden flex flex-col">
      <div className="border-b border-zinc-200 px-4 py-3 flex items-center justify-between shrink-0">
        <div>
          <p className="text-sm font-medium text-zinc-900">Map</p>
          <p className="text-xs text-zinc-500">
            {mappableCount}/{results.length} with coordinates
          </p>
        </div>
        <button
          type="button"
          className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50 disabled:opacity-50"
          onClick={() => onViewportChange({ bounds: null })}
          disabled={!withViewport}
        >
          Clear viewport filter
        </button>
      </div>
      <div className="flex-1 min-h-0 relative">
        <div ref={containerRef} className="absolute inset-0 z-0" />
        {!mapReady && (
          <div className="absolute inset-0 flex items-center justify-center bg-zinc-100 z-10">
            <p className="text-sm text-zinc-600">Loading map…</p>
          </div>
        )}
      </div>
    </div>
  );
}
