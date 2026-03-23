/**
 * POST /api/admin/viewings/[viewingId]/create-application
 * Create a CRM application from a viewing (or link to existing). Source: viewing_manual.
 * Admin: own agency; superAdmin: body.agencyId required.
 * Duplicate prevention: by applicantUserId first, then by email. Never creates duplicate.
 */

import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { requireServerSessionApi, assertRoleApi } from "@/lib/auth/authz";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { propertyDisplayLabel } from "@/lib/admin/normalizePropertyDisplay";
import { applicationsCol, propertiesCol, viewingsCol } from "@/lib/firestore/paths";
import { writeAuditLog } from "@/lib/audit/writeAuditLog";
import { upsertPipelineItem } from "@/lib/applicationPipeline/upsertPipelineItem";

function safeStr(v: unknown): string {
  if (v == null) return "";
  return typeof v === "string" ? v.trim() : "";
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ viewingId: string }> }
) {
  const sessionOr401 = await requireServerSessionApi();
  if (sessionOr401 instanceof NextResponse) return sessionOr401;
  const session = sessionOr401;
  const role403 = assertRoleApi(session, ["admin", "superAdmin"]);
  if (role403) return role403;

  const { viewingId } = await params;
  if (!viewingId) {
    return NextResponse.json({ error: "viewingId required" }, { status: 400 });
  }

  let body: { agencyId?: unknown };
  try {
    body = await request.json().catch(() => ({}));
  } catch {
    body = {};
  }

  const agencyIdParam = safeStr(body.agencyId);
  let agencyId: string;
  if (session.role === "superAdmin") {
    if (!agencyIdParam) {
      return NextResponse.json({ error: "agencyId required for superAdmin" }, { status: 400 });
    }
    agencyId = agencyIdParam;
  } else {
    agencyId = session.agencyId ?? "";
    if (!agencyId) {
      return NextResponse.json({ error: "No agency" }, { status: 403 });
    }
    if (agencyIdParam && agencyIdParam !== agencyId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const db = getAdminFirestore();
  const viewingRef = db.collection(viewingsCol(agencyId)).doc(viewingId);
  const viewingSnap = await viewingRef.get();
  if (!viewingSnap.exists) {
    return NextResponse.json({ error: "Viewing not found" }, { status: 404 });
  }

  const v = viewingSnap.data()!;
  const applicantUserId = typeof v.applicantUserId === "string" ? v.applicantUserId : "";
  const applicantName = typeof v.applicantName === "string" ? v.applicantName : "";
  const applicantEmail = (typeof v.applicantEmail === "string" ? v.applicantEmail : "").trim().toLowerCase();
  const applicantPhone = typeof v.applicantPhone === "string" && v.applicantPhone.trim() ? v.applicantPhone.trim() : null;
  const propertyId = typeof v.propertyId === "string" ? v.propertyId : "";
  const existingApplicantId = typeof v.applicantId === "string" ? v.applicantId : null;

  if (!applicantEmail) {
    return NextResponse.json(
      { error: "Viewing missing applicant email" },
      { status: 400 }
    );
  }

  const applicationsRef = db.collection(applicationsCol(agencyId));

  async function pipelineUpsert(applicationId: string) {
    let propLabel = propertyDisplayLabel(null, propertyId);
    if (propertyId) {
      const propSnap = await db.collection(propertiesCol(agencyId)).doc(propertyId).get();
      if (propSnap.exists) propLabel = propertyDisplayLabel(propSnap.data() ?? null, propertyId);
    }
    try {
      await upsertPipelineItem(db, agencyId, {
        applicantId: applicationId,
        applicantUserId: applicantUserId || null,
        propertyId,
        propertyDisplayLabel: propLabel,
        source: "viewing_manual",
        sourceEnquiryId: null,
        sourceViewingId: viewingId,
        applicationId,
        stage: "application_created",
      });
    } catch (err) {
      if (process.env.NODE_ENV !== "production") console.error("[create-application] pipeline upsert", err);
    }
  }

  if (existingApplicantId) {
    const existingSnap = await applicationsRef.doc(existingApplicantId).get();
    if (existingSnap.exists) {
      try {
        writeAuditLog({
          action: "VIEWING_APPLICATION_CREATED",
          actorUid: session.uid,
          actorRole: session.role === "superAdmin" ? "superAdmin" : "admin",
          actorAgencyId: session.agencyId,
          targetType: "viewing",
          targetId: viewingId,
          agencyId,
          meta: { viewingId, applicantId: existingApplicantId, linked: true },
        });
      } catch {}
      await pipelineUpsert(existingApplicantId);
      return NextResponse.json({
        ok: true,
        applicantId: existingApplicantId,
        linked: true,
      });
    }
  }

  if (applicantUserId) {
    const byUserId = await applicationsRef
      .where("applicantUserId", "==", applicantUserId)
      .limit(1)
      .get();
    if (!byUserId.empty) {
      const existingId = byUserId.docs[0].id;
      try {
        writeAuditLog({
          action: "VIEWING_APPLICATION_CREATED",
          actorUid: session.uid,
          actorRole: session.role === "superAdmin" ? "superAdmin" : "admin",
          actorAgencyId: session.agencyId,
          targetType: "viewing",
          targetId: viewingId,
          agencyId,
          meta: { viewingId, applicantId: existingId, linked: true },
        });
      } catch {}
      await pipelineUpsert(existingId);
      return NextResponse.json({ ok: true, applicantId: existingId, linked: true });
    }
  }

  const byEmail = await applicationsRef
    .where("email", "==", applicantEmail)
    .limit(1)
    .get();
  if (!byEmail.empty) {
    const existingId = byEmail.docs[0].id;
    const docRef = byEmail.docs[0].ref;
    const existing = byEmail.docs[0].data();
    const updates: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() };
    if (applicantUserId && typeof existing.applicantUserId !== "string") {
      updates.applicantUserId = applicantUserId;
    }
    if (typeof existing.source !== "string") {
      updates.source = "viewing_manual";
      updates.sourceViewingId = viewingId;
      updates.sourcePropertyId = propertyId || null;
    }
    if (Object.keys(updates).length > 1) {
      await docRef.update(updates);
    }
    try {
      writeAuditLog({
        action: "VIEWING_APPLICATION_CREATED",
        actorUid: session.uid,
        actorRole: session.role === "superAdmin" ? "superAdmin" : "admin",
        actorAgencyId: session.agencyId,
        targetType: "viewing",
        targetId: viewingId,
        agencyId,
        meta: { viewingId, applicantId: existingId, linked: true },
      });
    } catch {}
    await pipelineUpsert(existingId);
    return NextResponse.json({ ok: true, applicantId: existingId, linked: true });
  }

  const newDoc: Record<string, unknown> = {
    fullName: applicantName || "Applicant",
    email: applicantEmail,
    phone: applicantPhone,
    propertyRef: propertyId || null,
    status: "New",
    notes: null,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    createdByUid: session.uid,
    source: "viewing_manual",
    sourceViewingId: viewingId,
    sourcePropertyId: propertyId || null,
  };
  if (applicantUserId) newDoc.applicantUserId = applicantUserId;

  const newRef = await applicationsRef.add(newDoc);
  const newId = newRef.id;

  try {
    writeAuditLog({
      action: "VIEWING_APPLICATION_CREATED",
      actorUid: session.uid,
      actorRole: session.role === "superAdmin" ? "superAdmin" : "admin",
      actorAgencyId: session.agencyId,
      targetType: "viewing",
      targetId: viewingId,
      agencyId,
      meta: { viewingId, applicantId: newId, linked: false },
    });
  } catch {}

  await pipelineUpsert(newId);
  return NextResponse.json({ ok: true, applicantId: newId, linked: false });
}
