/**
 * GET /api/admin/staff-action-queue?agencyId=...&unified=1&view=open|snoozed|completed|all&assigned=me|unassigned|all&q=&priority=&type=
 * When unified=1, returns { items: StaffActionQueueItem[] } with workflow state overlay and filters.
 * Legacy: without unified=1, returns StaffActionQueueRow[] for dashboard/summary cards.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireServerSessionApi, assertRoleApi } from "@/lib/auth/authz";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { staffActionQueueCol } from "@/lib/firestore/paths";
import { serializeTimestamp } from "@/lib/serialization";
import {
  isStaffActionQueueStage,
  type StaffActionQueueStage,
} from "@/lib/types/staffActionQueue";
import type { StaffActionQueueItem, StaffQueuePriority, StaffQueueItemType } from "@/lib/types/staffQueueItem";
import { STAFF_QUEUE_ITEM_TYPES, STAFF_QUEUE_PRIORITIES } from "@/lib/types/staffQueueItem";
import { buildUnifiedQueueItems } from "./buildUnifiedQueueItems";
import { loadQueueStateMap, mergeStateIntoItems } from "./queueStateOverlay";

function resolveAgencyId(
  session: { role: string; agencyId: string | null },
  params: { agencyId?: string }
): string | null {
  let agencyId = session.agencyId ?? "";
  if (!agencyId && session.role === "superAdmin" && typeof params?.agencyId === "string") {
    agencyId = params.agencyId.trim();
  }
  return agencyId || null;
}

export type StaffActionQueueRow = {
  id: string;
  agencyId: string;
  offerId: string;
  applicationId: string | null;
  applicantId: string | null;
  applicantUserId: string | null;
  propertyId: string;
  propertyDisplayLabel: string;
  applicantName: string;
  applicantEmail: string;
  applicantPhone: string | null;
  offerAmount: number;
  currency: string;
  stage: StaffActionQueueStage;
  source: string;
  notes: string | null;
  acceptedAt: number | null;
  createdAt: number | null;
  updatedAt: number | null;
  lastActionAt: number | null;
};

export async function GET(request: NextRequest) {
  const sessionOr401 = await requireServerSessionApi();
  if (sessionOr401 instanceof NextResponse) return sessionOr401;
  const session = sessionOr401;
  const role403 = assertRoleApi(session, ["admin", "superAdmin"]);
  if (role403) return role403;

  const { searchParams } = new URL(request.url);
  const agencyIdParam = searchParams.get("agencyId")?.trim() || null;
  const stageParam = searchParams.get("stage")?.trim() || null;
  const propertyIdParam = searchParams.get("propertyId")?.trim() || null;
  const applicantIdParam = searchParams.get("applicantId")?.trim() || null;
  const offerIdParam = searchParams.get("offerId")?.trim() || null;
  const unified = searchParams.get("unified") === "1";

  const agencyId = resolveAgencyId(session, { agencyId: agencyIdParam ?? undefined });
  if (!agencyId) {
    return NextResponse.json({ error: "agencyId required" }, { status: 400 });
  }

  const db = getAdminFirestore();

  if (unified) {
    let items = await buildUnifiedQueueItems(db, agencyId);
    const itemIds = items.map((i) => i.id);
    const stateMap = await loadQueueStateMap(db, agencyId, itemIds);
    mergeStateIntoItems(items, stateMap);

    const now = Date.now();
    const view = (searchParams.get("view")?.trim() || "open") as "open" | "snoozed" | "completed" | "all";
    const assigned = (searchParams.get("assigned")?.trim() || "all") as "me" | "unassigned" | "all";
    const q = searchParams.get("q")?.trim() || "";
    const priorityParam = searchParams.get("priority")?.trim() || "";
    const typeParam = searchParams.get("type")?.trim() || "";

    if (view === "open") {
      items = items.filter(
        (i) =>
          i.workflowStatus !== "completed" &&
          !(i.workflowStatus === "snoozed" && i.snoozedUntil != null && i.snoozedUntil > now)
      );
    } else if (view === "snoozed") {
      items = items.filter(
        (i) => i.workflowStatus === "snoozed" && i.snoozedUntil != null && i.snoozedUntil > now
      );
    } else if (view === "completed") {
      items = items.filter((i) => i.workflowStatus === "completed");
    }

    if (assigned === "me") {
      const uid = (session as { uid?: string }).uid ?? "";
      items = items.filter((i) => i.assignedToUid === uid);
    } else if (assigned === "unassigned") {
      items = items.filter((i) => !i.assignedToUid);
    }

    if (q) {
      const lower = q.toLowerCase();
      items = items.filter(
        (i) =>
          i.title.toLowerCase().includes(lower) ||
          (i.description && i.description.toLowerCase().includes(lower)) ||
          (i.applicantName && i.applicantName.toLowerCase().includes(lower)) ||
          (i.propertyDisplayLabel && i.propertyDisplayLabel.toLowerCase().includes(lower))
      );
    }

    if (priorityParam && STAFF_QUEUE_PRIORITIES.includes(priorityParam as StaffQueuePriority)) {
      items = items.filter((i) => i.priority === priorityParam);
    }

    if (typeParam) {
      const typeNorm = typeParam === "APPLICATION_SUBMITTED" ? "APPLICATION_REVIEW" : typeParam;
      if (STAFF_QUEUE_ITEM_TYPES.includes(typeNorm as StaffQueueItemType)) {
        items = items.filter((i) => i.type === typeNorm);
      }
    }

    const priorityOrder: StaffQueuePriority[] = ["urgent", "high", "normal"];
    items.sort((a, b) => {
      const pa = priorityOrder.indexOf(a.priority);
      const pb = priorityOrder.indexOf(b.priority);
      if (pa !== pb) return pa - pb;
      return (b.createdAt ?? 0) - (a.createdAt ?? 0);
    });

    return NextResponse.json({ items });
  }

  const snap = await db.collection(staffActionQueueCol(agencyId)).orderBy("lastActionAt", "desc").get();
  let docs = snap.docs;

  if (stageParam && isStaffActionQueueStage(stageParam)) {
    docs = docs.filter((d) => d.data().stage === stageParam);
  }
  if (propertyIdParam) {
    docs = docs.filter((d) => (d.data().propertyId as string) === propertyIdParam);
  }
  if (applicantIdParam) {
    docs = docs.filter((d) => (d.data().applicantId as string) === applicantIdParam);
  }
  if (offerIdParam) {
    docs = docs.filter((d) => (d.data().offerId as string) === offerIdParam);
  }

  const list: StaffActionQueueRow[] = docs.map((doc) => {
    const d = doc.data();
    return {
      id: doc.id,
      agencyId: (d.agencyId as string) ?? agencyId,
      offerId: (d.offerId as string) ?? "",
      applicationId: (d.applicationId as string) ?? null,
      applicantId: (d.applicantId as string) ?? null,
      applicantUserId: (d.applicantUserId as string) ?? null,
      propertyId: (d.propertyId as string) ?? "",
      propertyDisplayLabel: (d.propertyDisplayLabel as string) ?? "",
      applicantName: (d.applicantName as string) ?? "",
      applicantEmail: (d.applicantEmail as string) ?? "",
      applicantPhone: (d.applicantPhone as string) ?? null,
      offerAmount: typeof d.offerAmount === "number" && Number.isFinite(d.offerAmount) ? d.offerAmount : 0,
      currency: (d.currency as string) ?? "GBP",
      stage: (isStaffActionQueueStage(d.stage) ? d.stage : "offer_accepted") as StaffActionQueueStage,
      source: (d.source as string) ?? "offer_accept",
      notes: typeof d.notes === "string" ? d.notes : null,
      acceptedAt: serializeTimestamp(d.acceptedAt) ?? null,
      createdAt: serializeTimestamp(d.createdAt) ?? null,
      updatedAt: serializeTimestamp(d.updatedAt) ?? null,
      lastActionAt: serializeTimestamp(d.lastActionAt) ?? null,
    };
  });

  return NextResponse.json(list);
}
