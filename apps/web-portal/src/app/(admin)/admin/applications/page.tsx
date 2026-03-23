"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { AdminStatusBadge } from "@/components/admin/AdminStatusBadge";
import { getStatusBadgeVariant } from "@/lib/admin/statusBadge";
import { useAuth } from "@/contexts/AuthContext";
import { formatAdminDate } from "@/lib/admin/formatAdminDate";
import {
  PIPELINE_STAGE_LABELS,
  type PipelineStage,
} from "@/lib/types/applicationPipeline";

type ApplicationRow = {
  id: string;
  agencyId: string;
  applicantId: string | null;
  applicantUserId: string | null;
  applicantName: string;
  applicantEmail: string | null;
  applicantPhone: string | null;
  propertyId: string;
  propertyDisplayLabel: string;
  stage: PipelineStage;
  notes: string | null;
  createdAt: number | null;
  lastActionAt: number | null;
  employmentStatus?: string | null;
  employerName?: string | null;
  jobTitle?: string | null;
  monthlyIncome?: number | null;
  annualIncome?: number | null;
};

type ApplicationStatusFilter =
  | ""
  | "application_submitted"
  | "under_review"
  | "referencing"
  | "approved"
  | "rejected"
  | "withdrawn";

type DateFilter = "recent" | "all";

function formatMoney(monthlyIncome?: number | null): string {
  if (monthlyIncome == null || !Number.isFinite(monthlyIncome)) return "—";
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: "GBP",
      maximumFractionDigits: 0,
    }).format(monthlyIncome);
  } catch {
    return `${monthlyIncome.toLocaleString()} /mo`;
  }
}

function formatDate(value: number | null): string {
  return formatAdminDate(value, "prettyDate");
}

const REVIEW_STAGES: PipelineStage[] = [
  "application_submitted",
  "application_created",
  "application_started",
  "under_review",
  "referencing",
  "approved",
  "rejected",
  "withdrawn",
];

export default function AdminApplicationsPage() {
  const searchParams = useSearchParams();
  const selectedAgencyId = searchParams?.get("agencyId")?.trim() ?? null;
  const { profile } = useAuth();
  const agencyId = profile?.agencyId ?? null;
  const isSuperAdmin = profile?.role === "superAdmin";
  const effectiveAgencyId = isSuperAdmin ? selectedAgencyId : agencyId;
  const pageSubtitle = "Review and manage tenant applications for listed properties.";

  const [rows, setRows] = useState<ApplicationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<ApplicationStatusFilter>("");
  const [propertyFilter, setPropertyFilter] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [dateFilter, setDateFilter] = useState<DateFilter>("recent");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const tableRef = useRef<HTMLDivElement | null>(null);

  const loadApplications = useCallback(() => {
    if (!effectiveAgencyId) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const params = new URLSearchParams();
    params.set("agencyId", effectiveAgencyId);
    params.set("limit", "120");
    params.set("applicationStagesOnly", "true");
    fetch(`/api/admin/application-pipeline?${params.toString()}`, {
      credentials: "include",
    })
      .then((res) => (res.ok ? res.json() : []))
      .then((data: ApplicationRow[]) => setRows(Array.isArray(data) ? data : []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [effectiveAgencyId]);

  useEffect(() => {
    loadApplications();
  }, [loadApplications]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const handleUpdateStage = useCallback(
    (itemId: string, newStage: PipelineStage) => {
      if (!effectiveAgencyId) return;
      setUpdatingId(itemId);
      fetch(`/api/admin/application-pipeline/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ agencyId: effectiveAgencyId, stage: newStage }),
      })
        .then(async (res) => {
          if (res.ok) {
            setToast("Status updated");
            loadApplications();
          } else {
            const data = await res.json().catch(() => ({}));
            setToast(data?.error ?? "Update failed");
          }
        })
        .catch(() => setToast("Update failed"))
        .finally(() => setUpdatingId(null));
    },
    [effectiveAgencyId, loadApplications]
  );

  const handleScrollToNew = useCallback(() => {
    tableRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  if (!effectiveAgencyId && !isSuperAdmin) {
    return (
      <>
        <AdminPageHeader title="Applications" subtitle={pageSubtitle} />
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
        <AdminPageHeader title="Applications" subtitle={pageSubtitle} />
        <EmptyState
          title="Select an agency from the header to view this page."
          description="Use the agency dropdown in the top bar."
        />
      </>
    );
  }

  const now = Date.now();
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

  const submittedApplications = rows.filter(
    (r) => r.stage === "application_submitted"
  );
  const underReviewApplications = rows.filter((r) =>
    ["under_review", "referencing", "application_created"].includes(r.stage)
  );

  const filteredRows = rows.filter((r) => {
    if (statusFilter && r.stage !== statusFilter) return false;
    if (propertyFilter && r.propertyId !== propertyFilter) return false;
    if (dateFilter === "recent") {
      const ts = r.createdAt ?? r.lastActionAt ?? null;
      if (ts == null || ts < thirtyDaysAgo) return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const name = (r.applicantName ?? "").toLowerCase();
      const email = (r.applicantEmail ?? "").toLowerCase();
      const property = (r.propertyDisplayLabel ?? "").toLowerCase();
      if (!name.includes(q) && !email.includes(q) && !property.includes(q))
        return false;
    }
    return true;
  });

  const propertyOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of rows) {
      if (!r.propertyId) continue;
      map.set(r.propertyId, r.propertyDisplayLabel);
    }
    return Array.from(map.entries());
  }, [rows]);

  const nextActionLabel =
    submittedApplications.length > 0
      ? "Review new applications"
      : underReviewApplications.length > 0
        ? "Continue application reviews"
        : "No urgent application actions right now.";

  const nextActionDescription =
    submittedApplications.length > 0
      ? "You have tenant applications awaiting review."
      : underReviewApplications.length > 0
        ? "Pick up where you left off with in-progress application reviews."
        : "You're up to date on application reviews.";

  const showScrollCta =
    submittedApplications.length > 0 || underReviewApplications.length > 0;

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
      <AdminPageHeader title="Applications" subtitle={pageSubtitle} />

      <div className="mb-4 grid gap-4 md:grid-cols-[2fr,3fr]">
        <Card className="p-4 border-amber-200 bg-amber-50/60">
          <h2 className="text-sm font-medium text-zinc-900 mb-1">
            Next recommended action
          </h2>
          <p className="text-sm text-zinc-700 mb-2">{nextActionLabel}</p>
          <p className="text-xs text-zinc-600 mb-3">{nextActionDescription}</p>
          {showScrollCta && (
            <button
              type="button"
              onClick={handleScrollToNew}
              className="inline-flex items-center rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-800"
            >
              Scroll to new applications
            </button>
          )}
        </Card>

        <Card className="p-4">
          <div className="mb-2 flex flex-wrap items-center gap-3">
            <div className="min-w-[160px] flex-1">
              <label
                htmlFor="applications-search"
                className="mb-1 block text-xs font-medium text-zinc-700"
              >
                Search
              </label>
              <input
                id="applications-search"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Applicant or property…"
                className="w-full rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm"
              />
            </div>
            <div>
              <label
                htmlFor="applications-status"
                className="mb-1 block text-xs font-medium text-zinc-700"
              >
                Status
              </label>
              <select
                id="applications-status"
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(e.target.value as ApplicationStatusFilter)
                }
                className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm"
              >
                <option value="">All</option>
                {REVIEW_STAGES.map((s) => (
                  <option key={s} value={s}>
                    {PIPELINE_STAGE_LABELS[s]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor="applications-property"
                className="mb-1 block text-xs font-medium text-zinc-700"
              >
                Property
              </label>
              <select
                id="applications-property"
                value={propertyFilter}
                onChange={(e) => setPropertyFilter(e.target.value)}
                className="min-w-[140px] rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm"
              >
                <option value="">All</option>
                {propertyOptions.map(([id, label]) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-700">
                Date
              </label>
              <div className="flex items-center gap-1 rounded-md border border-zinc-300 bg-white px-1 py-0.5">
                <button
                  type="button"
                  onClick={() => setDateFilter("recent")}
                  className={`rounded px-2 py-1 text-xs ${
                    dateFilter === "recent"
                      ? "bg-zinc-900 text-white"
                      : "text-zinc-700 hover:bg-zinc-100"
                  }`}
                >
                  Recent
                </button>
                <button
                  type="button"
                  onClick={() => setDateFilter("all")}
                  className={`rounded px-2 py-1 text-xs ${
                    dateFilter === "all"
                      ? "bg-zinc-900 text-white"
                      : "text-zinc-700 hover:bg-zinc-100"
                  }`}
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
          <p className="text-sm text-zinc-500">Loading applications…</p>
        ) : filteredRows.length === 0 ? (
          <EmptyState
            title="No applications found"
            description="Applications appear here once applicants submit forms for your listed properties."
          />
        ) : (
          <Card className="p-4 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200">
                  <th className="py-2 pr-4 text-left font-medium text-zinc-700">
                    Applicant
                  </th>
                  <th className="py-2 pr-4 text-left font-medium text-zinc-700">
                    Property
                  </th>
                  <th className="py-2 pr-4 text-left font-medium text-zinc-700">
                    Income
                  </th>
                  <th className="py-2 pr-4 text-left font-medium text-zinc-700">
                    Employment
                  </th>
                  <th className="py-2 pr-4 text-left font-medium text-zinc-700">
                    Status
                  </th>
                  <th className="py-2 pr-4 text-left font-medium text-zinc-700">
                    Submitted
                  </th>
                  <th className="py-2 text-left font-medium text-zinc-700">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((r) => {
                  const variant = getStatusBadgeVariant(r.stage, "application");
                  const isUpdating = updatingId === r.id;
                  const employerLabel =
                    r.employmentStatus === "self_employed" ||
                    r.employmentStatus === "self-employed"
                      ? "Self-employed"
                      : r.employerName || r.jobTitle || "—";
                  const submittedTs = r.createdAt ?? r.lastActionAt ?? null;
                  const canCreateOffer = ["approved", "offer_accepted", "progressed"].includes(r.stage);

                  return (
                    <tr key={r.id} className="border-b border-zinc-100">
                      <td className="py-2 pr-4 align-top">
                        <div className="flex flex-col">
                          <span className="font-medium text-zinc-900">
                            {r.applicantId ? (
                              <Link
                                href={`/admin/applicants/${r.applicantId}`}
                                className="hover:underline"
                              >
                                {r.applicantName || "Applicant"}
                              </Link>
                            ) : (
                              r.applicantName || "Applicant"
                            )}
                          </span>
                          <span className="text-xs text-zinc-600">
                            {r.applicantEmail || r.applicantPhone || "—"}
                          </span>
                        </div>
                      </td>
                      <td className="py-2 pr-4 align-top">
                        {r.propertyId ? (
                          <Link
                            href={`/admin/properties/${r.propertyId}?agencyId=${encodeURIComponent(r.agencyId)}`}
                            className="text-zinc-700 hover:underline"
                          >
                            {r.propertyDisplayLabel}
                          </Link>
                        ) : (
                          <span className="text-zinc-700">
                            {r.propertyDisplayLabel || "—"}
                          </span>
                        )}
                      </td>
                      <td className="py-2 pr-4 align-top text-zinc-900">
                        {formatMoney(r.monthlyIncome)}
                      </td>
                      <td className="py-2 pr-4 align-top text-zinc-900">
                        {employerLabel}
                      </td>
                      <td className="py-2 pr-4 align-top">
                        <AdminStatusBadge variant={variant}>
                          {PIPELINE_STAGE_LABELS[r.stage]}
                        </AdminStatusBadge>
                      </td>
                      <td className="py-2 pr-4 align-top text-zinc-900">
                        {formatDate(submittedTs)}
                      </td>
                      <td className="py-2 align-top">
                        <div className="flex flex-wrap gap-1">
                          <Link
                            href={`/admin/applications/${r.id}${effectiveAgencyId ? `?agencyId=${encodeURIComponent(effectiveAgencyId)}` : ""}`}
                            className="rounded border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100"
                          >
                            Open
                          </Link>
                          {r.applicantId && (
                            <Link
                              href={`/admin/applicants/${r.applicantId}`}
                              className="rounded border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100"
                            >
                              Applicant
                            </Link>
                          )}
                          <select
                            value={r.stage}
                            disabled={isUpdating}
                            onChange={(e) => {
                              const value = e.target
                                .value as ApplicationRow["stage"];
                              if (value) handleUpdateStage(r.id, value);
                            }}
                            className="rounded border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-700 disabled:opacity-50"
                          >
                            {REVIEW_STAGES.map((s) => (
                              <option key={s} value={s}>
                                {PIPELINE_STAGE_LABELS[s]}
                              </option>
                            ))}
                          </select>
                          {canCreateOffer && r.applicantId && (
                            <Link
                              href={`/admin/applicants/${r.applicantId}`}
                              className="rounded border border-emerald-300 px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50"
                            >
                              Create offer
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
    </>
  );
}
