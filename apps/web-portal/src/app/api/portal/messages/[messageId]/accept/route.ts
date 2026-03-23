/**
 * POST /api/portal/messages/[messageId]/accept
 * Accept a proceed_prompt message: mark acted, update pipeline to application_started,
 * create or link application, return applicationId and redirect path.
 * Body: { agencyId } (required to locate the message).
 * Only the message recipient (session.uid) can accept.
 */

import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import type { QuerySnapshot } from "firebase-admin/firestore";
import { requireServerSessionApi, assertRoleApi } from "@/lib/auth/authz";
import { getAdminFirestore } from "@/lib/firebase/admin";
import {
  applicationPipelineCol,
  applicationsCol,
  portalMessagesCol,
  viewingsCol,
  propertiesCol,
} from "@/lib/firestore/paths";
import { propertyDisplayLabel } from "@/lib/admin/normalizePropertyDisplay";
import { applicantDoc } from "@/lib/firestore/paths";

function safeStr(v: unknown): string {
  if (v == null) return "";
  return typeof v === "string" ? v.trim() : "";
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ messageId: string }> }
) {
  const sessionOr401 = await requireServerSessionApi();
  if (sessionOr401 instanceof NextResponse) return sessionOr401;
  const session = sessionOr401;
  const role403 = assertRoleApi(session, ["public", "lead"]);
  if (role403) return role403;

  const { messageId } = await params;
  if (!messageId) {
    return NextResponse.json({ error: "messageId required" }, { status: 400 });
  }

  let body: { agencyId?: unknown };
  try {
    body = await request.json().catch(() => ({}));
  } catch {
    body = {};
  }
  const agencyId = safeStr(body.agencyId);
  if (!agencyId) {
    return NextResponse.json({ error: "agencyId required" }, { status: 400 });
  }

  const uid = session.uid;
  const db = getAdminFirestore();

  const messageRef = db.collection(portalMessagesCol(agencyId)).doc(messageId);
  const messageSnap = await messageRef.get();
  if (!messageSnap.exists) {
    return NextResponse.json({ error: "Message not found" }, { status: 404 });
  }
  const msg = messageSnap.data()!;
  if (msg.recipientUserId !== uid) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (msg.type !== "proceed_prompt") {
    return NextResponse.json({ error: "Message is not a proceed prompt" }, { status: 400 });
  }

  await messageRef.update({
    actedAt: FieldValue.serverTimestamp(),
    readAt: FieldValue.serverTimestamp(),
  });

  const viewingId = typeof msg.viewingId === "string" ? msg.viewingId : null;
  const propertyId = typeof msg.propertyId === "string" ? msg.propertyId : "";
  const existingApplicantId = typeof msg.applicantId === "string" ? msg.applicantId : null;

  const pipelineCol = db.collection(applicationPipelineCol(agencyId));
  let pipelineSnap: QuerySnapshot | null = null;
  if (viewingId) {
    pipelineSnap = await pipelineCol.where("sourceViewingId", "==", viewingId).limit(1).get();
  }
  if ((!pipelineSnap || pipelineSnap.empty) && existingApplicantId && propertyId) {
    pipelineSnap = await pipelineCol
      .where("applicantId", "==", existingApplicantId)
      .where("propertyId", "==", propertyId)
      .limit(1)
      .get();
  }
  if ((!pipelineSnap || pipelineSnap.empty) && propertyId) {
    pipelineSnap = await pipelineCol
      .where("applicantUserId", "==", uid)
      .where("propertyId", "==", propertyId)
      .limit(1)
      .get();
  }

  let applicationId: string | null = null;
  const applicationsRef = db.collection(applicationsCol(agencyId));

  if (pipelineSnap && !pipelineSnap.empty) {
    const pipelineDoc = pipelineSnap.docs[0].data();
    applicationId = typeof pipelineDoc.applicationId === "string" ? pipelineDoc.applicationId : null;
  }

  if (applicationId) {
    const appSnap = await applicationsRef.doc(applicationId).get();
    if (appSnap.exists && pipelineSnap && !pipelineSnap.empty) {
      const pipelineRef = pipelineSnap.docs[0].ref;
      await pipelineRef.update({
        stage: "application_started",
        lastActionAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      return NextResponse.json({
        ok: true,
        applicationId,
        redirect: `/portal/applications/${applicationId}`,
      });
    }
    applicationId = null;
  }

  let applicantName = "";
  let applicantEmail = "";
  let applicantPhone: string | null = null;
  if (viewingId) {
    const viewingSnap = await db.collection(viewingsCol(agencyId)).doc(viewingId).get();
    if (viewingSnap.exists) {
      const v = viewingSnap.data()!;
      applicantName = typeof v.applicantName === "string" ? v.applicantName : "";
      applicantEmail = (typeof v.applicantEmail === "string" ? v.applicantEmail : "").trim();
      applicantPhone = typeof v.applicantPhone === "string" && v.applicantPhone ? v.applicantPhone : null;
    }
  }
  if (!applicantEmail) {
    const applicantSnap = await db.doc(applicantDoc(uid)).get();
    if (applicantSnap.exists) {
      const a = applicantSnap.data()!;
      applicantName = applicantName || (typeof a.fullName === "string" ? a.fullName : "");
      applicantEmail = (typeof a.email === "string" ? a.email : "").trim();
      applicantPhone = applicantPhone ?? (typeof a.phone === "string" ? a.phone : null);
    }
  }
  if (!applicantEmail) {
    return NextResponse.json(
      { error: "Could not resolve applicant email; please complete your profile first." },
      { status: 400 }
    );
  }

  const newApp: Record<string, unknown> = {
    fullName: applicantName || "Applicant",
    email: applicantEmail,
    phone: applicantPhone,
    propertyRef: propertyId || null,
    status: "New",
    notes: null,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    createdByUid: uid,
    applicantUserId: uid,
    source: "proceed_prompt",
    sourceViewingId: viewingId,
    sourcePropertyId: propertyId || null,
    applicationProgressStatus: "draft",
  };
  const newRef = await applicationsRef.add(newApp);
  const newId = newRef.id;

  if (pipelineSnap && !pipelineSnap.empty) {
    const pipelineRef = pipelineSnap.docs[0].ref;
    let propLabel = propertyDisplayLabel(null, propertyId);
    if (propertyId) {
      const propSnap = await db.collection(propertiesCol(agencyId)).doc(propertyId).get();
      if (propSnap.exists) propLabel = propertyDisplayLabel(propSnap.data() ?? null, propertyId);
    }
    await pipelineRef.update({
      stage: "application_started",
      applicationId: newId,
      applicantId: newId,
      propertyDisplayLabel: propLabel,
      lastActionAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  } else {
    let propLabel = propertyDisplayLabel(null, propertyId);
    if (propertyId) {
      const propSnap = await db.collection(propertiesCol(agencyId)).doc(propertyId).get();
      if (propSnap.exists) propLabel = propertyDisplayLabel(propSnap.data() ?? null, propertyId);
    }
    await pipelineCol.add({
      agencyId,
      applicantId: newId,
      applicantUserId: uid,
      propertyId,
      propertyDisplayLabel: propLabel,
      source: "proceed_prompt",
      sourceEnquiryId: null,
      sourceViewingId: viewingId,
      applicationId: newId,
      stage: "application_started",
      notes: null,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      lastActionAt: FieldValue.serverTimestamp(),
    });
  }

  return NextResponse.json({
    ok: true,
    applicationId: newId,
    redirect: `/portal/applications/${newId}`,
  });
}
