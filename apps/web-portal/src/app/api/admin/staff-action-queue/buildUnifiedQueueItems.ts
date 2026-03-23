/**
 * Build unified staff action queue items from workflow rules + legacy queue-derived items.
 * Used by GET /api/admin/staff-action-queue?unified=1.
 * Composes: workflow automation (buildWorkflowActions) + legacy OFFER_ACCEPTED where no CREATE_TENANCY, then state overlay applied in route.
 */

import type { Firestore, QuerySnapshot } from "firebase-admin/firestore";
import {
  staffActionQueueCol,
  applicationPipelineCol,
  viewingsCol,
  tenanciesCol,
  ticketsCol,
  propertiesCol,
  offersCol,
} from "@/lib/firestore/paths";
import { propertyDisplayLabel } from "@/lib/admin/normalizePropertyDisplay";
import { serializeTimestamp } from "@/lib/serialization";
import {
  isStaffActionQueueStage,
  type StaffActionQueueStage,
} from "@/lib/types/staffActionQueue";
import type {
  StaffActionQueueItem,
  StaffQueuePriority,
} from "@/lib/types/staffQueueItem";
import {
  buildWorkflowActions,
  type WorkflowInput,
  type WorkflowViewing,
  type WorkflowPipelineItem,
  type WorkflowOffer,
  type WorkflowTenancy,
  type WorkflowTicket,
  type WorkflowQueueRow,
} from "@/lib/workflow/buildWorkflowActions";

const TENANCY_URGENT_DAYS = 2;
const PRIORITY_ORDER: StaffQueuePriority[] = ["urgent", "high", "normal"];

const DEFAULT_WORKFLOW = {
  workflowStatus: "open" as const,
  assignedToUid: null as string | null,
  assignedToName: null as string | null,
  snoozedUntil: null as number | null,
  completedAt: null as number | null,
  completedByUid: null as string | null,
  completionNote: null as string | null,
};

function viewingUpdatedAtMs(raw: unknown): number {
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  const t = raw as { toMillis?: () => number };
  if (t && typeof t.toMillis === "function") return t.toMillis();
  return 0;
}

function toMs(ts: unknown): number {
  if (typeof ts === "number" && Number.isFinite(ts)) return ts;
  const s = serializeTimestamp(ts);
  if (s != null) return s;
  const t = ts as { toMillis?: () => number };
  if (t && typeof t.toMillis === "function") return t.toMillis();
  return 0;
}

function buildWorkflowInput(
  queueSnap: QuerySnapshot,
  pipelineSnap: QuerySnapshot,
  viewingsSnap: QuerySnapshot,
  offersSnap: QuerySnapshot,
  tenanciesSnap: QuerySnapshot,
  ticketsSnap: QuerySnapshot,
  propertyLabels: Map<string, string>,
  now: number
): WorkflowInput {
  const viewings: WorkflowViewing[] = viewingsSnap.docs.map((doc) => {
    const d = doc.data();
    const updatedAt = d.updatedAt;
    const updatedMs = viewingUpdatedAtMs(serializeTimestamp(updatedAt) ?? updatedAt);
    const createdMs = toMs(d.createdAt) || updatedMs;
    return {
      id: doc.id,
      propertyId: (d.propertyId as string) ?? "",
      applicantId: (d.applicantId as string) ?? null,
      applicantUserId: (d.applicantUserId as string) ?? null,
      status: (d.status as string) ?? "",
      updatedAtMs: updatedMs,
      createdAtMs: createdMs,
      applicantName: (d.applicantName as string) ?? null,
    };
  });

  const pipeline: WorkflowPipelineItem[] = pipelineSnap.docs.map((doc) => {
    const d = doc.data();
    return {
      id: doc.id,
      propertyId: (d.propertyId as string) ?? "",
      applicantId: (d.applicantId as string) ?? null,
      applicationId: (d.applicationId as string) ?? null,
      stage: (d.stage as string) ?? "",
      lastActionAtMs: toMs(d.lastActionAt) || toMs(d.updatedAt) || now,
      applicantName: (d.applicantName as string) ?? null,
    };
  });

  const offers: WorkflowOffer[] = offersSnap.docs.map((doc) => {
    const d = doc.data();
    return {
      id: doc.id,
      propertyId: (d.propertyId as string) ?? "",
      applicantId: (d.applicantId as string) ?? null,
      applicationId: (d.applicationId as string) ?? null,
      status: (d.status as string) ?? "",
      applicantName: (d.applicantName as string) ?? null,
    };
  });

  const tenancies: WorkflowTenancy[] = tenanciesSnap.docs.map((doc) => {
    const d = doc.data();
    return {
      id: doc.id,
      propertyId: (d.propertyId as string) ?? "",
      offerId: (d.offerId as string) ?? null,
      status: (d.status as string) ?? "active",
      tenancyStartDate: typeof d.tenancyStartDate === "string" ? d.tenancyStartDate : null,
      tenantName: (d.tenantName as string) ?? null,
    };
  });

  const tickets: WorkflowTicket[] = ticketsSnap.docs.map((doc) => {
    const d = doc.data();
    return {
      id: doc.id,
      propertyId: (d.propertyId as string) ?? "",
      status: (d.status as string) ?? "Open",
      title: (d.title as string) ?? "",
      category: (d.category as string) ?? null,
      description: (d.description as string) ?? null,
    };
  });

  const queueRows: WorkflowQueueRow[] = queueSnap.docs.map((doc) => {
    const d = doc.data();
    return {
      id: doc.id,
      offerId: (d.offerId as string) ?? "",
      propertyId: (d.propertyId as string) ?? "",
      applicantId: (d.applicantId as string) ?? null,
      applicantName: (d.applicantName as string) ?? null,
    };
  });

  return {
    viewings,
    pipeline,
    offers,
    tenancies,
    tickets,
    queueRows,
    propertyLabels,
    now,
  };
}

export async function buildUnifiedQueueItems(
  db: Firestore,
  agencyId: string
): Promise<StaffActionQueueItem[]> {
  const now = Date.now();
  const allPropertyIds = new Set<string>();

  const [queueSnap, pipelineSnap, viewingsSnap, offersSnap, tenanciesSnap, ticketsSnap] =
    await Promise.all([
      db.collection(staffActionQueueCol(agencyId)).orderBy("lastActionAt", "desc").limit(100).get(),
      db.collection(applicationPipelineCol(agencyId)).orderBy("lastActionAt", "desc").limit(100).get(),
      db.collection(viewingsCol(agencyId)).orderBy("updatedAt", "desc").limit(100).get(),
      db.collection(offersCol(agencyId)).orderBy("updatedAt", "desc").limit(100).get(),
      db.collection(tenanciesCol(agencyId)).orderBy("createdAt", "desc").limit(100).get(),
      db.collection(ticketsCol(agencyId)).orderBy("updatedAt", "desc").limit(100).get(),
    ]);

  for (const doc of queueSnap.docs) {
    const d = doc.data();
    const pid = (d.propertyId as string) ?? "";
    if (pid) allPropertyIds.add(pid);
  }
  for (const doc of pipelineSnap.docs) {
    const d = doc.data();
    const pid = (d.propertyId as string) ?? "";
    if (pid) allPropertyIds.add(pid);
  }
  for (const doc of viewingsSnap.docs) {
    const d = doc.data();
    const pid = (d.propertyId as string) ?? "";
    if (pid) allPropertyIds.add(pid);
  }
  for (const doc of offersSnap.docs) {
    const d = doc.data();
    const pid = (d.propertyId as string) ?? "";
    if (pid) allPropertyIds.add(pid);
  }
  for (const doc of tenanciesSnap.docs) {
    const d = doc.data();
    const pid = (d.propertyId as string) ?? "";
    if (pid) allPropertyIds.add(pid);
  }
  for (const doc of ticketsSnap.docs) {
    const d = doc.data();
    const pid = (d.propertyId as string) ?? "";
    if (pid) allPropertyIds.add(pid);
  }

  let propertyLabels: Map<string, string> = new Map();
  if (allPropertyIds.size > 0) {
    const ids = [...allPropertyIds].slice(0, 80);
    const refs = ids.map((id) => db.collection(propertiesCol(agencyId)).doc(id));
    const snaps = await db.getAll(...refs);
    snaps.forEach((s, idx) => {
      const id = ids[idx];
      if (id)
        propertyLabels.set(
          id,
          propertyDisplayLabel(s.exists ? (s.data() as Record<string, unknown>) : null, id)
        );
    });
  }

  const workflowInput = buildWorkflowInput(
    queueSnap,
    pipelineSnap,
    viewingsSnap,
    offersSnap,
    tenanciesSnap,
    ticketsSnap,
    propertyLabels,
    now
  );
  const workflowItems = buildWorkflowActions(workflowInput);

  const createTenancyOfferIds = new Set(
    workflowItems.filter((i) => i.type === "CREATE_TENANCY" && i.offerId).map((i) => i.offerId!)
  );

  const items: StaffActionQueueItem[] = [...workflowItems];

  for (const doc of queueSnap.docs) {
    const d = doc.data();
    const offerId = (d.offerId as string) ?? "";
    if (createTenancyOfferIds.has(offerId)) continue;
    const stage = (isStaffActionQueueStage(d.stage) ? d.stage : "offer_accepted") as StaffActionQueueStage;
    const createdAt = serializeTimestamp(d.createdAt) ?? now;
    const propId = (d.propertyId as string) ?? "";
    const label = (d.propertyDisplayLabel as string) || (propertyLabels.get(propId) ?? `Property ${propId}`);
    items.push({
      id: `offer_${doc.id}`,
      type: "OFFER_ACCEPTED",
      title: "Offer accepted – tenancy creation needed",
      description: (d.applicantName as string) ? `${d.applicantName} – ${label}` : label,
      createdAt,
      propertyId: propId,
      propertyDisplayLabel: label,
      applicantId: (d.applicantId as string) ?? null,
      ticketId: null,
      offerId,
      queueItemId: doc.id,
      priority: "urgent",
      status: stage,
      applicantName: (d.applicantName as string) ?? null,
      stage,
      ...DEFAULT_WORKFLOW,
    });
  }

  items.sort((a, b) => {
    const pa = PRIORITY_ORDER.indexOf(a.priority);
    const pb = PRIORITY_ORDER.indexOf(b.priority);
    if (pa !== pb) return pa - pb;
    return (b.createdAt ?? 0) - (a.createdAt ?? 0);
  });

  return items;
}
