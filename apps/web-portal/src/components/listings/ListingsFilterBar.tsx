"use client";

import type { ListingsSearchParams } from "./types";

type Props = {
  params: Required<Pick<ListingsSearchParams, "available" | "limit">> &
    Omit<ListingsSearchParams, "available" | "limit">;
  onChange: (next: Props["params"]) => void;
  loading: boolean;
};

function clampInt(v: string, min: number, max: number): number | undefined {
  const n = Number(v);
  if (!Number.isFinite(n)) return undefined;
  const i = Math.floor(n);
  if (i < min) return min;
  if (i > max) return max;
  return i;
}

export function ListingsFilterBar({ params, onChange, loading }: Props) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4">
      <div className="grid gap-3 md:grid-cols-12 md:items-end">
        <div className="md:col-span-4">
          <label className="block text-xs font-medium text-zinc-700 mb-1">
            Search
          </label>
          <input
            type="search"
            value={params.q ?? ""}
            onChange={(e) => onChange({ ...params, q: e.target.value })}
            placeholder="Address or postcode"
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-400"
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-xs font-medium text-zinc-700 mb-1">
            Type
          </label>
          <select
            value={params.listingType ?? ""}
            onChange={(e) =>
              onChange({
                ...params,
                listingType:
                  e.target.value === "sale" || e.target.value === "rent"
                    ? (e.target.value as "sale" | "rent")
                    : undefined,
              })
            }
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm bg-white outline-none focus:border-zinc-400"
          >
            <option value="">Any</option>
            <option value="sale">Sale</option>
            <option value="rent">Rent</option>
          </select>
        </div>

        <div className="md:col-span-2">
          <label className="block text-xs font-medium text-zinc-700 mb-1">
            Min price
          </label>
          <input
            inputMode="numeric"
            value={params.minPrice ?? ""}
            onChange={(e) => {
              const raw = e.target.value.trim();
              onChange({
                ...params,
                minPrice: raw === "" ? undefined : clampInt(e.target.value, 0, 100000000),
              });
            }}
            placeholder="Any"
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-400"
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-xs font-medium text-zinc-700 mb-1">
            Max price
          </label>
          <input
            inputMode="numeric"
            value={params.maxPrice ?? ""}
            onChange={(e) => {
              const raw = e.target.value.trim();
              onChange({
                ...params,
                maxPrice: raw === "" ? undefined : clampInt(e.target.value, 0, 100000000),
              });
            }}
            placeholder="Any"
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-400"
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-xs font-medium text-zinc-700 mb-1">
            Min beds
          </label>
          <input
            inputMode="numeric"
            value={params.minBeds ?? ""}
            onChange={(e) => {
              const raw = e.target.value.trim();
              onChange({
                ...params,
                minBeds: raw === "" ? undefined : clampInt(e.target.value, 0, 20),
              });
            }}
            placeholder="Any"
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-400"
          />
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="text-xs text-zinc-500">
          {loading ? "Updating…" : "Showing available listings"}
        </p>
        <button
          type="button"
          className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50"
          onClick={() =>
            onChange({
              available: true,
              limit: params.limit,
              q: "",
              listingType: undefined,
              minPrice: undefined,
              maxPrice: undefined,
              minBeds: undefined,
              bounds: undefined,
            })
          }
        >
          Reset
        </button>
      </div>
    </div>
  );
}

