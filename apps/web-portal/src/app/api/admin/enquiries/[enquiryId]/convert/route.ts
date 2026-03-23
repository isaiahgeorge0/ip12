/**
 * POST /api/admin/enquiries/[enquiryId]/convert
 * Convert an enquiry into a CRM applicant (application doc) or link to existing.
 * Admin: own agency; superAdmin: body.agencyId required.
 * Duplicate prevention: by applicantUserId first, then by email. Never creates duplicate.
 * New applicants get source: "listing_enquiry", sourceEnquiryId, sourcePropertyId, applicantUserId.
 */

import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { requireServerSessionApi, assertRoleApi } from "@/lib/auth/authz";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { propertyDisplayLabel } from "@/lib/admin/normalizePropertyDisplay";
import { applicationsCol, enquiriesCol, propertiesCol } from "@/lib/firestore/paths";
import { writeAuditLog } from "@/lib/audit/writeAuditLog";
import { upsertPipelineItem } from "@/lib/applicationPipeline/upsertPipelineItem";

function safeStr(v: unknown): string {
  if (v == null) return "";
  return typeof v === "string" ? v.trim() : "";
}

export type ConvertEnquiryResult =
  | { ok: true; applicantId: string; linked: true }
  | { ok: true; applicantId: string; linked: false }
  | { error: string };

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ enquiryId: string }> }
) {
  const sessionOr401 = await requireServerSessionApi();
  if (sessionOr401 instanceof NextResponse) return sessionOr401;
  const session = sessionOr401;
  const role403 = assertRoleApi(session, ["admin", "superAdmin"]);
  if (role403) return role403;

  const { enquiryId } = await params;
  if (!enquiryId) {
    return NextResponse.json({ error: "enquiryId required" }, { status: 400 });
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
  const enquiryRef = db.collection(enquiriesCol(agencyId)).doc(enquiryId);
  const enquirySnap = await enquiryRef.get();
  if (!enquirySnap.exists) {
    return NextResponse.json({ error: "Enquiry not found" }, { status: 404 });
  }

  const e = enquirySnap.data()!;
  const applicantUserId = typeof e.applicantUserId === "string" ? e.applicantUserId : "";
  const applicantName = typeof e.applicantName === "string" ? e.applicantName : "";
  const applicantEmail = (typeof e.applicantEmail === "string" ? e.applicantEmail : "").trim().toLowerCase();
  const applicantPhone = typeof e.applicantPhone === "string" && e.applicantPhone.trim() ? e.applicantPhone.trim() : null;
  const propertyId = typeof e.propertyId === "string" ? e.propertyId : "";

  if (!applicantUserId || !applicantEmail) {
    return NextResponse.json(
      { error: "Enquiry missing applicant user or email" },
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
        applicantUserId,
        propertyId,
        propertyDisplayLabel: propLabel,
        source: "listing_enquiry",
        sourceEnquiryId: enquiryId,
        sourceViewingId: null,
        applicationId,
        stage: "application_created",
      });
    } catch (err) {
      if (process.env.NODE_ENV !== "production") console.error("[enquiry convert] pipeline upsert", err);
    }
  }

  // 1) Existing CRM applicant by applicantUserId (from a previous convert)
  const byUserId = await applicationsRef
    .where("applicantUserId", "==", applicantUserId)
    .limit(1)
    .get();

  if (!byUserId.empty) {
    const existingId = byUserId.docs[0].id;
    try {
      writeAuditLog({
        action: "ENQUIRY_CONVERTED_TO_APPLICANT",
        actorUid: session.uid,
        actorRole: session.role === "superAdmin" ? "superAdmin" : "admin",
        actorAgencyId: session.agencyId,
        targetType: "enquiry",
        targetId: enquiryId,
        agencyId,
        meta: { enquiryId, applicantId: existingId, linked: true },
      });
    } catch {}
    await pipelineUpsert(existingId);
    return NextResponse.json({
      ok: true,
      applicantId: existingId,
      linked: true,
    });
  }

  // 2) Existing CRM applicant by email (same agency)
  const byEmail = await applicationsRef
    .where("email", "==", applicantEmail)
    .limit(1)
    .get();

  if (!byEmail.empty) {
    const existingId = byEmail.docs[0].id;
    const docRef = byEmail.docs[0].ref;
    const existing = byEmail.docs[0].data();
    const updates: Record<string, unknown> = {
      updatedAt: FieldValue.serverTimestamp(),
    };
    if (typeof existing.applicantUserId !== "string") {
      updates.applicantUserId = applicantUserId;
    }
    if (typeof existing.source !== "string") {
      updates.source = "listing_enquiry";
      updates.sourceEnquiryId = enquiryId;
      updates.sourcePropertyId = propertyId || null;
    }
    if (Object.keys(updates).length > 1) {
      await docRef.update(updates);
    }
    try {
      writeAuditLog({
        action: "ENQUIRY_CONVERTED_TO_APPLICANT",
        actorUid: session.uid,
        actorRole: session.role === "superAdmin" ? "superAdmin" : "admin",
        actorAgencyId: session.agencyId,
        targetType: "enquiry",
        targetId: enquiryId,
        agencyId,
        meta: { enquiryId, applicantId: existingId, linked: true },
      });
    } catch {}
    await pipelineUpsert(existingId);
    return NextResponse.json({
      ok: true,
      applicantId: existingId,
      linked: true,
    });
  }

  // 3) Create new CRM applicant from enquiry
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
    applicantUserId,
    source: "listing_enquiry",
    sourceEnquiryId: enquiryId,
    sourcePropertyId: propertyId || null,
  };

  const newRef = await applicationsRef.add(newDoc);
  const newId = newRef.id;

  try {
    writeAuditLog({
      action: "ENQUIRY_CONVERTED_TO_APPLICANT",
      actorUid: session.uid,
      actorRole: session.role === "superAdmin" ? "superAdmin" : "admin",
      actorAgencyId: session.agencyId,
      targetType: "enquiry",
      targetId: enquiryId,
      agencyId,
      meta: { enquiryId, applicantId: newId, linked: false },
    });
  } catch {}

  await pipelineUpsert(newId);
  return NextResponse.json({
    ok: true,
    applicantId: newId,
    linked: false,
  });
}
