"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/Input";
import { readPublicSearchPreferences } from "@/lib/public/storage";

export function HomeSearchForm() {
  const [keyword, setKeyword] = useState("");

  useEffect(() => {
    const prefs = readPublicSearchPreferences();
    if (prefs.q && prefs.q.trim()) {
      setKeyword(prefs.q);
    }
  }, []);

  return (
    <form action="/properties" method="get" className="mt-6">
      <label className="block text-sm font-medium text-zinc-700 mb-2" htmlFor="q">
        Location / keyword
      </label>
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <Input
            id="q"
            name="q"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="e.g. Ipswich, flat, riverside"
            className="rounded-[var(--pt-radius-input)] border-public-border bg-public-surface text-public-fg placeholder:text-public-muted-fg focus-visible:border-public-accent focus-visible:ring-public-accent/30 focus-visible:ring-offset-public-surface"
          />
        </div>
        <button
          type="submit"
          className="inline-flex items-center justify-center rounded-[var(--pt-radius-button)] bg-public-accent px-5 py-2.5 text-sm font-medium text-public-accent-fg transition-colors hover:bg-public-accent-hover active:scale-[0.99]"
        >
          Search
        </button>
      </div>
    </form>
  );
}

