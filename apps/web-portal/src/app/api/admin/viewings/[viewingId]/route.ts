/**
 * GET /api/admin/viewings/[viewingId]?agencyId=...
 * Returns a single viewing. Admin: own agency; superAdmin: agencyId required.
 *
 * PATCH /api/admin/viewings/[viewingId]
 * Update viewing: status, scheduledAt, notes. Same scoping. Audit: VIEWING_UPDATED, VIEWING_STATUS_UPDATED.
 */

import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { requireServerSessionApi, assertRoleApi } from "@/lib/auth/authz";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { propertiesCol, viewingsCol } from "@/lib/firestore/paths";
import { propertyDisplayLabel } from "@/lib/admin/normalizePropertyDisplay";
import { serializeTimestamp } from "@/lib/serialization";
import { writeAuditLog } from "@/lib/audit/writeAuditLog";
import {
  isViewingStatus,
  normaliseViewingStatus,
  type ViewingSource,
  type ViewingStatus,
} from "@/lib/types/viewing";

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

  const { searchParams } = new URL(request.url);
  const agencyIdParam = searchParams.get("agencyId")?.trim() ?? "";
  const { agencyId, error } = resolveAgencyId(session, agencyIdParam);
  if (error) return error;
  if (!agencyId && session.role !== "superAdmin") {
    return NextResponse.json({ error: "agencyId required" }, { status: 400 });
  }

  try {
    const db = getAdminFirestore();
    const ref = db.collection(viewingsCol(agencyId)).doc(viewingId);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json({ error: "Viewing not found" }, { status: 404 });
    }
    const d = snap.data()!;
    const status = normaliseViewingStatus(d.status);
    const propId = typeof d.propertyId === "string" ? d.propertyId : "";
    let propertyDisplayLabelVal = propertyDisplayLabel(null, propId);
    if (propId) {
      const propSnap = await db.collection(propertiesCol(agencyId)).doc(propId).get();
      if (propSnap.exists) propertyDisplayLabelVal = propertyDisplayLabel(propSnap.data() ?? null, propId);
    }
    return NextResponse.json({
      id: snap.id,
      agencyId: typeof d.agencyId === "string" ? d.agencyId : agencyId,
      propertyId: propId,
      propertyDisplayLabel: propertyDisplayLabelVal,
      applicantId: typeof d.applicantId === "string" ? d.applicantId : null,
      applicantUserId: typeof d.applicantUserId === "string" ? d.applicantUserId : null,
      enquiryId: typeof d.enquiryId === "string" ? d.enquiryId : null,
      applicantName: typeof d.applicantName === "string" ? d.applicantName : "",
      applicantEmail: typeof d.applicantEmail === "string" ? d.applicantEmail : "",
      applicantPhone: typeof d.applicantPhone === "string" ? d.applicantPhone : null,
      scheduledAt: serializeTimestamp(d.scheduledAt) ?? null,
      status,
      notes: typeof d.notes === "string" ? d.notes : null,
      source: (d.source === "enquiry" || d.source === "manual" ? d.source : "manual") as ViewingSource,
      createdAt: serializeTimestamp(d.createdAt) ?? null,
      updatedAt: serializeTimestamp(d.updatedAt) ?? null,
      createdBy: typeof d.createdBy === "string" ? d.createdBy : "",
      updatedBy: typeof d.updatedBy === "string" ? d.updatedBy : "",
    });
  } catch (err) {
    if (process.env.NODE_ENV !== "production") console.error("[GET admin/viewings]", err);
    return NextResponse.json({ error: "Failed to load viewing" }, { status: 500 });
  }
}

export async function PATCH(
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

  let body: { agencyId?: unknown; status?: unknown; scheduledAt?: unknown; notes?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const agencyIdParam = safeStr(body.agencyId);
  const { agencyId, error } = resolveAgencyId(session, agencyIdParam);
  if (error) return error;
  if (!agencyId && session.role !== "superAdmin") {
    return NextResponse.json({ error: "agencyId required" }, { status: 400 });
  }

  const statusRaw = body.status;
  const scheduledAtRaw = body.scheduledAt;
  const notesRaw = body.notes;
  const status = statusRaw !== undefined ? (isViewingStatus(statusRaw) ? (statusRaw as ViewingStatus) : null) : undefined;
  let scheduledAt: Date | undefined;
  if (scheduledAtRaw !== undefined) {
    if (typeof scheduledAtRaw === "number" && Number.isFinite(scheduledAtRaw)) {
      scheduledAt = new Date(scheduledAtRaw);
    } else if (typeof scheduledAtRaw === "string") {
      scheduledAt = new Date(scheduledAtRaw);
    } else {
      return NextResponse.json({ error: "scheduledAt must be ISO string or ms number" }, { status: 400 });
    }
    if (Number.isNaN(scheduledAt.getTime())) {
      return NextResponse.json({ error: "Invalid scheduledAt" }, { status: 400 });
    }
  }
  const notes = notesRaw !== undefined ? (typeof notesRaw === "string" ? notesRaw.trim() || null : null) : undefined;
  if (notes !== undefined && notes !== null && notes.length > NOTES_MAX) {
    return NextResponse.json({ error: `notes must be at most ${NOTES_MAX} characters` }, { status: 400 });
  }
  if (status !== undefined && status === null) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  try {
    const db = getAdminFirestore();
    const ref = db.collection(viewingsCol(agencyId)).doc(viewingId);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json({ error: "Viewing not found" }, { status: 404 });
    }
    const data = snap.data() ?? {};
    const previousStatus = normaliseViewingStatus(data.status);

    const updates: Record<string, unknown> = {
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: session.uid,
    };
    if (status !== undefined) {
      updates.status = status;
      if (status === "completed") {
        updates.completedAt = FieldValue.serverTimestamp();
      } else if (previousStatus === "completed") {
        updates.completedAt = null;
      }
    }
    if (scheduledAt !== undefined) {
      updates.scheduledAt = scheduledAt;
    }
    if (notes !== undefined) {
      updates.notes = notes;
    }

    await ref.update(updates);

    try {
      writeAuditLog({
        action: "VIEWING_UPDATED",
        actorUid: session.uid,
        actorRole: session.role === "superAdmin" ? "superAdmin" : "admin",
        actorAgencyId: session.agencyId,
        targetType: "viewing",
        targetId: viewingId,
        agencyId,
        meta: {
          viewingId,
          ...(status !== undefined && { previousStatus, newStatus: status }),
          ...(scheduledAt !== undefined && { scheduledAtMs: scheduledAt.getTime() }),
          ...(notes !== undefined && { notesLength: notes?.length ?? 0 }),
        },
      });
      if (status !== undefined && status !== previousStatus) {
        writeAuditLog({
          action: "VIEWING_STATUS_UPDATED",
          actorUid: session.uid,
          actorRole: session.role === "superAdmin" ? "superAdmin" : "admin",
          actorAgencyId: session.agencyId,
          targetType: "viewing",
          targetId: viewingId,
          agencyId,
          meta: { viewingId, previousStatus, newStatus: status },
        });
      }
    } catch {}

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (process.env.NODE_ENV !== "production") console.error("[PATCH admin/viewings]", err);
    return NextResponse.json({ error: "Failed to update viewing" }, { status: 500 });
  }
}
