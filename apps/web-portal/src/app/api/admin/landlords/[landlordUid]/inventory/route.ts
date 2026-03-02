import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/serverSession";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { propertyLandlordsCol, propertiesCol, userDoc } from "@/lib/firestore/paths";
import { getAllowedAgencyIdsForLandlord } from "@/lib/landlordGrants";

const ADMIN_ROLES = ["admin", "superAdmin"] as const;

function isAdmin(role: string): boolean {
  return ADMIN_ROLES.includes(role as (typeof ADMIN_ROLES)[number]);
}

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
  _request: NextRequest,
  { params }: { params: Promise<{ landlordUid: string }> }
) {
  const session = await getServerSession();
  if (!session || !isAdmin(session.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { landlordUid } = await params;
  if (!landlordUid) {
    return NextResponse.json({ error: "landlordUid required" }, { status: 400 });
  }

  const db = getAdminFirestore();
  const allowedAgencyIds = await getAllowedAgencyIdsForLandlord(db, session, landlordUid);

  const col = db.collection(propertyLandlordsCol());
  let snap;
  if (session.role === "superAdmin" || allowedAgencyIds === null) {
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
    status: string;
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
        return;
      }
      const p = propSnap.data()!;
      list.push({
        agencyId,
        propertyId,
        displayAddress: typeof p.displayAddress === "string" ? p.displayAddress : "",
        postcode: typeof p.postcode === "string" ? p.postcode : "",
        status: typeof p.status === "string" ? p.status : "—",
      });
    })
  );

  list.sort((a, b) => a.displayAddress.localeCompare(b.displayAddress, "en"));
  return NextResponse.json(list);
}
