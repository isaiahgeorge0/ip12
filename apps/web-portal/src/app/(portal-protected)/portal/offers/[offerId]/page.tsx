"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/Card";
import { HistoryBackLink } from "@/components/HistoryBackLink";
import { OFFER_STATUS_LABELS, type OfferStatus } from "@/lib/types/offer";

type OfferDetail = {
  id: string;
  agencyId: string;
  propertyId: string;
  propertyDisplayLabel: string;
  amount: number;
  currency: string;
  status: OfferStatus;
  notes: string | null;
  createdAt: number | null;
  updatedAt: number | null;
  respondedAt: number | null;
};

export default function PortalOfferDetailPage() {
  const params = useParams();
  const offerId = params?.offerId as string | undefined;
  const [offer, setOffer] = useState<OfferDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [acting, setActing] = useState<"accept" | "reject" | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!offerId) {
      setLoading(false);
      setNotFound(true);
      return;
    }
    fetch(`/api/portal/offers/${offerId}`, { credentials: "include" })
      .then((res) => {
        if (res.status === 404) {
          setNotFound(true);
          return null;
        }
        return res.ok ? res.json() : null;
      })
      .then((data: OfferDetail | null) => {
        if (data) setOffer(data);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [offerId]);

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(t);
    }
  }, [toast]);

  const handleAccept = useCallback(() => {
    if (!offerId) return;
    setActing("accept");
    fetch(`/api/portal/offers/${offerId}/accept`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
          setToast("Your offer acceptance has been recorded. A member of the team will review this and contact you with next steps.");
          setOffer((prev) => (prev ? { ...prev, status: "accepted" as OfferStatus } : null));
        } else {
          setToast((data?.error as string) ?? "Failed to accept");
        }
      })
      .catch(() => setToast("Failed to accept"))
      .finally(() => setActing(null));
  }, [offerId]);

  const handleReject = useCallback(() => {
    if (!offerId) return;
    setActing("reject");
    fetch(`/api/portal/offers/${offerId}/reject`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
          setToast("Offer rejected");
          setOffer((prev) => (prev ? { ...prev, status: "rejected" as OfferStatus } : null));
        } else {
          setToast((data?.error as string) ?? "Failed to reject");
        }
      })
      .catch(() => setToast("Failed to reject"))
      .finally(() => setActing(null));
  }, [offerId]);

  if (loading) {
    return (
      <>
        <PageHeader title="Offer" />
        <p className="text-sm text-zinc-500">Loading…</p>
      </>
    );
  }

  if (notFound || !offer) {
    return (
      <>
        <PageHeader title="Offer" />
        <Card className="p-6">
          <p className="text-zinc-600">Offer not found.</p>
          <HistoryBackLink href="/portal/offers" className="mt-4 inline-block">
            ← Back to offers
          </HistoryBackLink>
        </Card>
      </>
    );
  }

  const canRespond = offer.status === "draft" || offer.status === "sent";

  return (
    <>
      {toast && (
        <div
          className="fixed bottom-4 right-4 z-20 rounded-lg bg-zinc-900 px-4 py-2 text-sm text-white shadow-lg"
          role="status"
        >
          {toast}
        </div>
      )}
      <PageHeader
        title="Offer"
        action={
          <HistoryBackLink href="/portal/offers" className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50">
            ← Back to offers
          </HistoryBackLink>
        }
      />
      <Card className="p-6">
        <dl className="grid gap-2 sm:grid-cols-2">
          <dt className="text-sm text-zinc-500">Property</dt>
          <dd className="font-medium text-zinc-900">
            {offer.propertyDisplayLabel || `Property ${offer.propertyId}`}
          </dd>
          <dt className="text-sm text-zinc-500">Amount</dt>
          <dd className="text-zinc-900">
            £{typeof offer.amount === "number" ? offer.amount.toLocaleString() : "0"} {offer.currency ?? "GBP"}
          </dd>
          <dt className="text-sm text-zinc-500">Status</dt>
          <dd>
            <span className="rounded px-2 py-0.5 text-xs font-medium bg-zinc-200 text-zinc-700">
              {OFFER_STATUS_LABELS[offer.status] ?? offer.status}
            </span>
          </dd>
          <dt className="text-sm text-zinc-500">Created</dt>
          <dd className="text-zinc-600">
            {offer.createdAt != null ? new Date(offer.createdAt).toLocaleString() : "—"}
          </dd>
          {offer.respondedAt != null && (
            <>
              <dt className="text-sm text-zinc-500">Responded</dt>
              <dd className="text-zinc-600">{new Date(offer.respondedAt).toLocaleString()}</dd>
            </>
          )}
        </dl>
        {offer.notes && (
          <div className="mt-4 pt-4 border-t border-zinc-200">
            <dt className="text-sm text-zinc-500 mb-1">Notes</dt>
            <dd className="text-zinc-700 whitespace-pre-wrap">{offer.notes}</dd>
          </div>
        )}
        {canRespond && (
          <div className="mt-6 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleAccept}
              disabled={acting !== null}
              className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
            >
              {acting === "accept" ? "Accepting…" : "Accept offer"}
            </button>
            <button
              type="button"
              onClick={handleReject}
              disabled={acting !== null}
              className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
            >
              {acting === "reject" ? "Rejecting…" : "Reject offer"}
            </button>
          </div>
        )}
      </Card>
    </>
  );
}
