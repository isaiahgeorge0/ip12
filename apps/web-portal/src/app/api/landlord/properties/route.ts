import { NextResponse } from "next/server";
import { requireServerSessionApi, assertRoleApi } from "@/lib/auth/authz";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { propertyLandlordsCol, propertiesCol, userDoc } from "@/lib/firestore/paths";

export type LandlordPropertyItem = {
  id: string;
  agencyId: string;
  title: string;
  postcode: string;
  status: string;
};

export async function GET(request: Request) {
  const sessionOr401 = await requireServerSessionApi();
  if (sessionOr401 instanceof NextResponse) return sessionOr401;
  const session = sessionOr401;
  const role403 = assertRoleApi(session, ["landlord", "superAdmin"]);
  if (role403) return role403;

  const { searchParams } = new URL(request.url);
  const landlordUid =
    session.role === "superAdmin"
      ? searchParams.get("landlordUid") ?? session.uid
      : session.uid;

  const db = getAdminFirestore();
  const joinSnap = await db
    .collection(propertyLandlordsCol())
    .where("landlordUid", "==", landlordUid)
    .get();

  let allowedAgencyIds: string[] | null = null;
  if (session.role === "landlord") {
    const userSnap = await db.doc(userDoc(landlordUid)).get();
    if (userSnap.exists) {
      const d = userSnap.data()!;
      allowedAgencyIds = Array.isArray(d.agencyIds) ? (d.agencyIds as string[]).filter((x) => typeof x === "string") : [];
      if (allowedAgencyIds.length === 0 && d.agencyId != null && typeof d.agencyId === "string") {
        allowedAgencyIds = [d.agencyId];
      }
    }
  }

  const rows: { agencyId: string; propertyId: string }[] = [];
  joinSnap.docs.forEach((doc) => {
    const d = doc.data();
    const agencyId = typeof d.agencyId === "string" ? d.agencyId : "";
    const propertyId = typeof d.propertyId === "string" ? d.propertyId : "";
    if (agencyId && propertyId) {
      if (session.role === "superAdmin" && session.agencyId != null && session.agencyId !== "" && session.agencyId !== agencyId) {
        return;
      }
      if (allowedAgencyIds !== null && allowedAgencyIds.length > 0 && !allowedAgencyIds.includes(agencyId)) {
        return;
      }
      if (allowedAgencyIds === null && session.agencyId != null && session.agencyId !== "" && session.agencyId !== agencyId) {
        return;
      }
      rows.push({ agencyId, propertyId });
    }
  });

  const results: LandlordPropertyItem[] = [];
  await Promise.all(
    rows.map(async ({ agencyId, propertyId }) => {
      const propRef = db.doc(`${propertiesCol(agencyId)}/${propertyId}`);
      const propSnap = await propRef.get();
      if (!propSnap.exists) return;
      const p = propSnap.data();
      if (!p) return;
      results.push({
        id: propertyId,
        agencyId,
        title:
          typeof p.displayAddress === "string"
            ? p.displayAddress
            : typeof p.address === "string"
              ? p.address
              : typeof p.title === "string"
                ? p.title
                : "Property",
        postcode: typeof p.postcode === "string" ? p.postcode : "",
        status: typeof p.status === "string" ? p.status : "—",
      });
    })
  );

  results.sort((a, b) => a.title.localeCompare(b.title, "en"));
  return NextResponse.json(results);
}
