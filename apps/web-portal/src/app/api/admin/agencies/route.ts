import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/serverSession";
import { getAdminFirestore } from "@/lib/firebase/admin";

/**
 * GET /api/admin/agencies
 * Returns list of agencies (id, name) for superAdmin only. Used e.g. for grant multi-select.
 * Firestore: single collection "agencies" list; no composite index needed.
 */
export async function GET(_request: NextRequest) {
  const session = await getServerSession();
  if (!session || session.role !== "superAdmin") {
    return NextResponse.json({ error: "Forbidden: superAdmin only" }, { status: 403 });
  }

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
