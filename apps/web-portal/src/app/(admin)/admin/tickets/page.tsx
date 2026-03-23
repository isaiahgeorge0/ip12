"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/contexts/AuthContext";
import { AdminCreateTicketModal } from "@/components/admin/AdminCreateTicketModal";
import { formatAdminDate } from "@/lib/admin/formatAdminDate";

type TicketStatus = "Open" | "In progress" | "Resolved";

type Ticket = {
  id: string;
  agencyId: string;
  propertyId: string;
  landlordUid: string;
  status: TicketStatus;
  category: string;
  title: string;
  description: string;
  createdAt: unknown;
  updatedAt: unknown;
};

function formatTicketDate(v: unknown): string {
  return formatAdminDate(
    v as unknown as number | string | { seconds?: number; toDate?: () => Date } | null | undefined,
    "date"
  );
}

type TicketNote = {
  id: string;
  text: string;
  createdAt: unknown;
  authorUid: string;
  authorRole: string;
  authorAgencyId: string | null;
  authorDisplay: string | null;
};

function StatusChip({ status }: { status: string }) {
  const styles: Record<string, string> = {
    Open: "bg-amber-100 text-amber-800",
    "In progress": "bg-blue-100 text-blue-800",
    Resolved: "bg-zinc-100 text-zinc-700",
  };
  return (
    <span
      className={`rounded px-2 py-0.5 text-xs font-medium ${styles[status] ?? "bg-zinc-100 text-zinc-700"}`}
    >
      {status}
    </span>
  );
}

const STATUSES: TicketStatus[] = ["Open", "In progress", "Resolved"];

export default function AdminTicketsPage() {
  const { profile } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailTicket, setDetailTicket] = useState<Ticket | null>(null);
  const [detailStatus, setDetailStatus] = useState<TicketStatus | "">("");
  const [submitting, setSubmitting] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [notes, setNotes] = useState<TicketNote[]>([]);
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [addNoteSubmitting, setAddNoteSubmitting] = useState(false);
  const [addNoteError, setAddNoteError] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);

  const searchParams = useSearchParams();
  const agencyIdParam = searchParams?.get("agencyId")?.trim() ?? null;
  const sessionAgencyId = profile?.agencyId ?? null;
  const isSuperAdmin = profile?.role === "superAdmin";
  const agencyId = isSuperAdmin ? agencyIdParam : sessionAgencyId;
  const pageSubtitle = "Track and resolve maintenance tickets.";

  const loadTickets = useCallback(() => {
    if (!agencyId) {
      setLoading(false);
      setTickets([]);
      return;
    }
    const q = `?agencyId=${encodeURIComponent(agencyId)}`;
    fetch(`/api/admin/tickets${q}`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : []))
      .then((data: Ticket[]) => setTickets(Array.isArray(data) ? data : []))
      .catch(() => setTickets([]))
      .finally(() => setLoading(false));
  }, [agencyId]);

  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  const openDetail = useCallback((t: Ticket) => {
    setDetailTicket(t);
    setDetailStatus(t.status);
    setStatusError(null);
    setNotes([]);
    setNoteText("");
    setAddNoteError(null);
  }, []);

  const handleCreateSuccess = useCallback(
    (data: { id: string; agencyId?: string; propertyId?: string; landlordUid?: string; category?: string; title?: string; description?: string }) => {
      setCreateOpen(false);
      loadTickets();
      const newTicket: Ticket = {
        id: data.id,
        agencyId: data.agencyId ?? agencyId ?? "",
        propertyId: data.propertyId ?? "",
        landlordUid: data.landlordUid ?? "",
        status: "Open",
        category: data.category ?? "General",
        title: data.title ?? "",
        description: data.description ?? "",
        createdAt: null,
        updatedAt: null,
      };
      openDetail(newTicket);
    },
    [agencyId, loadTickets, openDetail]
  );

  const fetchNotes = useCallback(
    (ticketId: string, ticketAgencyId: string) => {
      const q = ticketAgencyId ? `?agencyId=${encodeURIComponent(ticketAgencyId)}` : "";
      setLoadingNotes(true);
      fetch(`/api/admin/tickets/${encodeURIComponent(ticketId)}/notes${q}`, {
        credentials: "include",
      })
        .then((r) => (r.ok ? r.json() : []))
        .then((data: TicketNote[]) => setNotes(Array.isArray(data) ? data : []))
        .catch(() => setNotes([]))
        .finally(() => setLoadingNotes(false));
    },
    []
  );

  useEffect(() => {
    if (detailTicket) {
      fetchNotes(detailTicket.id, detailTicket.agencyId);
    } else {
      setNotes([]);
    }
  }, [detailTicket, fetchNotes]);

  const handleAddNote = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!detailTicket || !noteText.trim()) return;
      setAddNoteSubmitting(true);
      setAddNoteError(null);
      const q = detailTicket.agencyId ? `?agencyId=${encodeURIComponent(detailTicket.agencyId)}` : "";
      fetch(`/api/admin/tickets/${encodeURIComponent(detailTicket.id)}/notes${q}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ text: noteText.trim() }),
      })
        .then(async (res) => {
          if (res.ok) {
            setNoteText("");
            fetchNotes(detailTicket.id, detailTicket.agencyId);
            return;
          }
          const d = await res.json().catch(() => ({}));
          setAddNoteError(d?.error ?? "Failed to add note");
        })
        .catch(() => setAddNoteError("Failed to add note"))
        .finally(() => setAddNoteSubmitting(false));
    },
    [detailTicket, noteText, fetchNotes]
  );

  const handleDetailStatusSave = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!detailTicket || detailStatus === "" || detailStatus === detailTicket.status) {
        setDetailTicket(null);
        return;
      }
      setSubmitting(true);
      setStatusError(null);
      fetch(`/api/admin/tickets/${encodeURIComponent(detailTicket.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          status: detailStatus,
          ...(agencyId ? { agencyId } : {}),
        }),
      })
        .then(async (res) => {
          if (res.ok) {
            setDetailTicket(null);
            loadTickets();
            return;
          }
          const d = await res.json().catch(() => ({}));
          setStatusError(d?.error ?? "Update failed");
        })
        .catch(() => setStatusError("Update failed"))
        .finally(() => setSubmitting(false));
    },
    [detailTicket, detailStatus, agencyId, loadTickets]
  );

  if (!agencyId && !isSuperAdmin) {
    return (
      <>
        <AdminPageHeader title="Tickets" subtitle={pageSubtitle} />
        <EmptyState title="No agency" description="Your account is not linked to an agency." />
      </>
    );
  }

  if (isSuperAdmin && !agencyId) {
    return (
      <>
        <AdminPageHeader title="Tickets" subtitle={pageSubtitle} />
        <EmptyState
          title="Select an agency from the header to view this page."
          description="Use the agency dropdown in the top bar."
        />
      </>
    );
  }

  return (
    <>
      <AdminPageHeader
        title="Tickets"
        subtitle={pageSubtitle}
        primaryAction={
          <Button
            type="button"
            onClick={() => setCreateOpen(true)}
          >
            Create ticket
          </Button>
        }
      />

      {loading && (
        <div className="text-sm text-zinc-500">Loading tickets…</div>
      )}

      {!loading && tickets.length === 0 && (
        <EmptyState
          title="No tickets yet"
          description="Tickets created by landlords will appear here."
        />
      )}

      {!loading && tickets.length > 0 && (
        <div className="space-y-2">
          {tickets.map((ticket) => (
            <Card
              key={ticket.id}
              className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between hover:border-zinc-400 transition-colors"
            >
              <button
                type="button"
                onClick={() => openDetail(ticket)}
                className="flex-1 text-left min-w-0"
              >
                <div>
                  <p className="font-medium text-zinc-900">{ticket.title}</p>
                  <p className="text-sm text-zinc-500">
                    {ticket.category || "General"} · Property: {ticket.propertyId}
                  </p>
                </div>
                <div className="flex items-center gap-2 mt-1 sm:mt-0 sm:ml-4">
                  <StatusChip status={ticket.status} />
                  <span className="text-sm text-zinc-500">
                    {formatTicketDate(ticket.updatedAt)}
                  </span>
                </div>
              </button>
              <Link
                href={`/admin/tickets/${ticket.id}${agencyId ? `?agencyId=${encodeURIComponent(agencyId)}` : ""}`}
                className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 bg-zinc-50 hover:bg-zinc-100 shrink-0"
              >
                Open ticket
              </Link>
            </Card>
          ))}
        </div>
      )}

      {createOpen && (
        <AdminCreateTicketModal
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          onSuccess={handleCreateSuccess}
        />
      )}

      {detailTicket && (
        <div
          className="fixed inset-0 z-10 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="ticket-detail-title"
        >
          <Card className="w-full max-w-md">
            <h2 id="ticket-detail-title" className="text-lg font-semibold text-zinc-900">
              Ticket details
            </h2>
            <div className="mt-4 space-y-2 text-sm">
              <p>
                <span className="text-zinc-500">Title:</span> {detailTicket.title}
              </p>
              <p>
                <span className="text-zinc-500">Category:</span> {detailTicket.category || "General"}
              </p>
              <p>
                <span className="text-zinc-500">Property ID:</span> {detailTicket.propertyId}
              </p>
              <p>
                <span className="text-zinc-500">Landlord UID:</span> {detailTicket.landlordUid}
              </p>
              <p>
                <span className="text-zinc-500">Description:</span>{" "}
                {detailTicket.description || "—"}
              </p>
              <p>
                <span className="text-zinc-500">Created:</span>{" "}
                {formatTicketDate(detailTicket.createdAt)}
              </p>
              <p>
                <span className="text-zinc-500">Updated:</span>{" "}
                {formatTicketDate(detailTicket.updatedAt)}
              </p>
            </div>

            <div className="mt-4 pt-4 border-t border-zinc-200">
              <h3 className="text-sm font-medium text-zinc-700 mb-2">Notes</h3>
              {loadingNotes ? (
                <p className="text-sm text-zinc-500">Loading notes…</p>
              ) : notes.length === 0 ? (
                <p className="text-sm text-zinc-500">No notes yet.</p>
              ) : (
                <ul className="space-y-2 mb-3 max-h-40 overflow-y-auto">
                  {notes.map((n) => (
                    <li key={n.id} className="text-sm rounded bg-zinc-50 px-3 py-2">
                      <p className="text-zinc-900 whitespace-pre-wrap">{n.text}</p>
                      <p className="text-zinc-500 text-xs mt-1">
                        {formatTicketDate(n.createdAt)}
                        {n.authorDisplay || n.authorUid ? ` · ${n.authorDisplay || n.authorUid}` : ""}
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
            </div>

            <form onSubmit={handleDetailStatusSave} className="mt-4">
              <label htmlFor="detail-status" className="block text-sm font-medium text-zinc-700">
                Status
              </label>
              <select
                id="detail-status"
                value={detailStatus}
                onChange={(e) => setDetailStatus(e.target.value as TicketStatus)}
                className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900"
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
              <div className="mt-4 flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setDetailTicket(null)}
                  className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 bg-zinc-50"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={submitting || detailStatus === detailTicket.status}
                  className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
                >
                  {submitting ? "Saving…" : "Save status"}
                </button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </>
  );
}
