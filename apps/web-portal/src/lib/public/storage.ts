import type { PublicPropertyType } from "@/lib/public/mockProperties";

const PUBLIC_SEARCH_PREFS_KEY = "public.searchPrefs.v1";
const RECENTLY_VIEWED_KEY = "public.recentPropertyIds.v1";
const MAX_RECENTLY_VIEWED = 10;

export type PublicSearchPreferences = {
  q?: string;
  minPrice?: string;
  maxPrice?: string;
  beds?: string;
  type?: PublicPropertyType | "All";
};

function hasWindow(): boolean {
  return typeof window !== "undefined";
}

export function readPublicSearchPreferences(): PublicSearchPreferences {
  if (!hasWindow()) return {};
  try {
    const raw = window.localStorage.getItem(PUBLIC_SEARCH_PREFS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as PublicSearchPreferences;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function writePublicSearchPreferences(value: PublicSearchPreferences): void {
  if (!hasWindow()) return;
  try {
    window.localStorage.setItem(PUBLIC_SEARCH_PREFS_KEY, JSON.stringify(value));
  } catch {
    // Ignore localStorage write failures (private mode/quota).
  }
}

export function readRecentlyViewedPropertyIds(): string[] {
  if (!hasWindow()) return [];
  try {
    const raw = window.localStorage.getItem(RECENTLY_VIEWED_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is string => typeof id === "string");
  } catch {
    return [];
  }
}

export function addRecentlyViewedPropertyId(propertyId: string): void {
  if (!hasWindow() || !propertyId) return;
  try {
    const current = readRecentlyViewedPropertyIds().filter((id) => id !== propertyId);
    const next = [propertyId, ...current].slice(0, MAX_RECENTLY_VIEWED);
    window.localStorage.setItem(RECENTLY_VIEWED_KEY, JSON.stringify(next));
  } catch {
    // Ignore localStorage write failures (private mode/quota).
  }
}

