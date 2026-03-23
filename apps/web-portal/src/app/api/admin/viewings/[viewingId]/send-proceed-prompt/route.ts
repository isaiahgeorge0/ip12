/**
 * POST /api/admin/viewings/[viewingId]/send-proceed-prompt
 * Create an applicant-facing "proceed prompt" message linked to a completed viewing.
 * Body: { agencyId } (required for superAdmin).
 * Stores a portal message record for future inbox; intent: ask applicant if they want to proceed.
 * Audit: PROCEED_PROMPT_SENT.
 */

import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { requireServerSessionApi, assertRoleApi } from "@/lib/auth/authz";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { portalMessagesCol, propertiesCol, viewingsCol } from "@/lib/firestore/paths";
import { writeAuditLog } from "@/lib/audit/writeAuditLog";
import { upsertPipelineItem } from "@/lib/applicationPipeline/upsertPipelineItem";
import { propertyDisplayLabel } from "@/lib/admin/normalizePropertyDisplay";

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
  const recipientUserId = typeof v.applicantUserId === "string" ? v.applicantUserId : null;
  if (!recipientUserId) {
    return NextResponse.json(
      { error: "Viewing has no applicant user; cannot send proceed prompt" },
      { status: 400 }
    );
  }

  const propertyId = typeof v.propertyId === "string" ? v.propertyId : "";
  const applicantId = typeof v.applicantId === "string" ? v.applicantId : null;

  const docData: Record<string, unknown> = {
    type: "proceed_prompt",
    recipientUserId,
    agencyId,
    viewingId,
    propertyId: propertyId || null,
    applicantId,
    createdAt: FieldValue.serverTimestamp(),
    createdBy: session.uid,
    readAt: null,
  };

  const messageRef = await db.collection(portalMessagesCol(agencyId)).add(docData);

  let propertyDisplayLabelVal = propertyDisplayLabel(null, propertyId);
  if (propertyId) {
    const propSnap = await db.collection(propertiesCol(agencyId)).doc(propertyId).get();
    if (propSnap.exists) propertyDisplayLabelVal = propertyDisplayLabel(propSnap.data() ?? null, propertyId);
  }
  try {
    await upsertPipelineItem(db, agencyId, {
      applicantId,
      applicantUserId: recipientUserId,
      propertyId,
      propertyDisplayLabel: propertyDisplayLabelVal,
      source: "proceed_prompt",
      sourceEnquiryId: null,
      sourceViewingId: viewingId,
      applicationId: null,
      stage: "prompt_sent",
    });
  } catch (err) {
    if (process.env.NODE_ENV !== "production") console.error("[send-proceed-prompt] pipeline upsert", err);
  }

  try {
    writeAuditLog({
      action: "PROCEED_PROMPT_SENT",
      actorUid: session.uid,
      actorRole: session.role === "superAdmin" ? "superAdmin" : "admin",
      actorAgencyId: session.agencyId,
      targetType: "viewing",
      targetId: viewingId,
      agencyId,
      meta: { viewingId, messageId: messageRef.id, recipientUserId },
    });
  } catch {}

  return NextResponse.json({ ok: true, messageId: messageRef.id });
}
