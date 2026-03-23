"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { useAuth } from "@/contexts/AuthContext";
import {
  OFFER_STATUSES,
  OFFER_STATUS_LABELS,
  type OfferStatus,
} from "@/lib/types/offer";
import type { OfferListItem } from "@/app/api/admin/offers/route";
import { AdminCreateOfferModal } from "@/components/admin/AdminCreateOfferModal";
import { AdminStatusBadge } from "@/components/admin/AdminStatusBadge";
import { getStatusBadgeVariant } from "@/lib/admin/statusBadge";
import { formatAdminDate } from "@/lib/admin/formatAdminDate";

type PropertyOption = { id: string; displayAddress: string };

type DateFilter = "recent" | "all";

function formatMoney(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(value);
}

function formatDate(ms: number | null | undefined): string {
  return formatAdminDate(ms ?? null, "prettyDate");
}

export default function AdminOffersPage() {
  const searchParams = useSearchParams();
  const selectedAgencyId = searchParams?.get("agencyId")?.trim() ?? null;
  const { profile } = useAuth();
  const agencyId = profile?.agencyId ?? null;
  const isSuperAdmin = profile?.role === "superAdmin";
  const effectiveAgencyId = isSuperAdmin ? selectedAgencyId : agencyId;
  const pageSubtitle = "Manage tenancy offers issued to prospective tenants.";

  const [offers, setOffers] = useState<OfferListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [propertyIdFilter, setPropertyIdFilter] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFilter, setDateFilter] = useState<DateFilter>("recent");
  const [properties, setProperties] = useState<PropertyOption[]>([]);
  const [statusUpdatingId, setStatusUpdatingId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [createOfferOpen, setCreateOfferOpen] = useState(false);
  const tableRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!effectiveAgencyId) return;
    fetch(`/api/admin/properties?agencyId=${encodeURIComponent(effectiveAgencyId)}`, { credentials: "include" })
      .then((res) => (res.ok ? res.json() : []))
      .then((data: { id: string; displayAddress?: string }[]) =>
        setProperties(
          Array.isArray(data)
            ? data.map((p) => ({ id: p.id, displayAddress: p.displayAddress ?? p.id }))
            : []
        )
      )
      .catch(() => setProperties([]));
  }, [effectiveAgencyId]);

  const loadOffers = useCallback(() => {
    if (!effectiveAgencyId) {
      setOffers([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const params = new URLSearchParams();
    params.set("agencyId", effectiveAgencyId);
    if (statusFilter) params.set("status", statusFilter);
    if (propertyIdFilter) params.set("propertyId", propertyIdFilter);
    fetch(`/api/admin/offers?${params.toString()}`, { credentials: "include" })
      .then((res) => (res.ok ? res.json() : []))
      .then((data: OfferListItem[]) => setOffers(Array.isArray(data) ? data : []))
      .catch(() => setOffers([]))
      .finally(() => setLoading(false));
  }, [effectiveAgencyId, statusFilter, propertyIdFilter]);

  useEffect(() => {
    loadOffers();
  }, [loadOffers]);

  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const filteredOffers = useMemo(() => {
    return offers.filter((o) => {
      if (statusFilter && o.status !== statusFilter) return false;
      if (propertyIdFilter && o.propertyId !== propertyIdFilter) return false;
      if (dateFilter === "recent") {
        const ts = o.sentAt ?? o.updatedAt ?? o.createdAt ?? null;
        if (ts == null || ts < thirtyDaysAgo) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const name = (o.applicantName ?? "").toLowerCase();
        const email = (o.applicantEmail ?? "").toLowerCase();
        const prop = (o.propertyDisplayLabel ?? "").toLowerCase();
        if (!name.includes(q) && !email.includes(q) && !prop.includes(q)) return false;
      }
      return true;
    });
  }, [offers, statusFilter, propertyIdFilter, dateFilter, searchQuery]);

  const offersAwaitingResponse = offers.filter((o) => o.status === "sent");
  const acceptedOffers = offers.filter((o) => o.status === "accepted");

  const handleStatusChange = useCallback(
    (offerId: string, newStatus: OfferStatus) => {
      if (!effectiveAgencyId) return;
      setStatusUpdatingId(offerId);
      fetch(`/api/admin/offers/${offerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ agencyId: effectiveAgencyId, status: newStatus }),
      })
        .then((res) => {
          if (res.ok) {
            setToast("Status updated");
            loadOffers();
          } else {
            res.json().then((d: { error?: string }) => setToast(d?.error ?? "Update failed"));
          }
        })
        .catch(() => setToast("Update failed"))
        .finally(() => setStatusUpdatingId(null));
    },
    [effectiveAgencyId, loadOffers]
  );

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(t);
    }
  }, [toast]);

  if (!effectiveAgencyId && !isSuperAdmin) {
    return (
      <>
        <AdminPageHeader title="Offers" subtitle={pageSubtitle} />
        <EmptyState
          title="No agency"
          description="Your account is not linked to an agency."
        />
      </>
    );
  }

  if (isSuperAdmin && !effectiveAgencyId) {
    return (
      <>
        <AdminPageHeader title="Offers" subtitle={pageSubtitle} />
        <EmptyState
          title="Select an agency from the header to view this page."
          description="Use the agency dropdown in the top bar."
        />
      </>
    );
  }

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
      <AdminPageHeader
        title="Offers"
        subtitle={pageSubtitle}
        primaryAction={
          <button
            type="button"
            onClick={() => setCreateOfferOpen(true)}
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
          >
            Create offer
          </button>
        }
      />

      <div className="mb-4 grid gap-4 md:grid-cols-[2fr,3fr]">
        <Card className="p-4 border-amber-200 bg-amber-50/60">
          <h2 className="text-sm font-medium text-zinc-900 mb-1">Next recommended action</h2>
          <p className="text-sm text-zinc-700 mb-2">
            {offersAwaitingResponse.length > 0
              ? "Offers awaiting response"
              : acceptedOffers.length > 0
                ? "Prepare tenancy agreements"
                : "No urgent offer actions."}
          </p>
        </Card>
        <Card className="p-4">
          <div className="mb-2 flex flex-wrap items-center gap-3">
            <div className="min-w-[160px] flex-1">
              <label htmlFor="offers-search" className="mb-1 block text-xs font-medium text-zinc-700">
                Search
              </label>
              <input
                id="offers-search"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Applicant or property…"
                className="w-full rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm"
              />
            </div>
            <div>
              <label htmlFor="offers-status" className="mb-1 block text-xs font-medium text-zinc-700">
                Status
              </label>
              <select
                id="offers-status"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm"
              >
                <option value="">All</option>
                {OFFER_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {OFFER_STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="offers-property" className="mb-1 block text-xs font-medium text-zinc-700">
                Property
              </label>
              <select
                id="offers-property"
                value={propertyIdFilter}
                onChange={(e) => setPropertyIdFilter(e.target.value)}
                className="min-w-[140px] rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm"
              >
                <option value="">All</option>
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.displayAddress || p.id}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-700">Date</label>
              <div className="flex items-center gap-1 rounded-md border border-zinc-300 bg-white px-1 py-0.5">
                <button
                  type="button"
                  onClick={() => setDateFilter("recent")}
                  className={`rounded px-2 py-1 text-xs ${dateFilter === "recent" ? "bg-zinc-900 text-white" : "text-zinc-700 hover:bg-zinc-100"}`}
                >
                  Recent
                </button>
                <button
                  type="button"
                  onClick={() => setDateFilter("all")}
                  className={`rounded px-2 py-1 text-xs ${dateFilter === "all" ? "bg-zinc-900 text-white" : "text-zinc-700 hover:bg-zinc-100"}`}
                >
                  All
                </button>
              </div>
            </div>
          </div>
        </Card>
      </div>

      <div ref={tableRef}>
        {loading ? (
          <p className="text-sm text-zinc-500">Loading…</p>
        ) : filteredOffers.length === 0 ? (
        <EmptyState
          title="No offers"
          description="Offers will appear here once created from an applicant or property."
          action={
            <button
              type="button"
              onClick={() => setCreateOfferOpen(true)}
              className="text-sm font-medium text-zinc-700 hover:text-zinc-900"
            >
              Create offer →
            </button>
          }
        />
      ) : (
        <Card className="p-4 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200">
                  <th className="py-2 pr-4 text-left font-medium text-zinc-700">Applicant</th>
                  <th className="py-2 pr-4 text-left font-medium text-zinc-700">Property</th>
                  <th className="py-2 pr-4 text-left font-medium text-zinc-700">Offer Rent</th>
                  <th className="py-2 pr-4 text-left font-medium text-zinc-700">Deposit</th>
                  <th className="py-2 pr-4 text-left font-medium text-zinc-700">Status</th>
                  <th className="py-2 pr-4 text-left font-medium text-zinc-700">Sent date</th>
                  <th className="py-2 text-left font-medium text-zinc-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredOffers.map((o) => {
                  const isUpdating = statusUpdatingId === o.id;
                  const propLabel = o.propertyDisplayLabel || `Property ${o.propertyId}`;
                  return (
                    <tr key={o.id} className="border-b border-zinc-100">
                      <td className="py-2 pr-4 align-top">
                        <div className="flex flex-col">
                          <span className="font-medium text-zinc-900">
                            {o.applicantId ? (
                              <Link href={`/admin/applicants/${o.applicantId}`} className="hover:underline">
                                {o.applicantName || "—"}
                              </Link>
                            ) : (
                              o.applicantName || "—"
                            )}
                          </span>
                          <span className="text-xs text-zinc-600">{o.applicantEmail ?? "—"}</span>
                        </div>
                      </td>
                      <td className="py-2 pr-4 align-top">
                        <Link
                          href={`/admin/properties/${o.propertyId}?agencyId=${encodeURIComponent(o.agencyId)}`}
                          className="text-zinc-700 hover:underline"
                        >
                          {propLabel}
                        </Link>
                      </td>
                      <td className="py-2 pr-4 align-top text-zinc-900">{formatMoney(o.amount)}</td>
                      <td className="py-2 pr-4 align-top text-zinc-900">{formatMoney(o.deposit)}</td>
                      <td className="py-2 pr-4 align-top">
                        <AdminStatusBadge variant={getStatusBadgeVariant(o.status, "offer")}>
                          {OFFER_STATUS_LABELS[o.status]}
                        </AdminStatusBadge>
                        <select
                          value={o.status}
                          onChange={(e) => handleStatusChange(o.id, e.target.value as OfferStatus)}
                          disabled={isUpdating}
                          className="mt-1 block rounded border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-700 disabled:opacity-50"
                          aria-label="Change status"
                        >
                          {OFFER_STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {OFFER_STATUS_LABELS[s]}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-2 pr-4 align-top text-zinc-900">{formatDate(o.sentAt)}</td>
                      <td className="py-2 align-top">
                        <div className="flex flex-wrap gap-1">
                          <Link
                            href={`/admin/offers/${o.id}${effectiveAgencyId ? `?agencyId=${encodeURIComponent(effectiveAgencyId)}` : ""}`}
                            className="rounded border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100"
                          >
                            Open offer
                          </Link>
                          {o.applicantId && (
                            <Link
                              href={`/admin/applicants/${o.applicantId}`}
                              className="rounded border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100"
                            >
                              Applicant
                            </Link>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        )}
      </div>

      {createOfferOpen && effectiveAgencyId && (
        <AdminCreateOfferModal
          open={createOfferOpen}
          onClose={() => setCreateOfferOpen(false)}
          agencyId={effectiveAgencyId}
          onSuccess={() => {
            setToast("Offer created");
            setCreateOfferOpen(false);
            loadOffers();
          }}
        />
      )}
    </>
  );
}
