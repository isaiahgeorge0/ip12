import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/serverSession";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { propertiesCol } from "@/lib/firestore/paths";
import { canAdminViewLandlord, isPropertyInLandlordInventory } from "@/lib/landlordGrants";
import { serializeTimestamp } from "@/lib/serialization";

const ADMIN_ROLES = ["admin", "superAdmin"] as const;

function isAdmin(role: string): boolean {
  return ADMIN_ROLES.includes(role as (typeof ADMIN_ROLES)[number]);
}

/**
 * GET /api/admin/properties/[propertyId]?agencyId=...&landlordUid=...
 * Returns property doc for admin view. Access: superAdmin OR agencyId === session.agencyId
 * OR (landlordUid present AND canAdminViewLandlord ok AND property in that landlord's inventory for agencyId).
 * Used when opening property from landlord inventory (cross-agency read-only).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ propertyId: string }> }
) {
  const session = await getServerSession();
  if (!session || !isAdmin(session.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

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

  const ref = db.doc(`${propertiesCol(agencyId)}/${propertyId}`);
  const snap = await ref.get();
  if (!snap.exists) {
    return NextResponse.json({ error: "Property not found" }, { status: 404 });
  }

  const d = snap.data()!;
  return NextResponse.json({
    id: snap.id,
    displayAddress: typeof d.displayAddress === "string" ? d.displayAddress : "",
    postcode: typeof d.postcode === "string" ? d.postcode : "",
    type: typeof d.type === "string" ? d.type : "House",
    bedrooms: Number(d.bedrooms) ?? 0,
    bathrooms: Number(d.bathrooms) ?? 0,
    rentPcm: d.rentPcm != null ? Number(d.rentPcm) : null,
    status: typeof d.status === "string" ? d.status : "Available",
    archived: d.archived === true,
    createdAtMs: serializeTimestamp(d.createdAt),
    updatedAtMs: serializeTimestamp(d.updatedAt),
    createdByUid: typeof d.createdByUid === "string" ? d.createdByUid : "",
    agencyId,
  });
}
