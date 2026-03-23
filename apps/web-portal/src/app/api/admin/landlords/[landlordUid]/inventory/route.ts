import { NextRequest, NextResponse } from "next/server";
import { requireServerSessionApi, assertRoleApi } from "@/lib/auth/authz";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { propertyLandlordsCol, propertiesCol, userDoc } from "@/lib/firestore/paths";
import { getAllowedAgencyIdsForLandlord } from "@/lib/landlordGrants";

/**
 * GET /api/admin/landlords/[landlordUid]/inventory
 * Returns propertyLandlords + property summary for this landlord, scoped by allowedAgencyIds
 * (session.agencyId only, or expanded via landlord grant for cross-agency visibility).
 *
 * Firestore index (if not auto-created): propertyLandlords composite
 * (landlordUid asc, agencyId asc) for the query with landlordUid + agencyId "in" [...].
 * No orderBy on the query; sort is in memory.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ landlordUid: string }> }
) {
  const sessionOr401 = await requireServerSessionApi();
  if (sessionOr401 instanceof NextResponse) return sessionOr401;
  const session = sessionOr401;
  const role403 = assertRoleApi(session, ["admin", "superAdmin"]);
  if (role403) return role403;

  const { landlordUid } = await params;
  if (!landlordUid) {
    return NextResponse.json({ error: "landlordUid required" }, { status: 400 });
  }

  const db = getAdminFirestore();
  const allowedAgencyIds = await getAllowedAgencyIdsForLandlord(db, session, landlordUid);
  const { searchParams } = new URL(request.url);
  const queryAgencyId = searchParams.get("agencyId")?.trim() ?? "";

  const col = db.collection(propertyLandlordsCol());
  let snap;
  if (queryAgencyId) {
    if (session.role === "superAdmin" || allowedAgencyIds === null) {
      snap = await col
        .where("landlordUid", "==", landlordUid)
        .where("agencyId", "==", queryAgencyId)
        .get();
    } else if (allowedAgencyIds.includes(queryAgencyId)) {
      snap = await col
        .where("landlordUid", "==", landlordUid)
        .where("agencyId", "==", queryAgencyId)
        .get();
    } else {
      return NextResponse.json([]);
    }
  } else if (session.role === "superAdmin" || allowedAgencyIds === null) {
    snap = await col.where("landlordUid", "==", landlordUid).get();
  } else if (allowedAgencyIds.length === 0) {
    return NextResponse.json([]);
  } else {
    const chunk = allowedAgencyIds.slice(0, 30);
    snap = await col.where("landlordUid", "==", landlordUid).where("agencyId", "in", chunk).get();
  }

  const rows: { agencyId: string; propertyId: string }[] = [];
  snap.docs.forEach((doc) => {
    const d = doc.data();
    if (d.status === "removed") return;
    const agencyId = typeof d.agencyId === "string" ? d.agencyId : "";
    const propertyId = typeof d.propertyId === "string" ? d.propertyId : "";
    if (agencyId && propertyId) rows.push({ agencyId, propertyId });
  });

  const list: {
    agencyId: string;
    propertyId: string;
    displayAddress: string;
    postcode: string;
    type: string;
    bedrooms: number | null;
    bathrooms: number | null;
    status: string;
    propertyMissing: boolean;
  }[] = [];

  await Promise.all(
    rows.map(async ({ agencyId, propertyId }) => {
      const propRef = db.doc(`${propertiesCol(agencyId)}/${propertyId}`);
      const propSnap = await propRef.get();
      if (!propSnap.exists) {
        if (process.env.NODE_ENV !== "production") {
          console.warn(
            `[landlord inventory] missing property: agencyId=${agencyId} propertyId=${propertyId}`
          );
        }
        list.push({
          agencyId,
          propertyId,
          displayAddress: "Property record missing",
          postcode: "",
          type: "",
          bedrooms: null,
          bathrooms: null,
          status: "—",
          propertyMissing: true,
        });
        return;
      }
      const p = propSnap.data()!;
      const displayAddress =
        typeof p.displayAddress === "string" && p.displayAddress.trim()
          ? p.displayAddress.trim()
          : typeof p.display_address === "string" && p.display_address.trim()
            ? p.display_address.trim()
            : typeof p.address_line_1 === "string" && p.address_line_1.trim()
              ? p.address_line_1.trim()
              : propertyId;
      const type =
        typeof p.type === "string" && p.type.trim()
          ? p.type.trim()
          : typeof p.property_type === "string" && p.property_type.trim()
            ? p.property_type.trim()
            : "—";
      list.push({
        agencyId,
        propertyId,
        displayAddress,
        postcode: typeof p.postcode === "string" ? p.postcode : "",
        type,
        bedrooms: typeof p.bedrooms === "number" && Number.isFinite(p.bedrooms) ? p.bedrooms : null,
        bathrooms: typeof p.bathrooms === "number" && Number.isFinite(p.bathrooms) ? p.bathrooms : null,
        status: typeof p.status === "string" ? p.status : "—",
        propertyMissing: false,
      });
    })
  );

  list.sort((a, b) => a.displayAddress.localeCompare(b.displayAddress, "en"));
  return NextResponse.json(list);
}
