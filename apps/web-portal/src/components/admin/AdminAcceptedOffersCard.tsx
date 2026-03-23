"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/Card";
import { useAuth } from "@/contexts/AuthContext";

type QueueRow = {
  id: string;
  agencyId: string;
  applicantName: string;
  applicantEmail: string;
  propertyId: string;
  propertyDisplayLabel: string;
  offerAmount: number;
  acceptedAt: number | null;
  lastActionAt: number | null;
};

export function AdminAcceptedOffersCard() {
  const { profile } = useAuth();
  const agencyId = profile?.agencyId ?? null;
  const isSuperAdmin = profile?.role === "superAdmin";
  const [items, setItems] = useState<QueueRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!agencyId && !isSuperAdmin) {
      setLoading(false);
      return;
    }
    if (isSuperAdmin && !agencyId) {
      setLoading(false);
      return;
    }
    const params = new URLSearchParams();
    params.set("agencyId", agencyId ?? "");
    params.set("stage", "offer_accepted");
    fetch(`/api/admin/staff-action-queue?${params.toString()}`, { credentials: "include" })
      .then((res) => (res.ok ? res.json() : []))
      .then((data: QueueRow[]) => setItems(Array.isArray(data) ? data : []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [agencyId, isSuperAdmin]);

  if (loading) return null;
  if (!agencyId && !isSuperAdmin) return null;
  if (isSuperAdmin && !agencyId) return null;

  const count = items.length;
  const latest = items.slice(0, 5);

  return (
    <Card className="p-4 sm:col-span-2 lg:col-span-3">
      <h2 className="text-base font-medium text-zinc-900 mb-2">Accepted offers awaiting action</h2>
      <p className="text-sm text-zinc-500 mb-3">
        {count} {count === 1 ? "item" : "items"} in stage &quot;Offer accepted&quot;
      </p>
      {latest.length === 0 ? (
        <p className="text-sm text-zinc-600">No accepted offers in queue.</p>
      ) : (
        <ul className="space-y-2">
          {latest.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className="text-zinc-900">
                {r.applicantName || "—"} · {r.propertyDisplayLabel || r.propertyId}
              </span>
              <span className="text-zinc-500">
                {r.acceptedAt != null || r.lastActionAt != null
                  ? new Date(r.acceptedAt ?? r.lastActionAt ?? 0).toLocaleDateString()
                  : "—"}
              </span>
              <div className="w-full flex gap-2 mt-0.5">
                <Link
                  href={`/admin/staff-action-queue?agencyId=${encodeURIComponent(r.agencyId)}`}
                  className="text-zinc-600 hover:underline text-xs"
                >
                  Open queue
                </Link>
                {r.applicantName && (
                  <Link
                    href={`/admin/properties/${r.propertyId}?agencyId=${encodeURIComponent(r.agencyId)}`}
                    className="text-zinc-600 hover:underline text-xs"
                  >
                    View property
                  </Link>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {count > 0 && (
        <Link
          href="/admin/staff-action-queue"
          className="inline-block mt-3 text-sm font-medium text-zinc-700 hover:text-zinc-900"
        >
          View action queue →
        </Link>
      )}
    </Card>
  );
}
