import { NextRequest, NextResponse } from "next/server";
import { requireServerSessionApi, assertRoleApi } from "@/lib/auth/authz";
import { getAdminFirestore } from "@/lib/firebase/admin";

/**
 * GET /api/admin/agencies
 * Returns list of agencies (id, name) for superAdmin only. Used e.g. for grant multi-select.
 * Firestore: single collection "agencies" list; no composite index needed.
 */
export async function GET(_request: NextRequest) {
  const sessionOr401 = await requireServerSessionApi();
  if (sessionOr401 instanceof NextResponse) return sessionOr401;
  const session = sessionOr401;
  const role403 = assertRoleApi(session, ["superAdmin"]);
  if (role403) return role403;

  const db = getAdminFirestore();
  const snap = await db.collection("agencies").get();
  const list = snap.docs.map((doc) => {
    const d = doc.data();
    return {
      id: doc.id,
      name: typeof d.name === "string" ? d.name : doc.id,
    };
  });
  list.sort((a, b) => a.name.localeCompare(b.name, "en"));
  return NextResponse.json(list);
}
