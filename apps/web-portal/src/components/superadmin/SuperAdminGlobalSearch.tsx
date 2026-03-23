"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

type UserResult = {
  type: "user";
  uid: string;
  email: string;
  role: string;
  status: string;
  agencyId?: string | null;
};
type AgencyResult = {
  type: "agency";
  agencyId: string;
  name?: string | null;
};
type PropertyResult = {
  type: "property";
  propertyId: string;
  agencyId: string;
  postcode?: string | null;
  address?: string | null;
  archived?: boolean;
};
type SearchResult = UserResult | AgencyResult | PropertyResult;

type SearchResponse = { q: string; results: SearchResult[] };

const DEBOUNCE_MS = 400;
const MIN_LENGTH = 2;

export function SuperAdminGlobalSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const runSearch = useCallback(async (q: string) => {
    if (q.length < MIN_LENGTH) {
      setResults([]);
      setSearched(true);
      return;
    }
    setLoading(true);
    setSearched(true);
    try {
      const res = await fetch(`/api/superadmin/search?q=${encodeURIComponent(q)}&limit=20`);
      if (!res.ok) {
        setResults([]);
        return;
      }
      const data: SearchResponse = await res.json();
      setResults(data.results ?? []);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => runSearch(query), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [query, runSearch]);

  return (
    <div className="mb-8">
      <label htmlFor="superadmin-global-search" className="sr-only">
        Search properties, agencies, and users
      </label>
      <input
        id="superadmin-global-search"
        type="search"
        placeholder="Search by address, agency name, or email…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="w-full max-w-xl rounded-lg border border-zinc-200 bg-white px-4 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-400"
        autoComplete="off"
      />

      {loading && (
        <p className="mt-2 text-sm text-zinc-500">Searching…</p>
      )}

      {!loading && searched && (
        <div className="mt-4">
          {results.length === 0 ? (
            <p className="text-sm text-zinc-500">No results.</p>
          ) : (
            <ul className="space-y-2">
              {results.map((r, i) => (
                <li key={r.type + (r.type === "user" ? r.uid : r.type === "agency" ? r.agencyId : `${r.agencyId}/${r.propertyId}`) + i}>
                  {r.type === "user" && (
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-200 bg-white p-3">
                      <div>
                        <span className="font-medium text-zinc-900">{r.email}</span>
                        <span className="ml-2 text-sm text-zinc-500">
                          {r.role} · {r.status}
                          {r.agencyId ? ` · ${r.agencyId}` : ""}
                        </span>
                      </div>
                      <Link
                        href="/superadmin/approvals"
                        className="rounded border border-zinc-300 bg-zinc-50 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
                      >
                        Open
                      </Link>
                    </div>
                  )}
                  {r.type === "agency" && (
                    <Link
                      href={`/superadmin/agencies?agencyId=${encodeURIComponent(r.agencyId)}`}
                      className="block rounded-lg border border-zinc-200 bg-white p-3 hover:border-zinc-300 hover:bg-zinc-50"
                    >
                      <span className="font-medium text-zinc-900">Agency: {r.name ?? r.agencyId}</span>
                    </Link>
                  )}
                  {r.type === "property" && (
                    <Link
                      href={`/admin/properties/${encodeURIComponent(r.propertyId)}?agencyId=${encodeURIComponent(r.agencyId)}`}
                      className="block rounded-lg border border-zinc-200 bg-white p-3 hover:border-zinc-300 hover:bg-zinc-50"
                    >
                      <span className="font-medium text-zinc-900">
                        {r.address ?? r.postcode ?? r.propertyId}
                        {r.postcode ? ` (${r.postcode})` : ""}
                        {r.archived ? " · Archived" : ""}
                      </span>
                      <span className="ml-2 text-sm text-zinc-500">· {r.agencyId}</span>
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
