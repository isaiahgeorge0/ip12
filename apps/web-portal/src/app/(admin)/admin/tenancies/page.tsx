"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { formatAdminDate } from "@/lib/admin/formatAdminDate";
import { useAdminAgency } from "@/lib/admin/useAdminAgency";
import type { TenancyListItem } from "@/app/api/admin/tenancies/route";
import { AdminStatusBadge } from "@/components/admin/AdminStatusBadge";
import { getStatusBadgeVariant } from "@/lib/admin/statusBadge";
import { TENANCY_STATUS_LABELS } from "@/lib/types/tenancy";

function formatMoney(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(value);
}

function formatDate(value: string | null | undefined): string {
  return formatAdminDate(value, "prettyDate");
}

export default function AdminTenanciesPage() {
  const searchParams = useSearchParams();
  const { effectiveAgencyId, isSuperAdmin } = useAdminAgency();
  const pageSubtitle = "Manage active tenancies and upcoming move-ins.";

  const [tenancies, setTenancies] = useState<TenancyListItem[]>([]);
  const [loading, setLoading] = useState(true);

  const loadTenancies = useCallback(() => {
    if (!effectiveAgencyId) {
      setTenancies([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const params = new URLSearchParams();
    params.set("agencyId", effectiveAgencyId);
    fetch(`/api/admin/tenancies?${params.toString()}`, { credentials: "include" })
      .then((res) => (res.ok ? res.json() : []))
      .then((data: TenancyListItem[]) => setTenancies(Array.isArray(data) ? data : []))
      .catch(() => setTenancies([]))
      .finally(() => setLoading(false));
  }, [effectiveAgencyId]);

  useEffect(() => {
    loadTenancies();
  }, [loadTenancies]);

  const upcomingMoveIns = tenancies.filter((t) => t.status === "preparing");
  const activeTenancies = tenancies.filter((t) => t.status === "active");

  if (!effectiveAgencyId && !isSuperAdmin) {
    return (
      <>
        <AdminPageHeader title="Tenancies" subtitle={pageSubtitle} />
        <EmptyState title="No agency" description="Your account is not linked to an agency." />
      </>
    );
  }

  if (isSuperAdmin && !effectiveAgencyId) {
    return (
      <>
        <AdminPageHeader title="Tenancies" subtitle={pageSubtitle} />
        <EmptyState
          title="Select an agency from the header to view this page."
          description="Use the agency dropdown in the top bar."
        />
      </>
    );
  }

  return (
    <>
      <AdminPageHeader title="Tenancies" subtitle={pageSubtitle} />

      <div className="mb-4">
        <Card className="p-4 border-amber-200 bg-amber-50/60">
          <h2 className="text-sm font-medium text-zinc-900 mb-1">Next recommended action</h2>
          <p className="text-sm text-zinc-700">
            {upcomingMoveIns.length > 0
              ? "Prepare upcoming move-ins"
              : activeTenancies.length > 0
                ? "Monitor active tenancies"
                : "No active tenancies yet."}
          </p>
        </Card>
      </div>

      {loading ? (
        <p className="text-sm text-zinc-500">Loading…</p>
      ) : tenancies.length === 0 ? (
        <EmptyState
          title="No tenancies"
          description="Tenancies are created when an offer is accepted. They will appear here once you have accepted offers or complete the handoff in the action queue."
          action={
            <Link
              href={effectiveAgencyId ? `/admin/offers?agencyId=${encodeURIComponent(effectiveAgencyId)}` : "/admin/offers"}
              className="text-sm font-medium text-zinc-700 hover:text-zinc-900"
            >
              Open offers →
            </Link>
          }
        />
      ) : (
        <Card className="p-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200">
                <th className="py-2 pr-4 text-left font-medium text-zinc-700">Tenant</th>
                <th className="py-2 pr-4 text-left font-medium text-zinc-700">Property</th>
                <th className="py-2 pr-4 text-left font-medium text-zinc-700">Rent</th>
                <th className="py-2 pr-4 text-left font-medium text-zinc-700">Move-in Date</th>
                <th className="py-2 pr-4 text-left font-medium text-zinc-700">Status</th>
                <th className="py-2 text-left font-medium text-zinc-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {tenancies.map((t) => (
                <tr key={t.id} className="border-b border-zinc-100">
                  <td className="py-2 pr-4 align-top">
                    <div className="flex flex-col">
                      <span className="font-medium text-zinc-900">{t.tenantName || "—"}</span>
                      <span className="text-xs text-zinc-600">{t.tenantEmail || "—"}</span>
                    </div>
                  </td>
                  <td className="py-2 pr-4 align-top">
                    <Link
                      href={`/admin/properties/${t.propertyId}?agencyId=${encodeURIComponent(t.agencyId)}`}
                      className="text-zinc-700 hover:underline"
                    >
                      {t.propertyDisplayLabel || t.propertyId}
                    </Link>
                  </td>
                  <td className="py-2 pr-4 align-top text-zinc-900">{formatMoney(t.rentAmount)}</td>
                  <td className="py-2 pr-4 align-top text-zinc-900">{formatDate(t.moveInDate ?? t.tenancyStartDate)}</td>
                  <td className="py-2 pr-4 align-top">
                    <AdminStatusBadge variant={getStatusBadgeVariant(t.status, "tenancy")}>
                      {TENANCY_STATUS_LABELS[t.status] ?? t.status}
                    </AdminStatusBadge>
                  </td>
                  <td className="py-2 align-top">
                    <div className="flex flex-wrap gap-1">
                      <Link
                        href={`/admin/tenancies/${t.id}${effectiveAgencyId ? `?agencyId=${encodeURIComponent(effectiveAgencyId)}` : ""}`}
                        className="rounded border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100"
                      >
                        Open tenancy
                      </Link>
                      <Link
                        href={`/admin/properties/${t.propertyId}?agencyId=${encodeURIComponent(t.agencyId)}`}
                        className="rounded border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100"
                      >
                        Open property
                      </Link>
                      {t.applicantId && (
                        <Link
                          href={`/admin/applicants/${t.applicantId}`}
                          className="rounded border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100"
                        >
                          Open tenant
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
