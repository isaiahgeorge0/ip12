"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { AdminStatusBadge } from "@/components/admin/AdminStatusBadge";
import { getStatusBadgeVariant } from "@/lib/admin/statusBadge";
import { formatAdminDate } from "@/lib/admin/formatAdminDate";
import { useAdminAgency } from "@/lib/admin/useAdminAgency";
import {
  RENT_PAYMENT_STATUSES,
  RENT_PAYMENT_STATUS_LABELS,
  type RentPaymentStatus,
  type RentPaymentListItem,
} from "@/lib/types/rentPayment";

function formatMoney(amount: number | null | undefined): string {
  if (typeof amount !== "number" || !Number.isFinite(amount)) return "—";
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function AdminRentPage() {
  const searchParams = useSearchParams();
  const { effectiveAgencyId, isSuperAdmin } = useAdminAgency();
  const pageSubtitle = "Track rent payments and arrears.";

  const [payments, setPayments] = useState<RentPaymentListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  const loadPayments = useCallback(() => {
    if (!effectiveAgencyId) {
      setPayments([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const params = new URLSearchParams();
    params.set("agencyId", effectiveAgencyId);
    if (statusFilter) params.set("status", statusFilter);
    fetch(`/api/admin/rent?${params.toString()}`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : []))
      .then((data: RentPaymentListItem[]) => setPayments(Array.isArray(data) ? data : []))
      .catch(() => setPayments([]))
      .finally(() => setLoading(false));
  }, [effectiveAgencyId, statusFilter]);

  useEffect(() => {
    loadPayments();
  }, [loadPayments]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let items = payments;
    if (q) {
      items = items.filter((p) => {
        const haystack = `${p.tenantName ?? ""} ${p.propertyDisplayLabel ?? ""}`.toLowerCase();
        return haystack.includes(q);
      });
    }
    return items;
  }, [payments, search]);

  if (!effectiveAgencyId && !isSuperAdmin) {
    return (
      <>
        <AdminPageHeader title="Rent payments" subtitle={pageSubtitle} />
        <EmptyState title="No agency" description="Your account is not linked to an agency." />
      </>
    );
  }

  if (isSuperAdmin && !effectiveAgencyId) {
    return (
      <>
        <AdminPageHeader title="Rent payments" subtitle={pageSubtitle} />
        <EmptyState
          title="Select an agency from the header to view this page."
          description="Use the agency dropdown in the top bar."
        />
      </>
    );
  }

  const query = effectiveAgencyId ? `?agencyId=${encodeURIComponent(effectiveAgencyId)}` : "";

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
      <AdminPageHeader title="Rent payments" subtitle={pageSubtitle} />

      <div className="mb-4 flex flex-wrap items-end gap-3 rounded-lg border border-zinc-200 bg-zinc-50/50 px-4 py-3">
        <div className="flex-1 min-w-[180px]">
          <label htmlFor="rent-search" className="mb-1 block text-xs font-medium text-zinc-700">
            Search
          </label>
          <input
            id="rent-search"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tenant or property"
            className="block w-full rounded-md border border-zinc-300 px-3 py-1.5 text-sm"
          />
        </div>
        <div>
          <label htmlFor="rent-status" className="mb-1 block text-xs font-medium text-zinc-700">
            Status
          </label>
          <select
            id="rent-status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm"
          >
            <option value="">All</option>
            {RENT_PAYMENT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {RENT_PAYMENT_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-zinc-500">Loading…</p>
      ) : payments.length === 0 ? (
        <EmptyState
          title="No rent payments"
          description="Rent payment rows will appear here once generated for active tenancies or created manually."
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No results"
          description="No rent payments match the current filters."
        />
      ) : (
        <Card className="p-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200">
                <th className="py-2 pr-4 text-left font-medium text-zinc-700">Tenant</th>
                <th className="py-2 pr-4 text-left font-medium text-zinc-700">Property</th>
                <th className="py-2 pr-4 text-left font-medium text-zinc-700">Amount</th>
                <th className="py-2 pr-4 text-left font-medium text-zinc-700">Due date</th>
                <th className="py-2 pr-4 text-left font-medium text-zinc-700">Status</th>
                <th className="py-2 pr-4 text-left font-medium text-zinc-700">Paid date</th>
                <th className="py-2 text-left font-medium text-zinc-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id} className="border-b border-zinc-100">
                  <td className="py-2 pr-4 align-top text-zinc-900">{p.tenantName}</td>
                  <td className="py-2 pr-4 align-top">
                    <Link
                      href={`/admin/properties/${p.propertyId}${query}`}
                      className="text-zinc-700 hover:underline"
                    >
                      {p.propertyDisplayLabel || p.propertyId || "—"}
                    </Link>
                  </td>
                  <td className="py-2 pr-4 align-top text-zinc-900">{formatMoney(p.rentAmount)}</td>
                  <td className="py-2 pr-4 align-top text-zinc-700">
                    {formatAdminDate(p.dueDate, "prettyDate")}
                  </td>
                  <td className="py-2 pr-4 align-top">
                    <AdminStatusBadge variant={getStatusBadgeVariant(p.status, "rent")}>
                      {RENT_PAYMENT_STATUS_LABELS[p.status]}
                    </AdminStatusBadge>
                  </td>
                  <td className="py-2 pr-4 align-top text-zinc-700">
                    {p.paidAt != null ? formatAdminDate(p.paidAt, "prettyDate") : "—"}
                  </td>
                  <td className="py-2 align-top">
                    <div className="flex flex-wrap gap-1">
                      <Link
                        href={`/admin/rent/${p.id}${query}`}
                        className="rounded border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100"
                      >
                        Record payment
                      </Link>
                      {p.tenancyId && (
                        <Link
                          href={`/admin/tenancies/${p.tenancyId}${query}`}
                          className="rounded border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100"
                        >
                          Open tenancy
                        </Link>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </>
  );
}

