import { NextRequest, NextResponse } from "next/server";
import { requireServerSessionApi, assertRoleApi } from "@/lib/auth/authz";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { landlordAgencyGrantsCol, userDoc } from "@/lib/firestore/paths";

type DocSnap = { id: string; data: () => Record<string, unknown> | undefined };

function toLandlordRow(doc: DocSnap): {
  uid: string;
  email: string;
  displayName: string;
  status: string;
  agencyIds: string[];
  agencyId: string | null;
  createdAt: unknown;
} {
  const d = doc.data();
  const agencyIds = Array.isArray(d?.agencyIds) ? (d.agencyIds as string[]).filter((x) => typeof x === "string") : [];
  const legacy = d?.agencyId != null && typeof d.agencyId === "string" ? d.agencyId : null;
  const primary =
    typeof d?.primaryAgencyId === "string" && d.primaryAgencyId.trim() ? d.primaryAgencyId.trim() : null;
  return {
    uid: doc.id,
    email: typeof d?.email === "string" ? d.email : "",
    displayName: typeof d?.displayName === "string" ? d.displayName : "",
    status: typeof d?.status === "string" ? d.status : "active",
    agencyIds,
    agencyId: primary ?? agencyIds[0] ?? legacy ?? null,
    createdAt: d?.createdAt ?? null,
  };
}

/**
 * GET /api/admin/landlords
 * Returns landlords the admin can view:
 * - superAdmin with no agencyId: all landlords.
 * - Otherwise: landlords where landlord.agencyIds (or legacy agencyId) includes session.agencyId,
 *   OR landlordAgencyGrants/{landlordUid}.sharedWithAgencyIds includes session.agencyId.
 * Sorted by displayName then email.
 */
export async function GET(_request: NextRequest) {
  const sessionOr401 = await requireServerSessionApi();
  if (sessionOr401 instanceof NextResponse) return sessionOr401;
  const session = sessionOr401;
  const role403 = assertRoleApi(session, ["admin", "superAdmin"]);
  if (role403) return role403;

  const db = getAdminFirestore();
  const col = db.collection("users");

  if (!session.agencyId) {
    const snap = await col.where("role", "==", "landlord").get();
    const list = snap.docs.map(toLandlordRow);
    list.sort((a, b) => {
      const na = (a.displayName || a.email || a.uid).toLowerCase();
      const nb = (b.displayName || b.email || b.uid).toLowerCase();
      return na.localeCompare(nb);
    });
    return NextResponse.json(list);
  }

  const [byAgencyIds, byLegacyAgencyId, grantsSnap] = await Promise.all([
    col.where("role", "==", "landlord").where("agencyIds", "array-contains", session.agencyId).get(),
    col.where("role", "==", "landlord").where("agencyId", "==", session.agencyId).get(),
    db.collection(landlordAgencyGrantsCol()).where("sharedWithAgencyIds", "array-contains", session.agencyId).get(),
  ]);

  const byUid = new Map<string, ReturnType<typeof toLandlordRow>>();
  byAgencyIds.docs.forEach((doc) => byUid.set(doc.id, toLandlordRow(doc)));
  byLegacyAgencyId.docs.forEach((doc) => {
    if (!byUid.has(doc.id)) byUid.set(doc.id, toLandlordRow(doc));
  });

  const grantLandlordUids = grantsSnap.docs.map((d) => d.id).filter((uid) => !byUid.has(uid));
  if (grantLandlordUids.length > 0) {
    const BATCH_SIZE = 10;
    for (let i = 0; i < grantLandlordUids.length; i += BATCH_SIZE) {
      const chunk = grantLandlordUids.slice(i, i + BATCH_SIZE);
      const refs = chunk.map((uid) => db.doc(userDoc(uid)));
      const snaps = await db.getAll(...refs);
      snaps.forEach((snap, idx) => {
        if (snap.exists) {
          const d = snap.data()!;
          if (d.role === "landlord" && !byUid.has(snap.id)) {
            byUid.set(snap.id, toLandlordRow(snap));
          }
        }
      });
    }
  }

  const list = Array.from(byUid.values()).filter((r) => r.uid);
  list.sort((a, b) => {
    const na = (a.displayName || a.email || a.uid).toLowerCase();
    const nb = (b.displayName || b.email || b.uid).toLowerCase();
    return na.localeCompare(nb);
  });

  return NextResponse.json(list);
}
