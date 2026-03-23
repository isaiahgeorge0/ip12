import { NextRequest, NextResponse } from "next/server";
import { requireServerSessionApi, assertSuperAdminApi } from "@/lib/auth/authz";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { propertiesCol } from "@/lib/firestore/paths";

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

type AgencyRow = {
  agencyId: string;
  name: string;
  status: string;
  createdAt: unknown;
  adminCount: number;
  propertyCount: number;
};

/**
 * GET /api/superadmin/agencies
 * SuperAdmin only. Query params: q (name search), limit.
 * Returns agencies with adminCount and propertyCount.
 */
export async function GET(request: NextRequest) {
  const sessionOr401 = await requireServerSessionApi();
  if (sessionOr401 instanceof NextResponse) return sessionOr401;
  const session = sessionOr401;
  const role403 = assertSuperAdminApi(session);
  if (role403) return role403;

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? "";
  const limitParam = searchParams.get("limit");
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, limitParam ? parseInt(limitParam, 10) || DEFAULT_LIMIT : DEFAULT_LIMIT)
  );

  const db = getAdminFirestore();
  const col = db.collection("agencies");

  let snapshot;
  if (q.length >= 1) {
    const qEnd = q + "\uf8ff";
    snapshot = await col
      .where("name", ">=", q)
      .where("name", "<=", qEnd)
      .limit(limit)
      .get();
  } else {
    snapshot = await col.limit(limit).get();
  }

  const results: AgencyRow[] = await Promise.all(
    snapshot.docs.map(async (doc) => {
      const agencyId = doc.id;
      const d = doc.data();
      const [adminCountSnap, propertyCountSnap] = await Promise.all([
        db
          .collection("users")
          .where("role", "==", "admin")
          .where("primaryAgencyId", "==", agencyId)
          .count()
          .get(),
        db.collection(propertiesCol(agencyId)).count().get(),
      ]);
      const adminCount = adminCountSnap.data().count ?? 0;
      const propertyCount = propertyCountSnap.data().count ?? 0;
      return {
        agencyId,
        name: typeof d.name === "string" ? d.name : agencyId,
        status: typeof d.status === "string" ? d.status : "active",
        createdAt: d.createdAt ?? undefined,
        adminCount,
        propertyCount,
      };
    })
  );

  return NextResponse.json({ results });
}
