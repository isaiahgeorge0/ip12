"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { OFFER_STATUS_LABELS, type OfferStatus } from "@/lib/types/offer";

type OfferRow = {
  id: string;
  agencyId: string;
  propertyId: string;
  propertyDisplayLabel: string;
  amount: number;
  currency: string;
  status: OfferStatus;
  notes: string | null;
  createdAt: number | null;
  respondedAt: number | null;
};

export default function PortalOffersPage() {
  const [offers, setOffers] = useState<OfferRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/portal/offers", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setOffers(Array.isArray(data) ? data : []))
      .catch(() => setOffers([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <PageHeader title="Offers" />
      {loading ? (
        <p className="text-sm text-zinc-500">Loading…</p>
      ) : offers.length === 0 ? (
        <EmptyState
          title="No offers"
          description="Offers from the agency will appear here when they send you one."
        />
      ) : (
        <div className="space-y-3">
          {offers.map((o) => (
            <Card key={`${o.agencyId}-${o.id}`} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-zinc-900">{o.propertyDisplayLabel || `Property ${o.propertyId}`}</p>
                  <p className="text-sm text-zinc-600 mt-0.5">
                    £{typeof o.amount === "number" ? o.amount.toLocaleString() : "0"} {o.currency ? ` ${o.currency}` : ""}
                  </p>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    {o.createdAt != null ? new Date(o.createdAt).toLocaleString() : "—"}
                  </p>
                  <span className="inline-block mt-2 rounded px-2 py-0.5 text-xs font-medium bg-zinc-200 text-zinc-700">
                    {OFFER_STATUS_LABELS[o.status] ?? o.status}
                  </span>
                </div>
                <Link
                  href={`/portal/offers/${o.id}`}
                  className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
                >
                  View
                </Link>
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
