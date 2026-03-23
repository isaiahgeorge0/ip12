"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { VIEWING_STATUS_LABELS, type ViewingStatus } from "@/lib/types/viewing";

type ViewingRow = {
  id: string;
  agencyId: string;
  propertyDisplayLabel: string;
  scheduledAt: number | null;
  status: ViewingStatus;
  notes: string | null;
};

export default function PortalViewingsPage() {
  const [viewings, setViewings] = useState<ViewingRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/portal/viewings", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setViewings(Array.isArray(data) ? data : []))
      .catch(() => setViewings([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <PageHeader title="Viewings" />
      {loading ? (
        <p className="text-sm text-zinc-500">Loading…</p>
      ) : viewings.length === 0 ? (
        <EmptyState
          title="No viewings"
          description="Viewings booked for you will appear here."
        />
      ) : (
        <div className="space-y-3">
          {viewings.map((v) => (
            <Card key={`${v.agencyId}-${v.id}`} className="p-4">
              <p className="font-medium text-zinc-900">{v.propertyDisplayLabel}</p>
              <p className="text-sm text-zinc-500 mt-0.5">
                {v.scheduledAt != null ? new Date(v.scheduledAt).toLocaleString() : "—"}
              </p>
              <span className="inline-block mt-2 rounded px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-800">
                {VIEWING_STATUS_LABELS[v.status] ?? v.status}
              </span>
              {v.notes && (
                <p className="text-sm text-zinc-600 mt-2">{v.notes}</p>
              )}
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
