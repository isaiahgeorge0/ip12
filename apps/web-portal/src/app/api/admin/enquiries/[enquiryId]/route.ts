/**
 * PATCH /api/admin/enquiries/[enquiryId]
 * Admin-only: update enquiry status and/or internal notes.
 * Body: { agencyId: string, status?: EnquiryStatus, internalNotes?: string }
 * Admin can update only own agency; superAdmin must supply agencyId.
 * Never writes undefined to Firestore. Audit log on success.
 *
 * GET /api/admin/enquiries/[enquiryId]?agencyId=...
 * Returns a single enquiry for admin (same scoping as PATCH).
 */

import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { requireServerSessionApi, assertRoleApi } from "@/lib/auth/authz";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { enquiriesCol } from "@/lib/firestore/paths";
import { serializeTimestamp } from "@/lib/serialization";
import { writeAuditLog } from "@/lib/audit/writeAuditLog";
import {
  isEnquiryStatus,
  normaliseEnquiryStatus,
  type EnquiryStatus,
} from "@/lib/types/enquiry";

const INTERNAL_NOTES_MAX = 5000;

function safeStr(v: unknown): string {
  if (v == null) return "";
  return typeof v === "string" ? v.trim() : "";
}

export async function GET(
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

  const { searchParams } = new URL(request.url);
  const agencyIdParam = searchParams.get("agencyId")?.trim();
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

  try {
    const db = getAdminFirestore();
    const ref = db.collection(enquiriesCol(agencyId)).doc(enquiryId);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json({ error: "Enquiry not found" }, { status: 404 });
    }
    const d = snap.data()!;
    const status = normaliseEnquiryStatus(d.status);
    return NextResponse.json({
      id: snap.id,
      propertyId: typeof d.propertyId === "string" ? d.propertyId : "",
      agencyId: typeof d.agencyId === "string" ? d.agencyId : agencyId,
      applicantUserId: typeof d.applicantUserId === "string" ? d.applicantUserId : "",
      applicantName: typeof d.applicantName === "string" ? d.applicantName : "",
      applicantEmail: typeof d.applicantEmail === "string" ? d.applicantEmail : "",
      applicantPhone: typeof d.applicantPhone === "string" ? d.applicantPhone : null,
      message: typeof d.message === "string" ? d.message : "",
      moveInDate: typeof d.moveInDate === "string" ? d.moveInDate : null,
      status,
      internalNotes: typeof d.internalNotes === "string" ? d.internalNotes : null,
      statusUpdatedAt: serializeTimestamp(d.statusUpdatedAt) ?? null,
      statusUpdatedBy: typeof d.statusUpdatedBy === "string" ? d.statusUpdatedBy : null,
      createdAt: serializeTimestamp(d.createdAt) ?? d.createdAt,
      updatedAt: serializeTimestamp(d.updatedAt) ?? d.updatedAt,
    });
  } catch (err) {
    if (process.env.NODE_ENV !== "production") console.error("[GET admin/enquiries]", err);
    return NextResponse.json({ error: "Failed to load enquiry" }, { status: 500 });
  }
}

export async function PATCH(
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

  let body: { agencyId?: unknown; status?: unknown; internalNotes?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
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
      return NextResponse.json({ error: "Forbidden: cannot update another agency's enquiry" }, { status: 403 });
    }
  }

  const statusRaw = body.status;
  const internalNotesRaw = body.internalNotes;
  const status = statusRaw !== undefined ? (isEnquiryStatus(statusRaw) ? (statusRaw as EnquiryStatus) : null) : undefined;
  const internalNotes =
    internalNotesRaw !== undefined
      ? (typeof internalNotesRaw === "string" ? internalNotesRaw.trim() : "")
      : undefined;

  if (status !== undefined && status === null) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }
  if (
    internalNotes !== undefined &&
    internalNotes.length > INTERNAL_NOTES_MAX
  ) {
    return NextResponse.json(
      { error: `internalNotes must be at most ${INTERNAL_NOTES_MAX} characters` },
      { status: 400 }
    );
  }

  try {
    const db = getAdminFirestore();
    const ref = db.collection(enquiriesCol(agencyId)).doc(enquiryId);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json({ error: "Enquiry not found" }, { status: 404 });
    }

    const data = snap.data() ?? {};
    const previousStatus = normaliseEnquiryStatus(data.status);

    const updates: Record<string, unknown> = {
      updatedAt: FieldValue.serverTimestamp(),
    };
    if (status !== undefined) {
      updates.status = status;
      updates.statusUpdatedAt = FieldValue.serverTimestamp();
      updates.statusUpdatedBy = session.uid;
    }
    if (internalNotes !== undefined) {
      updates.internalNotes = internalNotes || null;
    }

    await ref.update(updates);

    try {
      writeAuditLog({
        action: "ENQUIRY_STATUS_UPDATED",
        actorUid: session.uid,
        actorRole: session.role === "superAdmin" ? "superAdmin" : "admin",
        actorAgencyId: session.agencyId,
        targetType: "enquiry",
        targetId: enquiryId,
        agencyId,
        meta: {
          enquiryId,
          previousStatus,
          newStatus: status ?? previousStatus,
          ...(internalNotes !== undefined && { internalNotesLength: internalNotes.length }),
        },
      });
    } catch {
      // fire-and-forget
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      console.error("[PATCH admin/enquiries]", err);
    }
    return NextResponse.json(
      { error: "Failed to update enquiry" },
      { status: 500 }
    );
  }
}
