/**
 * GET /api/portal/messages
 * List portal messages for the signed-in user (public/lead only).
 * Scopes by recipientUserId === session.uid across all agencies.
 */

import { NextResponse } from "next/server";
import { requireServerSessionApi, assertRoleApi } from "@/lib/auth/authz";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { portalMessagesCol, propertiesCol } from "@/lib/firestore/paths";
import { serializeTimestamp } from "@/lib/serialization";
import { propertyDisplayLabel } from "@/lib/admin/normalizePropertyDisplay";

const MAX_AGENCIES = 100;
const MAX_MESSAGES = 50;

export type PortalMessageRow = {
  id: string;
  agencyId: string;
  type: string;
  recipientUserId: string;
  viewingId: string | null;
  propertyId: string | null;
  propertyDisplayLabel: string;
  applicantId: string | null;
  createdAt: number | null;
  readAt: number | null;
  actedAt: number | null;
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

  const all: PortalMessageRow[] = [];
  for (const agencyId of agencyIds) {
    const snap = await db
      .collection(portalMessagesCol(agencyId))
      .where("recipientUserId", "==", uid)
      .orderBy("createdAt", "desc")
      .limit(20)
      .get();
    for (const doc of snap.docs) {
      const d = doc.data();
      const propertyId = typeof d.propertyId === "string" ? d.propertyId : null;
      let propLabel = propertyDisplayLabel(null, propertyId ?? "");
      if (propertyId) {
        const propSnap = await db.collection(propertiesCol(agencyId)).doc(propertyId).get();
        if (propSnap.exists) propLabel = propertyDisplayLabel(propSnap.data() ?? null, propertyId);
      }
      all.push({
        id: doc.id,
        agencyId,
        type: typeof d.type === "string" ? d.type : "",
        recipientUserId: typeof d.recipientUserId === "string" ? d.recipientUserId : "",
        viewingId: typeof d.viewingId === "string" ? d.viewingId : null,
        propertyId,
        propertyDisplayLabel: propLabel,
        applicantId: typeof d.applicantId === "string" ? d.applicantId : null,
        createdAt: serializeTimestamp(d.createdAt) ?? null,
        readAt: serializeTimestamp(d.readAt) ?? null,
        actedAt: serializeTimestamp(d.actedAt) ?? null,
      });
    }
  }

  all.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
  const rows = all.slice(0, MAX_MESSAGES);
  return NextResponse.json(rows);
}
