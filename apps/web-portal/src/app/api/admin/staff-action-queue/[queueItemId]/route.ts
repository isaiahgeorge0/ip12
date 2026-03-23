/**
 * PATCH /api/admin/staff-action-queue/[queueItemId]
 * Update queue item: stage, notes. Scoped to agency; admin = own agency, superAdmin may pass agencyId.
 * When stage transitions to "completed", creates a tenancy (if none exists for this offerId) and attaches tenancyId to the queue item.
 */

import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { requireServerSessionApi, assertRoleApi } from "@/lib/auth/authz";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { staffActionQueueCol, tenanciesCol } from "@/lib/firestore/paths";
import { writeAuditLog } from "@/lib/audit/writeAuditLog";
import { isStaffActionQueueStage, STAFF_ACTION_QUEUE_STAGES, type StaffActionQueueStage } from "@/lib/types/staffActionQueue";

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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ queueItemId: string }> }
) {
  const sessionOr401 = await requireServerSessionApi();
  if (sessionOr401 instanceof NextResponse) return sessionOr401;
  const session = sessionOr401;
  const role403 = assertRoleApi(session, ["admin", "superAdmin"]);
  if (role403) return role403;

  const { queueItemId } = await params;
  if (!queueItemId) {
    return NextResponse.json({ error: "queueItemId required" }, { status: 400 });
  }

  let body: { stage?: string; notes?: string | null; agencyId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const agencyId = resolveAgencyId(session, body);
  if (!agencyId) {
    return NextResponse.json({ error: "agencyId required" }, { status: 400 });
  }

  const updates: Record<string, unknown> = {
    updatedAt: FieldValue.serverTimestamp(),
    lastActionAt: FieldValue.serverTimestamp(),
    updatedBy: session.uid,
  };

  if (typeof body?.stage === "string" && body.stage.trim()) {
    const stage = body.stage.trim() as StaffActionQueueStage;
    if (!STAFF_ACTION_QUEUE_STAGES.includes(stage)) {
      return NextResponse.json(
        { error: `stage must be one of: ${STAFF_ACTION_QUEUE_STAGES.join(", ")}` },
        { status: 400 }
      );
    }
    updates.stage = stage;
  }

  if (body?.notes !== undefined) {
    updates.notes = typeof body.notes === "string" ? body.notes.trim() || null : null;
  }

  if (Object.keys(updates).length <= 3) {
    return NextResponse.json({ ok: true });
  }

  const db = getAdminFirestore();
  const ref = db.collection(staffActionQueueCol(agencyId)).doc(queueItemId);
  const snap = await ref.get();
  if (!snap.exists) {
    return NextResponse.json({ error: "Queue item not found" }, { status: 404 });
  }

  const queueData = snap.data()!;
  const isTransitionToCompleted = updates.stage === "completed";

  if (isTransitionToCompleted) {
    const existingTenancySnap = await db
      .collection(tenanciesCol(agencyId))
      .where("offerId", "==", queueItemId)
      .limit(1)
      .get();
    if (existingTenancySnap.empty) {
      const tenantName = (typeof queueData.applicantName === "string" ? queueData.applicantName : "").trim() || "—";
      const tenantEmail = (typeof queueData.applicantEmail === "string" ? queueData.applicantEmail : "").trim() || "—";
      const tenantPhone = typeof queueData.applicantPhone === "string" ? queueData.applicantPhone.trim() || null : null;
      const propertyId = (typeof queueData.propertyId === "string" ? queueData.propertyId : "").trim();
      const propertyDisplayLabel = (typeof queueData.propertyDisplayLabel === "string" ? queueData.propertyDisplayLabel : "").trim() || `Property ${propertyId}`;
      const rentAmount = typeof queueData.offerAmount === "number" && Number.isFinite(queueData.offerAmount) ? queueData.offerAmount : 0;
      const tenancyRef = await db.collection(tenanciesCol(agencyId)).add({
        agencyId,
        propertyId,
        propertyDisplayLabel,
        applicantId: queueData.applicantId ?? null,
        applicantUserId: queueData.applicantUserId ?? null,
        applicationId: queueData.applicationId ?? null,
        offerId: queueItemId,
        tenantName,
        tenantEmail,
        tenantPhone,
        rentAmount,
        currency: "GBP",
        tenancyStartDate: null,
        tenancyEndDate: null,
        status: "active",
        createdFromQueueItemId: queueItemId,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        createdBy: session.uid,
      });
      (updates as Record<string, unknown>).tenancyId = tenancyRef.id;
      writeAuditLog({
        action: "TENANCY_CREATED",
        actorUid: session.uid,
        actorRole: session.role === "superAdmin" ? "superAdmin" : "admin",
        actorAgencyId: session.agencyId,
        targetType: "tenancy",
        targetId: tenancyRef.id,
        agencyId,
        meta: { offerId: queueItemId, createdFromQueueItemId: queueItemId },
        bypass: session.role === "superAdmin",
      });
    } else {
      const existingTenancyId = existingTenancySnap.docs[0].id;
      (updates as Record<string, unknown>).tenancyId = existingTenancyId;
    }
  }

  await ref.update(updates);

  writeAuditLog({
    action: "STAFF_ACTION_QUEUE_UPDATED",
    actorUid: session.uid,
    actorRole: session.role === "superAdmin" ? "superAdmin" : "admin",
    actorAgencyId: session.agencyId,
    targetType: "staff_action_queue",
    targetId: queueItemId,
    agencyId,
    meta: { stage: updates.stage },
    bypass: session.role === "superAdmin",
  });

  return NextResponse.json({ ok: true });
}
