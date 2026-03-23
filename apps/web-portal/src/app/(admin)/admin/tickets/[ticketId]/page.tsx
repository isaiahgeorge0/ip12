"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { AdminSectionHeader } from "@/components/admin/AdminSectionHeader";
import { AdminStatusBadge } from "@/components/admin/AdminStatusBadge";
import { getStatusBadgeVariant } from "@/lib/admin/statusBadge";
import { formatAdminDate } from "@/lib/admin/formatAdminDate";
import { useAuth } from "@/contexts/AuthContext";
import { JOB_STATUS_LABELS, JOB_PRIORITY_LABELS } from "@/lib/types/job";
import type { JobStatus, JobPriority } from "@/lib/types/job";

type TicketStatus = "Open" | "In progress" | "Resolved";

type TicketDetail = {
  id: string;
  agencyId: string;
  propertyId: string;
  propertyDisplayLabel: string;
  landlordUid: string;
  status: TicketStatus;
  category: string;
  title: string;
  description: string;
  createdAt: number | null;
  updatedAt: number | null;
  createdByUid: string;
};

type TicketNote = {
  id: string;
  text: string;
  createdAt: unknown;
  authorUid: string;
  authorRole: string;
  authorDisplay: string | null;
};

type JobRow = {
  id: string;
  title: string;
  contractorName: string;
  contractorId: string;
  status: JobStatus;
  priority: JobPriority;
  scheduledFor: string | null;
  updatedAt: number | null;
};

function formatTicketDate(v: unknown): string {
  return formatAdminDate(v as unknown as { seconds?: number; toDate?: () => Date } | number | null | undefined, "dateTime");
}

function StatusChip({ status }: { status: string }) {
  const styles: Record<string, string> = {
    Open: "bg-amber-100 text-amber-800 border-amber-200",
    "In progress": "bg-sky-50 text-sky-800 border-sky-200",
    Resolved: "bg-zinc-100 text-zinc-700 border-zinc-200",
  };
  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${styles[status] ?? "bg-zinc-100 text-zinc-700 border-zinc-200"}`}
    >
      {status}
    </span>
  );
}

const STATUSES: TicketStatus[] = ["Open", "In progress", "Resolved"];

function formatJobScheduled(s: string | null): string {
  if (!s) return "—";
  const d = new Date(s);
  return Number.isFinite(d.getTime()) ? d.toLocaleDateString(undefined, { dateStyle: "short" }) : s;
}

export default function AdminTicketDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const ticketId = typeof params?.ticketId === "string" ? params.ticketId : "";
  const agencyIdParam = searchParams?.get("agencyId")?.trim() ?? null;
  const { profile } = useAuth();
  const sessionAgencyId = profile?.agencyId ?? null;
  const isSuperAdmin = profile?.role === "superAdmin";
  const effectiveAgencyId = isSuperAdmin ? agencyIdParam : sessionAgencyId;

  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState<TicketNote[]>([]);
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [addNoteSubmitting, setAddNoteSubmitting] = useState(false);
  const [addNoteError, setAddNoteError] = useState<string | null>(null);
  const [statusValue, setStatusValue] = useState<TicketStatus | "">("");
  const [statusSubmitting, setStatusSubmitting] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);

  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [contractors, setContractors] = useState<{ id: string; displayName: string; trade: string | null }[]>([]);
  const [assignForm, setAssignForm] = useState({
    contractorId: "",
    title: "",
    description: "",
    priority: "normal" as string,
    scheduledFor: "",
    notes: "",
  });
  const [assignSubmitting, setAssignSubmitting] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [loadingContractors, setLoadingContractors] = useState(false);

  const backHref = effectiveAgencyId
    ? `/admin/tickets?agencyId=${encodeURIComponent(effectiveAgencyId)}`
    : "/admin/tickets";

  const fetchTicket = useCallback(() => {
    if (!ticketId) return;
    setLoading(true);
    setError(null);
    const q = effectiveAgencyId ? `?agencyId=${encodeURIComponent(effectiveAgencyId)}` : "";
    fetch(`/api/admin/tickets/${encodeURIComponent(ticketId)}${q}`, { credentials: "include" })
      .then(async (res) => {
        if (!res.ok) {
          if (res.status === 404) setError("Ticket not found.");
          else setError("Failed to load ticket.");
          return null;
        }
        return res.json();
      })
      .then((data: TicketDetail | null) => {
        setTicket(data);
        if (data) setStatusValue(data.status);
      })
      .catch(() => setError("Failed to load ticket."))
      .finally(() => setLoading(false));
  }, [ticketId, effectiveAgencyId]);

  useEffect(() => {
    if (!effectiveAgencyId && !isSuperAdmin) {
      setLoading(false);
      setTicket(null);
      setError("Agency context required.");
      return;
    }
    if (effectiveAgencyId) fetchTicket();
    else {
      setLoading(false);
      setTicket(null);
      setError(null);
    }
  }, [effectiveAgencyId, isSuperAdmin, fetchTicket]);

  const fetchNotes = useCallback(() => {
    if (!ticketId || !effectiveAgencyId) return;
    setLoadingNotes(true);
    const q = `?agencyId=${encodeURIComponent(effectiveAgencyId)}`;
    fetch(`/api/admin/tickets/${encodeURIComponent(ticketId)}/notes${q}`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : []))
      .then((data: TicketNote[]) => setNotes(Array.isArray(data) ? data : []))
      .catch(() => setNotes([]))
      .finally(() => setLoadingNotes(false));
  }, [ticketId, effectiveAgencyId]);

  useEffect(() => {
    if (ticket) fetchNotes();
    else setNotes([]);
  }, [ticket, fetchNotes]);

  const fetchJobs = useCallback(() => {
    if (!ticketId || !effectiveAgencyId) return;
    setLoadingJobs(true);
    const q = `?ticketId=${encodeURIComponent(ticketId)}&agencyId=${encodeURIComponent(effectiveAgencyId)}`;
    fetch(`/api/admin/jobs${q}`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : []))
      .then((data: JobRow[]) => setJobs(Array.isArray(data) ? data : []))
      .catch(() => setJobs([]))
      .finally(() => setLoadingJobs(false));
  }, [ticketId, effectiveAgencyId]);

  useEffect(() => {
    if (ticket) fetchJobs();
    else setJobs([]);
  }, [ticket, fetchJobs]);

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(t);
    }
  }, [toast]);

  useEffect(() => {
    if (assignModalOpen && effectiveAgencyId) {
      setLoadingContractors(true);
      const q = `?agencyId=${encodeURIComponent(effectiveAgencyId)}&active=true`;
      fetch(`/api/admin/contractors${q}`, { credentials: "include" })
        .then((r) => (r.ok ? r.json() : []))
        .then((data: { id: string; displayName: string; trade: string | null }[]) =>
          setContractors(Array.isArray(data) ? data : [])
        )
        .catch(() => setContractors([]))
        .finally(() => setLoadingContractors(false));
      if (ticket) {
        setAssignForm({
          contractorId: "",
          title: ticket.title || `${ticket.category || "General"} – maintenance`,
          description: ticket.description || "",
          priority: "normal",
          scheduledFor: "",
          notes: "",
        });
      }
    }
  }, [assignModalOpen, effectiveAgencyId, ticket]);

  const handleAssignSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!ticket || !effectiveAgencyId || !assignForm.contractorId.trim()) {
        setAssignError("Select a contractor.");
        return;
      }
      setAssignSubmitting(true);
      setAssignError(null);
      fetch("/api/admin/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          agencyId: effectiveAgencyId,
          ticketId: ticket.id,
          contractorId: assignForm.contractorId.trim(),
          title: assignForm.title.trim() || ticket.title || "Maintenance",
          description: assignForm.description.trim() || undefined,
          priority: assignForm.priority || undefined,
          scheduledFor: assignForm.scheduledFor.trim() || undefined,
          notes: assignForm.notes.trim() || undefined,
        }),
      })
        .then(async (res) => {
          if (res.ok) {
            setAssignModalOpen(false);
            setAssignForm({ contractorId: "", title: "", description: "", priority: "normal", scheduledFor: "", notes: "" });
            fetchJobs();
            setToast("Job created.");
            return;
          }
          const d = await res.json().catch(() => ({}));
          setAssignError((d as { error?: string }).error ?? "Create failed");
        })
        .catch(() => setAssignError("Create failed"))
        .finally(() => setAssignSubmitting(false));
    },
    [ticket, effectiveAgencyId, assignForm, fetchJobs]
  );

  const handleAddNote = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!ticket || !noteText.trim() || !effectiveAgencyId) return;
      setAddNoteSubmitting(true);
      setAddNoteError(null);
      const q = `?agencyId=${encodeURIComponent(effectiveAgencyId)}`;
      fetch(`/api/admin/tickets/${encodeURIComponent(ticket.id)}/notes${q}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ text: noteText.trim() }),
      })
        .then(async (res) => {
          if (res.ok) {
            setNoteText("");
            fetchNotes();
            return;
          }
          const d = await res.json().catch(() => ({}));
          setAddNoteError((d as { error?: string }).error ?? "Failed to add note");
        })
        .catch(() => setAddNoteError("Failed to add note"))
        .finally(() => setAddNoteSubmitting(false));
    },
    [ticket, noteText, effectiveAgencyId, fetchNotes]
  );

  const handleStatusSave = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!ticket || statusValue === "" || statusValue === ticket.status || !effectiveAgencyId) return;
      setStatusSubmitting(true);
      setStatusError(null);
      fetch(`/api/admin/tickets/${encodeURIComponent(ticket.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status: statusValue, agencyId: effectiveAgencyId }),
      })
        .then(async (res) => {
          if (res.ok) {
            setTicket((prev) => (prev ? { ...prev, status: statusValue, updatedAt: Date.now() } : null));
            return;
          }
          const d = await res.json().catch(() => ({}));
          setStatusError((d as { error?: string }).error ?? "Update failed");
        })
        .catch(() => setStatusError("Update failed"))
        .finally(() => setStatusSubmitting(false));
    },
    [ticket, statusValue, effectiveAgencyId]
  );

  if (!ticketId) {
    return (
      <>
        <PageHeader title="Ticket" action={<Link href={backHref}>← Back to tickets</Link>} />
        <EmptyState title="Invalid ticket" description="Missing ticket ID." action={<Link href={backHref}>← Back to tickets</Link>} />
      </>
    );
  }

  if (!effectiveAgencyId && isSuperAdmin) {
    return (
      <>
        <PageHeader title="Ticket" action={<Link href={backHref}>← Back to tickets</Link>} />
        <EmptyState
          title="Select an agency from the header to view this page."
          description="Use the agency dropdown in the top bar."
          action={<Link href={backHref}>← Back to tickets</Link>}
        />
      </>
    );
  }

  if (loading && !ticket) {
    return (
      <>
        <PageHeader title="Ticket" action={<Link href={backHref}>← Back to tickets</Link>} />
        <div className="rounded-lg border border-zinc-200 bg-zinc-50/50 p-6 text-center">
          <p className="text-sm text-zinc-500">Loading ticket…</p>
        </div>
      </>
    );
  }

  if (error || !ticket) {
    return (
      <>
        <PageHeader title="Ticket" action={<Link href={backHref}>← Back to tickets</Link>} />
        <EmptyState
          title={error ?? "Ticket not found"}
          description="The ticket may have been removed or you may not have access."
          action={<Link href={backHref}>← Back to tickets</Link>}
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={ticket.title || "Ticket"}
        subtitle={`${ticket.propertyDisplayLabel} · ${ticket.id}`}
        action={
          <Link href={backHref} className="text-sm text-zinc-600 hover:underline">
            ← Back to tickets
          </Link>
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <StatusChip status={ticket.status} />
      </div>

      <Card className="p-4 mb-6">
        <AdminSectionHeader title="Summary" />
        <dl className="grid gap-2 text-sm">
          <div>
            <dt className="text-zinc-500">Property</dt>
            <dd>
              {ticket.propertyId ? (
                <Link
                  href={`/admin/properties/${ticket.propertyId}${effectiveAgencyId ? `?agencyId=${encodeURIComponent(effectiveAgencyId)}` : ""}`}
                  className="text-zinc-900 hover:underline"
                >
                  {ticket.propertyDisplayLabel}
                </Link>
              ) : (
                <span className="text-zinc-700">—</span>
              )}
            </dd>
          </div>
          {ticket.landlordUid && (
            <div>
              <dt className="text-zinc-500">Landlord UID</dt>
              <dd className="text-zinc-700">{ticket.landlordUid}</dd>
            </div>
          )}
          <div>
            <dt className="text-zinc-500">Created</dt>
            <dd className="text-zinc-700">{formatTicketDate(ticket.createdAt)}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Updated</dt>
            <dd className="text-zinc-700">{formatTicketDate(ticket.updatedAt)}</dd>
          </div>
          {ticket.createdByUid && (
            <div>
              <dt className="text-zinc-500">Created by</dt>
              <dd className="text-zinc-700">{ticket.createdByUid}</dd>
            </div>
          )}
        </dl>
      </Card>

      <Card className="p-4 mb-6">
        <AdminSectionHeader title="Issue" />
        <dl className="grid gap-2 text-sm">
          <div>
            <dt className="text-zinc-500">Category</dt>
            <dd className="text-zinc-700">{ticket.category || "General"}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Description</dt>
            <dd className="text-zinc-700 whitespace-pre-wrap">{ticket.description || "—"}</dd>
          </div>
        </dl>
      </Card>

      <Card className="p-4 mb-6">
        <AdminSectionHeader title="Notes & activity" />
        {loadingNotes ? (
          <p className="text-sm text-zinc-500">Loading notes…</p>
        ) : notes.length === 0 ? (
          <p className="text-sm text-zinc-500">No notes yet.</p>
        ) : (
          <ul className="space-y-3 mb-4">
            {notes.map((n) => (
              <li key={n.id} className="rounded-md bg-zinc-50 border border-zinc-100 px-3 py-2 text-sm">
                <p className="text-zinc-900 whitespace-pre-wrap">{n.text}</p>
                <p className="text-zinc-500 text-xs mt-1">
                  {formatTicketDate(n.createdAt)}
                  {n.authorDisplay ? ` · ${n.authorDisplay}` : n.authorUid ? ` · ${n.authorUid}` : ""}
                </p>
              </li>
            ))}
          </ul>
        )}
        <form onSubmit={handleAddNote} className="flex flex-col gap-2">
          <textarea
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="Add a note…"
            rows={2}
            maxLength={2000}
            className="block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900"
          />
          {addNoteError && (
            <p className="text-sm text-red-600" role="alert">
              {addNoteError}
            </p>
          )}
          <button
            type="submit"
            disabled={!noteText.trim() || addNoteSubmitting}
            className="self-end rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 bg-zinc-50 hover:bg-zinc-100 disabled:opacity-50"
          >
            {addNoteSubmitting ? "Adding…" : "Add note"}
          </button>
        </form>
      </Card>

      <Card className="p-4 mb-6">
        <AdminSectionHeader title="Contractor jobs" />
        <p className="text-xs text-zinc-500 mb-3">
          Maintenance jobs assigned from this ticket. Create a job to send work to a contractor.
        </p>
        {loadingJobs ? (
          <p className="text-sm text-zinc-500">Loading jobs…</p>
        ) : jobs.length === 0 ? (
          <div className="py-4">
            <p className="text-sm text-zinc-600 mb-3">No jobs linked to this ticket yet.</p>
            <button
              type="button"
              onClick={() => setAssignModalOpen(true)}
              className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
            >
              Assign contractor
            </button>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 text-left text-zinc-500">
                    <th className="py-2 pr-4">Job</th>
                    <th className="py-2 pr-4">Contractor</th>
                    <th className="py-2 pr-4">Status</th>
                    <th className="py-2 pr-4">Priority</th>
                    <th className="py-2 pr-4">Scheduled</th>
                    <th className="py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {jobs.map((j) => (
                    <tr key={j.id} className="border-b border-zinc-100">
                      <td className="py-2 pr-4 font-medium text-zinc-900">{j.title}</td>
                      <td className="py-2 pr-4 text-zinc-600">{j.contractorName}</td>
                      <td className="py-2 pr-4">
                        <AdminStatusBadge variant={getStatusBadgeVariant(j.status, "jobStatus")}>
                          {JOB_STATUS_LABELS[j.status]}
                        </AdminStatusBadge>
                      </td>
                      <td className="py-2 pr-4 text-zinc-600">{JOB_PRIORITY_LABELS[j.priority]}</td>
                      <td className="py-2 pr-4 text-zinc-600">{formatJobScheduled(j.scheduledFor)}</td>
                      <td className="py-2">
                        <Link
                          href={`/admin/jobs/${j.id}${effectiveAgencyId ? `?agencyId=${encodeURIComponent(effectiveAgencyId)}` : ""}`}
                          className="text-zinc-700 hover:underline"
                        >
                          Open job
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button
              type="button"
              onClick={() => setAssignModalOpen(true)}
              className="mt-3 rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 bg-zinc-50 hover:bg-zinc-100"
            >
              Assign another contractor
            </button>
          </>
        )}
      </Card>

      <Card className="p-4">
        <AdminSectionHeader title="Status" />
        <form onSubmit={handleStatusSave}>
          <label htmlFor="ticket-status" className="block text-sm font-medium text-zinc-700 mb-1">
            Update status
          </label>
          <select
            id="ticket-status"
            value={statusValue}
            onChange={(e) => setStatusValue(e.target.value as TicketStatus)}
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 w-full max-w-xs"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          {statusError && (
            <p className="mt-2 text-sm text-red-600" role="alert">
              {statusError}
            </p>
          )}
          <div className="mt-3 flex gap-2">
            <button
              type="submit"
              disabled={statusSubmitting || statusValue === ticket.status}
              className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
            >
              {statusSubmitting ? "Saving…" : "Save status"}
            </button>
          </div>
        </form>
      </Card>

      {toast && (
        <div className="fixed bottom-4 right-4 rounded-md bg-zinc-900 px-4 py-2 text-sm text-white shadow-lg z-20">
          {toast}
        </div>
      )}

      {assignModalOpen && (
        <div
          className="fixed inset-0 z-10 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="assign-contractor-title"
        >
          <Card className="w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h2 id="assign-contractor-title" className="text-lg font-semibold text-zinc-900">
              Assign contractor
            </h2>
            <p className="text-sm text-zinc-500 mt-1">
              Create a maintenance job from this ticket and assign it to a contractor.
            </p>
            <form onSubmit={handleAssignSubmit} className="mt-4 space-y-4">
              <div>
                <label htmlFor="assign-contractor" className="block text-sm font-medium text-zinc-700">
                  Contractor *
                </label>
                <select
                  id="assign-contractor"
                  required
                  value={assignForm.contractorId}
                  onChange={(e) => setAssignForm((p) => ({ ...p, contractorId: e.target.value }))}
                  className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900"
                >
                  <option value="">Select contractor…</option>
                  {contractors.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.displayName}
                      {c.trade ? ` (${c.trade})` : ""}
                    </option>
                  ))}
                </select>
                {contractors.length === 0 && !loadingContractors && (
                  <p className="mt-1 text-xs text-zinc-500">No active contractors. Add one from Contractors.</p>
                )}
              </div>
              <div>
                <label htmlFor="assign-title" className="block text-sm font-medium text-zinc-700">
                  Job title *
                </label>
                <input
                  id="assign-title"
                  type="text"
                  value={assignForm.title}
                  onChange={(e) => setAssignForm((p) => ({ ...p, title: e.target.value }))}
                  required
                  className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900"
                />
              </div>
              <div>
                <label htmlFor="assign-description" className="block text-sm font-medium text-zinc-700">
                  Description
                </label>
                <textarea
                  id="assign-description"
                  rows={2}
                  value={assignForm.description}
                  onChange={(e) => setAssignForm((p) => ({ ...p, description: e.target.value }))}
                  className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900"
                />
              </div>
              <div>
                <label htmlFor="assign-priority" className="block text-sm font-medium text-zinc-700">
                  Priority
                </label>
                <select
                  id="assign-priority"
                  value={assignForm.priority}
                  onChange={(e) => setAssignForm((p) => ({ ...p, priority: e.target.value }))}
                  className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900"
                >
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
              <div>
                <label htmlFor="assign-scheduled" className="block text-sm font-medium text-zinc-700">
                  Scheduled date (YYYY-MM-DD)
                </label>
                <input
                  id="assign-scheduled"
                  type="date"
                  value={assignForm.scheduledFor}
                  onChange={(e) => setAssignForm((p) => ({ ...p, scheduledFor: e.target.value }))}
                  className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900"
                />
              </div>
              <div>
                <label htmlFor="assign-notes" className="block text-sm font-medium text-zinc-700">
                  Notes
                </label>
                <textarea
                  id="assign-notes"
                  rows={2}
                  value={assignForm.notes}
                  onChange={(e) => setAssignForm((p) => ({ ...p, notes: e.target.value }))}
                  className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900"
                />
              </div>
              {assignError && (
                <p className="text-sm text-red-600" role="alert">
                  {assignError}
                </p>
              )}
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setAssignModalOpen(false)}
                  className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 bg-zinc-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={assignSubmitting || !assignForm.contractorId.trim() || !assignForm.title.trim()}
                  className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
                >
                  {assignSubmitting ? "Creating…" : "Create job"}
                </button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </>
  );
}
