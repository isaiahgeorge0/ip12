/**
 * PATCH /api/admin/application-pipeline/[pipelineItemId]
 * Update pipeline item: stage (progressed, withdrawn, archived), notes.
 * Body: { agencyId } (required for superAdmin), stage?, notes?.
 * Admin: own agency; superAdmin: pass agencyId.
 */

import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { requireServerSessionApi, assertRoleApi } from "@/lib/auth/authz";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { applicationPipelineCol, applicationsCol } from "@/lib/firestore/paths";
import { serializeTimestamp } from "@/lib/serialization";
import { writeAuditLog } from "@/lib/audit/writeAuditLog";
import { isPipelineStage, type PipelineStage } from "@/lib/types/applicationPipeline";

const NOTES_MAX = 5000;

function safeStr(v: unknown): string {
  if (v == null) return "";
  return typeof v === "string" ? v.trim() : "";
}

function resolveAgencyId(
  session: { role?: string; agencyId?: string | null },
  agencyIdParam: string
): { agencyId: string; error?: NextResponse } {
  if (session.role === "superAdmin") {
    if (!agencyIdParam) {
      return { agencyId: "", error: NextResponse.json({ error: "agencyId required for superAdmin" }, { status: 400 }) };
    }
    return { agencyId: agencyIdParam };
  }
  const agencyId = session.agencyId ?? "";
  if (!agencyId) {
    return { agencyId: "", error: NextResponse.json({ error: "No agency" }, { status: 403 }) };
  }
  if (agencyIdParam && agencyIdParam !== agencyId) {
    return { agencyId: "", error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { agencyId };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ pipelineItemId: string }> }
) {
  const sessionOr401 = await requireServerSessionApi();
  if (sessionOr401 instanceof NextResponse) return sessionOr401;
  const session = sessionOr401;
  const role403 = assertRoleApi(session, ["admin", "superAdmin"]);
  if (role403) return role403;

  const { pipelineItemId } = await params;
  if (!pipelineItemId) {
    return NextResponse.json({ error: "pipelineItemId required" }, { status: 400 });
  }

  const { searchParams } = new URL(request.url);
  const agencyIdParam = safeStr(searchParams.get("agencyId"));
  const { agencyId, error } = resolveAgencyId(session, agencyIdParam);
  if (error) return error;

  const db = getAdminFirestore();
  const ref = db.collection(applicationPipelineCol(agencyId)).doc(pipelineItemId);
  const snap = await ref.get();
  if (!snap.exists) {
    return NextResponse.json({ error: "Pipeline item not found" }, { status: 404 });
  }

  const d = snap.data() ?? {};
  const applicantId = typeof d.applicantId === "string" ? d.applicantId : null;
  const applicationId = typeof d.applicationId === "string" ? d.applicationId : applicantId;

  let application: Record<string, unknown> | null = null;
  if (applicantId) {
    const appRef = db.collection(applicationsCol(agencyId)).doc(applicantId);
    const appSnap = await appRef.get();
    if (appSnap.exists) {
      const a = appSnap.data() ?? {};
      application = {
        id: appSnap.id,
        fullName: a.fullName ?? null,
        email: a.email ?? null,
        phone: a.phone ?? null,
        dateOfBirth: a.dateOfBirth ?? null,
        employmentStatus: a.employmentStatus ?? null,
        employerName: a.employerName ?? null,
        jobTitle: a.jobTitle ?? null,
        monthlyIncome: a.monthlyIncome ?? null,
        annualIncome: a.annualIncome ?? null,
        additionalIncomeNotes: a.additionalIncomeNotes ?? null,
        guarantorRequired: a.guarantorRequired ?? null,
        guarantorOffered: a.guarantorOffered ?? null,
        guarantorNotes: a.guarantorNotes ?? null,
        affordabilityNotes: a.affordabilityNotes ?? null,
        extraNotes: a.extraNotes ?? null,
        applicationProgressStatus: a.applicationProgressStatus ?? null,
        submittedAtMs: serializeTimestamp(a.submittedAt) ?? null,
        lastEditedAtMs: serializeTimestamp(a.lastEditedAt) ?? null,
        createdAtMs: serializeTimestamp(a.createdAt) ?? null,
        updatedAtMs: serializeTimestamp(a.updatedAt) ?? null,
      };
    }
  }

  return NextResponse.json({
    id: snap.id,
    agencyId: typeof d.agencyId === "string" ? d.agencyId : agencyId,
    applicantId,
    applicantUserId: typeof d.applicantUserId === "string" ? d.applicantUserId : null,
    applicationId,
    propertyId: typeof d.propertyId === "string" ? d.propertyId : null,
    propertyDisplayLabel:
      typeof d.propertyDisplayLabel === "string" ? d.propertyDisplayLabel : `Property ${d.propertyId ?? ""}`,
    stage: isPipelineStage(d.stage) ? (d.stage as PipelineStage) : "prompt_sent",
    notes: typeof d.notes === "string" ? d.notes : null,
    source: d.source ?? null,
    sourceEnquiryId: typeof d.sourceEnquiryId === "string" ? d.sourceEnquiryId : null,
    sourceViewingId: typeof d.sourceViewingId === "string" ? d.sourceViewingId : null,
    createdAtMs: serializeTimestamp(d.createdAt) ?? null,
    updatedAtMs: serializeTimestamp(d.updatedAt) ?? null,
    lastActionAtMs: serializeTimestamp(d.lastActionAt) ?? null,
    application,
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ pipelineItemId: string }> }
) {
  const sessionOr401 = await requireServerSessionApi();
  if (sessionOr401 instanceof NextResponse) return sessionOr401;
  const session = sessionOr401;
  const role403 = assertRoleApi(session, ["admin", "superAdmin"]);
  if (role403) return role403;

  const { pipelineItemId } = await params;
  if (!pipelineItemId) {
    return NextResponse.json({ error: "pipelineItemId required" }, { status: 400 });
  }

  let body: { agencyId?: unknown; stage?: unknown; notes?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const agencyIdParam = safeStr(body.agencyId);
  const { agencyId, error } = resolveAgencyId(session, agencyIdParam);
  if (error) return error;

  const stageRaw = body.stage;
  const notesRaw = body.notes;
  const stage = stageRaw !== undefined && isPipelineStage(stageRaw) ? (stageRaw as PipelineStage) : undefined;
  const notes =
    notesRaw !== undefined ? (typeof notesRaw === "string" ? notesRaw.trim() || null : null) : undefined;
  if (notes !== undefined && notes !== null && notes.length > NOTES_MAX) {
    return NextResponse.json({ error: `notes must be at most ${NOTES_MAX} characters` }, { status: 400 });
  }

  const db = getAdminFirestore();
  const ref = db.collection(applicationPipelineCol(agencyId)).doc(pipelineItemId);
  const snap = await ref.get();
  if (!snap.exists) {
    return NextResponse.json({ error: "Pipeline item not found" }, { status: 404 });
  }

  const updates: Record<string, unknown> = {
    updatedAt: FieldValue.serverTimestamp(),
    lastActionAt: FieldValue.serverTimestamp(),
  };
  if (stage !== undefined) updates.stage = stage;
  if (notes !== undefined) updates.notes = notes;

  await ref.update(updates);

  try {
    writeAuditLog({
      action: "PIPELINE_ITEM_UPDATED",
      actorUid: session.uid,
      actorRole: session.role === "superAdmin" ? "superAdmin" : "admin",
      actorAgencyId: session.agencyId,
      targetType: "application_pipeline",
      targetId: pipelineItemId,
      agencyId,
      meta: { pipelineItemId, ...(stage !== undefined && { stage }), ...(notes !== undefined && { notesLength: notes?.length ?? 0 }) },
    });
  } catch {}

  const d = snap.data()!;
  return NextResponse.json({
    ok: true,
    id: pipelineItemId,
    stage: stage ?? (isPipelineStage(d.stage) ? d.stage : "prompt_sent"),
    updatedAt: Date.now(),
  });
}
