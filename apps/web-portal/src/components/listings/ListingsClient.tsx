"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type {
  ListingsSearchParams,
  PropertySearchHit,
  PropertySearchResponse,
} from "./types";
import { ListingsFilterBar } from "./ListingsFilterBar";
import { ListingCard } from "./ListingCard";
import { ListingsMapPanel, type MapViewport } from "./ListingsMapPanel";
import { useDebouncedValue } from "./useDebouncedValue";

type Props = {
  initialResults: PropertySearchHit[];
  initialNextCursor?: string | null;
  initialParams: Required<Pick<ListingsSearchParams, "available" | "limit">> &
    Omit<ListingsSearchParams, "available" | "limit">;
};

function toQueryString(
  p: Props["initialParams"],
  cursor?: string | null
): string {
  const sp = new URLSearchParams();
  if (p.q) sp.set("q", p.q);
  if (p.listingType) sp.set("listingType", p.listingType);
  if (p.minPrice != null && p.minPrice >= 0) sp.set("minPrice", String(p.minPrice));
  if (p.maxPrice != null && p.maxPrice > 0) sp.set("maxPrice", String(p.maxPrice));
  if (p.minBeds != null && p.minBeds > 0) sp.set("minBeds", String(p.minBeds));
  if (p.bounds) sp.set("bounds", p.bounds);
  sp.set("available", p.available ? "true" : "false");
  sp.set("limit", String(p.limit));
  if (cursor) sp.set("cursor", cursor);
  return sp.toString();
}

function parseViewportToBoundsParam(viewport: MapViewport): string | undefined {
  const b = viewport.bounds;
  if (!b) return undefined;
  return `${b.south},${b.west},${b.north},${b.east}`;
}

export function ListingsClient({
  initialResults,
  initialNextCursor = null,
  initialParams,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [params, setParams] = useState<Props["initialParams"]>(initialParams);
  const [results, setResults] = useState<PropertySearchHit[]>(initialResults);
  const [nextCursor, setNextCursor] = useState<string | null>(initialNextCursor ?? null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewport, setViewport] = useState<MapViewport>({ bounds: null });
  const [mobileMode, setMobileMode] = useState<"list" | "map">("list");
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const qDebounced = useDebouncedValue(params.q ?? "", 350);

  const effectiveParams = useMemo(() => {
    const bounds = parseViewportToBoundsParam(viewport);
    return {
      ...params,
      q: qDebounced.trim() || undefined,
      bounds: bounds ?? params.bounds,
    };
  }, [params, qDebounced, viewport]);

  const syncUrl = useCallback(
    (next: Props["initialParams"]) => {
      const current = searchParams?.toString() ?? "";
      const qs = toQueryString(next);
      if (qs === current) return;
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  const fetchResults = useCallback(
    async (opts?: { append: true; cursor: string }) => {
      const id = ++requestIdRef.current;
      const append = opts?.append === true && opts?.cursor;
      setLoading(true);
      setError(null);
      try {
        const qs = toQueryString(
          effectiveParams,
          append ? opts.cursor : undefined
        );
        const res = await fetch(`/api/properties/search?${qs}`, {
          method: "GET",
          headers: { Accept: "application/json" },
        });
        if (id !== requestIdRef.current) return;
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as {
            error?: string;
          } | null;
          throw new Error(body?.error || `Search failed (${res.status})`);
        }
        const data = (await res.json()) as PropertySearchResponse;
        if (id !== requestIdRef.current) return;
        const list = Array.isArray(data.results) ? data.results : [];
        if (append) {
          setResults((prev) => {
            const seen = new Set(prev.map((r) => r.docId));
            const extra = list.filter((h) => !seen.has(h.docId));
            return [...prev, ...extra];
          });
        } else {
          setResults(list);
        }
        setNextCursor(data.nextCursor ?? null);
      } catch (e) {
        if (id !== requestIdRef.current) return;
        setError(e instanceof Error ? e.message : "Search failed");
        if (!append) setResults([]);
        setNextCursor(null);
      } finally {
        if (id === requestIdRef.current) setLoading(false);
      }
    },
    [effectiveParams]
  );

  const loadMore = useCallback(() => {
    if (loading || !nextCursor) return;
    void fetchResults({ append: true, cursor: nextCursor });
  }, [loading, nextCursor, fetchResults]);

  useEffect(() => {
    // Always keep URL in sync with current search state. This is a first-pass
    // implementation that remains compatible with future cursor pagination.
    syncUrl(effectiveParams);
  }, [effectiveParams, syncUrl]);

  useEffect(() => {
    void fetchResults();
  }, [fetchResults]);

  useEffect(() => {
    if (selectedDocId && !results.some((r) => r.docId === selectedDocId)) {
      setSelectedDocId(null);
    }
  }, [results, selectedDocId]);

  const onChangeParams = useCallback((next: Props["initialParams"]) => {
    // Reset pagination when filters change.
    setParams({ ...next, limit: initialParams.limit });
  }, [initialParams.limit]);

  const canLoadMore = nextCursor != null;

  const handleViewportChange = useCallback((next: MapViewport) => {
    setViewport(next);
    setParams((p) => ({ ...p, bounds: parseViewportToBoundsParam(next) }));
  }, []);

  const handleMarkerClick = useCallback((docId: string) => {
    setSelectedDocId(docId);
    requestAnimationFrame(() => {
      document.getElementById(`listing-card-${docId}`)?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    });
  }, []);

  return (
    <div className="flex-1 max-w-6xl w-full mx-auto px-4 py-6 lg:py-8">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">Property listings</h1>
          <p className="text-sm text-zinc-600 mt-1">
            Browse publicly available listings. Sign in only when you take actions.
          </p>
        </div>
        <div className="text-sm text-zinc-600">
          {loading ? "Loading…" : `${results.length} results`}
        </div>
      </div>

      <div className="mt-6">
        <ListingsFilterBar params={params} onChange={onChangeParams} loading={loading} />
      </div>

      {error ? (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      <div className="mt-6 flex lg:hidden">
        <div className="inline-flex rounded-lg border border-zinc-200 bg-white p-1">
          <button
            type="button"
            className={`rounded-md px-3 py-1.5 text-sm ${
              mobileMode === "list" ? "bg-zinc-900 text-white" : "text-zinc-700 hover:bg-zinc-50"
            }`}
            onClick={() => setMobileMode("list")}
          >
            List
          </button>
          <button
            type="button"
            className={`rounded-md px-3 py-1.5 text-sm ${
              mobileMode === "map" ? "bg-zinc-900 text-white" : "text-zinc-700 hover:bg-zinc-50"
            }`}
            onClick={() => setMobileMode("map")}
          >
            Map
          </button>
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-12">
        <div
          className={`lg:col-span-7 xl:col-span-6 order-2 lg:order-1 ${
            mobileMode === "map" ? "hidden lg:block" : ""
          }`}
        >
          {results.length === 0 && !loading ? (
            <div className="rounded-lg border border-zinc-200 bg-white p-6 text-sm text-zinc-600">
              No results. Try widening your search.
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {results.map((hit) => (
                <div key={hit.docId} id={`listing-card-${hit.docId}`}>
                  <ListingCard
                    hit={hit}
                    isSelected={selectedDocId === hit.docId}
                  />
                </div>
              ))}
            </div>
          )}

          <div className="mt-6 flex items-center justify-center">
            <button
              type="button"
              className="rounded-lg border border-zinc-300 bg-white px-5 py-2.5 font-medium hover:bg-zinc-50 disabled:opacity-50"
              disabled={loading || !canLoadMore}
              onClick={loadMore}
            >
              {loading ? "Loading…" : canLoadMore ? "Load more" : "No more results"}
            </button>
          </div>
        </div>

        <div
          className={`lg:col-span-5 xl:col-span-6 order-1 lg:order-2 ${
            mobileMode === "list" ? "hidden lg:block" : ""
          }`}
        >
          <ListingsMapPanel
            viewport={viewport}
            onViewportChange={handleViewportChange}
            results={results}
            onMarkerClick={handleMarkerClick}
            selectedDocId={selectedDocId}
          />
        </div>
      </div>
    </div>
  );
}

