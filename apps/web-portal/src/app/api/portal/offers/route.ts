/**
 * GET /api/portal/offers
 * List offers for the signed-in applicant (public/lead only).
 * Scopes by applicantUserId === session.uid across agencies.
 */

import { NextResponse } from "next/server";
import { requireServerSessionApi, assertRoleApi } from "@/lib/auth/authz";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { offersCol } from "@/lib/firestore/paths";
import { serializeTimestamp } from "@/lib/serialization";
import type { OfferStatus } from "@/lib/types/offer";

const MAX_AGENCIES = 100;
const MAX_OFFERS = 100;

export type PortalOfferRow = {
  id: string;
  agencyId: string;
  propertyId: string;
  propertyDisplayLabel: string;
  amount: number;
  currency: string;
  status: OfferStatus;
  notes: string | null;
  createdAt: number | null;
  respondedAt: number | null;
};

export async function GET() {
  const sessionOr401 = await requireServerSessionApi();
  if (sessionOr401 instanceof NextResponse) return sessionOr401;
  const session = sessionOr401;
  const role403 = assertRoleApi(session, ["public", "lead"]);
  if (role403) return role403;

  const uid = session.uid;
  const db = getAdminFirestore();

  const agenciesSnap = await db.collection("agencies").limit(MAX_AGENCIES).get();
  const agencyIds = agenciesSnap.docs.map((d) => d.id);

  const all: PortalOfferRow[] = [];
  for (const agencyId of agencyIds) {
    const snap = await db
      .collection(offersCol(agencyId))
      .where("applicantUserId", "==", uid)
      .get();
    for (const doc of snap.docs) {
      const d = doc.data();
      all.push({
        id: doc.id,
        agencyId,
        propertyId: (d.propertyId as string) ?? "",
        propertyDisplayLabel: (d.propertyDisplayLabel as string) ?? "",
        amount: typeof d.amount === "number" && Number.isFinite(d.amount) ? d.amount : 0,
        currency: (d.currency as string) ?? "GBP",
        status: (d.status as OfferStatus) ?? "draft",
        notes: typeof d.notes === "string" ? d.notes : null,
        createdAt: serializeTimestamp(d.createdAt) ?? null,
        respondedAt: serializeTimestamp(d.respondedAt) ?? null,
      });
    }
  }

  all.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
  const rows = all.slice(0, MAX_OFFERS);
  return NextResponse.json(rows);
}
