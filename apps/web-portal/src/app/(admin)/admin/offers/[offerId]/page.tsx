"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { HistoryBackLink } from "@/components/HistoryBackLink";
import { AdminStatusBadge } from "@/components/admin/AdminStatusBadge";
import { getStatusBadgeVariant } from "@/lib/admin/statusBadge";
import { formatAdminDate } from "@/lib/admin/formatAdminDate";
import { useAuth } from "@/contexts/AuthContext";
import { OFFER_STATUSES, OFFER_STATUS_LABELS, type OfferStatus } from "@/lib/types/offer";

type OfferDetail = {
  id: string;
  agencyId: string;
  propertyId: string;
  propertyDisplayLabel: string;
  applicantId: string | null;
  applicantUserId: string | null;
  applicantName: string | null;
  applicantEmail: string | null;
  applicationId: string | null;
  amount: number;
  currency: string;
  deposit: number | null;
  moveInDate: string | null;
  status: OfferStatus;
  notes: string | null;
  source: string;
  sentAt: number | null;
  createdAt: number | null;
  updatedAt: number | null;
  createdBy: string;
  updatedBy: string;
};

function formatMoney(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(ms: number | null | undefined): string {
  if (ms == null || !Number.isFinite(ms)) return "—";
  return formatAdminDate(ms, "date");
}

export default function AdminOfferDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const offerId = params?.offerId as string | undefined;
  const agencyIdParam = searchParams?.get("agencyId")?.trim() ?? "";
  const { profile } = useAuth();
  const sessionAgencyId = profile?.agencyId ?? null;
  const isSuperAdmin = profile?.role === "superAdmin";
  const effectiveAgencyId = isSuperAdmin ? agencyIdParam || null : sessionAgencyId;

  const [offer, setOffer] = useState<OfferDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const loadOffer = useCallback(() => {
    if (!offerId || !effectiveAgencyId) {
      setLoading(false);
      if (isSuperAdmin && !agencyIdParam) setOffer(null);
      else if (!effectiveAgencyId) setNotFound(true);
      return;
    }
    setLoading(true);
    fetch(
      `/api/admin/offers/${offerId}?agencyId=${encodeURIComponent(effectiveAgencyId)}`,
      { credentials: "include" }
    )
      .then((res) => {
        if (res.status === 404) {
          setNotFound(true);
          setOffer(null);
          return null;
        }
        return res.ok ? res.json() : null;
      })
      .then((data: OfferDetail | null) => {
        if (data) {
          setOffer(data);
          setNotFound(false);
        }
      })
      .catch(() => setOffer(null))
      .finally(() => setLoading(false));
  }, [offerId, effectiveAgencyId, isSuperAdmin, agencyIdParam]);

  useEffect(() => {
    loadOffer();
  }, [loadOffer]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const handleStatusChange = useCallback(
    (newStatus: OfferStatus) => {
      if (!offerId || !effectiveAgencyId) return;
      setUpdating(true);
      fetch(`/api/admin/offers/${offerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ agencyId: effectiveAgencyId, status: newStatus }),
      })
        .then(async (res) => {
          if (res.ok) {
            setToast("Status updated");
            loadOffer();
          } else {
            const data = await res.json().catch(() => ({}));
            setToast(data?.error ?? "Update failed");
          }
        })
        .catch(() => setToast("Update failed"))
        .finally(() => setUpdating(false));
    },
    [offerId, effectiveAgencyId, loadOffer]
  );

  const backHref = effectiveAgencyId
    ? `/admin/offers?agencyId=${encodeURIComponent(effectiveAgencyId)}`
    : "/admin/offers";

  if (isSuperAdmin && !agencyIdParam) {
    return (
      <>
        <HistoryBackLink href="/admin/offers">← Offers</HistoryBackLink>
        <PageHeader title="Offer" />
        <EmptyState
          title="Select an agency from the header to view this page."
          description="Use the agency dropdown in the top bar."
        />
      </>
    );
  }

  if (!effectiveAgencyId && !isSuperAdmin) {
    return (
      <>
        <PageHeader title="Offer" />
        <EmptyState title="No agency" description="Your account is not linked to an agency." />
      </>
    );
  }

  if (loading && !offer) {
    return (
      <>
        <HistoryBackLink href={backHref}>← Offers</HistoryBackLink>
        <PageHeader title="Offer" />
        <p className="text-sm text-zinc-500">Loading…</p>
      </>
    );
  }

  if (notFound || !offer) {
    return (
      <>
        <HistoryBackLink href={backHref}>← Offers</HistoryBackLink>
        <PageHeader title="Offer" />
        <EmptyState
          title="Offer not found"
          description="This offer may have been removed or you may not have access."
        />
      </>
    );
  }

  const variant = getStatusBadgeVariant(offer.status, "offer");

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
      <HistoryBackLink href={backHref}>← Offers</HistoryBackLink>
      <PageHeader
        title="Offer"
        subtitle={`${offer.applicantName ?? "Applicant"} · ${offer.propertyDisplayLabel}`}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <Card className="p-4">
            <h2 className="text-sm font-semibold text-zinc-900 mb-3">Applicant</h2>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <dt className="text-zinc-500">Name</dt>
              <dd className="text-zinc-900">
                {offer.applicantId ? (
                  <Link href={`/admin/applicants/${offer.applicantId}${effectiveAgencyId ? `?agencyId=${encodeURIComponent(effectiveAgencyId)}` : ""}`} className="hover:underline">
                    {offer.applicantName ?? "—"}
                  </Link>
                ) : (
                  offer.applicantName ?? "—"
                )}
              </dd>
              <dt className="text-zinc-500">Email</dt>
              <dd className="text-zinc-900">{offer.applicantEmail ?? "—"}</dd>
            </dl>
          </Card>

          <Card className="p-4">
            <h2 className="text-sm font-semibold text-zinc-900 mb-3">Property</h2>
            <Link
              href={`/admin/properties/${offer.propertyId}?agencyId=${encodeURIComponent(offer.agencyId)}`}
              className="text-zinc-700 hover:underline"
            >
              {offer.propertyDisplayLabel}
            </Link>
          </Card>

          <Card className="p-4">
            <h2 className="text-sm font-semibold text-zinc-900 mb-3">Offer terms</h2>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <dt className="text-zinc-500">Rent (monthly)</dt>
              <dd className="text-zinc-900">{formatMoney(offer.amount)}</dd>
              <dt className="text-zinc-500">Deposit</dt>
              <dd className="text-zinc-900">{formatMoney(offer.deposit)}</dd>
              <dt className="text-zinc-500">Move-in date</dt>
              <dd className="text-zinc-900">
                {offer.moveInDate
                  ? (() => {
                      try {
                        const d = new Date(offer.moveInDate);
                        return Number.isNaN(d.getTime()) ? offer.moveInDate : d.toLocaleDateString();
                      } catch {
                        return offer.moveInDate;
                      }
                    })()
                  : "—"}
              </dd>
              {offer.notes && (
                <>
                  <dt className="text-zinc-500">Notes</dt>
                  <dd className="text-zinc-900">{offer.notes}</dd>
                </>
              )}
            </dl>
          </Card>

          <Card className="p-4 border-dashed border-zinc-200 bg-zinc-50/50">
            <p className="text-xs text-zinc-500">
              Future: digital signing, tenancy agreement generation, deposit registration, move-in checklist.
            </p>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="p-4">
            <h2 className="text-sm font-semibold text-zinc-900 mb-3">Status</h2>
            <AdminStatusBadge variant={variant} className="mb-3">
              {OFFER_STATUS_LABELS[offer.status]}
            </AdminStatusBadge>

            <h3 className="text-xs font-medium text-zinc-600 mt-4 mb-2">Update status</h3>
            <select
              value={offer.status}
              disabled={updating}
              onChange={(e) => {
                const v = e.target.value as OfferStatus;
                if (OFFER_STATUSES.includes(v)) handleStatusChange(v);
              }}
              className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm disabled:opacity-50"
            >
              {OFFER_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {OFFER_STATUS_LABELS[s]}
                </option>
              ))}
            </select>

            <div className="mt-4 flex flex-wrap gap-2">
              {offer.status === "draft" && (
                <button
                  type="button"
                  disabled={updating}
                  onClick={() => handleStatusChange("sent")}
                  className="rounded border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-50"
                >
                  Send offer
                </button>
              )}
              {offer.status === "sent" && (
                <>
                  <button
                    type="button"
                    disabled={updating}
                    onClick={() => handleStatusChange("accepted")}
                    className="rounded border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                  >
                    Accept offer
                  </button>
                  <button
                    type="button"
                    disabled={updating}
                    onClick={() => handleStatusChange("rejected")}
                    className="rounded border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
                  >
                    Reject offer
                  </button>
                </>
              )}
              {!["accepted", "rejected"].includes(offer.status) && (
                <button
                  type="button"
                  disabled={updating}
                  onClick={() => handleStatusChange("withdrawn")}
                  className="rounded border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-50"
                >
                  Withdraw offer
                </button>
              )}
            </div>
          </Card>

          <Card className="p-4">
            <p className="text-xs text-zinc-500">Sent: {formatDate(offer.sentAt)}</p>
            <p className="text-xs text-zinc-500 mt-1">Updated: {formatDate(offer.updatedAt)}</p>
          </Card>
        </div>
      </div>
    </>
  );
}
