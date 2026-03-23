import { NextRequest, NextResponse } from "next/server";
import type { Query } from "firebase-admin/firestore";
import { requireServerSessionApi, assertSuperAdminApi } from "@/lib/auth/authz";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { PROPERTY_INDEX_COLLECTION } from "@/lib/firestore/paths";

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;
const MIN_QUERY_LENGTH = 2;

type IndexHit = {
  agencyId: string;
  propertyId: string;
  title?: string;
  displayAddress?: string;
  postcode?: string;
  lat?: number;
  lng?: number;
  listingType?: string;
  status?: string;
  available?: boolean;
  price?: number;
  rent?: number;
  beds?: number;
  createdAt?: unknown;
  updatedAt?: unknown;
};

type DocSnap = { id: string; data: () => Record<string, unknown> | undefined };

function docToHit(doc: DocSnap): IndexHit {
  const d = doc.data();
  if (!d) {
    const [agencyId, propertyId] = (doc.id.split("__") as [string, string]);
    return { agencyId: agencyId ?? "", propertyId: propertyId ?? "" };
  }
  const agencyId = typeof d.agencyId === "string" ? d.agencyId : "";
  const propertyId = typeof d.propertyId === "string" ? d.propertyId : "";
  const hit: IndexHit = { agencyId, propertyId };
  if (typeof d.title === "string") hit.title = d.title;
  if (typeof d.displayAddress === "string") hit.displayAddress = d.displayAddress;
  if (typeof d.postcode === "string") hit.postcode = d.postcode;
  if (typeof d.lat === "number" && Number.isFinite(d.lat)) hit.lat = d.lat;
  if (typeof d.lng === "number" && Number.isFinite(d.lng)) hit.lng = d.lng;
  if (typeof d.listingType === "string") hit.listingType = d.listingType;
  if (typeof d.status === "string") hit.status = d.status;
  if (typeof d.available === "boolean") hit.available = d.available;
  if (typeof d.price === "number" && Number.isFinite(d.price)) hit.price = d.price;
  if (typeof d.rent === "number" && Number.isFinite(d.rent)) hit.rent = d.rent;
  if (typeof d.beds === "number" && Number.isFinite(d.beds)) hit.beds = d.beds;
  if (d.createdAt != null) hit.createdAt = d.createdAt;
  if (d.updatedAt != null) hit.updatedAt = d.updatedAt;
  return hit;
}

function matchesFilters(
  hit: IndexHit,
  agencyIdFilter: string | null,
  listingTypeFilter: string | null,
  minPrice: number | null,
  maxPrice: number | null,
  minBeds: number | null,
  statusFilter: string | null
): boolean {
  if (agencyIdFilter && hit.agencyId !== agencyIdFilter) return false;
  if (listingTypeFilter && hit.listingType !== listingTypeFilter) return false;
  if (minPrice != null) {
    const p = hit.price ?? hit.rent;
    if (p == null || p < minPrice) return false;
  }
  if (maxPrice != null) {
    const p = hit.price ?? hit.rent;
    if (p == null || p > maxPrice) return false;
  }
  if (minBeds != null && (hit.beds == null || hit.beds < minBeds)) return false;
  if (statusFilter && hit.status !== statusFilter) return false;
  return true;
}

/**
 * GET /api/superadmin/properties
 * SuperAdmin only. Query propertyIndex. Params: q, agencyId, listingType, minPrice, maxPrice, minBeds, status, limit.
 */
export async function GET(request: NextRequest) {
  const sessionOr401 = await requireServerSessionApi();
  if (sessionOr401 instanceof NextResponse) return sessionOr401;
  const session = sessionOr401;
  const role403 = assertSuperAdminApi(session);
  if (role403) return role403;

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? "";
  const agencyIdParam = searchParams.get("agencyId")?.trim() ?? null;
  const listingTypeParam = searchParams.get("listingType")?.trim() ?? null;
  const minPriceParam = searchParams.get("minPrice");
  const maxPriceParam = searchParams.get("maxPrice");
  const minBedsParam = searchParams.get("minBeds");
  const statusParam = searchParams.get("status")?.trim() ?? null;
  const limitParam = searchParams.get("limit");

  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, limitParam ? parseInt(limitParam, 10) || DEFAULT_LIMIT : DEFAULT_LIMIT)
  );
  const minPrice = minPriceParam != null ? parseInt(minPriceParam, 10) : null;
  const maxPrice = maxPriceParam != null ? parseInt(maxPriceParam, 10) : null;
  const minBeds = minBedsParam != null ? parseInt(minBedsParam, 10) : null;

  const db = getAdminFirestore();
  const col = db.collection(PROPERTY_INDEX_COLLECTION);

  if (q.length >= 1 && q.length < MIN_QUERY_LENGTH) {
    return NextResponse.json({ results: [] });
  }

  let docs: DocSnap[] = [];
  const qLower = q.toLowerCase();
  const qEnd = qLower + "\uf8ff";

  if (q.length >= MIN_QUERY_LENGTH) {
    const [byPostcode, byAddress] = await Promise.all([
      col.where("postcodeLower", ">=", qLower).where("postcodeLower", "<=", qEnd).limit(limit * 2).get(),
      col.where("addressLower", ">=", qLower).where("addressLower", "<=", qEnd).limit(limit * 2).get(),
    ]);
    const byId = new Map<string, DocSnap>();
    byPostcode.docs.forEach((d) => byId.set(d.id, d));
    byAddress.docs.forEach((d) => byId.set(d.id, d));
    docs = Array.from(byId.values());
  } else {
    let query: Query = col;
    if (agencyIdParam) query = query.where("agencyId", "==", agencyIdParam);
    if (listingTypeParam) query = query.where("listingType", "==", listingTypeParam);
    const snap = await query.limit(limit * 3).get();
    docs = snap.docs;
  }

  const results: IndexHit[] = [];
  for (const doc of docs) {
    const hit = docToHit(doc);
    if (!matchesFilters(hit, agencyIdParam, listingTypeParam, minPrice, maxPrice, minBeds, statusParam)) continue;
    results.push(hit);
    if (results.length >= limit) break;
  }

  return NextResponse.json({ results });
}
