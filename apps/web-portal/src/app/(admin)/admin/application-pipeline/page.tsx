"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { formatAdminDate } from "@/lib/admin/formatAdminDate";
import { useAdminAgency } from "@/lib/admin/useAdminAgency";
import {
  PIPELINE_SOURCES,
  PIPELINE_STAGES,
  PIPELINE_SOURCE_LABELS,
  PIPELINE_STAGE_LABELS,
  type PipelineStage,
  type PipelineSource,
} from "@/lib/types/applicationPipeline";
import { AdminStatusBadge } from "@/components/admin/AdminStatusBadge";
import { getStatusBadgeVariant } from "@/lib/admin/statusBadge";

type PipelineRow = {
  id: string;
  agencyId: string;
  applicantId: string | null;
  applicantUserId: string | null;
  applicantName: string;
  propertyId: string;
  propertyDisplayLabel: string;
  source: PipelineSource;
  sourceEnquiryId: string | null;
  sourceViewingId: string | null;
  applicationId: string | null;
  stage: PipelineStage;
  notes: string | null;
  createdAt: number | null;
  updatedAt: number | null;
  lastActionAt: number | null;
};

export default function AdminApplicationPipelinePage() {
  const searchParams = useSearchParams();
  const { effectiveAgencyId, isSuperAdmin } = useAdminAgency();

  const [rows, setRows] = useState<PipelineRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [stageFilter, setStageFilter] = useState<string>(() => searchParams?.get("stage") ?? "");
  const [sourceFilter, setSourceFilter] = useState<string>(() => searchParams?.get("source") ?? "");
  const [propertySearch, setPropertySearch] = useState(() => searchParams?.get("propertySearch") ?? "");
  const [applicantIdParam, setApplicantIdParam] = useState<string | null>(() => searchParams?.get("applicantId") ?? null);
  const [propertyIdParam, setPropertyIdParam] = useState<string | null>(() => searchParams?.get("propertyId") ?? null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const loadPipeline = useCallback(() => {
    if (!effectiveAgencyId) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const params = new URLSearchParams();
    params.set("agencyId", effectiveAgencyId);
    params.set("limit", "100");
    if (stageFilter) params.set("stage", stageFilter);
    if (sourceFilter) params.set("source", sourceFilter);
    if (propertySearch.trim()) params.set("propertySearch", propertySearch.trim());
    if (applicantIdParam) params.set("applicantId", applicantIdParam);
    if (propertyIdParam) params.set("propertyId", propertyIdParam);
    fetch(`/api/admin/application-pipeline?${params.toString()}`, { credentials: "include" })
      .then((res) => (res.ok ? res.json() : []))
      .then((data: PipelineRow[]) => setRows(Array.isArray(data) ? data : []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [effectiveAgencyId, stageFilter, sourceFilter, propertySearch, applicantIdParam, propertyIdParam]);

  useEffect(() => {
    loadPipeline();
  }, [loadPipeline]);

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(t);
    }
  }, [toast]);

  const handleStageUpdate = useCallback(
    (itemId: string, newStage: PipelineStage) => {
      if (!effectiveAgencyId) return;
      setUpdatingId(itemId);
      fetch(`/api/admin/application-pipeline/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ agencyId: effectiveAgencyId, stage: newStage }),
      })
        .then((res) => {
          if (res.ok) {
            setToast("Updated");
            loadPipeline();
          } else {
            res.json().then((d: { error?: string }) => setToast(d?.error ?? "Update failed"));
          }
        })
        .catch(() => setToast("Update failed"))
        .finally(() => setUpdatingId(null));
    },
    [effectiveAgencyId, loadPipeline]
  );

  const handleCreateApplication = useCallback(
    (row: PipelineRow) => {
      if (!effectiveAgencyId) return;
      setUpdatingId(row.id);
      const body = { agencyId: effectiveAgencyId };
      if (row.sourceViewingId) {
        fetch(`/api/admin/viewings/${row.sourceViewingId}/create-application`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(body),
        })
          .then(async (res) => {
            const data = await res.json().catch(() => ({}));
            if (res.ok && data.applicantId) {
              setToast(data.linked ? "Linked to existing applicant" : "Application created");
              loadPipeline();
            } else {
              setToast(data?.error ?? "Failed");
            }
          })
          .catch(() => setToast("Failed"))
          .finally(() => setUpdatingId(null));
      } else if (row.sourceEnquiryId) {
        fetch(`/api/admin/enquiries/${row.sourceEnquiryId}/convert`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(body),
        })
          .then(async (res) => {
            const data = await res.json().catch(() => ({}));
            if (res.ok && data.applicantId) {
              setToast(data.linked ? "Linked to existing applicant" : "Application created");
              loadPipeline();
            } else {
              setToast(data?.error ?? "Failed");
            }
          })
          .catch(() => setToast("Failed"))
          .finally(() => setUpdatingId(null));
      } else {
        setToast("No viewing or enquiry to create application from");
        setUpdatingId(null);
      }
    },
    [effectiveAgencyId, loadPipeline]
  );

  if (!effectiveAgencyId && !isSuperAdmin) {
    return (
      <>
        <PageHeader title="Application pipeline" />
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
        <PageHeader title="Application pipeline" />
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
      <PageHeader
        title="Application pipeline"
        subtitle="Tracks applicant progress from prompt or application through to completion."
      />
      <div className="mb-4 flex flex-wrap items-center gap-4 rounded-lg border border-zinc-200 bg-zinc-50/50 px-4 py-3">
        <div className="flex items-center gap-2">
          <label htmlFor="pipeline-stage" className="text-sm font-medium text-zinc-700">
            Stage
          </label>
          <select
            id="pipeline-stage"
            value={stageFilter}
            onChange={(e) => setStageFilter(e.target.value)}
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm bg-white"
          >
            <option value="">All</option>
            {PIPELINE_STAGES.map((s) => (
              <option key={s} value={s}>
                {PIPELINE_STAGE_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="pipeline-source" className="text-sm font-medium text-zinc-700">
            Source
          </label>
          <select
            id="pipeline-source"
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm bg-white"
          >
            <option value="">All</option>
            {PIPELINE_SOURCES.map((s) => (
              <option key={s} value={s}>
                {PIPELINE_SOURCE_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="pipeline-property-search" className="text-sm font-medium text-zinc-700">
            Property search
          </label>
          <input
            id="pipeline-property-search"
            type="text"
            value={propertySearch}
            onChange={(e) => setPropertySearch(e.target.value)}
            placeholder="Address or property id…"
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm bg-white min-w-[180px]"
          />
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-zinc-500">Loading…</p>
      ) : rows.length === 0 ? (
        <EmptyState
          title="No pipeline items"
          description="Items appear when you send a proceed prompt from a completed viewing, or create an application from a viewing or enquiry."
          action={
            <Link href={`/admin/viewings${query}`} className="text-sm font-medium text-zinc-700 hover:text-zinc-900">
              Open viewings →
            </Link>
          }
        />
      ) : (
        <Card className="p-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200">
                <th className="text-left py-2 pr-4 font-medium text-zinc-700">Applicant</th>
                <th className="text-left py-2 pr-4 font-medium text-zinc-700">Property</th>
                <th className="text-left py-2 pr-4 font-medium text-zinc-700">Stage</th>
                <th className="text-left py-2 pr-4 font-medium text-zinc-700">Source</th>
                <th className="text-left py-2 pr-4 font-medium text-zinc-700">Last action</th>
                <th className="text-left py-2 font-medium text-zinc-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const isUpdating = updatingId === r.id;
                const canCreateApp = !r.applicationId && (!!r.sourceViewingId || !!r.sourceEnquiryId);
                return (
                  <tr key={r.id} className="border-b border-zinc-100">
                    <td className="py-2 pr-4 text-zinc-900">
                      {r.applicantId ? (
                        <Link
                          href={`/admin/applicants/${r.applicantId}${query}`}
                          className="text-zinc-700 hover:underline"
                        >
                          {r.applicantName || "—"}
                        </Link>
                      ) : (
                        <span>{r.applicantName || "—"}</span>
                      )}
                    </td>
                    <td className="py-2 pr-4 text-zinc-900">
                      <Link
                        href={`/admin/properties/${r.propertyId}?agencyId=${encodeURIComponent(r.agencyId)}`}
                        className="text-zinc-700 hover:underline"
                      >
                        {r.propertyDisplayLabel}
                      </Link>
                    </td>
                    <td className="py-2 pr-4">
                      <AdminStatusBadge variant={getStatusBadgeVariant(r.stage, "pipeline")}>
                        {PIPELINE_STAGE_LABELS[r.stage]}
                      </AdminStatusBadge>
                    </td>
                    <td className="py-2 pr-4 text-zinc-600">
                      {PIPELINE_SOURCE_LABELS[r.source]}
                    </td>
                    <td className="py-2 pr-4 text-zinc-600">
                      {formatAdminDate(r.lastActionAt, "dateTime")}
                    </td>
                    <td className="py-2">
                      <div className="flex flex-wrap gap-1">
                        {r.applicantId && (
                          <Link
                            href={`/admin/applicants/${r.applicantId}${query}`}
                            className="rounded border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100"
                          >
                            View applicant
                          </Link>
                        )}
                        <Link
                          href={`/admin/properties/${r.propertyId}?agencyId=${encodeURIComponent(r.agencyId)}`}
                          className="rounded border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100"
                        >
                          View property
                        </Link>
                        {r.sourceViewingId && (
                          <Link
                            href={`/admin/viewings?agencyId=${encodeURIComponent(r.agencyId)}`}
                            className="rounded border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100"
                          >
                            View viewings
                          </Link>
                        )}
                        {canCreateApp && (
                          <button
                            type="button"
                            disabled={isUpdating}
                            onClick={() => handleCreateApplication(r)}
                            className="rounded border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-50"
                          >
                            {isUpdating ? "Creating…" : "Create application"}
                          </button>
                        )}
                        {r.stage !== "progressed" && (
                          <button
                            type="button"
                            disabled={isUpdating}
                            onClick={() => handleStageUpdate(r.id, "progressed")}
                            className="rounded border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-50"
                          >
                            Mark progressed
                          </button>
                        )}
                        {r.stage !== "withdrawn" && (
                          <button
                            type="button"
                            disabled={isUpdating}
                            onClick={() => handleStageUpdate(r.id, "withdrawn")}
                            className="rounded border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-50"
                          >
                            Mark withdrawn
                          </button>
                        )}
                        {r.stage !== "archived" && (
                          <button
                            type="button"
                            disabled={isUpdating}
                            onClick={() => handleStageUpdate(r.id, "archived")}
                            className="rounded border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-50"
                          >
                            Archive
                          </button>
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
    </>
  );
}
