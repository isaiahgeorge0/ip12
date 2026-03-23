"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/Card";
import { useAuth } from "@/contexts/AuthContext";
import { HistoryBackLink } from "@/components/HistoryBackLink";
import { AdminStatusBadge } from "@/components/admin/AdminStatusBadge";
import { getStatusBadgeVariant } from "@/lib/admin/statusBadge";
import type { TenantSummary } from "@/lib/types/tenancy";
import type { TenantDetailTenancyRow } from "@/lib/types/tenancy";

type TenantDetailResponse = {
  tenant: TenantSummary;
  tenancies: TenantDetailTenancyRow[];
};

export default function AdminTenantDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const tenantId = params?.tenantId as string | undefined;
  const { profile } = useAuth();
  const queryAgencyId = searchParams?.get("agencyId")?.trim() ?? null;
  const sessionAgencyId = profile?.agencyId ?? null;
  const effectiveAgencyId = queryAgencyId || sessionAgencyId;

  const [data, setData] = useState<TenantDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const loadTenant = useCallback(() => {
    if (!tenantId) {
      setLoading(false);
      setNotFound(true);
      return;
    }
    setLoading(true);
    const q = effectiveAgencyId ? `?agencyId=${encodeURIComponent(effectiveAgencyId)}` : "";
    fetch(`/api/admin/tenants/${encodeURIComponent(tenantId)}${q}`, { credentials: "include" })
      .then((res) => {
        if (res.status === 404) {
          setNotFound(true);
          return null;
        }
        if (!res.ok) return null;
        return res.json();
      })
      .then((d: TenantDetailResponse | null) => {
        if (d) setData(d);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [tenantId, effectiveAgencyId]);

  useEffect(() => {
    loadTenant();
  }, [loadTenant]);

  function formatDate(v: string | number | null | undefined): string {
    if (v == null || v === "") return "—";
    if (typeof v === "number") return new Date(v).toLocaleDateString();
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleDateString();
  }

  function formatDateTime(ms: number | null | undefined): string {
    if (ms == null) return "—";
    return new Date(ms).toLocaleString();
  }

  if (!tenantId) {
    return (
      <>
        <PageHeader title="Tenant" />
        <p className="text-sm text-zinc-500">Missing tenant ID.</p>
        <HistoryBackLink href="/admin/tenants" className="mt-2 inline-block text-sm font-medium text-zinc-600 hover:underline">
          ← Back to tenants
        </HistoryBackLink>
      </>
    );
  }

  if (loading) {
    return (
      <>
        <PageHeader title="Tenant" subtitle="Loading…" />
        <p className="text-sm text-zinc-500">Loading tenant…</p>
      </>
    );
  }

  if (notFound || !data) {
    return (
      <>
        <PageHeader title="Tenant" />
        <Card className="p-6 mt-4">
          <p className="text-sm text-zinc-600">Tenant not found or you don’t have access.</p>
          <HistoryBackLink href="/admin/tenants" className="mt-2 inline-block text-sm font-medium text-zinc-600 hover:underline">
            ← Back to tenants
          </HistoryBackLink>
        </Card>
      </>
    );
  }

  const { tenant, tenancies } = data;
  const backHref = effectiveAgencyId
    ? `/admin/tenants?agencyId=${encodeURIComponent(effectiveAgencyId)}`
    : "/admin/tenants";
  const latestTenancy = tenancies[0];
  const latestNotes = latestTenancy?.notes?.trim();

  return (
    <>
      <PageHeader
        title={tenant.tenantName || "Tenant"}
        subtitle={[tenant.tenantEmail, tenant.tenantPhone].filter(Boolean).join(" · ") || undefined}
        action={
          <HistoryBackLink href={backHref} className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50">
            ← Back to tenants
          </HistoryBackLink>
        }
      />

      <div className="mb-4">
        <AdminStatusBadge variant={getStatusBadgeVariant(tenant.status, "tenant")}>
          {tenant.status}
        </AdminStatusBadge>
      </div>

      <Card className="p-4 mb-6">
        <h2 className="text-base font-medium text-zinc-900 mb-1">Summary</h2>
        <p className="text-xs text-zinc-500 mb-3">Current property, tenancy count, and linked records.</p>
        <dl className="space-y-2 text-sm">
          <div>
            <dt className="text-zinc-500">Current property</dt>
            <dd>
              {tenant.currentPropertyId ? (
                <Link
                  href={`/admin/properties/${tenant.currentPropertyId}?agencyId=${encodeURIComponent(tenant.agencyId)}`}
                  className="text-zinc-900 font-medium hover:underline"
                >
                  {tenant.currentPropertyDisplayLabel || tenant.currentPropertyId}
                </Link>
              ) : (
                <span className="text-zinc-600">—</span>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-zinc-500">Tenancy count</dt>
            <dd className="text-zinc-900">{tenant.tenancyCount}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Active tenancy</dt>
            <dd>
              {tenant.activeTenancyId ? (
                <Link
                  href={`/admin/tenancies/${tenant.activeTenancyId}?agencyId=${encodeURIComponent(tenant.agencyId)}`}
                  className="text-zinc-700 hover:underline font-mono text-xs"
                >
                  {tenant.activeTenancyId}
                </Link>
              ) : (
                <span className="text-zinc-600">—</span>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-zinc-500">Latest tenancy</dt>
            <dd>
              {tenant.latestTenancyId ? (
                <Link
                  href={`/admin/tenancies/${tenant.latestTenancyId}?agencyId=${encodeURIComponent(tenant.agencyId)}`}
                  className="text-zinc-700 hover:underline font-mono text-xs"
                >
                  {tenant.latestTenancyId}
                </Link>
              ) : (
                <span className="text-zinc-600">—</span>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-zinc-500">Applicant</dt>
            <dd>
              {tenant.applicantId ? (
                <Link
                  href={`/admin/applicants/${tenant.applicantId}`}
                  className="text-zinc-900 font-medium hover:underline"
                >
                  View applicant
                </Link>
              ) : (
                <span className="text-zinc-600">—</span>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-zinc-500">Created / updated</dt>
            <dd className="text-zinc-600">
              {formatDateTime(tenant.createdAt)} / {formatDateTime(tenant.updatedAt)}
            </dd>
          </div>
        </dl>
      </Card>

      <Card className="p-4 mb-6">
        <h2 className="text-base font-medium text-zinc-900 mb-1">Tenancy history</h2>
        <p className="text-xs text-zinc-500 mb-3">All tenancies for this tenant, newest first.</p>
        {tenancies.length === 0 ? (
          <p className="text-sm text-zinc-500">No tenancy records.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200">
                  <th className="text-left py-2 pr-4 font-medium text-zinc-700">Property</th>
                  <th className="text-left py-2 pr-4 font-medium text-zinc-700">Start</th>
                  <th className="text-left py-2 pr-4 font-medium text-zinc-700">End</th>
                  <th className="text-left py-2 pr-4 font-medium text-zinc-700">Rent</th>
                  <th className="text-left py-2 pr-4 font-medium text-zinc-700">Status</th>
                  <th className="text-left py-2 pr-4 font-medium text-zinc-700">Updated</th>
                  <th className="text-left py-2 font-medium text-zinc-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {tenancies.map((t) => (
                  <tr key={t.id} className="border-b border-zinc-100">
                    <td className="py-2 pr-4 text-zinc-900">
                      <Link
                        href={`/admin/properties/${t.propertyId}?agencyId=${encodeURIComponent(tenant.agencyId)}`}
                        className="text-zinc-700 hover:underline"
                      >
                        {t.propertyDisplayLabel || t.propertyId}
                      </Link>
                    </td>
                    <td className="py-2 pr-4 text-zinc-600">{formatDate(t.tenancyStartDate)}</td>
                    <td className="py-2 pr-4 text-zinc-600">{formatDate(t.tenancyEndDate)}</td>
                    <td className="py-2 pr-4 text-zinc-600">
                      £{t.rentAmount.toLocaleString()} {t.currency}
                    </td>
                    <td className="py-2 pr-4">
                      <AdminStatusBadge variant={getStatusBadgeVariant(t.status, "tenancy")}>
                        {t.status}
                      </AdminStatusBadge>
                    </td>
                    <td className="py-2 pr-4 text-zinc-600">{formatDateTime(t.updatedAt)}</td>
                    <td className="py-2">
                      <Link
                        href={`/admin/tenancies/${t.id}?agencyId=${encodeURIComponent(tenant.agencyId)}`}
                        className="text-sm font-medium text-zinc-700 hover:text-zinc-900"
                      >
                        View tenancy
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card className="p-4 mb-6">
        <h2 className="text-base font-medium text-zinc-900 mb-1">Linked records</h2>
        <p className="text-xs text-zinc-500 mb-2">Applicant, application, and active property.</p>
        <ul className="space-y-1 text-sm">
          {tenant.applicantId && (
            <li>
              <Link href={`/admin/applicants/${tenant.applicantId}`} className="text-zinc-700 hover:underline">
                Applicant
              </Link>
            </li>
          )}
          {tenant.applicationId && (
            <li>
              <span className="text-zinc-600">Application (see applicant record)</span>
            </li>
          )}
          {tenant.currentPropertyId && (
            <li>
              <Link
                href={`/admin/properties/${tenant.currentPropertyId}?agencyId=${encodeURIComponent(tenant.agencyId)}`}
                className="text-zinc-700 hover:underline"
              >
                Current property
              </Link>
            </li>
          )}
          {!tenant.applicantId && !tenant.currentPropertyId && (
            <li className="text-zinc-500">—</li>
          )}
        </ul>
      </Card>

      {latestNotes && (
        <Card className="p-4 mb-6">
          <h2 className="text-base font-medium text-zinc-900 mb-1">Notes (latest tenancy)</h2>
          <p className="text-xs text-zinc-500 mb-2">Internal operational notes from the most recent tenancy.</p>
          <p className="text-sm text-zinc-700 whitespace-pre-wrap">{latestNotes}</p>
        </Card>
      )}
    </>
  );
}
