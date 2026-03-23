/**
 * GET /api/portal/viewings
 * List viewings for the signed-in user (public/lead only).
 * Scopes by applicantUserId === session.uid across agencies.
 */

import { NextResponse } from "next/server";
import { requireServerSessionApi, assertRoleApi } from "@/lib/auth/authz";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { viewingsCol, propertiesCol } from "@/lib/firestore/paths";
import { serializeTimestamp } from "@/lib/serialization";
import { propertyDisplayLabel } from "@/lib/admin/normalizePropertyDisplay";
import { normaliseViewingStatus, type ViewingStatus } from "@/lib/types/viewing";

const MAX_AGENCIES = 100;
const MAX_VIEWINGS = 50;

export type PortalViewingRow = {
  id: string;
  agencyId: string;
  propertyId: string;
  propertyDisplayLabel: string;
  scheduledAt: number | null;
  status: ViewingStatus;
  notes: string | null;
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

  const all: PortalViewingRow[] = [];
  for (const agencyId of agencyIds) {
    const snap = await db
      .collection(viewingsCol(agencyId))
      .where("applicantUserId", "==", uid)
      .orderBy("scheduledAt", "desc")
      .limit(20)
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
        scheduledAt: serializeTimestamp(d.scheduledAt) ?? null,
        status: normaliseViewingStatus(d.status),
        notes: typeof d.notes === "string" ? d.notes : null,
      });
    }
  }

  all.sort((a, b) => (b.scheduledAt ?? 0) - (a.scheduledAt ?? 0));
  const rows = all.slice(0, MAX_VIEWINGS);
  return NextResponse.json(rows);
}
