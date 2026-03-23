import type { PublicPropertyType } from "@/lib/public/mockProperties";

export type PropertySortOption = "priceAsc" | "priceDesc" | "newest";

export type PropertySearchState = {
  q: string;
  minPrice: string;
  maxPrice: string;
  beds: string;
  type: PublicPropertyType | "All";
  sort: PropertySortOption;
};

export function safeTrim(v: string | null): string {
  return v?.trim() ?? "";
}

export function safeNum(v: string): number | undefined {
  const t = v.trim();
  if (!t) return undefined;
  const n = Number(t);
  return Number.isFinite(n) ? n : undefined;
}

export function typeFromQueryParam(v: string | null): PublicPropertyType | "All" {
  const t = safeTrim(v).toLowerCase();
  if (!t) return "All";
  if (t === "house") return "House";
  if (t === "flat") return "Flat";
  if (t === "studio") return "Studio";
  if (t === "other") return "Other";
  return "All";
}

export function typeToQueryParam(v: PublicPropertyType | "All"): string | null {
  if (v === "All") return null;
  return v.toLowerCase();
}

export function sortFromQueryParam(v: string | null): PropertySortOption {
  const t = safeTrim(v);
  if (t === "priceAsc" || t === "priceDesc" || t === "newest") return t;
  return "newest";
}

export function readSearchStateFromParams(sp: URLSearchParams): PropertySearchState {
  return {
    q: sp.get("q") ?? "",
    minPrice: sp.get("minPrice") ?? "",
    maxPrice: sp.get("maxPrice") ?? "",
    beds: sp.get("beds") ?? "",
    type: typeFromQueryParam(sp.get("type")),
    sort: sortFromQueryParam(sp.get("sort")),
  };
}

export function buildSearchParams(state: PropertySearchState): URLSearchParams {
  const next = new URLSearchParams();
  if (state.q.trim()) next.set("q", state.q.trim());
  if (state.minPrice.trim()) next.set("minPrice", state.minPrice.trim());
  if (state.maxPrice.trim()) next.set("maxPrice", state.maxPrice.trim());
  if (state.beds.trim()) next.set("beds", state.beds.trim());
  const typeParam = typeToQueryParam(state.type);
  if (typeParam) next.set("type", typeParam);
  next.set("sort", state.sort);
  return next;
}

export function buildReturnTo(pathname: string, searchParams: URLSearchParams): string {
  const qs = searchParams.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

