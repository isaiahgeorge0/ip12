"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/Card";
import { AdminStatusBadge } from "@/components/admin/AdminStatusBadge";
import { getStatusBadgeVariant } from "@/lib/admin/statusBadge";
import { formatAdminDate } from "@/lib/admin/formatAdminDate";
import { useAuth } from "@/contexts/AuthContext";
import {
  JOB_STATUSES,
  JOB_STATUS_LABELS,
  JOB_PRIORITIES,
  JOB_PRIORITY_LABELS,
  type JobStatus,
  type JobPriority,
} from "@/lib/types/job";

type JobDetail = {
  id: string;
  agencyId: string;
  ticketId: string;
  propertyId: string | null;
  propertyDisplayLabel: string | null;
  contractorId: string;
  contractorName: string;
  title: string;
  description: string | null;
  status: JobStatus;
  priority: JobPriority;
  scheduledFor: string | null;
  completedAt: number | null;
  notes: string | null;
  createdAt: number | null;
  updatedAt: number | null;
  createdBy: string;
  updatedBy: string;
};

function formatScheduled(s: string | null): string {
  if (!s) return "—";
  const d = new Date(s);
  return Number.isFinite(d.getTime()) ? d.toLocaleDateString(undefined, { dateStyle: "short" }) : s;
}

export default function AdminJobDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const jobId = typeof params?.jobId === "string" ? params.jobId : "";
  const agencyIdParam = searchParams?.get("agencyId")?.trim() ?? null;
  const { profile } = useAuth();
  const isSuperAdmin = profile?.role === "superAdmin";
  const sessionAgencyId = profile?.agencyId ?? null;
  const effectiveAgencyId = isSuperAdmin ? agencyIdParam : sessionAgencyId;

  const [job, setJob] = useState<JobDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updateForm, setUpdateForm] = useState({
    status: "" as JobStatus | "",
    priority: "" as JobPriority | "",
    scheduledFor: "",
    notes: "",
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const backHref = effectiveAgencyId
    ? `/admin/jobs?agencyId=${encodeURIComponent(effectiveAgencyId)}`
    : "/admin/jobs";

  const load = useCallback(() => {
    if (!jobId || !effectiveAgencyId) {
      setLoading(false);
      setJob(null);
      setError(!effectiveAgencyId ? "Agency context required" : null);
      return;
    }
    setLoading(true);
    setError(null);
    const q = `?agencyId=${encodeURIComponent(effectiveAgencyId)}`;
    fetch(`/api/admin/jobs/${encodeURIComponent(jobId)}${q}`, { credentials: "include" })
      .then(async (res) => {
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          setError(d?.error ?? "Job not found");
          setJob(null);
          return;
        }
        const data = await res.json();
        setJob(data);
        setUpdateForm({
          status: data.status ?? "assigned",
          priority: data.priority ?? "normal",
          scheduledFor: data.scheduledFor ?? "",
          notes: data.notes ?? "",
        });
      })
      .catch(() => {
        setError("Failed to load");
        setJob(null);
      })
      .finally(() => setLoading(false));
  }, [jobId, effectiveAgencyId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSave = useCallback(() => {
    if (!jobId || !effectiveAgencyId || !job) return;
    setSaving(true);
    setSaveError(null);
    const q = `?agencyId=${encodeURIComponent(effectiveAgencyId)}`;
    fetch(`/api/admin/jobs/${encodeURIComponent(jobId)}${q}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        status: updateForm.status || undefined,
        priority: updateForm.priority || undefined,
        scheduledFor: updateForm.scheduledFor.trim() || null,
        notes: updateForm.notes.trim() || null,
      }),
    })
      .then(async (res) => {
        const data = await res.json();
        if (res.ok) {
          setJob(data);
          setUpdateForm({
            status: data.status ?? "",
            priority: data.priority ?? "",
            scheduledFor: data.scheduledFor ?? "",
            notes: data.notes ?? "",
          });
          return;
        }
        setSaveError(data?.error ?? "Update failed");
      })
      .catch(() => setSaveError("Update failed"))
      .finally(() => setSaving(false));
  }, [jobId, effectiveAgencyId, job, updateForm]);

  if (!effectiveAgencyId && !isSuperAdmin) {
    return (
      <>
        <PageHeader title="Job" />
        <p className="text-sm text-zinc-500 mt-4">Agency context required.</p>
      </>
    );
  }

  if (isSuperAdmin && !effectiveAgencyId) {
    return (
      <>
        <PageHeader title="Job" />
        <p className="text-sm text-zinc-500 mt-4">Select an agency from the header.</p>
      </>
    );
  }

  const query = effectiveAgencyId ? `?agencyId=${encodeURIComponent(effectiveAgencyId)}` : "";

  if (loading && !job) {
    return (
      <>
        <PageHeader title="Job" action={<Link href={backHref}>← Back to jobs</Link>} />
        <p className="text-sm text-zinc-500 mt-4">Loading…</p>
      </>
    );
  }

  if (error || !job) {
    return (
      <>
        <PageHeader title="Job" action={<Link href={backHref}>← Back to jobs</Link>} />
        <p className="text-sm text-red-600 mt-4">{error ?? "Not found"}</p>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={job.title}
        subtitle={job.propertyDisplayLabel ?? job.propertyId ?? undefined}
        action={<Link href={backHref}>← Back to jobs</Link>}
      />

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <AdminStatusBadge variant={getStatusBadgeVariant(job.status, "jobStatus")}>
          {JOB_STATUS_LABELS[job.status]}
        </AdminStatusBadge>
        <AdminStatusBadge variant={getStatusBadgeVariant(job.priority, "jobPriority")}>
          {JOB_PRIORITY_LABELS[job.priority]}
        </AdminStatusBadge>
      </div>

      <Card className="mt-4">
        <h2 className="text-sm font-semibold text-zinc-900">Summary</h2>
        <dl className="mt-2 grid gap-2 sm:grid-cols-2 text-sm">
          <div>
            <dt className="text-zinc-500">Contractor</dt>
            <dd>
              <Link
                href={`/admin/contractors/${job.contractorId}${query}`}
                className="text-zinc-900 hover:underline"
              >
                {job.contractorName}
              </Link>
            </dd>
          </div>
          <div>
            <dt className="text-zinc-500">Ticket</dt>
            <dd>
              <Link
                href={`/admin/tickets/${job.ticketId}${query}`}
                className="text-zinc-900 hover:underline"
              >
                View ticket
              </Link>
            </dd>
          </div>
          <div>
            <dt className="text-zinc-500">Property</dt>
            <dd>
              {job.propertyId ? (
                <Link
                  href={`/admin/properties/${job.propertyId}${query}`}
                  className="text-zinc-900 hover:underline"
                >
                  {job.propertyDisplayLabel ?? job.propertyId}
                </Link>
              ) : (
                  job.propertyDisplayLabel ?? "—"
                )}
            </dd>
          </div>
          <div>
            <dt className="text-zinc-500">Created</dt>
            <dd className="text-zinc-900">{formatAdminDate(job.createdAt, "dateTime")}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Updated</dt>
            <dd className="text-zinc-900">{formatAdminDate(job.updatedAt, "dateTime")}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Scheduled</dt>
            <dd className="text-zinc-900">{formatScheduled(job.scheduledFor)}</dd>
          </div>
          {job.completedAt != null && (
            <div>
              <dt className="text-zinc-500">Completed</dt>
              <dd className="text-zinc-900">{formatAdminDate(job.completedAt, "dateTime")}</dd>
            </div>
          )}
        </dl>
      </Card>

      {(job.description || job.notes) && (
        <Card className="mt-4">
          <h2 className="text-sm font-semibold text-zinc-900">Work details</h2>
          {job.description && (
            <p className="mt-2 text-sm text-zinc-700 whitespace-pre-wrap">{job.description}</p>
          )}
          {job.notes && (
            <p className="mt-2 text-sm text-zinc-600 whitespace-pre-wrap border-t border-zinc-100 pt-2">
              {job.notes}
            </p>
          )}
        </Card>
      )}

      <Card className="mt-4">
        <h2 className="text-sm font-semibold text-zinc-900">Update</h2>
        <p className="text-xs text-zinc-500 mt-0.5">
          Change status, priority, scheduled date, or notes.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="job-status" className="block text-xs font-medium text-zinc-500">
              Status
            </label>
            <select
              id="job-status"
              value={updateForm.status}
              onChange={(e) => setUpdateForm((p) => ({ ...p, status: e.target.value as JobStatus }))}
              className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900"
            >
              {JOB_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {JOB_STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="job-priority" className="block text-xs font-medium text-zinc-500">
              Priority
            </label>
            <select
              id="job-priority"
              value={updateForm.priority}
              onChange={(e) => setUpdateForm((p) => ({ ...p, priority: e.target.value as JobPriority }))}
              className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900"
            >
              {JOB_PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {JOB_PRIORITY_LABELS[p]}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="job-scheduled" className="block text-xs font-medium text-zinc-500">
              Scheduled date (YYYY-MM-DD)
            </label>
            <input
              id="job-scheduled"
              type="date"
              value={updateForm.scheduledFor}
              onChange={(e) => setUpdateForm((p) => ({ ...p, scheduledFor: e.target.value }))}
              className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900"
            />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="job-notes" className="block text-xs font-medium text-zinc-500">
              Notes
            </label>
            <textarea
              id="job-notes"
              rows={3}
              value={updateForm.notes}
              onChange={(e) => setUpdateForm((p) => ({ ...p, notes: e.target.value }))}
              className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900"
            />
          </div>
        </div>
        {saveError && (
          <p className="mt-2 text-sm text-red-600" role="alert">
            {saveError}
          </p>
        )}
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="mt-4 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </Card>
    </>
  );
}
