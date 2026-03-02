import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/serverSession";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { propertiesCol } from "@/lib/firestore/paths";

const ADMIN_ROLES = ["admin", "superAdmin"] as const;

function isAdmin(role: string): boolean {
  return ADMIN_ROLES.includes(role as (typeof ADMIN_ROLES)[number]);
}

/**
 * GET /api/admin/properties
 * List properties for session.agencyId. superAdmin may pass ?agencyId= to scope.
 * Returns minimal fields for dropdowns: id, agencyId, displayAddress, postcode, status.
 */
export async function GET(request: NextRequest) {
  const session = await getServerSession();
  if (!session || !isAdmin(session.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  let agencyId = session.agencyId ?? "";
  if (session.role === "superAdmin" && searchParams.get("agencyId")) {
    agencyId = searchParams.get("agencyId")!.trim();
  }
  if (!agencyId) {
    return NextResponse.json({ error: "agencyId required" }, { status: 400 });
  }

  const db = getAdminFirestore();
  const snap = await db.collection(propertiesCol(agencyId)).get();

  const list = snap.docs.map((doc) => {
    const d = doc.data();
    const title =
      typeof d.displayAddress === "string"
        ? d.displayAddress
        : typeof d.address === "string"
          ? d.address
          : typeof d.title === "string"
            ? d.title
            : doc.id;
    return {
      id: doc.id,
      agencyId,
      displayAddress: title,
      postcode: typeof d.postcode === "string" ? d.postcode : "",
      status: typeof d.status === "string" ? d.status : "—",
    };
  });

  return NextResponse.json(list);
}
