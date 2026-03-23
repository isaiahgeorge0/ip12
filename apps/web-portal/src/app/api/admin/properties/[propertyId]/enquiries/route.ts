/**
 * GET /api/admin/properties/[propertyId]/enquiries?agencyId=...
 * List enquiries for this property. Agency-scoped: admin sees only their agency's enquiries;
 * superAdmin may pass agencyId to scope. Same access as property detail (session agency or
 * landlord cross-agency when canAdminViewLandlord + property in inventory).
 */

import { NextRequest, NextResponse } from "next/server";
import { requireServerSessionApi, assertRoleApi } from "@/lib/auth/authz";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { enquiriesCol, propertiesCol } from "@/lib/firestore/paths";
import { canAdminViewLandlord, isPropertyInLandlordInventory } from "@/lib/landlordGrants";
import { serializeTimestamp } from "@/lib/serialization";
import { normaliseEnquiryStatus, type EnquiryStatus } from "@/lib/types/enquiry";

export type EnquiryRow = {
  id: string;
  propertyId: string;
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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ propertyId: string }> }
) {
  const sessionOr401 = await requireServerSessionApi();
  if (sessionOr401 instanceof NextResponse) return sessionOr401;
  const session = sessionOr401;
  const role403 = assertRoleApi(session, ["admin", "superAdmin"]);
  if (role403) return role403;

  const { propertyId } = await params;
  if (!propertyId) {
    return NextResponse.json({ error: "propertyId required" }, { status: 400 });
  }

  const { searchParams } = new URL(request.url);
  const agencyId = searchParams.get("agencyId")?.trim();
  const landlordUid = searchParams.get("landlordUid")?.trim();

  if (!agencyId) {
    return NextResponse.json({ error: "agencyId required" }, { status: 400 });
  }

  const db = getAdminFirestore();
  const sessionAgencyId = session.agencyId ?? "";

  let allowed = false;
  if (session.role === "superAdmin") {
    allowed = true;
  } else if (sessionAgencyId === agencyId) {
    allowed = true;
  } else if (landlordUid) {
    const access = await canAdminViewLandlord(db, session, landlordUid);
    if (access.ok) {
      const inInventory = await isPropertyInLandlordInventory(db, agencyId, propertyId, landlordUid);
      allowed = inInventory;
    }
  }

  if (!allowed) {
    return NextResponse.json({ error: "Forbidden: no access to this property" }, { status: 403 });
  }

  const snap = await db
    .collection(enquiriesCol(agencyId))
    .where("propertyId", "==", propertyId)
    .orderBy("createdAt", "desc")
    .limit(100)
    .get();

  const list: EnquiryRow[] = snap.docs.map((doc) => {
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

  return NextResponse.json(list);
}
