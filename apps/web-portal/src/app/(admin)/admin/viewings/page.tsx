"use client";

import { useCallback, useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { formatAdminDate } from "@/lib/admin/formatAdminDate";
import { useAdminAgency } from "@/lib/admin/useAdminAgency";
import {
  VIEWING_STATUSES,
  VIEWING_STATUS_LABELS,
  type ViewingStatus,
  type ViewingSource,
} from "@/lib/types/viewing";
import { AdminStatusBadge } from "@/components/admin/AdminStatusBadge";
import { getStatusBadgeVariant } from "@/lib/admin/statusBadge";

type ViewingRow = {
  id: string;
  agencyId: string;
  propertyId: string;
  propertyDisplayLabel?: string;
  applicantId: string | null;
  applicantName: string;
  applicantEmail: string;
  applicantPhone?: string | null;
  scheduledAt: number | null;
  status: ViewingStatus;
  source: ViewingSource;
  createdBy?: string;
};

function formatDateTime(ms: number | null): string {
  return formatAdminDate(ms, "dateTime");
}

const DATE_FILTER_OPTIONS = ["upcoming", "past", "all"] as const;
type DateFilter = (typeof DATE_FILTER_OPTIONS)[number];

export default function AdminViewingsPage() {
  const searchParams = useSearchParams();
  const { effectiveAgencyId, isSuperAdmin } = useAdminAgency();

  const [viewings, setViewings] = useState<ViewingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [propertyFilter, setPropertyFilter] = useState<string>("");
  const [dateFilter, setDateFilter] = useState<DateFilter>("upcoming");
  const [searchQ, setSearchQ] = useState("");
  const [statusUpdatingId, setStatusUpdatingId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const loadViewings = useCallback(() => {
    if (!effectiveAgencyId) {
      setViewings([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const params = new URLSearchParams();
    params.set("agencyId", effectiveAgencyId);
    params.set("limit", "200");
    if (statusFilter) params.set("status", statusFilter);
    fetch(`/api/admin/viewings?${params.toString()}`, { credentials: "include" })
      .then((res) => (res.ok ? res.json() : []))
      .then((data: ViewingRow[]) => setViewings(Array.isArray(data) ? data : []))
      .catch(() => setViewings([]))
      .finally(() => setLoading(false));
  }, [effectiveAgencyId, statusFilter]);

  const handleStatusChange = useCallback(
    (viewingId: string, newStatus: ViewingStatus) => {
      if (!effectiveAgencyId) return;
      setStatusUpdatingId(viewingId);
      fetch(`/api/admin/viewings/${viewingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ agencyId: effectiveAgencyId, status: newStatus }),
      })
        .then((res) => {
          if (res.ok) {
            setToast("Status updated");
            loadViewings();
          } else {
            res.json().then((d: { error?: string }) => setToast(d?.error ?? "Update failed"));
          }
        })
        .catch(() => setToast("Update failed"))
        .finally(() => setStatusUpdatingId(null));
    },
    [effectiveAgencyId, loadViewings]
  );

  useEffect(() => {
    loadViewings();
  }, [loadViewings]);

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(t);
    }
  }, [toast]);

  const now = Date.now();
  const filtered = useMemo(() => {
    let list = viewings;
    if (propertyFilter) {
      list = list.filter((v) => v.propertyId === propertyFilter);
    }
    if (searchQ.trim()) {
      const q = searchQ.trim().toLowerCase();
      list = list.filter(
        (v) =>
          (v.applicantName && v.applicantName.toLowerCase().includes(q)) ||
          (v.applicantEmail && v.applicantEmail.toLowerCase().includes(q)) ||
          (v.propertyDisplayLabel && v.propertyDisplayLabel.toLowerCase().includes(q))
      );
    }
    if (dateFilter === "upcoming") {
      list = list.filter((v) => v.scheduledAt != null && v.scheduledAt >= now && !["cancelled", "no_show", "completed"].includes(v.status));
    } else if (dateFilter === "past") {
      list = list.filter((v) => v.scheduledAt == null || v.scheduledAt < now || ["cancelled", "no_show", "completed"].includes(v.status));
    }
    return list;
  }, [viewings, propertyFilter, searchQ, dateFilter, now]);

  const { upcoming, past } = useMemo(() => {
    const up: ViewingRow[] = [];
    const pa: ViewingRow[] = [];
    const cut = now;
    for (const v of filtered) {
      if (v.scheduledAt != null && v.scheduledAt >= cut && !["cancelled", "no_show", "completed"].includes(v.status)) {
        up.push(v);
      } else {
        pa.push(v);
      }
    }
    up.sort((a, b) => (a.scheduledAt ?? 0) - (b.scheduledAt ?? 0));
    pa.sort((a, b) => (b.scheduledAt ?? 0) - (a.scheduledAt ?? 0));
    return { upcoming: up, past: pa };
  }, [filtered, now]);

  const propertyOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const v of viewings) {
      if (v.propertyId && !seen.has(v.propertyId)) {
        seen.set(v.propertyId, v.propertyDisplayLabel ?? v.propertyId);
      }
    }
    return Array.from(seen.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [viewings]);

  const upcomingCount = viewings.filter(
    (v) => v.scheduledAt != null && v.scheduledAt >= now && !["cancelled", "no_show", "completed"].includes(v.status)
  ).length;
  const pageSubtitle = "Schedule and manage property viewings with prospective applicants.";

  if (!effectiveAgencyId && !isSuperAdmin) {
    return (
      <>
        <AdminPageHeader title="Viewings" subtitle={pageSubtitle} />
        <EmptyState title="No agency" description="Your account is not linked to an agency." />
      </>
    );
  }

  if (isSuperAdmin && !effectiveAgencyId) {
    return (
      <>
        <AdminPageHeader title="Viewings" subtitle={pageSubtitle} />
        <EmptyState
          title="Select an agency from the header to view viewings."
          description="Use the agency dropdown in the header to see viewings for that agency."
        />
      </>
    );
  }

  const query = effectiveAgencyId ? `?agencyId=${encodeURIComponent(effectiveAgencyId)}` : "";

  function TableRows({ list }: { list: ViewingRow[] }) {
    return (
      <>
        {list.map((v) => {
          const isUpdating = statusUpdatingId === v.id;
          const propLabel = v.propertyDisplayLabel ?? v.propertyId ?? "—";
          return (
            <tr key={v.id} className="border-b border-zinc-100 hover:bg-zinc-50">
              <td className="px-4 py-2">
                <span className="font-medium text-zinc-900">{v.applicantName || "—"}</span>
                {(v.applicantEmail || v.applicantPhone) && (
                  <p className="text-xs text-zinc-500 mt-0.5">
                    {[v.applicantEmail, v.applicantPhone].filter(Boolean).join(" · ")}
                  </p>
                )}
              </td>
              <td className="px-4 py-2">
                <Link href={`/admin/properties/${v.propertyId}${query}`} className="text-zinc-700 hover:underline">
                  {propLabel}
                </Link>
              </td>
              <td className="px-4 py-2 text-zinc-600">{formatDateTime(v.scheduledAt)}</td>
              <td className="px-4 py-2 text-zinc-500">—</td>
              <td className="px-4 py-2">
                <AdminStatusBadge variant={getStatusBadgeVariant(v.status, "viewing")}>
                  {VIEWING_STATUS_LABELS[v.status]}
                </AdminStatusBadge>
              </td>
              <td className="px-4 py-2">
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={v.status}
                    onChange={(e) => handleStatusChange(v.id, e.target.value as ViewingStatus)}
                    disabled={isUpdating}
                    className="rounded border border-zinc-300 px-2 py-1 text-xs font-medium bg-zinc-50 text-zinc-900 disabled:opacity-50"
                    aria-label="Update status"
                  >
                    {VIEWING_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {VIEWING_STATUS_LABELS[s]}
                      </option>
                    ))}
                  </select>
                  {v.applicantId && (
                    <Link
                      href={`/admin/applicants/${v.applicantId}${query}`}
                      className="rounded border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-700 bg-zinc-50 hover:bg-zinc-100"
                    >
                      Open applicant
                    </Link>
                  )}
                  <Link
                    href={`/admin/properties/${v.propertyId}${query}`}
                    className="rounded border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-700 bg-zinc-50 hover:bg-zinc-100"
                  >
                    Open property
                  </Link>
                </div>
              </td>
            </tr>
          );
        })}
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
      <AdminPageHeader title="Viewings" subtitle={pageSubtitle} />

      {effectiveAgencyId && (
        <Card className="mt-4 p-4 border-zinc-200 bg-zinc-50/50">
          <h2 className="text-sm font-semibold text-zinc-900">Next recommended action</h2>
          {upcomingCount > 0 ? (
            <>
              <p className="mt-1 text-sm text-zinc-700">
                You have viewings scheduled soon that may require confirmation.
              </p>
              <a href="#upcoming-viewings" className="mt-2 inline-block text-sm font-medium text-amber-700 hover:text-amber-900">
                Prepare for upcoming viewings →
              </a>
            </>
          ) : viewings.length === 0 ? (
            <>
              <p className="mt-1 text-sm text-zinc-700">Convert enquiries or applicants into property viewings.</p>
              <Link href={`/admin/applicants${query}`} className="mt-2 inline-block text-sm font-medium text-zinc-700 hover:text-zinc-900">
                Open applicants →
              </Link>
            </>
          ) : (
            <p className="mt-1 text-sm text-zinc-600">No viewings scheduled right now.</p>
          )}
        </Card>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg border border-zinc-200 bg-zinc-50/50 px-4 py-3">
        <input
          type="search"
          placeholder="Search applicant or property…"
          value={searchQ}
          onChange={(e) => setSearchQ(e.target.value)}
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 w-56 bg-white"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 bg-white"
        >
          <option value="">All statuses</option>
          {VIEWING_STATUSES.map((s) => (
            <option key={s} value={s}>
              {VIEWING_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        <select
          value={propertyFilter}
          onChange={(e) => setPropertyFilter(e.target.value)}
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 bg-white min-w-[180px]"
        >
          <option value="">All properties</option>
          {propertyOptions.map(([id, label]) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </select>
        <select
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value as DateFilter)}
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 bg-white"
        >
          <option value="upcoming">Upcoming</option>
          <option value="past">Past</option>
          <option value="all">All</option>
        </select>
      </div>

      <Card className="mt-4 overflow-hidden">
        {loading ? (
          <div className="p-4 text-sm text-zinc-500">Loading viewings…</div>
        ) : filtered.length === 0 ? (
          <EmptyState
            title={viewings.length === 0 ? "No viewings" : "No viewings match your filters"}
            description={
              viewings.length === 0
                ? "Viewings appear here when scheduled from an applicant or property."
                : "Try changing search, status, property, or date filter."
            }
            action={
              viewings.length === 0 ? (
                <Link href={`/admin/applicants${query}`} className="text-sm font-medium text-zinc-700 hover:text-zinc-900">
                  Open applicants →
                </Link>
              ) : undefined
            }
          />
        ) : (
          <>
            {upcoming.length > 0 && (
              <div id="upcoming-viewings" className="p-4 border-b border-zinc-200">
                <h2 className="text-sm font-semibold text-zinc-900">Upcoming viewings</h2>
                <p className="text-xs text-zinc-500 mt-0.5">Sorted by nearest date.</p>
                <div className="mt-3 overflow-x-auto">
                  <table className="min-w-full text-sm divide-y divide-zinc-200">
                    <thead>
                      <tr className="bg-zinc-50">
                        <th className="px-4 py-2 text-left text-xs font-medium text-zinc-500 uppercase">Applicant</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-zinc-500 uppercase">Property</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-zinc-500 uppercase">Date & time</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-zinc-500 uppercase">Assigned staff</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-zinc-500 uppercase">Status</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-zinc-500 uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      <TableRows list={upcoming} />
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            {past.length > 0 && (
              <div className="p-4">
                <h2 className="text-sm font-semibold text-zinc-900">Past viewings</h2>
                <p className="text-xs text-zinc-500 mt-0.5">Newest first.</p>
                <div className="mt-3 overflow-x-auto">
                  <table className="min-w-full text-sm divide-y divide-zinc-200">
                    <thead>
                      <tr className="bg-zinc-50">
                        <th className="px-4 py-2 text-left text-xs font-medium text-zinc-500 uppercase">Applicant</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-zinc-500 uppercase">Property</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-zinc-500 uppercase">Date & time</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-zinc-500 uppercase">Assigned staff</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-zinc-500 uppercase">Status</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-zinc-500 uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      <TableRows list={past} />
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </Card>
    </>
  );
}
