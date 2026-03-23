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
import { TENANCY_STATUSES, TENANCY_STATUS_LABELS, type TenancyStatus } from "@/lib/types/tenancy";
import type { TenancyDetail } from "@/lib/types/tenancy";

export default function AdminTenancyDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const tenancyId = params?.tenancyId as string | undefined;
  const { profile } = useAuth();
  const queryAgencyId = searchParams?.get("agencyId")?.trim() ?? null;
  const sessionAgencyId = profile?.agencyId ?? null;
  const effectiveAgencyId = queryAgencyId || sessionAgencyId;

  const isSuperAdmin = profile?.role === "superAdmin";
  const [tenancy, setTenancy] = useState<TenancyDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [editing, setEditing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    tenancyStartDate: "",
    tenancyEndDate: "",
    status: "active" as TenancyStatus,
    tenantPhone: "",
    notes: "",
  });

  const loadTenancy = useCallback(() => {
    if (!tenancyId) {
      setLoading(false);
      setNotFound(true);
      return;
    }
    setLoading(true);
    const q = effectiveAgencyId ? `?agencyId=${encodeURIComponent(effectiveAgencyId)}` : "";
    fetch(`/api/admin/tenancies/${tenancyId}${q}`, { credentials: "include" })
      .then((res) => {
        if (res.status === 404) {
          setNotFound(true);
          return null;
        }
        if (!res.ok) return null;
        return res.json();
      })
      .then((data: TenancyDetail | null) => {
        if (data) {
          setTenancy(data);
          setEditForm({
            tenancyStartDate: data.tenancyStartDate ?? "",
            tenancyEndDate: data.tenancyEndDate ?? "",
            status: data.status,
            tenantPhone: data.tenantPhone ?? "",
            notes: data.notes ?? "",
          });
        }
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [tenancyId, effectiveAgencyId]);

  useEffect(() => {
    loadTenancy();
  }, [loadTenancy]);

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(t);
    }
  }, [toast]);

  const handleSave = useCallback(() => {
    if (!tenancyId || !effectiveAgencyId || !tenancy) return;
    setSubmitting(true);
    fetch(`/api/admin/tenancies/${tenancyId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        agencyId: effectiveAgencyId,
        tenancyStartDate: editForm.tenancyStartDate.trim() || null,
        tenancyEndDate: editForm.tenancyEndDate.trim() || null,
        status: editForm.status,
        tenantPhone: editForm.tenantPhone.trim() || null,
        notes: editForm.notes.trim() || null,
      }),
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
          setToast("Tenancy updated");
          setEditing(false);
          loadTenancy();
        } else {
          setToast((data?.error as string) ?? "Update failed");
        }
      })
      .catch(() => setToast("Update failed"))
      .finally(() => setSubmitting(false));
  }, [tenancyId, effectiveAgencyId, tenancy, editForm, loadTenancy]);

  const handleCancelEdit = useCallback(() => {
    if (tenancy) {
      setEditForm({
        tenancyStartDate: tenancy.tenancyStartDate ?? "",
        tenancyEndDate: tenancy.tenancyEndDate ?? "",
        status: tenancy.status,
        tenantPhone: tenancy.tenantPhone ?? "",
        notes: tenancy.notes ?? "",
      });
    }
    setEditing(false);
  }, [tenancy]);

  function formatDate(v: string | number | null | undefined): string {
    if (v == null || v === "") return "—";
    if (typeof v === "number") return new Date(v).toLocaleDateString();
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleDateString();
  }

  function formatMoney(value: number | null | undefined): string {
    if (value == null || !Number.isFinite(value)) return "—";
    return new Intl.NumberFormat(undefined, { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(value);
  }

  function formatDateTime(ms: number | null | undefined): string {
    if (ms == null) return "—";
    return new Date(ms).toLocaleString();
  }

  if (isSuperAdmin && !queryAgencyId) {
    return (
      <>
        <HistoryBackLink href="/admin/tenancies">← Tenancies</HistoryBackLink>
        <PageHeader title="Tenancy" />
        <Card className="p-6 mt-4">
          <p className="text-sm text-zinc-600">Select an agency from the header to view this tenancy.</p>
        </Card>
      </>
    );
  }

  if (!tenancyId) {
    return (
      <>
        <PageHeader title="Tenancy" />
        <p className="text-sm text-zinc-500">Missing tenancy ID.</p>
        <HistoryBackLink href={effectiveAgencyId ? `/admin/tenancies?agencyId=${encodeURIComponent(effectiveAgencyId)}` : "/admin/tenancies"} className="mt-2 inline-block text-sm font-medium text-zinc-600 hover:underline">
          ← Back to tenancies
        </HistoryBackLink>
      </>
    );
  }

  if (loading) {
    return (
      <>
        <PageHeader title="Tenancy" subtitle="Loading…" />
        <p className="text-sm text-zinc-500">Loading tenancy…</p>
      </>
    );
  }

  if (notFound || !tenancy) {
    return (
      <>
        <PageHeader title="Tenancy" />
        <Card className="p-6 mt-4">
          <p className="text-sm text-zinc-600">Tenancy not found or you don’t have access.</p>
          <HistoryBackLink href="/admin/tenancies" className="mt-2 inline-block text-sm font-medium text-zinc-600 hover:underline">
            ← Back to tenancies
          </HistoryBackLink>
        </Card>
      </>
    );
  }

  const title = tenancy.propertyDisplayLabel || "Tenancy";
  const backHref = effectiveAgencyId
    ? `/admin/tenancies?agencyId=${encodeURIComponent(effectiveAgencyId)}`
    : "/admin/tenancies";

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
        title={title}
        subtitle="Operational record for an active or completed tenancy."
        action={
          <div className="flex gap-2">
            {editing ? (
              <>
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={submitting}
                  className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
                >
                  {submitting ? "Saving…" : "Save"}
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
              >
                Edit
              </button>
            )}
            <HistoryBackLink href={backHref} className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50">
              ← Back to tenancies
            </HistoryBackLink>
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-2 mb-6">
        <Card className="p-4">
          <h2 className="text-base font-medium text-zinc-900 mb-3">Tenant information</h2>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <dt className="text-zinc-500">Name</dt>
            <dd className="text-zinc-900">
              {tenancy.applicantId ? (
                <Link href={`/admin/applicants/${tenancy.applicantId}`} className="hover:underline">
                  {tenancy.tenantName || "—"}
                </Link>
              ) : (
                tenancy.tenantName || "—"
              )}
            </dd>
            <dt className="text-zinc-500">Email</dt>
            <dd className="text-zinc-900">{tenancy.tenantEmail || "—"}</dd>
            <dt className="text-zinc-500">Phone</dt>
            <dd className="text-zinc-900">{tenancy.tenantPhone || "—"}</dd>
          </dl>
        </Card>
        <Card className="p-4">
          <h2 className="text-base font-medium text-zinc-900 mb-3">Property</h2>
          <p className="text-sm text-zinc-900">
            {tenancy.linkedProperty ? (
              <Link
                href={`/admin/properties/${tenancy.propertyId}?agencyId=${encodeURIComponent(tenancy.agencyId)}`}
                className="hover:underline"
              >
                {tenancy.linkedProperty.displayLabel}
              </Link>
            ) : (
              tenancy.propertyDisplayLabel || "—"
            )}
          </p>
        </Card>
      </div>

      <Card className="p-4 mb-6">
        <h2 className="text-base font-medium text-zinc-900 mb-3">Tenancy terms</h2>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <dt className="text-zinc-500">Rent</dt>
          <dd className="text-zinc-900">{formatMoney(tenancy.rentAmount)}</dd>
          <dt className="text-zinc-500">Deposit</dt>
          <dd className="text-zinc-900">{formatMoney(tenancy.deposit)}</dd>
          <dt className="text-zinc-500">Move-in date</dt>
          <dd className="text-zinc-900">{formatDate(tenancy.moveInDate)}</dd>
          <dt className="text-zinc-500">Start date</dt>
          <dd className="text-zinc-900">{formatDate(tenancy.tenancyStartDate)}</dd>
          {(tenancy.notes ?? "") !== "" && (
            <>
              <dt className="text-zinc-500">Notes</dt>
              <dd className="text-zinc-900">{tenancy.notes}</dd>
            </>
          )}
        </dl>
      </Card>

      <Card className="p-4 mb-6 border-dashed border-zinc-200 bg-zinc-50/50">
        <h2 className="text-base font-medium text-zinc-900 mb-2">Move-in checklist</h2>
        <p className="text-xs text-zinc-500 mb-3">Placeholders for move-in tasks. To be implemented.</p>
        <ul className="space-y-1.5 text-sm text-zinc-600">
          <li>· Deposit registration</li>
          <li>· Tenancy agreement signed</li>
          <li>· Inventory completed</li>
          <li>· Keys handed over</li>
        </ul>
      </Card>

      <Card className="p-4 mb-6 border-dashed border-zinc-200 bg-zinc-50/50">
        <p className="text-xs text-zinc-500">
          Future: rent collection, maintenance tracking, tenant portal, contract storage, inspection scheduling.
        </p>
      </Card>

      <Card className="p-4 mb-6">
        <h2 className="text-base font-medium text-zinc-900 mb-2">Summary</h2>
        <div className="grid gap-2 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <AdminStatusBadge variant={getStatusBadgeVariant(tenancy.status, "tenancy")}>
              {TENANCY_STATUS_LABELS[tenancy.status] ?? tenancy.status}
            </AdminStatusBadge>
            <span className="text-zinc-600">{tenancy.propertyDisplayLabel || "—"}</span>
          </div>
          <p className="text-zinc-400 text-xs">
            Created: {formatDateTime(tenancy.createdAt)} · Updated: {formatDateTime(tenancy.updatedAt)}
          </p>
        </div>
      </Card>

      <Card className="p-4 mb-6">
        <h2 className="text-base font-medium text-zinc-900 mb-1">Linked records</h2>
        <p className="text-xs text-zinc-500 mb-3">Related property, applicant, offer, queue item, and landlord.</p>
        <dl className="space-y-2 text-sm">
          <div>
            <dt className="text-zinc-500">Property</dt>
            <dd>
              {tenancy.linkedProperty ? (
                <Link
                  href={`/admin/properties/${tenancy.propertyId}?agencyId=${encodeURIComponent(tenancy.agencyId)}`}
                  className="text-zinc-900 font-medium hover:underline"
                >
                  {tenancy.linkedProperty.displayLabel}
                </Link>
              ) : (
                <span className="text-zinc-600">—</span>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-zinc-500">Applicant</dt>
            <dd>
              {tenancy.linkedApplicant && tenancy.applicantId ? (
                <Link
                  href={`/admin/applicants/${tenancy.applicantId}`}
                  className="text-zinc-900 font-medium hover:underline"
                >
                  {tenancy.linkedApplicant.name || tenancy.linkedApplicant.email || "Applicant"}
                </Link>
              ) : (
                <span className="text-zinc-600">—</span>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-zinc-500">Offer</dt>
            <dd>
              {tenancy.linkedOffer ? (
                <span className="text-zinc-700">
                  £{tenancy.linkedOffer.amount.toLocaleString()} {tenancy.linkedOffer.currency} · {tenancy.linkedOffer.status}
                </span>
              ) : (
                <span className="text-zinc-600">—</span>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-zinc-500">Queue item</dt>
            <dd>
              {tenancy.linkedQueue ? (
                <Link
                  href={`/admin/staff-action-queue?agencyId=${encodeURIComponent(tenancy.agencyId)}`}
                  className="text-zinc-900 font-medium hover:underline"
                >
                  {tenancy.linkedQueue.stage || tenancy.createdFromQueueItemId}
                </Link>
              ) : tenancy.createdFromQueueItemId ? (
                <Link
                  href={`/admin/staff-action-queue?agencyId=${encodeURIComponent(tenancy.agencyId)}`}
                  className="text-zinc-700 hover:underline"
                >
                  View action queue
                </Link>
              ) : (
                <span className="text-zinc-600">—</span>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-zinc-500">Landlord</dt>
            <dd>
              {tenancy.linkedLandlord ? (
                <Link
                  href={`/admin/landlords/${tenancy.linkedLandlord.uid}`}
                  className="text-zinc-900 font-medium hover:underline"
                >
                  {tenancy.linkedLandlord.displayName}
                </Link>
              ) : (
                <span className="text-zinc-600">—</span>
              )}
            </dd>
          </div>
        </dl>
      </Card>

      <Card className="p-4 mb-6">
        <h2 className="text-base font-medium text-zinc-900 mb-1">Tenancy details</h2>
        <p className="text-xs text-zinc-500 mb-3">Operational fields. Edit to update start/end dates, status, phone, and notes.</p>
        {editing ? (
          <div className="space-y-4">
            <div>
              <label htmlFor="tenancy-start" className="block text-sm font-medium text-zinc-700">Start date</label>
              <input
                id="tenancy-start"
                type="date"
                value={editForm.tenancyStartDate}
                onChange={(e) => setEditForm((f) => ({ ...f, tenancyStartDate: e.target.value }))}
                className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900"
              />
            </div>
            <div>
              <label htmlFor="tenancy-end" className="block text-sm font-medium text-zinc-700">End date</label>
              <input
                id="tenancy-end"
                type="date"
                value={editForm.tenancyEndDate}
                onChange={(e) => setEditForm((f) => ({ ...f, tenancyEndDate: e.target.value }))}
                className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900"
              />
            </div>
            <div>
              <label htmlFor="tenancy-status" className="block text-sm font-medium text-zinc-700">Status</label>
              <select
                id="tenancy-status"
                value={editForm.status}
                onChange={(e) => setEditForm((f) => ({ ...f, status: e.target.value as TenancyStatus }))}
                className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 bg-white"
              >
                {TENANCY_STATUSES.map((s) => (
                  <option key={s} value={s}>{TENANCY_STATUS_LABELS[s]}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="tenancy-phone" className="block text-sm font-medium text-zinc-700">Tenant phone</label>
              <input
                id="tenancy-phone"
                type="tel"
                value={editForm.tenantPhone}
                onChange={(e) => setEditForm((f) => ({ ...f, tenantPhone: e.target.value }))}
                className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900"
              />
            </div>
            <div>
              <label htmlFor="tenancy-notes" className="block text-sm font-medium text-zinc-700">Notes</label>
              <textarea
                id="tenancy-notes"
                rows={3}
                value={editForm.notes}
                onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))}
                className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900"
                placeholder="Internal operational notes for this tenancy."
              />
            </div>
          </div>
        ) : (
          <dl className="space-y-2 text-sm">
            <div>
              <dt className="text-zinc-500">Start date</dt>
              <dd className="text-zinc-900">{formatDate(tenancy.tenancyStartDate)}</dd>
            </div>
            <div>
              <dt className="text-zinc-500">End date</dt>
              <dd className="text-zinc-900">{formatDate(tenancy.tenancyEndDate)}</dd>
            </div>
            <div>
              <dt className="text-zinc-500">Status</dt>
              <dd>
                <AdminStatusBadge variant={getStatusBadgeVariant(tenancy.status, "tenancy")}>
                  {tenancy.status}
                </AdminStatusBadge>
              </dd>
            </div>
            <div>
              <dt className="text-zinc-500">Tenant phone</dt>
              <dd className="text-zinc-900">{tenancy.tenantPhone || "—"}</dd>
            </div>
            {tenancy.notes && (
              <div>
                <dt className="text-zinc-500">Notes</dt>
                <dd className="text-zinc-700 whitespace-pre-wrap">{tenancy.notes}</dd>
              </div>
            )}
          </dl>
        )}
      </Card>

      <Card className="p-4 mb-6">
        <h2 className="text-base font-medium text-zinc-900 mb-1">Origin</h2>
        <p className="text-xs text-zinc-500 mb-2">Created from queue and offer for audit trail.</p>
        <dl className="space-y-1 text-sm text-zinc-600">
          <div><dt className="inline font-medium text-zinc-500">Queue item:</dt> <dd className="inline">{tenancy.createdFromQueueItemId || "—"}</dd></div>
          <div><dt className="inline font-medium text-zinc-500">Offer ID:</dt> <dd className="inline font-mono text-xs">{tenancy.offerId || "—"}</dd></div>
          <div><dt className="inline font-medium text-zinc-500">Application ID:</dt> <dd className="inline font-mono text-xs">{tenancy.applicationId || "—"}</dd></div>
          <div><dt className="inline font-medium text-zinc-500">Created:</dt> <dd className="inline">{formatDateTime(tenancy.createdAt)}</dd></div>
          <div><dt className="inline font-medium text-zinc-500">Created by:</dt> <dd className="inline">{tenancy.createdBy || "—"}</dd></div>
        </dl>
      </Card>
    </>
  );
}
