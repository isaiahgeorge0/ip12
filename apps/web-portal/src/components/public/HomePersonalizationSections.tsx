"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PropertyCard } from "@/components/public/PropertyCard";
import { mockProperties } from "@/lib/public/mockProperties";
import type { PublicProperty } from "@/lib/public/mockProperties";
import {
  readPublicSearchPreferences,
  readRecentlyViewedPropertyIds,
} from "@/lib/public/storage";

function buildSearchHrefFromPreferences(): string {
  const prefs = readPublicSearchPreferences();
  const params = new URLSearchParams();
  if (prefs.q?.trim()) params.set("q", prefs.q.trim());
  if (prefs.minPrice?.trim()) params.set("minPrice", prefs.minPrice.trim());
  if (prefs.maxPrice?.trim()) params.set("maxPrice", prefs.maxPrice.trim());
  if (prefs.beds?.trim()) params.set("beds", prefs.beds.trim());
  if (prefs.type && prefs.type !== "All") params.set("type", prefs.type.toLowerCase());
  return `/properties${params.toString() ? `?${params.toString()}` : ""}`;
}

export function HomePersonalizationSections() {
  const [searchLabel, setSearchLabel] = useState<string>("");
  const [searchHref, setSearchHref] = useState<string>("/properties");
  const [recentlyViewed, setRecentlyViewed] = useState<PublicProperty[]>([]);

  useEffect(() => {
    const prefs = readPublicSearchPreferences();
    setSearchLabel(prefs.q?.trim() ?? "");
    setSearchHref(buildSearchHrefFromPreferences());

    const ids = readRecentlyViewedPropertyIds();
    const mapped = ids
      .map((id) => mockProperties.find((p) => p.id === id) ?? null)
      .filter((p): p is PublicProperty => p !== null)
      .slice(0, 3);
    setRecentlyViewed(mapped);
  }, []);

  const hasPersonalization = useMemo(
    () => Boolean(searchLabel) || recentlyViewed.length > 0,
    [searchLabel, recentlyViewed.length]
  );

  if (!hasPersonalization) return null;

  return (
    <>
      {searchLabel ? (
        <section className="max-w-6xl mx-auto px-[var(--pt-spacing-container)] pb-8">
          <div className="public-card rounded-[var(--pt-radius-card)] border border-public-border bg-public-surface p-5 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-public-fg">Continue your search in {searchLabel}</p>
              <p className="mt-1 text-xs text-public-muted-fg">
                We remembered your last filters to help you pick up where you left off.
              </p>
            </div>
            <Link
              href={searchHref}
              className="inline-flex items-center justify-center rounded-[var(--pt-radius-button)] bg-public-accent px-4 py-2 text-sm font-medium text-public-accent-fg transition-colors hover:bg-public-accent-hover"
            >
              Continue search
            </Link>
          </div>
        </section>
      ) : null}

      {recentlyViewed.length > 0 ? (
        <section className="max-w-6xl mx-auto px-[var(--pt-spacing-container)] pb-10">
          <div className="mb-5">
            <h2 className="text-[var(--pt-font-section-title)] font-semibold text-public-fg">
              Recently viewed
            </h2>
            <p className="mt-1 text-[var(--pt-font-meta)] text-public-muted-fg">
              Quick access to the listings you looked at most recently.
            </p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {recentlyViewed.map((p) => (
              <PropertyCard key={p.id} property={p} />
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}

