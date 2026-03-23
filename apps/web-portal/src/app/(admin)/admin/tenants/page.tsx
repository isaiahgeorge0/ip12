"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { useAuth } from "@/contexts/AuthContext";
import type { TenantSummary } from "@/lib/types/tenancy";
import { AdminStatusBadge } from "@/components/admin/AdminStatusBadge";
import { getStatusBadgeVariant } from "@/lib/admin/statusBadge";

export default function AdminTenantsPage() {
  const searchParams = useSearchParams();
  const { profile } = useAuth();
  const agencyId = profile?.agencyId ?? null;
  const isSuperAdmin = profile?.role === "superAdmin";
  const agencyIdParam = searchParams?.get("agencyId")?.trim() ?? null;

  const [tenants, setTenants] = useState<TenantSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [searchQ, setSearchQ] = useState("");

  const effectiveAgencyId = isSuperAdmin ? agencyIdParam : agencyId;

  const loadTenants = useCallback(() => {
    if (!effectiveAgencyId) {
      setTenants([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const params = new URLSearchParams();
    params.set("agencyId", effectiveAgencyId);
    if (statusFilter) params.set("status", statusFilter);
    if (searchQ.trim()) params.set("q", searchQ.trim());
    fetch(`/api/admin/tenants?${params.toString()}`, { credentials: "include" })
      .then((res) => (res.ok ? res.json() : { items: [] }))
      .then((data: { items?: TenantSummary[] }) => setTenants(Array.isArray(data?.items) ? data.items : []))
      .catch(() => setTenants([]))
      .finally(() => setLoading(false));
  }, [effectiveAgencyId, statusFilter, searchQ]);

  useEffect(() => {
    loadTenants();
  }, [loadTenants]);

  if (!effectiveAgencyId && !isSuperAdmin) {
    return (
      <>
        <PageHeader title="Tenants" subtitle="View active and former tenants derived from tenancy records." />
        <EmptyState title="No agency" description="Your account is not linked to an agency." />
      </>
    );
  }

  if (isSuperAdmin && !effectiveAgencyId) {
    return (
      <>
        <PageHeader title="Tenants" subtitle="View active and former tenants derived from tenancy records." />
        <EmptyState
          title="Select an agency from the header to view tenants."
          description="Use the agency dropdown in the top bar."
        />
      </>
    );
  }

  const query = effectiveAgencyId ? `?agencyId=${encodeURIComponent(effectiveAgencyId)}` : "";

  return (
    <>
      <PageHeader title="Tenants" subtitle="View active and former tenants derived from tenancy records." />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm bg-white"
          aria-label="Status"
        >
          <option value="">All</option>
          <option value="active">Active</option>
          <option value="former">Former</option>
        </select>
        <input
          type="search"
          placeholder="Search name, email, phone, property…"
          value={searchQ}
          onChange={(e) => setSearchQ(e.target.value)}
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm min-w-[200px]"
        />
      </div>

      {loading ? (
        <p className="text-sm text-zinc-500">Loading…</p>
      ) : tenants.length === 0 ? (
        <EmptyState
          title="No tenants yet"
          description="Tenant records will appear here once tenancies are created."
          action={
            <Link href={`/admin/tenancies${query}`} className="text-sm font-medium text-zinc-700 hover:text-zinc-900">
              View tenancies →
            </Link>
          }
        />
      ) : (
        <Card className="p-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200">
                <th className="text-left py-2 pr-4 font-medium text-zinc-700">Tenant</th>
                <th className="text-left py-2 pr-4 font-medium text-zinc-700">Current property</th>
                <th className="text-left py-2 pr-4 font-medium text-zinc-700">Status</th>
                <th className="text-left py-2 pr-4 font-medium text-zinc-700">Tenancies</th>
                <th className="text-left py-2 pr-4 font-medium text-zinc-700">Last updated</th>
                <th className="text-left py-2 font-medium text-zinc-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {tenants.map((t) => (
                <tr key={t.tenantId} className="border-b border-zinc-100">
                  <td className="py-2 pr-4 text-zinc-900">
                    <Link
                      href={`/admin/tenants/${encodeURIComponent(t.tenantId)}${query}`}
                      className="font-medium text-zinc-900 hover:underline"
                    >
                      {t.tenantName || "—"}
                    </Link>
                    {t.tenantEmail && (
                      <span className="block text-xs text-zinc-500">{t.tenantEmail}</span>
                    )}
                  </td>
                  <td className="py-2 pr-4 text-zinc-900">
                    {t.currentPropertyId ? (
                      <Link
                        href={`/admin/properties/${t.currentPropertyId}?agencyId=${encodeURIComponent(t.agencyId)}`}
                        className="text-zinc-700 hover:underline"
                      >
                        {t.currentPropertyDisplayLabel || t.currentPropertyId}
                      </Link>
                    ) : (
                      <span className="text-zinc-500">—</span>
                    )}
                  </td>
                  <td className="py-2 pr-4">
                    <AdminStatusBadge variant={getStatusBadgeVariant(t.status, "tenant")}>
                      {t.status}
                    </AdminStatusBadge>
                  </td>
                  <td className="py-2 pr-4 text-zinc-600">{t.tenancyCount}</td>
                  <td className="py-2 pr-4 text-zinc-600">
                    {t.updatedAt != null ? new Date(t.updatedAt).toLocaleDateString() : "—"}
                  </td>
                  <td className="py-2">
                    <Link
                      href={`/admin/tenants/${encodeURIComponent(t.tenantId)}${effectiveAgencyId ? `?agencyId=${encodeURIComponent(effectiveAgencyId)}` : ""}`}
                      className="text-sm font-medium text-zinc-700 hover:text-zinc-900"
                    >
                      View tenant
                    </Link>
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
