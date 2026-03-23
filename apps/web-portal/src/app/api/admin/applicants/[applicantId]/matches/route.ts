/**
 * GET /api/admin/applicants/[applicantId]/matches?agencyId=...
 * Returns recommended properties for one applicant (rule-based matching).
 * Admin: session.agencyId; superAdmin: ?agencyId= required.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireServerSessionApi, assertRoleApi } from "@/lib/auth/authz";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { applicationsCol, propertiesCol } from "@/lib/firestore/paths";
import { propertyDisplayLabel } from "@/lib/admin/normalizePropertyDisplay";
import { scoreApplicantToProperty } from "@/lib/matching/scoreApplicantToProperty";
import { safeRentPcm } from "@/lib/admin/normalizePropertyDisplay";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

export type ApplicantMatchPropertyItem = {
  propertyId: string;
  propertyDisplayLabel: string;
  rentPcm: number | null;
  type: string;
  bedrooms: number;
  score: number;
  reasons: string[];
  warnings: string[];
  matched: boolean;
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ applicantId: string }> }
) {
  const sessionOr401 = await requireServerSessionApi();
  if (sessionOr401 instanceof NextResponse) return sessionOr401;
  const session = sessionOr401;
  const role403 = assertRoleApi(session, ["admin", "superAdmin"]);
  if (role403) return role403;

  const { applicantId } = await params;
  if (!applicantId) {
    return NextResponse.json({ error: "applicantId required" }, { status: 400 });
  }

  const { searchParams } = new URL(request.url);
  const agencyIdParam = searchParams.get("agencyId")?.trim();
  const limitParam = searchParams.get("limit");
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, limitParam ? parseInt(limitParam, 10) : DEFAULT_LIMIT)
  );

  const agencyId =
    session.role === "superAdmin" && agencyIdParam
      ? agencyIdParam
      : session.agencyId ?? "";
  if (!agencyId) {
    return NextResponse.json({ error: "agencyId required" }, { status: 400 });
  }

  const db = getAdminFirestore();

  const appRef = db.doc(`${applicationsCol(agencyId)}/${applicantId}`);
  const appSnap = await appRef.get();
  if (!appSnap.exists) {
    return NextResponse.json({ error: "Applicant not found" }, { status: 404 });
  }

  const appData = appSnap.data() as Record<string, unknown>;
  const applicant = {
    id: applicantId,
    fullName: typeof appData.fullName === "string" ? appData.fullName : "",
    email: typeof appData.email === "string" ? appData.email : "",
    phone: typeof appData.phone === "string" ? appData.phone : null,
    preferences: appData.preferences ?? null,
  };

  const propsSnap = await db.collection(propertiesCol(agencyId)).get();
  const properties = propsSnap.docs.map((doc) => {
    const d = doc.data() as Record<string, unknown>;
    return {
      id: doc.id,
      displayAddress:
        typeof d.displayAddress === "string"
          ? d.displayAddress
          : typeof d.address === "string"
            ? d.address
            : typeof d.title === "string"
              ? d.title
              : "",
      postcode: typeof d.postcode === "string" ? d.postcode : "",
      type: typeof d.type === "string" ? d.type : "House",
      bedrooms: typeof d.bedrooms === "number" ? d.bedrooms : 0,
      rentPcm: safeRentPcm(d.rentPcm),
      listingType: (d.listingType as "rent" | "sale") ?? "rent",
    };
  });

  const scored = properties.map((prop) => {
    const result = scoreApplicantToProperty(applicant, prop);
    return {
      propertyId: prop.id,
      propertyDisplayLabel: propertyDisplayLabel(prop as unknown as Record<string, unknown>, prop.id),
      rentPcm: prop.rentPcm,
      type: prop.type,
      bedrooms: prop.bedrooms,
      score: result.score,
      reasons: result.reasons,
      warnings: result.warnings,
      matched: result.matched,
    };
  });

  scored.sort((a, b) => b.score - a.score);
  const list = scored.slice(0, limit) as ApplicantMatchPropertyItem[];

  return NextResponse.json(list);
}
