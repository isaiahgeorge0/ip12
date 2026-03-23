"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { AdminStatusBadge } from "@/components/admin/AdminStatusBadge";
import { getStatusBadgeVariant } from "@/lib/admin/statusBadge";
import { formatAdminDate } from "@/lib/admin/formatAdminDate";
import { useAuth } from "@/contexts/AuthContext";
import { CONTRACTOR_TRADES } from "@/lib/types/contractor";
import { JOB_STATUS_LABELS, JOB_PRIORITY_LABELS } from "@/lib/types/job";
import type { JobStatus, JobPriority } from "@/lib/types/job";

type ContractorDetail = {
  id: string;
  agencyId: string;
  displayName: string;
  companyName: string | null;
  email: string | null;
  phone: string | null;
  trade: string | null;
  skills: string[];
  coverageAreas: string[];
  isActive: boolean;
  notes: string | null;
  createdAt: number | null;
  updatedAt: number | null;
  jobsCount: number;
};

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
  if (!s) return "—";
  const d = new Date(s);
  return Number.isFinite(d.getTime()) ? d.toLocaleDateString(undefined, { dateStyle: "short" }) : s;
}

export default function AdminContractorDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const contractorId = typeof params?.contractorId === "string" ? params.contractorId : "";
  const agencyIdParam = searchParams?.get("agencyId")?.trim() ?? null;
  const { profile } = useAuth();
  const isSuperAdmin = profile?.role === "superAdmin";
  const sessionAgencyId = profile?.agencyId ?? null;
  const effectiveAgencyId = isSuperAdmin ? agencyIdParam : sessionAgencyId;

  const [contractor, setContractor] = useState<ContractorDetail | null>(null);
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState({
    displayName: "",
    companyName: "",
    email: "",
    phone: "",
    trade: "",
    skills: "",
    coverageAreas: "",
    isActive: true,
    notes: "",
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const backHref = effectiveAgencyId
    ? `/admin/contractors?agencyId=${encodeURIComponent(effectiveAgencyId)}`
    : "/admin/contractors";

  const load = useCallback(() => {
    if (!contractorId || !effectiveAgencyId) {
      setLoading(false);
      setContractor(null);
      setJobs([]);
      setError(!effectiveAgencyId ? "Agency context required" : null);
      return;
    }
    setLoading(true);
    setError(null);
    const q = `?agencyId=${encodeURIComponent(effectiveAgencyId)}`;
    Promise.all([
      fetch(`/api/admin/contractors/${encodeURIComponent(contractorId)}${q}`, { credentials: "include" }),
      fetch(`/api/admin/jobs?contractorId=${encodeURIComponent(contractorId)}&agencyId=${encodeURIComponent(effectiveAgencyId)}`, {
        credentials: "include",
      }),
    ])
      .then(async ([r1, r2]) => {
        if (!r1.ok) {
          const d = await r1.json().catch(() => ({}));
          setError(d?.error ?? "Contractor not found");
          setContractor(null);
          setJobs([]);
          return;
        }
        const c = await r1.json();
        setContractor(c);
        setEditForm({
          displayName: c.displayName ?? "",
          companyName: c.companyName ?? "",
          email: c.email ?? "",
          phone: c.phone ?? "",
          trade: c.trade ?? "",
          skills: Array.isArray(c.skills) ? c.skills.join(", ") : "",
          coverageAreas: Array.isArray(c.coverageAreas) ? c.coverageAreas.join(", ") : "",
          isActive: c.isActive !== false,
          notes: c.notes ?? "",
        });
        const jobList = r2.ok ? await r2.json() : [];
        setJobs(Array.isArray(jobList) ? jobList : []);
      })
      .catch(() => {
        setError("Failed to load");
        setContractor(null);
        setJobs([]);
      })
      .finally(() => setLoading(false));
  }, [contractorId, effectiveAgencyId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSave = useCallback(() => {
    if (!contractorId || !effectiveAgencyId) return;
    setSaving(true);
    setSaveError(null);
    const skills = editForm.skills.split(/[,;]/).map((s) => s.trim()).filter(Boolean);
    const coverageAreas = editForm.coverageAreas.split(/[,;]/).map((s) => s.trim()).filter(Boolean);
    const q = `?agencyId=${encodeURIComponent(effectiveAgencyId)}`;
    fetch(`/api/admin/contractors/${encodeURIComponent(contractorId)}${q}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        displayName: editForm.displayName.trim(),
        companyName: editForm.companyName.trim() || null,
        email: editForm.email.trim() || null,
        phone: editForm.phone.trim() || null,
        trade: editForm.trade.trim() || null,
        skills,
        coverageAreas,
        isActive: editForm.isActive,
        notes: editForm.notes.trim() || null,
      }),
    })
      .then(async (res) => {
        const data = await res.json();
        if (res.ok) {
          setContractor((prev) =>
            prev
              ? {
                  ...prev,
                  displayName: data.displayName ?? prev.displayName,
                  companyName: data.companyName ?? prev.companyName,
                  email: data.email ?? prev.email,
                  phone: data.phone ?? prev.phone,
                  trade: data.trade ?? prev.trade,
                  skills: Array.isArray(data.skills) ? data.skills : prev.skills,
                  coverageAreas: Array.isArray(data.coverageAreas) ? data.coverageAreas : prev.coverageAreas,
                  isActive: data.isActive !== false,
                  notes: data.notes ?? prev.notes,
                }
              : null
          );
          setEditMode(false);
          return;
        }
        setSaveError(data?.error ?? "Update failed");
      })
      .catch(() => setSaveError("Update failed"))
      .finally(() => setSaving(false));
  }, [contractorId, effectiveAgencyId, editForm]);

  if (!effectiveAgencyId && !isSuperAdmin) {
    return (
      <>
        <PageHeader title="Contractor" />
        <EmptyState title="No agency" description="Your account is not linked to an agency." />
      </>
    );
  }

  if (isSuperAdmin && !effectiveAgencyId) {
    return (
      <>
        <PageHeader title="Contractor" />
        <EmptyState
          title="Select an agency from the header to view this page."
          description="Use the agency dropdown in the top bar."
        />
      </>
    );
  }

  const query = effectiveAgencyId ? `?agencyId=${encodeURIComponent(effectiveAgencyId)}` : "";

  if (loading && !contractor) {
    return (
      <>
        <PageHeader title="Contractor" action={<Link href={backHref}>← Back to contractors</Link>} />
        <p className="text-sm text-zinc-500 mt-4">Loading…</p>
      </>
    );
  }

  if (error || !contractor) {
    return (
      <>
        <PageHeader title="Contractor" action={<Link href={backHref}>← Back to contractors</Link>} />
        <EmptyState title={error ?? "Not found"} description="This contractor may have been removed." />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={contractor.displayName}
        subtitle={
          [
            contractor.trade,
            contractor.companyName,
            contractor.email || contractor.phone,
          ]
            .filter(Boolean)
            .join(" · ") || undefined
        }
        action={<Link href={backHref}>← Back to contractors</Link>}
      />

      <Card className="mt-4">
        <h2 className="text-sm font-semibold text-zinc-900">Summary</h2>
        <dl className="mt-2 grid gap-2 sm:grid-cols-2 text-sm">
          <div>
            <dt className="text-zinc-500">Email</dt>
            <dd className="text-zinc-900">{contractor.email ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Phone</dt>
            <dd className="text-zinc-900">{contractor.phone ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Trade</dt>
            <dd className="text-zinc-900">{contractor.trade ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Status</dt>
            <dd>
              <AdminStatusBadge variant={getStatusBadgeVariant(contractor.isActive ? "active" : "inactive", "contractor")}>
                {contractor.isActive ? "Active" : "Inactive"}
              </AdminStatusBadge>
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-zinc-500">Coverage areas</dt>
            <dd className="text-zinc-900">
              {contractor.coverageAreas.length ? contractor.coverageAreas.join(", ") : "—"}
            </dd>
          </div>
          {contractor.notes && (
            <div className="sm:col-span-2">
              <dt className="text-zinc-500">Notes</dt>
              <dd className="text-zinc-900 whitespace-pre-wrap">{contractor.notes}</dd>
            </div>
          )}
        </dl>

        {!editMode ? (
          <button
            type="button"
            onClick={() => setEditMode(true)}
            className="mt-4 rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 bg-zinc-50 hover:bg-zinc-100"
          >
            Edit
          </button>
        ) : (
          <div className="mt-4 pt-4 border-t border-zinc-200 space-y-3">
            <div>
              <label className="block text-xs font-medium text-zinc-500">Name</label>
              <input
                type="text"
                value={editForm.displayName}
                onChange={(e) => setEditForm((p) => ({ ...p, displayName: e.target.value }))}
                className="mt-0.5 block w-full rounded border border-zinc-300 px-2 py-1.5 text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-zinc-500">Email</label>
                <input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm((p) => ({ ...p, email: e.target.value }))}
                  className="mt-0.5 block w-full rounded border border-zinc-300 px-2 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-500">Phone</label>
                <input
                  type="text"
                  value={editForm.phone}
                  onChange={(e) => setEditForm((p) => ({ ...p, phone: e.target.value }))}
                  className="mt-0.5 block w-full rounded border border-zinc-300 px-2 py-1.5 text-sm"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-500">Trade</label>
              <select
                value={editForm.trade}
                onChange={(e) => setEditForm((p) => ({ ...p, trade: e.target.value }))}
                className="mt-0.5 block w-full rounded border border-zinc-300 px-2 py-1.5 text-sm"
              >
                <option value="">—</option>
                {CONTRACTOR_TRADES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-500">Skills (comma-separated)</label>
              <input
                type="text"
                value={editForm.skills}
                onChange={(e) => setEditForm((p) => ({ ...p, skills: e.target.value }))}
                className="mt-0.5 block w-full rounded border border-zinc-300 px-2 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-500">Coverage areas (comma-separated)</label>
              <input
                type="text"
                value={editForm.coverageAreas}
                onChange={(e) => setEditForm((p) => ({ ...p, coverageAreas: e.target.value }))}
                className="mt-0.5 block w-full rounded border border-zinc-300 px-2 py-1.5 text-sm"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="edit-active"
                checked={editForm.isActive}
                onChange={(e) => setEditForm((p) => ({ ...p, isActive: e.target.checked }))}
                className="rounded border-zinc-300"
              />
              <label htmlFor="edit-active" className="text-sm text-zinc-700">
                Active
              </label>
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-500">Notes</label>
              <textarea
                rows={2}
                value={editForm.notes}
                onChange={(e) => setEditForm((p) => ({ ...p, notes: e.target.value }))}
                className="mt-0.5 block w-full rounded border border-zinc-300 px-2 py-1.5 text-sm"
              />
            </div>
            {saveError && (
              <p className="text-sm text-red-600" role="alert">
                {saveError}
              </p>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setEditMode(false)}
                className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 bg-zinc-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || !editForm.displayName.trim()}
                className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        )}
      </Card>

      <Card className="mt-4">
        <h2 className="text-sm font-semibold text-zinc-900">Jobs</h2>
        <p className="text-xs text-zinc-500 mt-0.5">
          Maintenance jobs assigned to this contractor.
        </p>
        {jobs.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500">No jobs yet.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-left text-zinc-500">
                  <th className="py-2 pr-4">Job</th>
                  <th className="py-2 pr-4">Property</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4">Priority</th>
                  <th className="py-2 pr-4">Scheduled</th>
                  <th className="py-2">Updated</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((j) => (
                  <tr key={j.id} className="border-b border-zinc-100">
                    <td className="py-2 pr-4">
                      <Link
                        href={`/admin/jobs/${j.id}${query}`}
                        className="font-medium text-zinc-900 hover:underline"
                      >
                        {j.title}
                      </Link>
                    </td>
                    <td className="py-2 pr-4 text-zinc-600">
                      {j.propertyDisplayLabel ?? j.propertyId ?? "—"}
                    </td>
                    <td className="py-2 pr-4">
                      <AdminStatusBadge variant={getStatusBadgeVariant(j.status, "jobStatus")}>
                        {JOB_STATUS_LABELS[j.status]}
                      </AdminStatusBadge>
                    </td>
                    <td className="py-2 pr-4 text-zinc-600">{JOB_PRIORITY_LABELS[j.priority]}</td>
                    <td className="py-2 pr-4 text-zinc-600">{formatScheduled(j.scheduledFor)}</td>
                    <td className="py-2 text-zinc-500">{formatAdminDate(j.updatedAt, "dateTime")}</td>
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
