/**
 * GET /api/portal/enquiries
 * List enquiries for the signed-in user (public/lead only).
 * Scopes by applicantUserId === session.uid across agencies.
 */

import { NextResponse } from "next/server";
import { requireServerSessionApi, assertRoleApi } from "@/lib/auth/authz";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { enquiriesCol, propertiesCol } from "@/lib/firestore/paths";
import { serializeTimestamp } from "@/lib/serialization";
import { propertyDisplayLabel } from "@/lib/admin/normalizePropertyDisplay";
import { normaliseEnquiryStatus, type EnquiryStatus } from "@/lib/types/enquiry";

const MAX_AGENCIES = 100;
const MAX_ENQUIRIES = 100;

export type PortalEnquiryRow = {
  id: string;
  agencyId: string;
  propertyId: string;
  propertyDisplayLabel: string;
  message: string;
  status: EnquiryStatus;
  createdAt: number | null;
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

  const all: PortalEnquiryRow[] = [];
  for (const agencyId of agencyIds) {
    const snap = await db
      .collection(enquiriesCol(agencyId))
      .where("applicantUserId", "==", uid)
      .orderBy("createdAt", "desc")
      .limit(30)
      .get();
    for (const doc of snap.docs) {
      const d = doc.data();
      const propertyId = typeof d.propertyId === "string" ? d.propertyId : "";
      let propLabel = propertyDisplayLabel(null, propertyId);
      if (propertyId) {
        const propSnap = await db.collection(propertiesCol(agencyId)).doc(propertyId).get();
        if (propSnap.exists) propLabel = propertyDisplayLabel(propSnap.data() ?? null, propertyId);
      }
      all.push({
        id: doc.id,
        agencyId,
        propertyId,
        propertyDisplayLabel: propLabel,
        message: typeof d.message === "string" ? d.message : "",
        status: normaliseEnquiryStatus(d.status),
        createdAt: serializeTimestamp(d.createdAt) ?? null,
      });
    }
  }

  all.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
  const rows = all.slice(0, MAX_ENQUIRIES);
  return NextResponse.json(rows);
}
