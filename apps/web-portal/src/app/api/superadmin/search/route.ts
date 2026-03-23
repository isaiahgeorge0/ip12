import { NextRequest, NextResponse } from "next/server";
import { requireServerSessionApi, assertSuperAdminApi } from "@/lib/auth/authz";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { propertiesCol } from "@/lib/firestore/paths";

const MAX_LIMIT = 50;
const DEFAULT_LIMIT = 20;
const MIN_QUERY_LENGTH = 2;
const AGENCIES_FOR_PROPERTY_SEARCH = 20;
const PROPERTIES_PER_AGENCY = 10;

type SearchResult =
  | {
      type: "user";
      uid: string;
      email: string;
      role: string;
      status: string;
      agencyId?: string | null;
    }
  | {
      type: "agency";
      agencyId: string;
      name?: string | null;
    }
  | {
      type: "property";
      propertyId: string;
      agencyId: string;
      postcode?: string | null;
      address?: string | null;
      archived?: boolean;
    };

function looksLikeAgencyId(q: string): boolean {
  return /^[a-zA-Z0-9_-]{2,64}$/.test(q);
}

export async function GET(request: NextRequest) {
  const sessionOr401 = await requireServerSessionApi();
  if (sessionOr401 instanceof NextResponse) return sessionOr401;
  const session = sessionOr401;
  const role403 = assertSuperAdminApi(session);
  if (role403) return role403;

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? "";
  const limitParam = searchParams.get("limit");
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, limitParam ? parseInt(limitParam, 10) || DEFAULT_LIMIT : DEFAULT_LIMIT)
  );

  if (q.length < MIN_QUERY_LENGTH) {
    return NextResponse.json({ q, results: [] });
  }

  const qLower = q.toLowerCase();
  const qEnd = q + "\uf8ff";
  const qLowerEnd = qLower + "\uf8ff";
  const perTypeLimit = Math.ceil(limit / 3) + 5;

  const db = getAdminFirestore();
  const results: SearchResult[] = [];

  // --- Users: email prefix (case-insensitive via lowercase range on email)
  const usersCol = db.collection("users");
  const usersSnap = await usersCol
    .where("email", ">=", qLower)
    .where("email", "<=", qLowerEnd)
    .limit(perTypeLimit)
    .get();

  usersSnap.docs.forEach((doc) => {
    const d = doc.data();
    const email = typeof d.email === "string" ? d.email : "";
    const primaryAgencyId =
      typeof d.primaryAgencyId === "string" && d.primaryAgencyId.trim() ? d.primaryAgencyId.trim() : null;
    const legacyAgencyId = d.agencyId != null && typeof d.agencyId === "string" ? d.agencyId : null;
    const agencyId = primaryAgencyId ?? legacyAgencyId ?? null;
    results.push({
      type: "user",
      uid: doc.id,
      email,
      role: typeof d.role === "string" ? d.role : "—",
      status: typeof d.status === "string" ? d.status : "—",
      agencyId,
    });
  });

  // --- Agencies: by id (exact match) + name prefix
  const agenciesCol = db.collection("agencies");
  const byId = new Map<string, SearchResult>();

  if (looksLikeAgencyId(q)) {
    const agencyDoc = await agenciesCol.doc(q).get();
    if (agencyDoc.exists) {
      const d = agencyDoc.data();
      byId.set(agencyDoc.id, {
        type: "agency",
        agencyId: agencyDoc.id,
        name: typeof d?.name === "string" ? d.name : null,
      });
    }
  }

  const agenciesSnap = await agenciesCol
    .where("name", ">=", q)
    .where("name", "<=", qEnd)
    .limit(perTypeLimit)
    .get();

  agenciesSnap.docs.forEach((doc) => {
    if (!byId.has(doc.id)) {
      const d = doc.data();
      byId.set(doc.id, {
        type: "agency",
        agencyId: doc.id,
        name: typeof d.name === "string" ? d.name : null,
      });
    }
  });
  results.push(...Array.from(byId.values()));

  // --- Properties: search by postcode prefix within bounded agency set
  const agenciesListSnap = await agenciesCol.orderBy("name").limit(AGENCIES_FOR_PROPERTY_SEARCH).get();
  const agencyIds = agenciesListSnap.docs.map((d) => d.id);

  for (const agencyId of agencyIds) {
    if (results.filter((r) => r.type === "property").length >= perTypeLimit) break;
    const propsSnap = await db
      .collection(propertiesCol(agencyId))
      .where("postcode", ">=", q)
      .where("postcode", "<=", qEnd)
      .limit(PROPERTIES_PER_AGENCY)
      .get();

    propsSnap.docs.forEach((doc) => {
      const d = doc.data();
      const address =
        typeof d.displayAddress === "string"
          ? d.displayAddress
          : typeof d.address === "string"
            ? d.address
            : typeof d.title === "string"
              ? d.title
              : null;
      results.push({
        type: "property",
        propertyId: doc.id,
        agencyId,
        postcode: typeof d.postcode === "string" ? d.postcode : null,
        address,
        archived: d.archived === true,
      });
    });
  }

  const sorted = results.slice(0, limit);
  return NextResponse.json({ q, results: sorted });
}
