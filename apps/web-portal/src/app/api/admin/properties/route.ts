import { NextRequest, NextResponse } from "next/server";
import { requireServerSessionApi, assertRoleApi } from "@/lib/auth/authz";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { propertiesCol } from "@/lib/firestore/paths";
import { normalizePropertyRow } from "@/lib/admin/normalizePropertyDisplay";

/**
 * GET /api/admin/properties
 * List properties. Visibility (intended product rule):
 * - superAdmin: may pass ?agencyId= to scope; no ?agencyId= returns 400.
 * - admin: properties tab is agency-scoped only (session.agencyId). Cross-agency property
 *   access is via landlord context: when viewing a landlord, inventory can show properties
 *   from other agencies via getAllowedAgencyIdsForLandlord; the normal properties tab does NOT.
 * Returns minimal fields: id, agencyId, displayAddress, postcode, status.
 */
export async function GET(request: NextRequest) {
  const sessionOr401 = await requireServerSessionApi();
  if (sessionOr401 instanceof NextResponse) return sessionOr401;
  const session = sessionOr401;
  const role403 = assertRoleApi(session, ["admin", "superAdmin"]);
  if (role403) return role403;

  const { searchParams } = new URL(request.url);
  const agencyIdParam = searchParams.get("agencyId")?.trim() || null;

  const db = getAdminFirestore();

  // superAdmin without ?agencyId=: require explicit scope (no combined "all agencies" in this path).
  if (session.role === "superAdmin" && !agencyIdParam) {
    return NextResponse.json(
      { error: "agencyId required for superAdmin" },
      { status: 400 }
    );
  }

  // superAdmin with ?agencyId=: single agency. Canonical path: agencies/{agencyId}/properties/{docId}.
  if (session.role === "superAdmin" && agencyIdParam) {
    const snap = await db.collection(propertiesCol(agencyIdParam)).get();
    const list = snap.docs.map((doc) =>
      normalizePropertyRow(doc.id, agencyIdParam, doc.data() as Record<string, unknown>)
    );
    return NextResponse.json(list);
  }

  // Admin: properties tab is agency-scoped only (do not use getAllowedAgencyIdsForAdminTickets).
  const sessionAgencyId = session.agencyId ?? "";
  if (!sessionAgencyId) {
    return NextResponse.json({ error: "agencyId required" }, { status: 400 });
  }

  const agenciesToQuery = [sessionAgencyId];
  const snaps = await Promise.all(
    agenciesToQuery.map((aid) => db.collection(propertiesCol(aid)).get())
  );

  const list = snaps.flatMap((snap, i) => {
    const aid = agenciesToQuery[i];
    return snap.docs.map((doc) =>
      normalizePropertyRow(doc.id, aid, doc.data() as Record<string, unknown>)
    );
  });

  return NextResponse.json(list);
}
