/**
 * GET /api/portal/offers/[offerId]
 * Get a single offer. Only the applicant (applicantUserId === session.uid) can access.
 * Returns 404 if not found or not owned.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireServerSessionApi, assertRoleApi } from "@/lib/auth/authz";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { offersCol } from "@/lib/firestore/paths";
import { serializeTimestamp } from "@/lib/serialization";
import type { OfferStatus } from "@/lib/types/offer";

const MAX_AGENCIES = 100;

export type PortalOfferDetail = {
  id: string;
  agencyId: string;
  propertyId: string;
  propertyDisplayLabel: string;
  amount: number;
  currency: string;
  status: OfferStatus;
  notes: string | null;
  createdAt: number | null;
  updatedAt: number | null;
  respondedAt: number | null;
};

export async function GET(
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

  for (const agencyId of agencyIds) {
    const ref = db.collection(offersCol(agencyId)).doc(offerId);
    const snap = await ref.get();
    if (!snap.exists) continue;
    const d = snap.data()!;
    if ((d.applicantUserId as string) !== uid) continue;

    return NextResponse.json({
      id: snap.id,
      agencyId,
      propertyId: (d.propertyId as string) ?? "",
      propertyDisplayLabel: (d.propertyDisplayLabel as string) ?? "",
      amount: typeof d.amount === "number" && Number.isFinite(d.amount) ? d.amount : 0,
      currency: (d.currency as string) ?? "GBP",
      status: (d.status as OfferStatus) ?? "draft",
      notes: typeof d.notes === "string" ? d.notes : null,
      createdAt: serializeTimestamp(d.createdAt) ?? null,
      updatedAt: serializeTimestamp(d.updatedAt) ?? null,
      respondedAt: serializeTimestamp(d.respondedAt) ?? null,
    } satisfies PortalOfferDetail);
  }

  return NextResponse.json({ error: "Offer not found" }, { status: 404 });
}
