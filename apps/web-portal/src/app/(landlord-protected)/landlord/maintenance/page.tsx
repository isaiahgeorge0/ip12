"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { CreateTicketModal } from "@/components/landlord/CreateTicketModal";

type Ticket = {
  id: string;
  agencyId: string;
  propertyId: string;
  landlordUid: string;
  status: string;
  category: string;
  title: string;
  description: string;
  createdAt: unknown;
  updatedAt: unknown;
};

type PropertyOption = { id: string; agencyId: string; title: string; postcode: string; status: string };

function formatDate(v: unknown): string {
  if (v == null) return "—";
  const t = v as { seconds?: number; toDate?: () => Date };
  if (typeof t.toDate === "function") return t.toDate().toLocaleDateString();
  if (typeof t.seconds === "number") return new Date(t.seconds * 1000).toLocaleDateString();
  return String(v);
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

export default function LandlordMaintenancePage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [properties, setProperties] = useState<PropertyOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [detailTicket, setDetailTicket] = useState<Ticket | null>(null);
  const [notes, setNotes] = useState<TicketNote[]>([]);
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [addNoteSubmitting, setAddNoteSubmitting] = useState(false);
  const [addNoteError, setAddNoteError] = useState<string | null>(null);

  const loadTickets = useCallback(() => {
    fetch("/api/landlord/tickets", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : []))
      .then((data: Ticket[]) => setTickets(Array.isArray(data) ? data : []))
      .catch(() => setTickets([]));
  }, []);

  const fetchNotes = useCallback((ticketId: string) => {
    setLoadingNotes(true);
    fetch(`/api/landlord/tickets/${encodeURIComponent(ticketId)}/notes`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : []))
      .then((data: TicketNote[]) => setNotes(Array.isArray(data) ? data : []))
      .catch(() => setNotes([]))
      .finally(() => setLoadingNotes(false));
  }, []);

  useEffect(() => {
    if (detailTicket) {
      fetchNotes(detailTicket.id);
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
      fetch(`/api/landlord/tickets/${encodeURIComponent(detailTicket.id)}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ text: noteText.trim() }),
      })
        .then(async (res) => {
          if (res.ok) {
            setNoteText("");
            fetchNotes(detailTicket.id);
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

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch("/api/landlord/tickets", { credentials: "include" }),
      fetch("/api/landlord/properties", { credentials: "include" }),
    ])
      .then(async ([r1, r2]) => {
        const [tData, pData] = await Promise.all([
          r1.ok ? r1.json() : [],
          r2.ok ? r2.json() : [],
        ]);
        setTickets(Array.isArray(tData) ? tData : []);
        setProperties(Array.isArray(pData) ? pData : []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const openCount = tickets.filter((t) => t.status !== "Resolved").length;
  const resolvedCount = tickets.filter((t) => t.status === "Resolved").length;

  return (
    <>
      <PageHeader
        title="Maintenance"
        action={
          properties.length > 0 ? (
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
            >
              Create ticket
            </button>
          ) : null
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 mb-6">
        <Card className="p-4">
          <p className="text-sm text-zinc-500">Open / in progress</p>
          <p className="text-2xl font-semibold text-zinc-900">{openCount}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-zinc-500">Resolved</p>
          <p className="text-2xl font-semibold text-zinc-900">{resolvedCount}</p>
        </Card>
      </div>
      <h2 className="text-lg font-medium text-zinc-900 mb-2">Your tickets</h2>
      <p className="text-sm text-zinc-500 mb-4">
        Tickets for properties you are assigned to. Create a ticket to report an issue.
      </p>

      {loading ? (
        <p className="text-sm text-zinc-500">Loading…</p>
      ) : tickets.length === 0 ? (
        <EmptyState
          title="No tickets yet"
          description="Create a ticket for one of your assigned properties."
          action={
            properties.length > 0 ? (
              <button
                type="button"
                onClick={() => setCreateOpen(true)}
                className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
              >
                Create ticket
              </button>
            ) : null
          }
        />
      ) : (
        <div className="space-y-2">
          {tickets.map((ticket) => (
            <button
              key={`${ticket.agencyId}-${ticket.id}`}
              type="button"
              onClick={() => {
                setDetailTicket(ticket);
                setNoteText("");
                setAddNoteError(null);
              }}
              className="w-full text-left"
            >
              <Card>
                <p className="font-medium text-zinc-900">{ticket.title}</p>
                <p className="text-sm text-zinc-500">
                  {ticket.category || "General"} · Property ID: {ticket.propertyId}
                </p>
                <p className="text-sm text-zinc-500 mt-1 flex items-center gap-2">
                  <StatusChip status={ticket.status} />
                  {formatDate(ticket.updatedAt)}
                </p>
                {ticket.description && (
                  <p className="text-sm text-zinc-600 mt-1">{ticket.description}</p>
                )}
              </Card>
            </button>
          ))}
        </div>
      )}

      {detailTicket && (
        <div
          className="fixed inset-0 z-10 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="ticket-detail-title"
        >
          <Card className="w-full max-w-md max-h-[90vh] overflow-y-auto">
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
                <span className="text-zinc-500">Status:</span> <StatusChip status={detailTicket.status} />
              </p>
              {detailTicket.description && (
                <p>
                  <span className="text-zinc-500">Description:</span> {detailTicket.description}
                </p>
              )}
              <p>
                <span className="text-zinc-500">Created:</span> {formatDate(detailTicket.createdAt)}
              </p>
              <p>
                <span className="text-zinc-500">Updated:</span> {formatDate(detailTicket.updatedAt)}
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
                        {formatDate(n.createdAt)}
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
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setDetailTicket(null)}
                className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 bg-zinc-50"
              >
                Close
              </button>
            </div>
          </Card>
        </div>
      )}

      <CreateTicketModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSuccess={() => loadTickets()}
      />
    </>
  );
}
