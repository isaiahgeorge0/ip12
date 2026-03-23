"use client";

import type { CSSProperties } from "react";

type Props = {
  resultsCount: number;
};

const markerPositions: Array<{ left: string; top: string }> = [
  { left: "22%", top: "28%" },
  { left: "38%", top: "44%" },
  { left: "57%", top: "34%" },
  { left: "70%", top: "55%" },
  { left: "48%", top: "62%" },
  { left: "27%", top: "63%" },
  { left: "62%", top: "22%" },
  { left: "78%", top: "28%" },
];

export function PropertiesMapPanel({ resultsCount }: Props) {
  const shownMarkers = Math.min(markerPositions.length, Math.max(0, resultsCount));
  return (
    <div className="public-card border border-public-border bg-public-surface p-5 lg:sticky lg:top-24 h-fit">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-public-fg">Map preview</h2>
          <p className="mt-1 text-[var(--pt-font-meta)] text-public-muted-fg">
            {resultsCount} matching home{resultsCount === 1 ? "" : "s"}
          </p>
        </div>
        <span className="inline-flex items-center rounded-full border border-public-border bg-public-accent-soft px-2 py-0.5 text-xs font-medium text-public-accent">
          Accent
        </span>
      </div>

      <div className="mt-4 relative aspect-[4/3] overflow-hidden rounded-[var(--pt-radius-input)] border border-public-border bg-public-accent-soft/25">
        <div className="absolute inset-0 bg-gradient-to-br from-public-accent-soft/70 via-transparent to-transparent" />

        {markerPositions.slice(0, shownMarkers).map((pos, idx) => {
          const style: CSSProperties = { left: pos.left, top: pos.top };
          return (
            <div
              key={`marker-${idx}`}
              style={style}
              className="absolute -translate-x-1/2 -translate-y-1/2 h-2.5 w-2.5 rounded-full bg-public-accent ring-1 ring-public-accent/20"
              aria-hidden="true"
            />
          );
        })}

        <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between gap-3">
          <div className="rounded-full border border-public-border bg-public-surface/70 px-3 py-1 text-[11px] font-medium text-public-muted-fg">
            Viewport synced to filters (preview)
          </div>
          <div className="rounded-full border border-public-border bg-public-surface/70 px-3 py-1 text-[11px] font-medium text-public-muted-fg">
            No real map data yet
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <div className="text-xs text-public-muted-fg">
          Clear viewport filter
        </div>
        <button
          type="button"
          disabled
          className="inline-flex items-center justify-center rounded-[var(--pt-radius-button)] border border-public-border bg-public-surface px-3 py-1.5 text-xs font-medium text-public-fg opacity-60"
        >
          Not available
        </button>
      </div>
    </div>
  );
}

