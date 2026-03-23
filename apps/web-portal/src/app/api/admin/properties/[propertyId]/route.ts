import { NextRequest, NextResponse } from "next/server";
import { requireServerSessionApi, assertRoleApi } from "@/lib/auth/authz";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { propertiesCol } from "@/lib/firestore/paths";
import { canAdminViewLandlord, isPropertyInLandlordInventory } from "@/lib/landlordGrants";
import { serializeTimestamp } from "@/lib/serialization";
import {
  normalizedDisplayAddress,
  safeRentPcm,
} from "@/lib/admin/normalizePropertyDisplay";

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

  // Canonical path: agencies/{agencyId}/properties/{propertyId}; propertyId = Firestore doc id.
  const ref = db.doc(`${propertiesCol(agencyId)}/${propertyId}`);
  const snap = await ref.get();
  if (!snap.exists) {
    return NextResponse.json({ error: "Property not found" }, { status: 404 });
  }

  const d = snap.data() as Record<string, unknown>;
  return NextResponse.json({
    id: snap.id,
    displayAddress: normalizedDisplayAddress(d, snap.id),
    postcode: typeof d.postcode === "string" ? d.postcode : "",
    type: typeof d.type === "string" ? d.type : "House",
    bedrooms: Number(d.bedrooms) ?? 0,
    bathrooms: Number(d.bathrooms) ?? 0,
    rentPcm: safeRentPcm(d.rentPcm),
    status: typeof d.status === "string" ? d.status : "Available",
    archived: d.archived === true,
    createdAtMs: serializeTimestamp(d.createdAt),
    updatedAtMs: serializeTimestamp(d.updatedAt),
    createdByUid: typeof d.createdByUid === "string" ? d.createdByUid : "",
    agencyId,
  });
}
