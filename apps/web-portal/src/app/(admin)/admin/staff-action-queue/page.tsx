"use client";

import { useCallback, useEffect, useState } from "react";
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
  type StaffActionQueueItem,
  type StaffQueuePriority,
  STAFF_QUEUE_ITEM_TYPES,
  STAFF_QUEUE_ITEM_TYPE_LABELS,
  STAFF_QUEUE_PRIORITIES,
} from "@/lib/types/staffQueueItem";

const PRIORITY_LABELS: Record<StaffQueuePriority, string> = {
  urgent: "Urgent",
  high: "High",
  normal: "Normal",
};

const VIEW_OPTIONS: { value: "open" | "snoozed" | "completed" | "all"; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "snoozed", label: "Snoozed" },
  { value: "completed", label: "Completed" },
  { value: "all", label: "All" },
];

const ASSIGNED_OPTIONS: { value: "all" | "me" | "unassigned"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "me", label: "Assigned to me" },
  { value: "unassigned", label: "Unassigned" },
];

const SNOOZE_OPTIONS: { label: string; untilMs: () => number }[] = [
  { label: "Tomorrow morning", untilMs: () => { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(9, 0, 0, 0); return d.getTime(); } },
  { label: "In 3 days", untilMs: () => { const d = new Date(); d.setDate(d.getDate() + 3); d.setHours(9, 0, 0, 0); return d.getTime(); } },
  { label: "Next week", untilMs: () => { const d = new Date(); d.setDate(d.getDate() + 7); d.setHours(9, 0, 0, 0); return d.getTime(); } },
];

function formatDate(ms: number | null): string {
  return formatAdminDate(ms, "prettyDate");
}

function QueueCard({
  item,
  effectiveAgencyId,
  isSuperAdmin,
  currentUid,
  currentUserName,
  onComplete,
  onSnooze,
  onAssignToMe,
  onReopen,
  showReopen,
  loadingId,
}: {
  item: StaffActionQueueItem;
  effectiveAgencyId: string;
  isSuperAdmin: boolean;
  currentUid: string;
  currentUserName: string;
  onComplete: (id: string, note?: string) => void;
  onSnooze: (id: string, until: number) => void;
  onAssignToMe: (id: string) => void;
  onReopen: (id: string) => void;
  showReopen: boolean;
  loadingId: string | null;
}) {
  const [completeNote, setCompleteNote] = useState("");
  const [showCompleteInput, setShowCompleteInput] = useState(false);
  const [snoozeOpen, setSnoozeOpen] = useState(false);

  const q = isSuperAdmin ? `?agencyId=${encodeURIComponent(effectiveAgencyId)}` : "";
  const propHref = `/admin/properties/${item.propertyId}${q}`;
  const busy = loadingId === item.id;

  let actionLabel: string;
  let actionHref: string;

  switch (item.type) {
    case "APPLICATION_REVIEW":
      actionLabel = "Review application";
      actionHref = item.applicantId
        ? `/admin/applicants/${item.applicantId}${q}`
        : `/admin/application-pipeline${q}`;
      break;
    case "VIEWING_FOLLOW_UP":
      actionLabel = "Review viewing";
      actionHref = `/admin/viewings${q}`;
      break;
    case "PREPARE_OFFER":
      actionLabel = "Prepare offer";
      actionHref = `/admin/offers${q}`;
      break;
    case "CREATE_TENANCY":
      actionLabel = "Create tenancy";
      actionHref = `/admin/tenancies${q}`;
      break;
    case "OFFER_ACCEPTED":
      actionLabel = "Create tenancy";
      actionHref = `/admin/tenancies${q}`;
      break;
    case "UPCOMING_MOVE_IN": {
      const tenancyId = item.id.startsWith("upcoming_move_in_") ? item.id.slice("upcoming_move_in_".length) : item.id;
      actionLabel = "View tenancy";
      actionHref = `/admin/tenancies/${tenancyId}${q}`;
      break;
    }
    case "TENANCY_MOVE_IN": {
      const tenancyId = item.id.startsWith("tenancy_") ? item.id.slice("tenancy_".length) : item.id;
      actionLabel = "View tenancy";
      actionHref = `/admin/tenancies/${tenancyId}${q}`;
      break;
    }
    case "OPEN_TICKET":
    case "MAINTENANCE_TICKET_OPEN":
      actionLabel = "Open ticket";
      actionHref = item.ticketId ? `/admin/tickets/${item.ticketId}${q}` : `/admin/tickets${q}`;
      break;
    case "DOCUMENT_SIGNATURE_PENDING":
      actionLabel = "View";
      actionHref = propHref;
      break;
    default:
      actionLabel = "View property";
      actionHref = propHref;
  }

  return (
    <Card className="p-4 flex flex-col gap-2">
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-medium text-zinc-900">{item.title}</h3>
        <Link
          href={actionHref}
          className="shrink-0 rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
        >
          {actionLabel}
        </Link>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <AdminStatusBadge variant={getStatusBadgeVariant(item.priority, "queuePriority")}>
          {PRIORITY_LABELS[item.priority]}
        </AdminStatusBadge>
        <AdminStatusBadge variant="neutral">
          {STAFF_QUEUE_ITEM_TYPE_LABELS[item.type]}
        </AdminStatusBadge>
        <AdminStatusBadge variant={getStatusBadgeVariant(item.workflowStatus ?? "open", "queueWorkflow")}>
          {(item.workflowStatus ?? "open").charAt(0).toUpperCase() + (item.workflowStatus ?? "open").slice(1)}
        </AdminStatusBadge>
      </div>
      <p className="text-sm text-zinc-600">
        <Link href={propHref} className="hover:underline">
          {item.propertyDisplayLabel || `Property ${item.propertyId}`}
        </Link>
      </p>
      {item.applicantName && (
        <p className="text-sm text-zinc-600">{item.applicantName}</p>
      )}
      <p className="text-xs text-zinc-500">{formatDate(item.createdAt)}</p>
      {item.assignedToName && (
        <p className="text-xs text-zinc-500">Assigned to {item.assignedToName}</p>
      )}
      {item.description && (
        <p className="text-sm text-zinc-600 line-clamp-2">{item.description}</p>
      )}
      {item.reasonWhy && (
        <p className="text-xs text-zinc-500 italic">{item.reasonWhy}</p>
      )}

      <div className="mt-2 flex flex-wrap gap-1.5 border-t border-zinc-100 pt-2">
        {(item.workflowStatus ?? "open") === "open" && (
          <>
            {!showCompleteInput ? (
              <button
                type="button"
                onClick={() => setShowCompleteInput(true)}
                disabled={busy}
                className="rounded border border-zinc-300 bg-white px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
              >
                Complete
              </button>
            ) : (
              <div className="flex flex-wrap items-center gap-1">
                <input
                  type="text"
                  placeholder="Note (optional)"
                  value={completeNote}
                  onChange={(e) => setCompleteNote(e.target.value)}
                  className="rounded border border-zinc-300 px-2 py-1 text-xs w-32"
                />
                <button
                  type="button"
                  onClick={() => { onComplete(item.id, completeNote || undefined); setShowCompleteInput(false); setCompleteNote(""); }}
                  disabled={busy}
                  className="rounded bg-amber-600 px-2 py-1 text-xs font-medium text-white hover:bg-amber-700 disabled:opacity-50"
                >
                  Done
                </button>
                <button
                  type="button"
                  onClick={() => { setShowCompleteInput(false); setCompleteNote(""); }}
                  className="rounded border border-zinc-300 px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-50"
                >
                  Cancel
                </button>
              </div>
            )}
            <div className="relative">
              <button
                type="button"
                onClick={() => setSnoozeOpen(!snoozeOpen)}
                disabled={busy}
                className="rounded border border-zinc-300 bg-white px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
              >
                Snooze
              </button>
              {snoozeOpen && (
                <div className="absolute left-0 top-full z-10 mt-1 w-40 rounded border border-zinc-200 bg-white py-1 shadow">
                  {SNOOZE_OPTIONS.map((opt) => (
                    <button
                      key={opt.label}
                      type="button"
                      onClick={() => { onSnooze(item.id, opt.untilMs()); setSnoozeOpen(false); }}
                      className="block w-full px-3 py-1.5 text-left text-xs text-zinc-700 hover:bg-zinc-50"
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => onAssignToMe(item.id)}
              disabled={busy || item.assignedToUid === currentUid}
              className="rounded border border-zinc-300 bg-white px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
            >
              Assign to me
            </button>
          </>
        )}
        {showReopen && ((item.workflowStatus ?? "open") === "snoozed" || (item.workflowStatus ?? "open") === "completed") && (
          <button
            type="button"
            onClick={() => onReopen(item.id)}
            disabled={busy}
            className="rounded border border-zinc-300 bg-white px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
          >
            Reopen
          </button>
        )}
      </div>
    </Card>
  );
}

export default function AdminStaffActionQueuePage() {
  const { profile, user } = useAuth();
  const searchParams = useSearchParams();
  const selectedAgencyId = searchParams?.get("agencyId")?.trim() ?? null;
  const agencyId = profile?.agencyId ?? null;
  const isSuperAdmin = profile?.role === "superAdmin";
  const currentUid = user?.uid ?? profile?.uid ?? "";
  const currentUserName = profile?.displayName || profile?.email || "Me";

  const [items, setItems] = useState<StaffActionQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [view, setView] = useState<"open" | "snoozed" | "completed" | "all">("open");
  const [assigned, setAssigned] = useState<"all" | "me" | "unassigned">("all");
  const [priority, setPriority] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [q, setQ] = useState("");

  const effectiveAgencyId = isSuperAdmin ? selectedAgencyId : agencyId;
  const pageSubtitle = "Triage and act on items requiring staff attention.";

  const loadQueue = useCallback(() => {
    if (!effectiveAgencyId) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const params = new URLSearchParams();
    params.set("agencyId", effectiveAgencyId);
    params.set("unified", "1");
    params.set("view", view);
    params.set("assigned", assigned);
    if (priority) params.set("priority", priority);
    if (typeFilter) params.set("type", typeFilter);
    if (q.trim()) params.set("q", q.trim());
    fetch(`/api/admin/staff-action-queue?${params.toString()}`, { credentials: "include" })
      .then((res) => (res.ok ? res.json() : { items: [] }))
      .then((data: { items?: StaffActionQueueItem[] }) =>
        setItems(Array.isArray(data?.items) ? data.items : [])
      )
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [effectiveAgencyId, view, assigned, priority, typeFilter, q]);

  useEffect(() => {
    loadQueue();
  }, [loadQueue]);

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(t);
    }
  }, [toast]);

  const apiBody = () => (isSuperAdmin && effectiveAgencyId ? { agencyId: effectiveAgencyId } : {});

  const handleComplete = useCallback(
    (itemId: string, note?: string) => {
      if (!effectiveAgencyId) return;
      setLoadingId(itemId);
      fetch(`/api/admin/staff-action-queue/${encodeURIComponent(itemId)}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ...apiBody(), note }),
      })
        .then((res) => {
          if (res.ok) {
            setToast("Marked complete");
            loadQueue();
          } else {
            return res.json().then((d: { error?: string }) => setToast(d?.error ?? "Failed"));
          }
        })
        .catch(() => setToast("Failed"))
        .finally(() => setLoadingId(null));
    },
    [effectiveAgencyId, isSuperAdmin, loadQueue]
  );

  const handleSnooze = useCallback(
    (itemId: string, until: number) => {
      if (!effectiveAgencyId) return;
      setLoadingId(itemId);
      fetch(`/api/admin/staff-action-queue/${encodeURIComponent(itemId)}/snooze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ...apiBody(), until }),
      })
        .then((res) => {
          if (res.ok) {
            setToast("Snoozed");
            loadQueue();
          } else {
            return res.json().then((d: { error?: string }) => setToast(d?.error ?? "Failed"));
          }
        })
        .catch(() => setToast("Failed"))
        .finally(() => setLoadingId(null));
    },
    [effectiveAgencyId, isSuperAdmin, loadQueue]
  );

  const handleAssignToMe = useCallback(
    (itemId: string) => {
      if (!effectiveAgencyId || !currentUid) return;
      setLoadingId(itemId);
      fetch(`/api/admin/staff-action-queue/${encodeURIComponent(itemId)}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          ...apiBody(),
          assignedToUid: currentUid,
          assignedToName: currentUserName,
        }),
      })
        .then((res) => {
          if (res.ok) {
            setToast("Assigned to you");
            loadQueue();
          } else {
            return res.json().then((d: { error?: string }) => setToast(d?.error ?? "Failed"));
          }
        })
        .catch(() => setToast("Failed"))
        .finally(() => setLoadingId(null));
    },
    [effectiveAgencyId, currentUid, currentUserName, isSuperAdmin, loadQueue]
  );

  const handleReopen = useCallback(
    (itemId: string) => {
      if (!effectiveAgencyId) return;
      setLoadingId(itemId);
      fetch(`/api/admin/staff-action-queue/${encodeURIComponent(itemId)}/reopen`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(apiBody()),
      })
        .then((res) => {
          if (res.ok) {
            setToast("Reopened");
            loadQueue();
          } else {
            return res.json().then((d: { error?: string }) => setToast(d?.error ?? "Failed"));
          }
        })
        .catch(() => setToast("Failed"))
        .finally(() => setLoadingId(null));
    },
    [effectiveAgencyId, isSuperAdmin, loadQueue]
  );

  if (!effectiveAgencyId && !isSuperAdmin) {
    return (
      <>
        <AdminPageHeader title="Staff action queue" subtitle={pageSubtitle} />
        <EmptyState title="No agency" description="Your account is not linked to an agency." />
      </>
    );
  }

  if (isSuperAdmin && !effectiveAgencyId) {
    return (
      <>
        <AdminPageHeader title="Staff action queue" subtitle={pageSubtitle} />
        <EmptyState
          title="Select an agency from the header."
          description="Choose an agency in the header to view its staff action queue."
        />
      </>
    );
  }

  const byPriority = {
    urgent: items.filter((i) => i.priority === "urgent"),
    high: items.filter((i) => i.priority === "high"),
    normal: items.filter((i) => i.priority === "normal"),
  };

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
      <AdminPageHeader title="Staff action queue" subtitle={pageSubtitle} />

      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-zinc-200 bg-zinc-50/50 px-4 py-3">
        <div className="flex items-center gap-2">
          <label htmlFor="queue-view" className="text-sm font-medium text-zinc-700">
            View
          </label>
          <select
            id="queue-view"
            value={view}
            onChange={(e) => setView(e.target.value as "open" | "snoozed" | "completed" | "all")}
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm"
          >
            {VIEW_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="queue-assigned" className="text-sm font-medium text-zinc-700">
            Assigned
          </label>
          <select
            id="queue-assigned"
            value={assigned}
            onChange={(e) => setAssigned(e.target.value as "all" | "me" | "unassigned")}
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm"
          >
            {ASSIGNED_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="queue-priority" className="text-sm font-medium text-zinc-700">
            Priority
          </label>
          <select
            id="queue-priority"
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm"
          >
            <option value="">All</option>
            {STAFF_QUEUE_PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {PRIORITY_LABELS[p]}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="queue-type" className="text-sm font-medium text-zinc-700">
            Type
          </label>
          <select
            id="queue-type"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm min-w-[180px]"
          >
            <option value="">All</option>
            {STAFF_QUEUE_ITEM_TYPES.map((t) => (
              <option key={t} value={t}>
                {STAFF_QUEUE_ITEM_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2 flex-1 min-w-[160px]">
          <label htmlFor="queue-search" className="text-sm font-medium text-zinc-700 shrink-0">
            Search
          </label>
          <input
            id="queue-search"
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Title, property, applicant…"
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm w-full max-w-xs"
          />
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-zinc-500">Loading…</p>
      ) : items.length === 0 ? (
        <EmptyState
          title="Nothing requiring staff attention."
          description="When applications, viewings, offers, tenancies or tickets need action, they will appear here. Use the view filter to see snoozed or completed items."
        />
      ) : (
        <div className="space-y-8">
          {(["urgent", "high", "normal"] as const).map((priorityKey) => {
            const list = items.filter((i) => i.priority === priorityKey);
            if (list.length === 0) return null;
            return (
              <section key={priorityKey}>
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">
                  {PRIORITY_LABELS[priorityKey]}
                </h2>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {list.map((item) => (
                    <QueueCard
                      key={item.id}
                      item={item}
                      effectiveAgencyId={effectiveAgencyId!}
                      isSuperAdmin={!!isSuperAdmin}
                      currentUid={currentUid}
                      currentUserName={currentUserName}
                      onComplete={handleComplete}
                      onSnooze={handleSnooze}
                      onAssignToMe={handleAssignToMe}
                      onReopen={handleReopen}
                      showReopen={view === "snoozed" || view === "completed" || view === "all"}
                      loadingId={loadingId}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}
