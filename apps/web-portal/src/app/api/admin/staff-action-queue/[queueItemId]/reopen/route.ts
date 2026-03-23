/**
 * POST /api/admin/staff-action-queue/[queueItemId]/reopen
 * Reopen unified queue item (clear completed/snoozed). Body: { agencyId? }
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

  let body: { agencyId?: string };
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const agencyId = resolveAgencyId(session, body);
  if (!agencyId) {
    return NextResponse.json({ error: "agencyId required" }, { status: 400 });
  }

  const db = getAdminFirestore();
  const stateRef = db.doc(staffActionQueueStateDoc(agencyId, itemId));
  const stateSnap = await stateRef.get();
  const existing = stateSnap.exists ? (stateSnap.data() as Record<string, unknown>) : null;
  const previousStatus = existing && typeof existing.status === "string" ? existing.status : "open";

  const payload = {
    itemId,
    agencyId,
    status: "open" as const,
    assignedToUid: existing && typeof (existing as { assignedToUid?: string }).assignedToUid === "string" ? (existing as { assignedToUid: string }).assignedToUid : null,
    assignedToName: existing && typeof (existing as { assignedToName?: string }).assignedToName === "string" ? (existing as { assignedToName: string }).assignedToName : null,
    snoozedUntil: null,
    completedAt: null,
    completedByUid: null,
    completionNote: null,
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: session.uid,
  };

  await stateRef.set(payload, { merge: true });

  const items = await buildUnifiedQueueItems(db, agencyId);
  const stateMap = await loadQueueStateMap(db, agencyId, items.map((i) => i.id));
  mergeStateIntoItems(items, stateMap);
  const item = items.find((i) => i.id === itemId);

  writeStaffQueueAudit({
    action: "STAFF_QUEUE_REOPENED",
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
    nextStatus: "open",
    bypass: session.role === "superAdmin",
  });

  return NextResponse.json({ ok: true, status: "open" });
}
