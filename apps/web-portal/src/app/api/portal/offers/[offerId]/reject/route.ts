/**
 * POST /api/portal/offers/[offerId]/reject
 * Applicant rejects an offer. Sets offer status to "rejected" and respondedAt.
 * Only offer.applicantUserId === session.uid may call.
 */

import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { requireServerSessionApi, assertRoleApi } from "@/lib/auth/authz";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { offersCol } from "@/lib/firestore/paths";
import { writeAuditLog } from "@/lib/audit/writeAuditLog";

const MAX_AGENCIES = 100;

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ offerId: string }> }
) {
  const sessionOr401 = await requireServerSessionApi();
  if (sessionOr401 instanceof NextResponse) return sessionOr401;
  const session = sessionOr401;
  const role403 = assertRoleApi(session, ["public", "lead"]);
  if (role403) return role403;

  const { offerId } = await params;
  if (!offerId) {
    return NextResponse.json({ error: "offerId required" }, { status: 400 });
  }

  const uid = session.uid;
  const db = getAdminFirestore();

  const agenciesSnap = await db.collection("agencies").limit(MAX_AGENCIES).get();
  const agencyIds = agenciesSnap.docs.map((d) => d.id);

  let offerRef: ReturnType<ReturnType<typeof db.collection>["doc"]> | null = null;
  let agencyId: string | null = null;
  let propertyId = "";
  let status = "";

  for (const aid of agencyIds) {
    const ref = db.collection(offersCol(aid)).doc(offerId);
    const snap = await ref.get();
    if (!snap.exists) continue;
    const d = snap.data()!;
    if ((d.applicantUserId as string) !== uid) continue;
    offerRef = ref;
    agencyId = aid;
    propertyId = (d.propertyId as string) ?? "";
    status = (d.status as string) ?? "";
    break;
  }

  if (!offerRef || !agencyId) {
    return NextResponse.json({ error: "Offer not found" }, { status: 404 });
  }

  if (status === "rejected") {
    return NextResponse.json({ ok: true, alreadyRejected: true });
  }
  if (status === "accepted" || status === "withdrawn") {
    return NextResponse.json(
      { error: "Offer can no longer be rejected" },
      { status: 400 }
    );
  }

  await offerRef.update({
    status: "rejected",
    respondedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: uid,
  });

  writeAuditLog({
    action: "OFFER_REJECTED",
    actorUid: uid,
    actorRole: "public",
    actorAgencyId: null,
    targetType: "offer",
    targetId: offerId,
    agencyId,
    meta: { propertyId },
  });

  return NextResponse.json({ ok: true });
}
