"use client";

import { useCallback, useEffect, useState } from "react";
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
  MAINTENANCE_STATUSES,
  MAINTENANCE_STATUS_LABELS,
  MAINTENANCE_PRIORITIES,
  MAINTENANCE_PRIORITY_LABELS,
  type MaintenanceStatus,
  type MaintenancePriority,
} from "@/lib/types/maintenanceRequest";
import type { MaintenanceListItem } from "@/app/api/admin/maintenance/route";

export default function AdminMaintenancePage() {
  const searchParams = useSearchParams();
  const { effectiveAgencyId, isSuperAdmin } = useAdminAgency();
  const pageSubtitle = "Track repair requests and property issues.";

  const [requests, setRequests] = useState<MaintenanceListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const loadRequests = useCallback(() => {
    if (!effectiveAgencyId) {
      setRequests([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const params = new URLSearchParams();
    params.set("agencyId", effectiveAgencyId);
    if (statusFilter) params.set("status", statusFilter);
    if (priorityFilter) params.set("priority", priorityFilter);
    fetch(`/api/admin/maintenance?${params}`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : []))
      .then((data: MaintenanceListItem[]) => setRequests(Array.isArray(data) ? data : []))
      .catch(() => setRequests([]))
      .finally(() => setLoading(false));
  }, [effectiveAgencyId, statusFilter, priorityFilter]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const handleStatusChange = useCallback(
    (requestId: string, newStatus: MaintenanceStatus) => {
      if (!effectiveAgencyId) return;
      setUpdatingId(requestId);
      fetch(`/api/admin/maintenance/${requestId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ agencyId: effectiveAgencyId, status: newStatus }),
      })
        .then(async (res) => {
          if (res.ok) {
            setToast("Status updated");
            loadRequests();
          } else {
            const data = await res.json().catch(() => ({}));
            setToast((data?.error as string) ?? "Update failed");
          }
        })
        .catch(() => setToast("Update failed"))
        .finally(() => setUpdatingId(null));
    },
    [effectiveAgencyId, loadRequests]
  );

  if (!effectiveAgencyId && !isSuperAdmin) {
    return (
      <>
        <AdminPageHeader title="Maintenance" subtitle={pageSubtitle} />
        <EmptyState title="No agency" description="Your account is not linked to an agency." />
      </>
    );
  }

  if (isSuperAdmin && !effectiveAgencyId) {
    return (
      <>
        <AdminPageHeader title="Maintenance" subtitle={pageSubtitle} />
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
      <AdminPageHeader title="Maintenance" subtitle={pageSubtitle} />

      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-zinc-200 bg-zinc-50/50 px-4 py-3">
        <div>
          <label htmlFor="maint-status" className="mb-1 block text-xs font-medium text-zinc-700">
            Status
          </label>
          <select
            id="maint-status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm"
          >
            <option value="">All</option>
            {MAINTENANCE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {MAINTENANCE_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="maint-priority" className="mb-1 block text-xs font-medium text-zinc-700">
            Priority
          </label>
          <select
            id="maint-priority"
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm"
          >
            <option value="">All</option>
            {MAINTENANCE_PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {MAINTENANCE_PRIORITY_LABELS[p]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-zinc-500">Loading…</p>
      ) : requests.length === 0 ? (
        <EmptyState
          title="No maintenance requests"
          description="Maintenance requests will appear here when created for a property and tenancy."
        />
      ) : (
        <Card className="p-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200">
                <th className="py-2 pr-4 text-left font-medium text-zinc-700">Property</th>
                <th className="py-2 pr-4 text-left font-medium text-zinc-700">Tenant</th>
                <th className="py-2 pr-4 text-left font-medium text-zinc-700">Issue</th>
                <th className="py-2 pr-4 text-left font-medium text-zinc-700">Priority</th>
                <th className="py-2 pr-4 text-left font-medium text-zinc-700">Status</th>
                <th className="py-2 pr-4 text-left font-medium text-zinc-700">Reported date</th>
                <th className="py-2 text-left font-medium text-zinc-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((r) => {
                const isUpdating = updatingId === r.id;
                return (
                  <tr key={r.id} className="border-b border-zinc-100">
                    <td className="py-2 pr-4 align-top">
                      <Link
                        href={`/admin/properties/${r.propertyId}${query}`}
                        className="text-zinc-700 hover:underline"
                      >
                        {r.propertyDisplayLabel || r.propertyId || "—"}
                      </Link>
                    </td>
                    <td className="py-2 pr-4 align-top text-zinc-900">
                      {r.tenantName ?? "—"}
                    </td>
                    <td className="py-2 pr-4 align-top text-zinc-900">
                      {r.title || "—"}
                    </td>
                    <td className="py-2 pr-4 align-top text-zinc-600">
                      {MAINTENANCE_PRIORITY_LABELS[r.priority]}
                    </td>
                    <td className="py-2 pr-4 align-top">
                      <AdminStatusBadge variant={getStatusBadgeVariant(r.status, "maintenance")}>
                        {MAINTENANCE_STATUS_LABELS[r.status]}
                      </AdminStatusBadge>
                      <select
                        value={r.status}
                        disabled={isUpdating}
                        onChange={(e) => handleStatusChange(r.id, e.target.value as MaintenanceStatus)}
                        className="mt-1 block rounded border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-700 disabled:opacity-50"
                        aria-label="Update status"
                      >
                        {MAINTENANCE_STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {MAINTENANCE_STATUS_LABELS[s]}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2 pr-4 align-top text-zinc-600">
                      {formatAdminDate(r.reportedAt ?? r.createdAt, "prettyDate")}
                    </td>
                    <td className="py-2 align-top">
                      <div className="flex flex-wrap gap-1">
                        <Link
                          href={`/admin/maintenance/${r.id}${query}`}
                          className="rounded border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100"
                        >
                          Open request
                        </Link>
                        <Link
                          href={`/admin/maintenance/${r.id}${query}#assign`}
                          className="rounded border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100"
                        >
                          Assign contractor
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
    </>
  );
}
