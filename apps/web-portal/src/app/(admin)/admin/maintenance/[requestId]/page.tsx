"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/Card";
import { HistoryBackLink } from "@/components/HistoryBackLink";
import { EmptyState } from "@/components/EmptyState";
import { AdminStatusBadge } from "@/components/admin/AdminStatusBadge";
import { getStatusBadgeVariant } from "@/lib/admin/statusBadge";
import { formatAdminDate } from "@/lib/admin/formatAdminDate";
import { useAdminAgency } from "@/lib/admin/useAdminAgency";
import {
  MAINTENANCE_STATUSES,
  MAINTENANCE_STATUS_LABELS,
  MAINTENANCE_PRIORITIES,
  MAINTENANCE_PRIORITY_LABELS,
  type MaintenanceStatus,
  type MaintenancePriority,
} from "@/lib/types/maintenanceRequest";
import type { MaintenanceRequestDetail } from "@/app/api/admin/maintenance/[requestId]/route";
import type { ContractorListItem } from "@/lib/types/contractor";

export default function AdminMaintenanceRequestDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const requestId = params?.requestId as string | undefined;
  const queryAgencyId = searchParams?.get("agencyId")?.trim() ?? null;
  const { effectiveAgencyId: ctxAgencyId, isSuperAdmin } = useAdminAgency();
  const effectiveAgencyId = queryAgencyId || ctxAgencyId;

  const [request, setRequest] = useState<MaintenanceRequestDetail | null>(null);
  const [contractors, setContractors] = useState<ContractorListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [statusEdit, setStatusEdit] = useState<MaintenanceStatus | null>(null);
  const [assignContractorId, setAssignContractorId] = useState<string>("");

  const query = effectiveAgencyId ? `?agencyId=${encodeURIComponent(effectiveAgencyId)}` : "";

  const loadRequest = useCallback(() => {
    if (!requestId || !effectiveAgencyId) {
      setLoading(false);
      if (!effectiveAgencyId && !requestId) setNotFound(true);
      return;
    }
    setLoading(true);
    fetch(`/api/admin/maintenance/${requestId}${query}`, { credentials: "include" })
      .then((res) => {
        if (res.status === 404) {
          setNotFound(true);
          return null;
        }
        if (!res.ok) return null;
        return res.json();
      })
      .then((data: MaintenanceRequestDetail | null) => {
        if (data) {
          setRequest(data);
          setStatusEdit(data.status);
          setAssignContractorId(data.contractorId ?? "");
        }
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [requestId, effectiveAgencyId, query]);

  useEffect(() => {
    loadRequest();
  }, [loadRequest]);

  useEffect(() => {
    if (!effectiveAgencyId) return;
    fetch(`/api/admin/contractors?agencyId=${encodeURIComponent(effectiveAgencyId)}`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : []))
      .then((data: ContractorListItem[]) => setContractors(Array.isArray(data) ? data : []))
      .catch(() => setContractors([]));
  }, [effectiveAgencyId]);

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(t);
    }
  }, [toast]);

  const handleStatusSave = useCallback(() => {
    if (!requestId || !effectiveAgencyId || statusEdit == null) return;
    setSubmitting(true);
    fetch(`/api/admin/maintenance/${requestId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ agencyId: effectiveAgencyId, status: statusEdit }),
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
          setToast("Status updated");
          loadRequest();
        } else {
          setToast((data?.error as string) ?? "Update failed");
        }
      })
      .catch(() => setToast("Update failed"))
      .finally(() => setSubmitting(false));
  }, [requestId, effectiveAgencyId, statusEdit, loadRequest]);

  const handleAssignContractor = useCallback(() => {
    if (!requestId || !effectiveAgencyId) return;
    const contractor = contractors.find((c) => c.id === assignContractorId);
    setSubmitting(true);
    fetch(`/api/admin/maintenance/${requestId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        agencyId: effectiveAgencyId,
        contractorId: assignContractorId || null,
        contractorName: contractor?.displayName ?? null,
      }),
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
          setToast(assignContractorId ? "Contractor assigned" : "Contractor cleared");
          loadRequest();
        } else {
          setToast((data?.error as string) ?? "Update failed");
        }
      })
      .catch(() => setToast("Update failed"))
      .finally(() => setSubmitting(false));
  }, [requestId, effectiveAgencyId, assignContractorId, contractors, loadRequest]);

  if (!requestId) {
    return (
      <>
        <PageHeader title="Maintenance request" />
        <p className="text-sm text-zinc-500">Missing request ID.</p>
      </>
    );
  }

  if (!effectiveAgencyId && !isSuperAdmin) {
    return (
      <>
        <PageHeader title="Maintenance request" />
        <EmptyState title="No agency" description="Your account is not linked to an agency." />
      </>
    );
  }

  if (isSuperAdmin && !effectiveAgencyId) {
    return (
      <>
        <PageHeader title="Maintenance request" />
        <EmptyState
          title="Select an agency from the header to view this page."
          description="Use the agency dropdown in the top bar."
        />
      </>
    );
  }

  if (loading || !request) {
    return (
      <>
        <HistoryBackLink href={`/admin/maintenance${query}`}>← Maintenance</HistoryBackLink>
        <PageHeader title="Maintenance request" />
        <p className="text-sm text-zinc-500">{notFound ? "Request not found." : "Loading…"}</p>
      </>
    );
  }

  const timeline = [
    request.reportedAt != null && { label: "Reported", at: request.reportedAt },
    request.completedAt != null && { label: "Completed", at: request.completedAt },
  ].filter(Boolean) as { label: string; at: number }[];

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
      <HistoryBackLink href={`/admin/maintenance${query}`}>← Maintenance</HistoryBackLink>
      <PageHeader title={request.title || "Maintenance request"} />

      <div className="space-y-6">
        <Card className="p-4">
          <h2 className="text-sm font-semibold text-zinc-900 mb-3">Property</h2>
          <p className="text-sm text-zinc-700">
            <Link href={`/admin/properties/${request.propertyId}${query}`} className="hover:underline">
              {request.propertyDisplayLabel || request.propertyId || "—"}
            </Link>
          </p>
        </Card>

        <Card className="p-4">
          <h2 className="text-sm font-semibold text-zinc-900 mb-3">Tenant</h2>
          <p className="text-sm text-zinc-700">{request.tenantName ?? "—"}</p>
          {request.tenancyId && (
            <Link
              href={`/admin/tenancies/${request.tenancyId}${query}`}
              className="text-sm text-zinc-600 hover:underline"
            >
              View tenancy
            </Link>
          )}
        </Card>

        <Card className="p-4">
          <h2 className="text-sm font-semibold text-zinc-900 mb-3">Issue description</h2>
          <p className="text-sm text-zinc-700 whitespace-pre-wrap">{request.description ?? "—"}</p>
        </Card>

        <Card className="p-4">
          <h2 className="text-sm font-semibold text-zinc-900 mb-3">Status</h2>
          <div className="flex items-center gap-2 flex-wrap">
            <AdminStatusBadge variant={getStatusBadgeVariant(request.status, "maintenance")}>
              {MAINTENANCE_STATUS_LABELS[request.status]}
            </AdminStatusBadge>
            <select
              value={statusEdit ?? request.status}
              onChange={(e) => setStatusEdit(e.target.value as MaintenanceStatus)}
              className="rounded border border-zinc-300 bg-white px-2 py-1 text-sm"
            >
              {MAINTENANCE_STATUSES.map((s) => (
                <option key={s} value={s}>{MAINTENANCE_STATUS_LABELS[s]}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleStatusSave}
              disabled={submitting}
              className="rounded bg-zinc-800 px-3 py-1 text-sm text-white hover:bg-zinc-700 disabled:opacity-50"
            >
              Update status
            </button>
          </div>
        </Card>

        <Card className="p-4">
          <h2 className="text-sm font-semibold text-zinc-900 mb-3">Priority</h2>
          <p className="text-sm text-zinc-700">{MAINTENANCE_PRIORITY_LABELS[request.priority]}</p>
        </Card>

        <div id="assign">
          <Card className="p-4">
            <h2 className="text-sm font-semibold text-zinc-900 mb-3">Contractor assignment</h2>
          {request.contractorName && (
            <p className="text-sm text-zinc-700 mb-2">Assigned: {request.contractorName}</p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={assignContractorId}
              onChange={(e) => setAssignContractorId(e.target.value)}
              className="rounded border border-zinc-300 bg-white px-3 py-1.5 text-sm min-w-[180px]"
            >
              <option value="">— No contractor —</option>
              {contractors.map((c) => (
                <option key={c.id} value={c.id}>{c.displayName}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleAssignContractor}
              disabled={submitting}
              className="rounded bg-zinc-800 px-3 py-1.5 text-sm text-white hover:bg-zinc-700 disabled:opacity-50"
            >
              {assignContractorId ? "Assign" : "Clear"}
            </button>
          </div>
          </Card>
        </div>

        <Card className="p-4 border-dashed border-zinc-200 bg-zinc-50/50">
          <h2 className="text-sm font-semibold text-zinc-900 mb-3">Timeline</h2>
          {timeline.length === 0 ? (
            <p className="text-sm text-zinc-500">Reported: {formatAdminDate(request.reportedAt ?? request.createdAt, "dateTime")}</p>
          ) : (
            <ul className="space-y-1.5 text-sm text-zinc-700">
              {timeline.map(({ label, at }) => (
                <li key={label}>{label}: {formatAdminDate(at, "dateTime")}</li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-4 border-dashed border-zinc-200 bg-zinc-50/50">
          <h2 className="text-sm font-medium text-zinc-900 mb-2">Future extensions</h2>
          <p className="text-xs text-zinc-500 mb-2">Structure in place for: Contractor portal, photo uploads, invoice tracking, maintenance history per property, tenant reporting via tenant portal.</p>
        </Card>
      </div>
    </>
  );
}
