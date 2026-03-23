/**
 * POST /api/admin/viewings
 * Create an agency-scoped viewing.
 * Body: agencyId (required for superAdmin), propertyId, scheduledAt (required),
 * optional: enquiryId (prefill from enquiry), applicantId, applicantUserId,
 * applicantName, applicantEmail, applicantPhone, status, notes, source.
 * When enquiryId provided, prefills applicant/property from enquiry when not supplied.
 * Never writes undefined to Firestore. Audit: VIEWING_CREATED.
 *
 * GET /api/admin/viewings?agencyId=...&status=...&propertyId=...&applicantId=...&applicantUserId=...&limit=...
 * List viewings. Admin: own agency; superAdmin: agencyId when cross-agency.
 * Order: scheduledAt desc (newest/upcoming). Filter by status, propertyId, applicantId, applicantUserId.
 */

import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { requireServerSessionApi, assertRoleApi } from "@/lib/auth/authz";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { propertyDisplayLabel } from "@/lib/admin/normalizePropertyDisplay";
import {
  applicationsCol,
  enquiriesCol,
  propertiesCol,
  viewingsCol,
} from "@/lib/firestore/paths";
import { serializeTimestamp } from "@/lib/serialization";
import { writeAuditLog } from "@/lib/audit/writeAuditLog";
import {
  DEFAULT_VIEWING_STATUS,
  isViewingStatus,
  normaliseViewingStatus,
  type ViewingSource,
  type ViewingStatus,
} from "@/lib/types/viewing";

const NOTES_MAX = 5000;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

export type AdminViewingRow = {
  id: string;
  agencyId: string;
  propertyId: string;
  /** Human-readable property label (displayAddress / address / title / "Property {id}"). */
  propertyDisplayLabel: string;
  applicantId: string | null;
  applicantUserId: string | null;
  enquiryId: string | null;
  applicantName: string;
  applicantEmail: string;
  applicantPhone: string | null;
  scheduledAt: number | null;
  status: ViewingStatus;
  notes: string | null;
  source: ViewingSource;
  createdAt: number | null;
  updatedAt: number | null;
  createdBy: string;
  updatedBy: string;
};

function safeStr(v: unknown): string {
  if (v == null) return "";
  return typeof v === "string" ? v.trim() : "";
}

function safeStrOrNull(v: unknown): string | null {
  if (v == null) return null;
  const s = typeof v === "string" ? v.trim() : "";
  return s || null;
}

export async function GET(request: NextRequest) {
  const sessionOr401 = await requireServerSessionApi();
  if (sessionOr401 instanceof NextResponse) return sessionOr401;
  const session = sessionOr401;
  const role403 = assertRoleApi(session, ["admin", "superAdmin"]);
  if (role403) return role403;

  const { searchParams } = new URL(request.url);
  const agencyIdParam = searchParams.get("agencyId")?.trim();
  const statusParam = searchParams.get("status")?.trim();
  const propertyIdParam = searchParams.get("propertyId")?.trim();
  const applicantIdParam = searchParams.get("applicantId")?.trim();
  const applicantUserIdParam = searchParams.get("applicantUserId")?.trim();
  const limitParam = searchParams.get("limit");
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, limitParam ? parseInt(limitParam, 10) : DEFAULT_LIMIT)
  );
  if (!Number.isFinite(limit)) {
    return NextResponse.json({ error: "Invalid limit" }, { status: 400 });
  }

  let agencyId: string;
  if (session.role === "superAdmin" && agencyIdParam) {
    agencyId = agencyIdParam;
  } else {
    agencyId = session.agencyId ?? "";
  }
  if (!agencyId) {
    return NextResponse.json({ error: "agencyId required" }, { status: 400 });
  }

  const db = getAdminFirestore();
  const snap = await db
    .collection(viewingsCol(agencyId))
    .orderBy("scheduledAt", "desc")
    .limit(limit * 5)
    .get();

  const statusFilter = statusParam && (["requested", "booked", "completed", "cancelled", "no_show"] as const).includes(statusParam as "requested")
    ? (statusParam as ViewingStatus)
    : null;

  const list: Omit<AdminViewingRow, "propertyDisplayLabel">[] = [];
  for (const doc of snap.docs) {
    const d = doc.data();
    const status = normaliseViewingStatus(d.status);
    if (statusFilter != null && status !== statusFilter) continue;
    if (applicantIdParam && d.applicantId !== applicantIdParam) continue;
    if (applicantUserIdParam && d.applicantUserId !== applicantUserIdParam) continue;
    if (propertyIdParam && d.propertyId !== propertyIdParam) continue;
    list.push({
      id: doc.id,
      agencyId: typeof d.agencyId === "string" ? d.agencyId : agencyId,
      propertyId: typeof d.propertyId === "string" ? d.propertyId : "",
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
    if (list.length >= limit) break;
  }

  const propertyIds = [...new Set(list.map((r) => r.propertyId).filter(Boolean))];
  const propertyLabelById = new Map<string, string>();
  if (propertyIds.length > 0) {
    const BATCH = 30;
    for (let i = 0; i < propertyIds.length; i += BATCH) {
      const batch = propertyIds.slice(i, i + BATCH);
      const refs = batch.map((id) => db.collection(propertiesCol(agencyId)).doc(id));
      const snaps = await db.getAll(...refs);
      snaps.forEach((s, idx) => {
        const id = batch[idx];
        if (id) propertyLabelById.set(id, propertyDisplayLabel(s.exists ? s.data() ?? null : null, id));
      });
    }
  }

  const rows: AdminViewingRow[] = list.map((r) => ({
    ...r,
    propertyDisplayLabel: propertyLabelById.get(r.propertyId) ?? propertyDisplayLabel(null, r.propertyId),
  }));

  return NextResponse.json(rows);
}

export async function POST(request: NextRequest) {
  const sessionOr401 = await requireServerSessionApi();
  if (sessionOr401 instanceof NextResponse) return sessionOr401;
  const session = sessionOr401;
  const role403 = assertRoleApi(session, ["admin", "superAdmin"]);
  if (role403) return role403;

  let body: {
    agencyId?: unknown;
    propertyId?: unknown;
    scheduledAt?: unknown;
    enquiryId?: unknown;
    applicantId?: unknown;
    applicantUserId?: unknown;
    applicantName?: unknown;
    applicantEmail?: unknown;
    applicantPhone?: unknown;
    status?: unknown;
    notes?: unknown;
    source?: unknown;
  };
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
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const enquiryId = safeStrOrNull(body.enquiryId);
  const propertyIdParam = safeStr(body.propertyId);
  const scheduledAtRaw = body.scheduledAt;
  const applicantIdParam = safeStrOrNull(body.applicantId);
  const applicantUserIdParam = safeStrOrNull(body.applicantUserId);
  let applicantName = safeStr(body.applicantName);
  let applicantEmail = safeStr(body.applicantEmail);
  let applicantPhone = safeStrOrNull(body.applicantPhone);
  let propertyId = propertyIdParam;
  let applicantUserId = applicantUserIdParam;
  let applicantId = applicantIdParam;

  const db = getAdminFirestore();

  if (enquiryId) {
    const enquiryRef = db.collection(enquiriesCol(agencyId)).doc(enquiryId);
    const enquirySnap = await enquiryRef.get();
    if (!enquirySnap.exists) {
      return NextResponse.json({ error: "Enquiry not found" }, { status: 404 });
    }
    const e = enquirySnap.data()!;
    if (!propertyId) propertyId = typeof e.propertyId === "string" ? e.propertyId : "";
    if (!applicantName) applicantName = typeof e.applicantName === "string" ? e.applicantName : "";
    if (!applicantEmail) applicantEmail = typeof e.applicantEmail === "string" ? e.applicantEmail : "";
    if (applicantPhone == null) {
      applicantPhone = typeof e.applicantPhone === "string" && e.applicantPhone ? e.applicantPhone : null;
    }
    if (!applicantUserId) {
      applicantUserId = typeof e.applicantUserId === "string" && e.applicantUserId ? e.applicantUserId : null;
    }
  }

  if (!propertyId) {
    return NextResponse.json({ error: "propertyId required" }, { status: 400 });
  }

  const propRef = db.collection(propertiesCol(agencyId)).doc(propertyId);
  const propSnap = await propRef.get();
  if (!propSnap.exists) {
    return NextResponse.json({ error: "Property not found" }, { status: 404 });
  }

  let scheduledAt: Date;
  if (scheduledAtRaw == null) {
    return NextResponse.json({ error: "scheduledAt required" }, { status: 400 });
  }
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

  const statusInput = body.status;
  const status: ViewingStatus = isViewingStatus(statusInput) ? statusInput : DEFAULT_VIEWING_STATUS;
  const notesRaw = body.notes;
  const notes = notesRaw !== undefined ? safeStrOrNull(notesRaw) : null;
  if (notes !== null && notes.length > NOTES_MAX) {
    return NextResponse.json({ error: `notes must be at most ${NOTES_MAX} characters` }, { status: 400 });
  }

  const source: ViewingSource = enquiryId ? "enquiry" : "manual";

  if (!applicantId && applicantUserId) {
    const byUser = await db
      .collection(applicationsCol(agencyId))
      .where("applicantUserId", "==", applicantUserId)
      .limit(1)
      .get();
    if (!byUser.empty) {
      applicantId = byUser.docs[0].id;
    }
  }

  const uid = session.uid;
  const docData: Record<string, unknown> = {
    agencyId,
    propertyId,
    applicantName: applicantName || "Applicant",
    applicantEmail: applicantEmail || "",
    scheduledAt: scheduledAt,
    status,
    source,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    createdBy: uid,
    updatedBy: uid,
  };
  if (applicantId != null) docData.applicantId = applicantId;
  if (applicantUserId != null) docData.applicantUserId = applicantUserId;
  if (applicantPhone != null) docData.applicantPhone = applicantPhone;
  if (notes != null) docData.notes = notes;
  if (enquiryId != null) docData.enquiryId = enquiryId;

  const colRef = db.collection(viewingsCol(agencyId));
  const docRef = colRef.doc();
  await docRef.set(docData);

  try {
    writeAuditLog({
      action: "VIEWING_CREATED",
      actorUid: session.uid,
      actorRole: session.role === "superAdmin" ? "superAdmin" : "admin",
      actorAgencyId: session.agencyId,
      targetType: "viewing",
      targetId: docRef.id,
      agencyId,
      meta: { viewingId: docRef.id, propertyId, source, status },
    });
  } catch {}

  return NextResponse.json({
    id: docRef.id,
    agencyId,
    propertyId,
    applicantName: docData.applicantName,
    applicantEmail: docData.applicantEmail,
    scheduledAt: scheduledAt.getTime(),
    status,
    source,
  });
}
