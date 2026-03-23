/**
 * GET /api/portal/applications
 * List applications for the signed-in user (public/lead only).
 * Scopes by applicantUserId === session.uid across agencies.
 */

import { NextResponse } from "next/server";
import { requireServerSessionApi, assertRoleApi } from "@/lib/auth/authz";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { applicationsCol, propertiesCol } from "@/lib/firestore/paths";
import { serializeTimestamp } from "@/lib/serialization";
import { propertyDisplayLabel } from "@/lib/admin/normalizePropertyDisplay";

const MAX_AGENCIES = 100;
const MAX_APPLICATIONS = 50;

export type PortalApplicationRow = {
  id: string;
  agencyId: string;
  propertyId: string | null;
  propertyDisplayLabel: string;
  fullName: string;
  email: string;
  applicationProgressStatus: string;
  lastEditedAt: number | null;
  submittedAt: number | null;
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

  const all: PortalApplicationRow[] = [];
  for (const agencyId of agencyIds) {
    const snap = await db
      .collection(applicationsCol(agencyId))
      .where("applicantUserId", "==", uid)
      .limit(30)
      .get();
    for (const doc of snap.docs) {
      const d = doc.data();
      const propertyId =
        typeof d.propertyRef === "string" && d.propertyRef
          ? d.propertyRef
          : typeof d.sourcePropertyId === "string"
            ? d.sourcePropertyId
            : null;
      const propId = propertyId ?? "";
      let propLabel = propertyDisplayLabel(null, propId);
      if (propertyId) {
        const propSnap = await db.collection(propertiesCol(agencyId)).doc(propertyId).get();
        if (propSnap.exists) propLabel = propertyDisplayLabel(propSnap.data() ?? null, propertyId);
      }
      all.push({
        id: doc.id,
        agencyId,
        propertyId,
        propertyDisplayLabel: propLabel,
        fullName: typeof d.fullName === "string" ? d.fullName : "",
        email: typeof d.email === "string" ? d.email : "",
        applicationProgressStatus: typeof d.applicationProgressStatus === "string" ? d.applicationProgressStatus : "draft",
        lastEditedAt: serializeTimestamp(d.lastEditedAt) ?? serializeTimestamp(d.updatedAt) ?? null,
        submittedAt: serializeTimestamp(d.submittedAt) ?? null,
      });
    }
  }

  all.sort((a, b) => (b.lastEditedAt ?? 0) - (a.lastEditedAt ?? 0));
  const rows = all.slice(0, MAX_APPLICATIONS);
  return NextResponse.json(rows);
}
