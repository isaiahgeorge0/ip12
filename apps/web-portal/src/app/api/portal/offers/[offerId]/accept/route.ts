/**
 * POST /api/portal/offers/[offerId]/accept
 * Applicant accepts an offer. Sets offer status to "accepted", respondedAt, and pipeline stage to "offer_accepted".
 * Only offer.applicantUserId === session.uid may call.
 */

import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import type { DocumentReference } from "firebase-admin/firestore";
import { requireServerSessionApi, assertRoleApi } from "@/lib/auth/authz";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { offersCol, applicationPipelineCol, staffActionQueueCol, propertiesCol } from "@/lib/firestore/paths";
import { writeAuditLog } from "@/lib/audit/writeAuditLog";
import { propertyDisplayLabel } from "@/lib/admin/normalizePropertyDisplay";

const MAX_AGENCIES = 100;

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ offerId: string }> }
) {
  const sessionOr401 = await requireServerSessionApi();
  if (sessionOr401 instanceof NextResponse) return sessionOr401;
  const session = sessionOr401;
  const role403 = assertRoleApi(session, ["public", "lead"]);
  if (role403) return role403;

  const { offerId } = await params;
  if (!offerId) {
    return NextResponse.json({ error: "offerId required" }, { status: 400 });
  }

  const uid = session.uid;
  const db = getAdminFirestore();

  const agenciesSnap = await db.collection("agencies").limit(MAX_AGENCIES).get();
  const agencyIds = agenciesSnap.docs.map((d) => d.id);

  let offerRef: DocumentReference | null = null;
  let agencyId: string | null = null;
  let offerData: Record<string, unknown> = {};

  for (const aid of agencyIds) {
    const ref = db.collection(offersCol(aid)).doc(offerId);
    const snap = await ref.get();
    if (!snap.exists) continue;
    const d = snap.data()!;
    if ((d.applicantUserId as string) !== uid) continue;
    offerRef = ref;
    agencyId = aid;
    offerData = d as Record<string, unknown>;
    break;
  }

  if (!offerRef || !agencyId) {
    return NextResponse.json({ error: "Offer not found" }, { status: 404 });
  }

  const status = offerData.status as string;
  if (status === "accepted") {
    return NextResponse.json({ ok: true, alreadyAccepted: true });
  }
  if (status === "rejected" || status === "withdrawn") {
    return NextResponse.json(
      { error: "Offer can no longer be accepted" },
      { status: 400 }
    );
  }

  await offerRef.update({
    status: "accepted",
    respondedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: uid,
  });

  const applicationId = typeof offerData.applicationId === "string" ? offerData.applicationId : null;
  const applicantId = typeof offerData.applicantId === "string" ? offerData.applicantId : null;
  const propertyId = typeof offerData.propertyId === "string" ? offerData.propertyId : "";

  const pipelineCol = db.collection(applicationPipelineCol(agencyId));
  const pipelineSnap = await pipelineCol.get();
  let pipelineUpdated = false;
  for (const doc of pipelineSnap.docs) {
    const d = doc.data();
    const match =
      (applicationId && d.applicationId === applicationId) ||
      (applicantId && d.applicantId === applicantId && d.propertyId === propertyId) ||
      (d.applicantUserId === uid && d.propertyId === propertyId);
    if (match) {
      await doc.ref.update({
        stage: "offer_accepted",
        updatedAt: FieldValue.serverTimestamp(),
        lastActionAt: FieldValue.serverTimestamp(),
      });
      pipelineUpdated = true;
      break;
    }
  }

  writeAuditLog({
    action: "OFFER_ACCEPTED",
    actorUid: uid,
    actorRole: "public",
    actorAgencyId: null,
    targetType: "offer",
    targetId: offerId,
    agencyId,
    meta: { propertyId, pipelineUpdated },
  });

  const now = FieldValue.serverTimestamp();
  const applicantName = typeof offerData.applicantName === "string" ? offerData.applicantName : "";
  const applicantEmail = typeof offerData.applicantEmail === "string" ? offerData.applicantEmail : "";
  const applicantPhone = typeof offerData.applicantPhone === "string" ? offerData.applicantPhone : null;
  const offerAmount = typeof offerData.amount === "number" && Number.isFinite(offerData.amount) ? offerData.amount : 0;
  let resolvedPropertyLabel: string;
  if (typeof offerData.propertyDisplayLabel === "string" && offerData.propertyDisplayLabel) {
    resolvedPropertyLabel = offerData.propertyDisplayLabel;
  } else {
    const propSnap = await db.doc(`${propertiesCol(agencyId)}/${propertyId}`).get();
    resolvedPropertyLabel = propertyDisplayLabel(propSnap.exists ? (propSnap.data() ?? null) : null, propertyId);
  }

  const queueCol = db.collection(staffActionQueueCol(agencyId));
  const queueDocRef = queueCol.doc(offerId);
  const queueSnap = await queueDocRef.get();
  const queuePayload = {
    agencyId,
    offerId,
    applicationId,
    applicantId,
    applicantUserId: uid,
    propertyId,
    propertyDisplayLabel: resolvedPropertyLabel,
    applicantName: applicantName || "—",
    applicantEmail: applicantEmail || "—",
    applicantPhone,
    offerAmount,
    currency: "GBP" as const,
    stage: "offer_accepted" as const,
    source: "offer_accept" as const,
    notes: null as string | null,
    acceptedAt: now,
    lastActionAt: now,
    updatedAt: now,
    updatedBy: uid,
  };

  if (queueSnap.exists) {
    await queueDocRef.update(queuePayload);
    writeAuditLog({
      action: "STAFF_ACTION_QUEUE_UPDATED",
      actorUid: uid,
      actorRole: "public",
      actorAgencyId: null,
      targetType: "staff_action_queue",
      targetId: offerId,
      agencyId,
      meta: { offerId, stage: "offer_accepted" },
    });
  } else {
    await queueDocRef.set({
      ...queuePayload,
      createdAt: now,
      createdBy: uid,
    });
    writeAuditLog({
      action: "OFFER_ACCEPTED_QUEUE_CREATED",
      actorUid: uid,
      actorRole: "public",
      actorAgencyId: null,
      targetType: "staff_action_queue",
      targetId: offerId,
      agencyId,
      meta: { offerId },
    });
  }

  return NextResponse.json({ ok: true });
}
