/**
 * POST /api/admin/staff-action-queue/[queueItemId]/assign
 * Assign unified queue item. Body: { agencyId?, assignedToUid, assignedToName? }
 */

import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { requireServerSessionApi, assertRoleApi } from "@/lib/auth/authz";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { staffActionQueueStateDoc } from "@/lib/firestore/paths";
import { writeStaffQueueAudit } from "@/lib/audit/staffQueueAudit";
import { buildUnifiedQueueItems } from "../../buildUnifiedQueueItems";
import { loadQueueStateMap, mergeStateIntoItems } from "../../queueStateOverlay";

function resolveAgencyId(
  session: { role: string; agencyId: string | null },
  body: { agencyId?: string }
): string | null {
  let agencyId = session.agencyId ?? "";
  if (!agencyId && session.role === "superAdmin" && typeof body?.agencyId === "string") {
    agencyId = body.agencyId.trim();
  }
  return agencyId || null;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ queueItemId: string }> }
) {
  const sessionOr401 = await requireServerSessionApi();
  if (sessionOr401 instanceof NextResponse) return sessionOr401;
  const session = sessionOr401;
  const role403 = assertRoleApi(session, ["admin", "superAdmin"]);
  if (role403) return role403;

  const { queueItemId: itemId } = await params;
  if (!itemId) {
    return NextResponse.json({ error: "itemId required" }, { status: 400 });
  }

  let body: { agencyId?: string; assignedToUid?: string; assignedToName?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const agencyId = resolveAgencyId(session, body);
  if (!agencyId) {
    return NextResponse.json({ error: "agencyId required" }, { status: 400 });
  }

  const assignedToUid =
    typeof body.assignedToUid === "string" && body.assignedToUid.trim() ? body.assignedToUid.trim() : null;
  const assignedToName =
    typeof body.assignedToName === "string" ? body.assignedToName.trim().slice(0, 200) || null : null;
  if (!assignedToUid) {
    return NextResponse.json({ error: "assignedToUid required" }, { status: 400 });
  }

  const db = getAdminFirestore();
  const stateRef = db.doc(staffActionQueueStateDoc(agencyId, itemId));
  const stateSnap = await stateRef.get();
  const existing = stateSnap.exists ? (stateSnap.data() as Record<string, unknown>) : null;
  const prev = existing as { status?: string; snoozedUntil?: number } | null;
  const previousStatus = prev && typeof prev.status === "string" ? prev.status : "open";
  const currentStatus =
    prev && (prev.status === "open" || prev.status === "snoozed" || prev.status === "completed")
      ? prev.status
      : "open";

  await stateRef.set(
    {
      itemId,
      agencyId,
      status: currentStatus,
      assignedToUid,
      assignedToName: assignedToName ?? assignedToUid,
      snoozedUntil: prev && typeof prev.snoozedUntil === "number" ? prev.snoozedUntil : null,
      completedAt: null,
      completedByUid: null,
      completionNote: null,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: session.uid,
    },
    { merge: true }
  );

  const items = await buildUnifiedQueueItems(db, agencyId);
  const stateMap = await loadQueueStateMap(db, agencyId, items.map((i) => i.id));
  mergeStateIntoItems(items, stateMap);
  const item = items.find((i) => i.id === itemId);

  writeStaffQueueAudit({
    action: "STAFF_QUEUE_ASSIGNED",
    actorUid: session.uid,
    actorRole: session.role === "superAdmin" ? "superAdmin" : "admin",
    actorAgencyId: session.agencyId ?? null,
    agencyId,
    itemId,
    itemType: item?.type ?? "unknown",
    propertyId: item?.propertyId ?? "",
    propertyDisplayLabel: item?.propertyDisplayLabel ?? null,
    applicantId: item?.applicantId ?? null,
    offerId: item?.offerId ?? null,
    ticketId: item?.ticketId ?? null,
    previousStatus,
    nextStatus: currentStatus,
    assignedToUid,
    assignedToName: assignedToName ?? assignedToUid,
    bypass: session.role === "superAdmin",
  });

  return NextResponse.json({ ok: true, assignedToUid, assignedToName: assignedToName ?? assignedToUid });
}
