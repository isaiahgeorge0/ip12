/**
 * GET /api/admin/enquiries?agencyId=...&limit=...
 * List recent enquiries for the agency. Admin sees only their agency; superAdmin may pass ?agencyId=.
 * Used by applicants page to surface enquiry-linked applicants.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireServerSessionApi, assertRoleApi } from "@/lib/auth/authz";
import { propertyDisplayLabel } from "@/lib/admin/normalizePropertyDisplay";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { enquiriesCol, propertiesCol } from "@/lib/firestore/paths";
import { serializeTimestamp } from "@/lib/serialization";
import { normaliseEnquiryStatus, type EnquiryStatus } from "@/lib/types/enquiry";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

export type AdminEnquiryRow = {
  id: string;
  propertyId: string;
  /** Human-readable property label for display. */
  propertyDisplayLabel: string;
  agencyId: string;
  applicantUserId: string;
  applicantName: string;
  applicantEmail: string;
  applicantPhone: string | null;
  message: string;
  moveInDate: string | null;
  hasPets: boolean | null;
  petDetails: string | null;
  hasChildren: boolean | null;
  employmentStatus: string | null;
  smoker: boolean | null;
  intendedOccupants: number | null;
  incomeNotes: string | null;
  source: string;
  status: EnquiryStatus;
  internalNotes: string | null;
  statusUpdatedAt: number | null;
  statusUpdatedBy: string | null;
  createdAt: unknown;
  updatedAt: unknown;
};

export async function GET(request: NextRequest) {
  const sessionOr401 = await requireServerSessionApi();
  if (sessionOr401 instanceof NextResponse) return sessionOr401;
  const session = sessionOr401;
  const role403 = assertRoleApi(session, ["admin", "superAdmin"]);
  if (role403) return role403;

  const { searchParams } = new URL(request.url);
  const agencyIdParam = searchParams.get("agencyId")?.trim();
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
    .collection(enquiriesCol(agencyId))
    .orderBy("createdAt", "desc")
    .limit(limit)
    .get();

  const list: Omit<AdminEnquiryRow, "propertyDisplayLabel">[] = snap.docs.map((doc) => {
    const d = doc.data();
    const status = normaliseEnquiryStatus(d.status);
    const internalNotes = typeof d.internalNotes === "string" ? d.internalNotes : null;
    return {
      id: doc.id,
      propertyId: typeof d.propertyId === "string" ? d.propertyId : "",
      agencyId: typeof d.agencyId === "string" ? d.agencyId : agencyId,
      applicantUserId: typeof d.applicantUserId === "string" ? d.applicantUserId : "",
      applicantName: typeof d.applicantName === "string" ? d.applicantName : "",
      applicantEmail: typeof d.applicantEmail === "string" ? d.applicantEmail : "",
      applicantPhone: typeof d.applicantPhone === "string" ? d.applicantPhone : null,
      message: typeof d.message === "string" ? d.message : "",
      moveInDate: typeof d.moveInDate === "string" ? d.moveInDate : null,
      hasPets: typeof d.hasPets === "boolean" ? d.hasPets : null,
      petDetails: typeof d.petDetails === "string" ? d.petDetails : null,
      hasChildren: typeof d.hasChildren === "boolean" ? d.hasChildren : null,
      employmentStatus: typeof d.employmentStatus === "string" ? d.employmentStatus : null,
      smoker: typeof d.smoker === "boolean" ? d.smoker : null,
      intendedOccupants: typeof d.intendedOccupants === "number" && Number.isFinite(d.intendedOccupants) ? d.intendedOccupants : null,
      incomeNotes: typeof d.incomeNotes === "string" ? d.incomeNotes : null,
      source: typeof d.source === "string" ? d.source : "",
      status,
      internalNotes,
      statusUpdatedAt: serializeTimestamp(d.statusUpdatedAt) ?? null,
      statusUpdatedBy: typeof d.statusUpdatedBy === "string" ? d.statusUpdatedBy : null,
      createdAt: serializeTimestamp(d.createdAt) ?? d.createdAt,
      updatedAt: serializeTimestamp(d.updatedAt) ?? d.updatedAt,
    };
  });

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

  const rows: AdminEnquiryRow[] = list.map((r) => ({
    ...r,
    propertyDisplayLabel: propertyLabelById.get(r.propertyId) ?? propertyDisplayLabel(null, r.propertyId),
  }));

  return NextResponse.json(rows);
}
