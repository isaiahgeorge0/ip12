/**
 * GET /api/portal/applications/[applicationId]
 * Get a single application. Only the applicant (applicantUserId === session.uid) can access.
 * Returns 404 if not found or not owned.
 *
 * PATCH /api/portal/applications/[applicationId]
 * Update application (draft or submit). Same ownership check. Body: application form fields.
 */

import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { requireServerSessionApi, assertRoleApi } from "@/lib/auth/authz";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { applicationsCol, propertiesCol } from "@/lib/firestore/paths";
import { serializeTimestamp } from "@/lib/serialization";
import { propertyDisplayLabel } from "@/lib/admin/normalizePropertyDisplay";
import {
  APPLICATION_PROGRESS_STATUSES,
  type ApplicationFormFields,
  type ApplicationProgressStatus,
} from "@/lib/types/applicationForm";

const ALLOWED_PATCH_KEYS: (keyof ApplicationFormFields)[] = [
  "fullName",
  "email",
  "phone",
  "dateOfBirth",
  "currentAddressLine1",
  "currentAddressLine2",
  "currentCity",
  "currentPostcode",
  "reasonForMoving",
  "intendedOccupants",
  "hasChildren",
  "hasPets",
  "petDetails",
  "smoker",
  "moveInDate",
  "employmentStatus",
  "employerName",
  "jobTitle",
  "monthlyIncome",
  "annualIncome",
  "additionalIncomeNotes",
  "guarantorRequired",
  "guarantorOffered",
  "guarantorNotes",
  "affordabilityNotes",
  "extraNotes",
  "applicationProgressStatus",
];

function isApplicationProgressStatus(s: unknown): s is ApplicationProgressStatus {
  return typeof s === "string" && (APPLICATION_PROGRESS_STATUSES as readonly string[]).includes(s);
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ applicationId: string }> }
) {
  const sessionOr401 = await requireServerSessionApi();
  if (sessionOr401 instanceof NextResponse) return sessionOr401;
  const session = sessionOr401;
  const role403 = assertRoleApi(session, ["public", "lead"]);
  if (role403) return role403;

  const { applicationId } = await params;
  if (!applicationId) {
    return NextResponse.json({ error: "applicationId required" }, { status: 400 });
  }

  const uid = session.uid;
  const db = getAdminFirestore();

  const agenciesSnap = await db.collection("agencies").limit(100).get();
  for (const agencyDoc of agenciesSnap.docs) {
    const agencyId = agencyDoc.id;
    const appRef = db.collection(applicationsCol(agencyId)).doc(applicationId);
    const appSnap = await appRef.get();
    if (!appSnap.exists) continue;
    const d = appSnap.data()!;
    const appUid = typeof d.applicantUserId === "string" ? d.applicantUserId : null;
    if (appUid !== uid) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const propertyId = typeof d.propertyRef === "string" ? d.propertyRef : typeof d.sourcePropertyId === "string" ? d.sourcePropertyId : null;
    let propertyDisplayLabelVal = propertyDisplayLabel(null, propertyId ?? "");
    if (propertyId) {
      const propSnap = await db.collection(propertiesCol(agencyId)).doc(propertyId).get();
      if (propSnap.exists) propertyDisplayLabelVal = propertyDisplayLabel(propSnap.data() ?? null, propertyId);
    }
    const out: Record<string, unknown> = {
      id: appSnap.id,
      agencyId,
      fullName: d.fullName,
      email: d.email,
      phone: d.phone,
      propertyRef: d.propertyRef,
      sourcePropertyId: d.sourcePropertyId,
      status: d.status,
      notes: d.notes,
      applicantUserId: d.applicantUserId,
      source: d.source,
      sourceViewingId: d.sourceViewingId,
      sourceEnquiryId: d.sourceEnquiryId,
      applicationProgressStatus: d.applicationProgressStatus ?? "draft",
      propertyDisplayLabel: propertyDisplayLabelVal,
      dateOfBirth: d.dateOfBirth,
      currentAddressLine1: d.currentAddressLine1,
      currentAddressLine2: d.currentAddressLine2,
      currentCity: d.currentCity,
      currentPostcode: d.currentPostcode,
      reasonForMoving: d.reasonForMoving,
      intendedOccupants: d.intendedOccupants,
      hasChildren: d.hasChildren,
      hasPets: d.hasPets,
      petDetails: d.petDetails,
      smoker: d.smoker,
      moveInDate: d.moveInDate,
      employmentStatus: d.employmentStatus,
      employerName: d.employerName,
      jobTitle: d.jobTitle,
      monthlyIncome: d.monthlyIncome,
      annualIncome: d.annualIncome,
      additionalIncomeNotes: d.additionalIncomeNotes,
      guarantorRequired: d.guarantorRequired,
      guarantorOffered: d.guarantorOffered,
      guarantorNotes: d.guarantorNotes,
      affordabilityNotes: d.affordabilityNotes,
      extraNotes: d.extraNotes,
      createdAtMs: serializeTimestamp(d.createdAt) ?? null,
      updatedAtMs: serializeTimestamp(d.updatedAt) ?? null,
      submittedAtMs: serializeTimestamp(d.submittedAt) ?? null,
      lastEditedAtMs: serializeTimestamp(d.lastEditedAt) ?? null,
    };
    return NextResponse.json(out);
  }

  return NextResponse.json({ error: "Application not found" }, { status: 404 });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ applicationId: string }> }
) {
  const sessionOr401 = await requireServerSessionApi();
  if (sessionOr401 instanceof NextResponse) return sessionOr401;
  const session = sessionOr401;
  const role403 = assertRoleApi(session, ["public", "lead"]);
  if (role403) return role403;

  const { applicationId } = await params;
  if (!applicationId) {
    return NextResponse.json({ error: "applicationId required" }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const uid = session.uid;
  const db = getAdminFirestore();

  const agenciesSnap = await db.collection("agencies").limit(100).get();
  for (const agencyDoc of agenciesSnap.docs) {
    const agencyId = agencyDoc.id;
    const appRef = db.collection(applicationsCol(agencyId)).doc(applicationId);
    const appSnap = await appRef.get();
    if (!appSnap.exists) continue;
    const d = appSnap.data()!;
    const appUid = typeof d.applicantUserId === "string" ? d.applicantUserId : null;
    if (appUid !== uid) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const updates: Record<string, unknown> = {
      updatedAt: FieldValue.serverTimestamp(),
      lastEditedAt: FieldValue.serverTimestamp(),
    };

    const submitRequested = isApplicationProgressStatus(body.applicationProgressStatus) && body.applicationProgressStatus === "submitted";

    for (const key of ALLOWED_PATCH_KEYS) {
      const v = body[key];
      if (v === undefined) continue;
      if (key === "applicationProgressStatus") {
        if (isApplicationProgressStatus(v)) updates.applicationProgressStatus = v;
        continue;
      }
      if (key === "phone" || key === "dateOfBirth" || key === "currentAddressLine1" || key === "currentAddressLine2" || key === "currentCity" || key === "currentPostcode" || key === "reasonForMoving" || key === "petDetails" || key === "moveInDate" || key === "employmentStatus" || key === "employerName" || key === "jobTitle" || key === "additionalIncomeNotes" || key === "guarantorNotes" || key === "affordabilityNotes" || key === "extraNotes") {
        updates[key] = typeof v === "string" ? v.trim() || null : v === null ? null : v;
        continue;
      }
      if (key === "intendedOccupants" || key === "monthlyIncome" || key === "annualIncome") {
        const n = typeof v === "number" && Number.isFinite(v) ? v : v === null ? null : Number(v);
        updates[key] = n !== null && Number.isFinite(n) ? n : null;
        continue;
      }
      if (key === "hasChildren" || key === "hasPets" || key === "smoker" || key === "guarantorRequired" || key === "guarantorOffered") {
        updates[key] = v === true || v === false ? v : null;
        continue;
      }
      if (key === "fullName" || key === "email") {
        updates[key] = typeof v === "string" ? v.trim() : "";
        continue;
      }
    }

    if (submitRequested) {
      updates.submittedAt = FieldValue.serverTimestamp();
      updates.applicationProgressStatus = "submitted";
    }

    await appRef.update(updates);

    return NextResponse.json({ ok: true, applicationId });
  }

  return NextResponse.json({ error: "Application not found" }, { status: 404 });
}
