"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import type {
  PublicProperty,
  PublicPropertyType,
} from "@/lib/public/mockProperties";
import { mockProperties } from "@/lib/public/mockProperties";
import { PropertyCard } from "@/components/public/PropertyCard";
import {
  buildReturnTo,
  buildSearchParams,
  readSearchStateFromParams,
  safeNum,
  sortFromQueryParam,
  typeFromQueryParam,
  type PropertySortOption,
} from "@/lib/public/searchState";
import {
  readPublicSearchPreferences,
  writePublicSearchPreferences,
} from "@/lib/public/storage";
import { PublicThemeProvider } from "@/lib/public/theme/PublicThemeProvider";
import { PropertiesMapPanel } from "@/components/public/PropertiesMapPanel";

function getNewestRank(id: string): number {
  // Mock dataset: extract trailing numeric suffix for deterministic sorting.
  const m = id.match(/(\d+)$/);
  return m ? Number(m[1]) : 0;
}

export default function PropertiesSearchClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [keyword, setKeyword] = useState<string>("");
  const [minPrice, setMinPrice] = useState<string>("");
  const [maxPrice, setMaxPrice] = useState<string>("");
  const [beds, setBeds] = useState<string>(""); // "" = Any
  const [propertyType, setPropertyType] = useState<PublicPropertyType | "All">("All");
  const [sort, setSort] = useState<PropertySortOption>("newest");

  // URL stays source of truth. Fallback preferences fill missing params only.
  useEffect(() => {
    const fromUrl = readSearchStateFromParams(new URLSearchParams(searchParams.toString()));
    const prefs = readPublicSearchPreferences();
    const hasQ = searchParams.has("q");
    const hasMinPrice = searchParams.has("minPrice");
    const hasMaxPrice = searchParams.has("maxPrice");
    const hasBeds = searchParams.has("beds");
    const hasType = searchParams.has("type");

    setKeyword(hasQ ? fromUrl.q : prefs.q ?? "");
    setMinPrice(hasMinPrice ? fromUrl.minPrice : prefs.minPrice ?? "");
    setMaxPrice(hasMaxPrice ? fromUrl.maxPrice : prefs.maxPrice ?? "");
    setBeds(hasBeds ? fromUrl.beds : prefs.beds ?? "");
    setPropertyType(hasType ? fromUrl.type : prefs.type ?? "All");
    setSort(fromUrl.sort);
  }, [searchParams]);

  const filtered = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    const minP = safeNum(minPrice);
    const maxP = safeNum(maxPrice);
    const bedsNum = safeNum(beds);

    const results = mockProperties.filter((p: PublicProperty) => {
      const matchesKeyword =
        !q ||
        p.address.toLowerCase().includes(q) ||
        p.location.toLowerCase().includes(q) ||
        p.propertyType.toLowerCase().includes(q);

      const matchesType = propertyType === "All" ? true : p.propertyType === propertyType;
      const matchesBeds = bedsNum == null ? true : p.beds >= bedsNum;
      const matchesMinPrice = minP == null ? true : p.price >= minP;
      const matchesMaxPrice = maxP == null ? true : p.price <= maxP;

      return matchesKeyword && matchesType && matchesBeds && matchesMinPrice && matchesMaxPrice;
    });

    const sorted = [...results];
    if (sort === "priceAsc") sorted.sort((a, b) => a.price - b.price);
    if (sort === "priceDesc") sorted.sort((a, b) => b.price - a.price);
    if (sort === "newest") sorted.sort((a, b) => getNewestRank(b.id) - getNewestRank(a.id));

    return sorted;
  }, [keyword, minPrice, maxPrice, beds, propertyType, sort]);

  // Keep URL in sync (shareable filters) without creating update loops.
  useEffect(() => {
    const current = readSearchStateFromParams(new URLSearchParams(searchParams.toString()));
    const same =
      current.q === keyword &&
      current.minPrice === minPrice &&
      current.maxPrice === maxPrice &&
      current.beds === beds &&
      current.type === propertyType &&
      current.sort === sort;

    if (same) return;

    const next = buildSearchParams({
      q: keyword,
      minPrice,
      maxPrice,
      beds,
      type: propertyType,
      sort,
    });
    const qs = next.toString();
    router.replace(`/properties${qs ? `?${qs}` : ""}`);
  }, [keyword, minPrice, maxPrice, beds, propertyType, sort, router, searchParams]);

  useEffect(() => {
    writePublicSearchPreferences({
      q: keyword.trim() || undefined,
      minPrice: minPrice.trim() || undefined,
      maxPrice: maxPrice.trim() || undefined,
      beds: beds.trim() || undefined,
      type: propertyType,
    });
  }, [keyword, minPrice, maxPrice, beds, propertyType]);

  const resultsCount = filtered.length;
  const returnTo = buildReturnTo("/properties", new URLSearchParams(searchParams.toString()));

  return (
    <PublicThemeProvider mode="light">
      <div className="public-page-shell min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1 max-w-[1480px] w-full mx-auto px-[var(--pt-spacing-container)] py-8 lg:py-10">
        <div className="mb-8">
          <h1 className="text-[var(--pt-font-hero-title)] leading-tight font-semibold text-public-fg">Find properties</h1>
          <p className="mt-2 text-sm text-public-muted-fg">
            Search by location, keyword, and core filters. URL remains the source of truth.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-12 items-start">
          <aside className="space-y-4 lg:col-span-4 xl:col-span-3">
            <div className="public-card rounded-[var(--pt-radius-card)] border border-public-border bg-public-surface p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold text-public-fg">Filters</h2>
                  <p className="mt-1 text-[var(--pt-font-meta)] text-public-muted-fg">
                    Refine your results with shareable URL filters.
                  </p>
                </div>
                <Link
                  href="/properties"
                  className="inline-flex items-center justify-center rounded-[var(--pt-radius-button)] border border-public-border px-3 py-1.5 text-xs font-medium text-public-fg transition-colors hover:bg-public-accent-soft"
                >
                  Reset
                </Link>
              </div>

              <div className="mt-5 space-y-5">
                <div>
                  <label className="text-sm font-medium text-public-fg block mb-1" htmlFor="q">
                    Location / keyword
                  </label>
                  <Input
                    id="q"
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                    placeholder="e.g. Ipswich, flat, riverside"
                    className="rounded-[var(--pt-radius-input)] border-public-border bg-public-surface text-public-fg placeholder:text-public-muted-fg focus-visible:border-public-accent focus-visible:ring-public-accent/30 focus-visible:ring-offset-public-surface"
                  />
                </div>

                <div className="grid gap-3 grid-cols-2">
                  <div>
                    <label className="text-sm font-medium text-public-fg block mb-1" htmlFor="minPrice">
                      Min price
                    </label>
                    <Input
                      id="minPrice"
                      type="number"
                      inputMode="numeric"
                      value={minPrice}
                      onChange={(e) => setMinPrice(e.target.value)}
                      placeholder="700"
                      className="rounded-[var(--pt-radius-input)] border-public-border bg-public-surface text-public-fg placeholder:text-public-muted-fg focus-visible:border-public-accent focus-visible:ring-public-accent/30 focus-visible:ring-offset-public-surface"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-public-fg block mb-1" htmlFor="maxPrice">
                      Max price
                    </label>
                    <Input
                      id="maxPrice"
                      type="number"
                      inputMode="numeric"
                      value={maxPrice}
                      onChange={(e) => setMaxPrice(e.target.value)}
                      placeholder="1300"
                      className="rounded-[var(--pt-radius-input)] border-public-border bg-public-surface text-public-fg placeholder:text-public-muted-fg focus-visible:border-public-accent focus-visible:ring-public-accent/30 focus-visible:ring-offset-public-surface"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-public-fg block mb-1" htmlFor="beds">
                    Bedrooms (min)
                  </label>
                  <Select
                    id="beds"
                    value={beds}
                    onChange={(e) => setBeds(e.target.value)}
                    className="rounded-[var(--pt-radius-input)] border-public-border bg-public-surface text-public-fg focus-visible:border-public-accent focus-visible:ring-public-accent/30 focus-visible:ring-offset-public-surface"
                  >
                    <option value="">Any</option>
                    <option value="1">1+</option>
                    <option value="2">2+</option>
                    <option value="3">3+</option>
                    <option value="4">4+</option>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium text-public-fg block mb-1" htmlFor="type">
                    Property type
                  </label>
                  <Select
                    id="type"
                    value={propertyType}
                    onChange={(e) => setPropertyType(typeFromQueryParam(e.target.value))}
                    className="rounded-[var(--pt-radius-input)] border-public-border bg-public-surface text-public-fg focus-visible:border-public-accent focus-visible:ring-public-accent/30 focus-visible:ring-offset-public-surface"
                  >
                    <option value="All">All types</option>
                    <option value="House">House</option>
                    <option value="Flat">Flat</option>
                    <option value="Studio">Studio</option>
                    <option value="Other">Other</option>
                  </Select>
                </div>

              </div>
            </div>
          </aside>

          <section className="space-y-4 lg:col-span-8 xl:col-span-6">
            <div className="public-card rounded-[var(--pt-radius-card)] border border-public-border bg-public-surface px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-3">
                <div>
                  <h2 className="text-sm font-semibold text-public-fg">Results</h2>
                  <div className="mt-2 inline-flex items-center rounded-full bg-public-accent-soft px-3 py-1 text-xs font-medium text-public-accent">
                    {resultsCount} home{resultsCount === 1 ? "" : "s"}
                  </div>
                </div>
              </div>

              <div className="w-full sm:w-auto">
                <label className="text-sm font-medium text-public-fg block mb-1" htmlFor="sort">
                  Sort
                </label>
                <Select
                  id="sort"
                  value={sort}
                  onChange={(e) => setSort(sortFromQueryParam(e.target.value))}
                  className="rounded-[var(--pt-radius-input)] border-public-border bg-public-surface text-public-fg focus-visible:border-public-accent focus-visible:ring-public-accent/30 focus-visible:ring-offset-public-surface"
                >
                  <option value="newest">Newest</option>
                  <option value="priceAsc">Price (low → high)</option>
                  <option value="priceDesc">Price (high → low)</option>
                </Select>
              </div>
            </div>

            <div className="h-px w-full bg-public-border/60" />

            {resultsCount === 0 ? (
              <div className="public-card rounded-[var(--pt-radius-card)] border border-public-border bg-public-surface p-10 text-center">
                <div className="mx-auto w-fit rounded-full border border-public-border bg-public-accent-soft px-3 py-1 text-xs font-medium text-public-accent">
                  No matches yet
                </div>
                <p className="mt-3 font-semibold text-public-fg">Try a wider search</p>
                <p className="mt-1 text-sm text-public-muted-fg leading-6">
                  Widen your price range or remove one filter to discover more homes.
                </p>
                <Link
                  href="/properties"
                  className="mt-4 inline-flex items-center justify-center rounded-[var(--pt-radius-button)] bg-public-accent px-4 py-2 text-sm font-medium text-public-accent-fg transition-colors hover:bg-public-accent-hover"
                >
                  Reset filters
                </Link>
              </div>
            ) : (
              <div className="grid gap-6 sm:grid-cols-2 2xl:grid-cols-3">
                {filtered.map((p) => (
                  <PropertyCard key={p.id} property={p} returnTo={returnTo} />
                ))}
              </div>
            )}
          </section>

          <aside className="space-y-4 lg:col-span-12 xl:col-span-3">
            <PropertiesMapPanel resultsCount={resultsCount} />
          </aside>
        </div>
      </main>
      </div>
    </PublicThemeProvider>
  );
}

