/**
 * POST /api/admin/staff-action-queue/[queueItemId]/snooze
 * Snooze unified queue item. Body: { agencyId?, until: number (ms), note? }
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

  let body: { agencyId?: string; until?: number; note?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const agencyId = resolveAgencyId(session, body);
  if (!agencyId) {
    return NextResponse.json({ error: "agencyId required" }, { status: 400 });
  }

  const until = typeof body.until === "number" && Number.isFinite(body.until) ? body.until : null;
  if (until == null || until <= Date.now()) {
    return NextResponse.json({ error: "until required and must be a future timestamp (ms)" }, { status: 400 });
  }

  const note = typeof body.note === "string" ? body.note.trim().slice(0, 2000) || null : null;
  const db = getAdminFirestore();
  const stateRef = db.doc(staffActionQueueStateDoc(agencyId, itemId));
  const stateSnap = await stateRef.get();
  const existing = stateSnap.exists ? (stateSnap.data() as Record<string, unknown>) : null;
  const previousStatus = existing && typeof existing.status === "string" ? existing.status : "open";

  const payload = {
    itemId,
    agencyId,
    status: "snoozed" as const,
    assignedToUid: existing && typeof existing.assignedToUid === "string" ? existing.assignedToUid : null,
    assignedToName: existing && typeof existing.assignedToName === "string" ? existing.assignedToName : null,
    snoozedUntil: until,
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
    action: "STAFF_QUEUE_SNOOZED",
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
    nextStatus: "snoozed",
    snoozedUntil: until,
    completionNote: note,
    bypass: session.role === "superAdmin",
  });

  return NextResponse.json({ ok: true, status: "snoozed", snoozedUntil: until });
}
