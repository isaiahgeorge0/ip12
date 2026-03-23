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
import { useAuth } from "@/contexts/AuthContext";
import { JOB_STATUSES, JOB_STATUS_LABELS, JOB_PRIORITIES, JOB_PRIORITY_LABELS } from "@/lib/types/job";
import type { JobStatus, JobPriority } from "@/lib/types/job";

type JobRow = {
  id: string;
  title: string;
  contractorName: string;
  contractorId: string;
  propertyDisplayLabel: string | null;
  propertyId: string | null;
  ticketId: string;
  status: JobStatus;
  priority: JobPriority;
  scheduledFor: string | null;
  updatedAt: number | null;
  createdAt: number | null;
};

function formatScheduled(s: string | null): string {
  return formatAdminDate(s, "date");
}

export default function AdminJobsPage() {
  const { profile } = useAuth();
  const searchParams = useSearchParams();
  const agencyIdParam = searchParams?.get("agencyId")?.trim() ?? null;
  const isSuperAdmin = profile?.role === "superAdmin";
  const sessionAgencyId = profile?.agencyId ?? null;
  const effectiveAgencyId = isSuperAdmin ? agencyIdParam : sessionAgencyId;
  const pageSubtitle = "Contractor assignments created from tickets.";

  const [list, setList] = useState<JobRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");

  const loadJobs = useCallback(() => {
    if (!effectiveAgencyId) {
      setLoading(false);
      setList([]);
      return;
    }
    setLoading(true);
    const params = new URLSearchParams();
    params.set("agencyId", effectiveAgencyId);
    if (q.trim()) params.set("q", q.trim());
    if (statusFilter) params.set("status", statusFilter);
    if (priorityFilter) params.set("priority", priorityFilter);
    fetch(`/api/admin/jobs?${params}`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : []))
      .then((data: JobRow[]) => setList(Array.isArray(data) ? data : []))
      .catch(() => setList([]))
      .finally(() => setLoading(false));
  }, [effectiveAgencyId, q, statusFilter, priorityFilter]);

  useEffect(() => {
    loadJobs();
  }, [loadJobs]);

  if (!effectiveAgencyId && !isSuperAdmin) {
    return (
      <>
        <AdminPageHeader title="Maintenance jobs" subtitle={pageSubtitle} />
        <EmptyState title="No agency" description="Your account is not linked to an agency." />
      </>
    );
  }

  if (isSuperAdmin && !effectiveAgencyId) {
    return (
      <>
        <AdminPageHeader title="Maintenance jobs" subtitle={pageSubtitle} />
        <EmptyState
          title="Select an agency from the header to view this page."
          description="Use the agency dropdown in the top bar."
        />
      </>
    );
  }

  const query = effectiveAgencyId ? `?agencyId=${encodeURIComponent(effectiveAgencyId)}` : "";
  const hasFilters = q || statusFilter || priorityFilter;

  return (
    <>
      <AdminPageHeader title="Maintenance jobs" subtitle={pageSubtitle} />

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <input
          type="search"
          placeholder="Search…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-900 w-48"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-900"
        >
          <option value="">All statuses</option>
          {JOB_STATUSES.map((s) => (
            <option key={s} value={s}>
              {JOB_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-900"
        >
          <option value="">All priorities</option>
          {JOB_PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {JOB_PRIORITY_LABELS[p]}
            </option>
          ))}
        </select>
      </div>

      <Card className="mt-4 overflow-hidden">
        {loading && (
          <div className="p-4 text-sm text-zinc-500">
            Loading jobs…
          </div>
        )}
        {!loading && list.length === 0 && !hasFilters && (
          <EmptyState
            title="No maintenance jobs yet"
            description="Assign contractors to tickets from a ticket detail page to create jobs."
          />
        )}
        {!loading && list.length === 0 && hasFilters && (
          <EmptyState
            title="No jobs match your filters"
            description="Try changing search, status, or priority."
          />
        )}
        {!loading && list.length > 0 && (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-zinc-200">
              <thead>
                <tr className="bg-zinc-50">
                  <th className="px-4 py-2 text-left text-xs font-medium text-zinc-500 uppercase">Job</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-zinc-500 uppercase">Property</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-zinc-500 uppercase">Contractor</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-zinc-500 uppercase">Status</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-zinc-500 uppercase">Priority</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-zinc-500 uppercase">Scheduled</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-zinc-500 uppercase">Updated</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-zinc-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                {list.map((j) => (
                  <tr key={j.id} className="hover:bg-zinc-50">
                    <td className="px-4 py-2">
                      <Link
                        href={`/admin/jobs/${j.id}${query}`}
                        className="font-medium text-zinc-900 hover:underline"
                      >
                        {j.title}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-sm text-zinc-600">
                      {j.propertyDisplayLabel ?? j.propertyId ?? "—"}
                    </td>
                    <td className="px-4 py-2 text-sm">
                      <Link
                        href={`/admin/contractors/${j.contractorId}${query}`}
                        className="text-zinc-700 hover:underline"
                      >
                        {j.contractorName}
                      </Link>
                    </td>
                    <td className="px-4 py-2">
                      <AdminStatusBadge variant={getStatusBadgeVariant(j.status, "jobStatus")}>
                        {JOB_STATUS_LABELS[j.status]}
                      </AdminStatusBadge>
                    </td>
                    <td className="px-4 py-2 text-sm text-zinc-600">
                      <AdminStatusBadge variant={getStatusBadgeVariant(j.priority, "jobPriority")}>
                        {JOB_PRIORITY_LABELS[j.priority]}
                      </AdminStatusBadge>
                    </td>
                    <td className="px-4 py-2 text-sm text-zinc-600">{formatScheduled(j.scheduledFor)}</td>
                    <td className="px-4 py-2 text-sm text-zinc-500">{formatAdminDate(j.updatedAt, "dateTime")}</td>
                    <td className="px-4 py-2 text-right">
                      <Link
                        href={`/admin/jobs/${j.id}${query}`}
                        className="rounded-md border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-700 bg-zinc-50 hover:bg-zinc-100"
                      >
                        Open job
                      </Link>
                      <Link
                        href={`/admin/tickets/${j.ticketId}${query}`}
                        className="ml-1 rounded-md border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-700 bg-zinc-50 hover:bg-zinc-100"
                      >
                        Open ticket
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
