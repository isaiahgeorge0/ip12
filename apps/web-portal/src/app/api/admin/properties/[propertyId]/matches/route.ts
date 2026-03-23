/**
 * GET /api/admin/properties/[propertyId]/matches?agencyId=...
 * Returns recommended applicants for one property (rule-based matching).
 * Admin: session.agencyId; superAdmin: ?agencyId= required.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireServerSessionApi, assertRoleApi } from "@/lib/auth/authz";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { applicationsCol, propertiesCol } from "@/lib/firestore/paths";
import { propertyDisplayLabel, safeRentPcm } from "@/lib/admin/normalizePropertyDisplay";
import { scoreApplicantToProperty } from "@/lib/matching/scoreApplicantToProperty";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

export type PropertyMatchApplicantItem = {
  applicantId: string;
  applicantName: string;
  applicantEmail: string;
  applicantPhone: string | null;
  score: number;
  reasons: string[];
  warnings: string[];
  matched: boolean;
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ propertyId: string }> }
) {
  const sessionOr401 = await requireServerSessionApi();
  if (sessionOr401 instanceof NextResponse) return sessionOr401;
  const session = sessionOr401;
  const role403 = assertRoleApi(session, ["admin", "superAdmin"]);
  if (role403) return role403;

  const { propertyId } = await params;
  if (!propertyId) {
    return NextResponse.json({ error: "propertyId required" }, { status: 400 });
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

  const propRef = db.doc(`${propertiesCol(agencyId)}/${propertyId}`);
  const propSnap = await propRef.get();
  if (!propSnap.exists) {
    return NextResponse.json({ error: "Property not found" }, { status: 404 });
  }

  const propData = propSnap.data() as Record<string, unknown>;
  const property = {
    id: propertyId,
    displayAddress: propertyDisplayLabel(propData, propertyId),
    postcode: typeof propData.postcode === "string" ? propData.postcode : "",
    type: typeof propData.type === "string" ? propData.type : "House",
    bedrooms: typeof propData.bedrooms === "number" ? propData.bedrooms : 0,
    rentPcm: safeRentPcm(propData.rentPcm),
    listingType: (propData.listingType as "rent" | "sale") ?? "rent",
  };

  const applicationsSnap = await db.collection(applicationsCol(agencyId)).get();
  const applicants = applicationsSnap.docs.map((doc) => {
    const d = doc.data() as Record<string, unknown>;
    return {
      id: doc.id,
      fullName: typeof d.fullName === "string" ? d.fullName : "",
      email: typeof d.email === "string" ? d.email : "",
      phone: typeof d.phone === "string" ? d.phone : null,
      preferences: d.preferences ?? null,
    };
  });

  const scored = applicants.map((app) => {
    const result = scoreApplicantToProperty(app, property);
    return {
      applicantId: app.id,
      applicantName: app.fullName,
      applicantEmail: app.email,
      applicantPhone: app.phone,
      score: result.score,
      reasons: result.reasons,
      warnings: result.warnings,
      matched: result.matched,
    };
  });

  scored.sort((a, b) => b.score - a.score);
  const list = scored.slice(0, limit) as PropertyMatchApplicantItem[];

  return NextResponse.json(list);
}
