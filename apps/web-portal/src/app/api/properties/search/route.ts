/**
 * GET /api/properties/search
 * Rightmove-style property search backed by propertyIndex.
 * Public-safe: returns only fields needed for listing/map display.
 *
 * Query modes (priority):
 * 1) bounds=south,west,north,east → geohash range queries, then in-memory bounds filter.
 * 2) q (length >= 2) → prefix search on postcodeLower and addressLower; merge + dedupe.
 * 3) Else → ordered by updatedAt desc with limit.
 *
 * Pagination: optional cursor (opaque). Response includes nextCursor; omit or null when no next page.
 * Sort order: updatedAt desc, then docId (tiebreaker) for stable pages.
 *
 * Firestore index for default + cursor: propertyIndex (updatedAt Desc, __name__ Desc).
 */

import { NextRequest, NextResponse } from "next/server";
import type { Query } from "firebase-admin/firestore";
import { FieldPath, Timestamp } from "firebase-admin/firestore";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { PROPERTY_INDEX_COLLECTION } from "@/lib/firestore/paths";
import { geohashQueryBounds, distanceBetween } from "geofire-common";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;
const MIN_QUERY_LENGTH = 2;

/** Cursor payload: sort key (updatedAt seconds) + docId tiebreaker. */
type CursorPayload = { t: number; id: string };

function encodeCursor(tSeconds: number, docId: string): string {
  const payload: CursorPayload = { t: tSeconds, id: docId };
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

function decodeCursor(cursor: string): CursorPayload | null {
  try {
    const json = Buffer.from(cursor, "base64url").toString("utf8");
    const p = JSON.parse(json) as unknown;
    if (p && typeof p === "object" && "t" in p && "id" in p && typeof (p as CursorPayload).t === "number" && typeof (p as CursorPayload).id === "string") {
      return p as CursorPayload;
    }
  } catch {
    // ignore
  }
  return null;
}

/** Extract updatedAt in seconds from Firestore doc data or hit for stable sort. */
function updatedAtSeconds(d: Record<string, unknown> | PropertySearchHit): number {
  const v = (d as Record<string, unknown>).updatedAt;
  if (v == null) return 0;
  if (typeof v === "object" && v !== null && "seconds" in v && typeof (v as { seconds: number }).seconds === "number") {
    return (v as { seconds: number }).seconds;
  }
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (v instanceof Date) return Math.floor(v.getTime() / 1000);
  return 0;
}

export type PropertySearchHit = {
  docId: string;
  agencyId: string;
  propertyId: string;
  title?: string;
  displayAddress?: string;
  postcode?: string;
  lat?: number;
  lng?: number;
  price?: number;
  rent?: number;
  beds?: number;
  baths?: number;
  propertyType?: string;
  listingType?: string;
  available?: boolean;
  updatedAt?: unknown;
};

export type PropertySearchResponse = {
  results: PropertySearchHit[];
  nextCursor: string | null;
};

/** Stable sort: updatedAt desc, then docId asc (tiebreaker). Same order for default, bounds, q. */
function sortByUpdatedAtDescThenDocId(hits: PropertySearchHit[]): void {
  hits.sort((a, b) => {
    const ta = updatedAtSeconds(a);
    const tb = updatedAtSeconds(b);
    if (tb !== ta) return tb - ta;
    return a.docId.localeCompare(b.docId);
  });
}

/** True if (updatedAt, docId) is strictly after cursor in our sort order (updatedAt desc, docId asc). */
function isAfterCursor(
  hit: PropertySearchHit,
  cursor: CursorPayload
): boolean {
  const t = updatedAtSeconds(hit);
  if (t < cursor.t) return true;
  if (t > cursor.t) return false;
  return hit.docId.localeCompare(cursor.id) > 0;
}

function safeStr(v: unknown): string {
  if (v == null) return "";
  return typeof v === "string" ? v : String(v);
}

function safeNum(v: unknown): number | undefined {
  if (v == null) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

/** Parse "south,west,north,east"; return null if malformed. */
function parseBounds(boundsStr: string): { south: number; west: number; north: number; east: number } | null {
  const parts = boundsStr.split(",").map((s) => s.trim()).filter(Boolean);
  if (parts.length !== 4) return null;
  const south = Number(parts[0]);
  const west = Number(parts[1]);
  const north = Number(parts[2]);
  const east = Number(parts[3]);
  if (
    !Number.isFinite(south) || !Number.isFinite(west) || !Number.isFinite(north) || !Number.isFinite(east) ||
    south < -90 || south > 90 || north < -90 || north > 90 || south > north ||
    west < -180 || west > 180 || east < -180 || east > 180
  ) {
    return null;
  }
  return { south, west, north, east };
}

function docToHit(docId: string, d: Record<string, unknown> | undefined): PropertySearchHit {
  const hit: PropertySearchHit = {
    docId,
    agencyId: typeof d?.agencyId === "string" ? d.agencyId : "",
    propertyId: typeof d?.propertyId === "string" ? d.propertyId : "",
  };
  if (typeof d?.title === "string") hit.title = d.title;
  if (typeof d?.displayAddress === "string") hit.displayAddress = d.displayAddress;
  if (typeof d?.postcode === "string") hit.postcode = d.postcode;
  const lat = safeNum(d?.lat ?? d?.latitude);
  const lng = safeNum(d?.lng ?? d?.longitude ?? d?.lon);
  if (lat != null) hit.lat = lat;
  if (lng != null) hit.lng = lng;
  if (typeof d?.price === "number" && Number.isFinite(d.price)) hit.price = d.price;
  if (typeof d?.rent === "number" && Number.isFinite(d.rent)) hit.rent = d.rent;
  if (typeof d?.beds === "number" && Number.isFinite(d.beds)) hit.beds = d.beds;
  if (typeof d?.baths === "number" && Number.isFinite(d.baths)) hit.baths = d.baths;
  if (typeof d?.propertyType === "string") hit.propertyType = d.propertyType;
  if (typeof d?.listingType === "string") hit.listingType = d.listingType;
  if (typeof d?.available === "boolean") hit.available = d.available;
  if (d?.updatedAt != null) hit.updatedAt = d.updatedAt;
  return hit;
}

function inBounds(lat: number, lng: number, bounds: { south: number; west: number; north: number; east: number }): boolean {
  return lat >= bounds.south && lat <= bounds.north && lng >= bounds.west && lng <= bounds.east;
}

function matchesFilters(
  hit: PropertySearchHit,
  listingType: string | null,
  minPrice: number | null | undefined,
  maxPrice: number | null | undefined,
  minBeds: number | null | undefined,
  available: boolean | null
): boolean {
  if (listingType != null && hit.listingType !== listingType) return false;
  const p = hit.price ?? hit.rent;
  if (minPrice != null && (p == null || p < minPrice)) return false;
  if (maxPrice != null && (p == null || p > maxPrice)) return false;
  if (minBeds != null && (hit.beds == null || hit.beds < minBeds)) return false;
  if (available != null && hit.available !== available) return false;
  return true;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const boundsParam = searchParams.get("bounds")?.trim() ?? "";
  const q = searchParams.get("q")?.trim() ?? "";
  const listingTypeParam = searchParams.get("listingType")?.trim() ?? null;
  const minPriceRaw = safeNum(searchParams.get("minPrice"));
  const maxPriceRaw = safeNum(searchParams.get("maxPrice"));
  const minBedsRaw = safeNum(searchParams.get("minBeds"));
  // Ignore 0 / empty / invalid so optional numeric filters do not exclude all results.
  const minPrice = minPriceRaw != null && minPriceRaw > 0 ? minPriceRaw : null;
  const maxPrice = maxPriceRaw != null && maxPriceRaw > 0 ? maxPriceRaw : null;
  const minBeds = minBedsRaw != null && minBedsRaw > 0 ? minBedsRaw : null;
  const availableParam = searchParams.get("available");
  const availableFilter =
    availableParam === "" || availableParam == null
      ? true
      : availableParam === "true";

  const limitParam = safeNum(searchParams.get("limit"));
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, limitParam != null ? limitParam : DEFAULT_LIMIT)
  );

  const cursorParam = searchParams.get("cursor")?.trim() ?? "";
  const cursor = cursorParam ? decodeCursor(cursorParam) : null;
  if (cursorParam && !cursor) {
    return NextResponse.json(
      { error: "Invalid or malformed cursor" },
      { status: 400 }
    );
  }

  const listingType =
    listingTypeParam === "sale" || listingTypeParam === "rent" ? listingTypeParam : null;

  if (boundsParam) {
    const bounds = parseBounds(boundsParam);
    if (!bounds) {
      return NextResponse.json(
        { error: "Invalid bounds; use south,west,north,east (numbers)" },
        { status: 400 }
      );
    }
    const centerLat = (bounds.south + bounds.north) / 2;
    const centerLng = (bounds.west + bounds.east) / 2;
    const radiusKm = Math.max(
      distanceBetween([centerLat, centerLng], [bounds.south, bounds.west]),
      distanceBetween([centerLat, centerLng], [bounds.north, bounds.east])
    );
    const radiusMeters = Math.ceil(radiusKm * 1000) + 1;
    const geohashBounds = geohashQueryBounds([centerLat, centerLng], radiusMeters);

    const db = getAdminFirestore();
    const col = db.collection(PROPERTY_INDEX_COLLECTION);
    const byId = new Map<string, PropertySearchHit>();

    // Bounds mode: merge geohash queries, then sort/filter in memory. Cursor: skip until after
    // cursor in stable order (updatedAt desc, docId asc), then take limit.
    // TODO(geospatial): If viewport pagination scale demands it, consider a dedicated geospatial
    // index or cursor strategy to avoid re-querying and skipping.
    const fetchLimit = cursor ? limit * 4 : limit * 2;
    await Promise.all(
      geohashBounds.map(async ([start, end]) => {
        const snap = await col
          .where("geohash", ">=", start)
          .where("geohash", "<=", end)
          .limit(fetchLimit)
          .get();
        snap.docs.forEach((doc) => {
          const d = doc.data() as Record<string, unknown>;
          const hit = docToHit(doc.id, d);
          const lat = hit.lat ?? safeNum(d?.lat ?? d?.latitude);
          const lng = hit.lng ?? safeNum(d?.lng ?? d?.longitude ?? d?.lon);
          if (lat != null && lng != null && inBounds(lat, lng, bounds) && matchesFilters(hit, listingType, minPrice, maxPrice, minBeds, availableFilter)) {
            byId.set(doc.id, hit);
          }
        });
      })
    );

    let list = Array.from(byId.values());
    sortByUpdatedAtDescThenDocId(list);
    if (cursor) {
      list = list.filter((hit) => isAfterCursor(hit, cursor));
    }
    const results = list.slice(0, limit);
    const last = results[results.length - 1];
    const nextCursor =
      results.length === limit && last
        ? encodeCursor(updatedAtSeconds(last), last.docId)
        : null;
    return NextResponse.json({ results, nextCursor } satisfies PropertySearchResponse);
  }

  const db = getAdminFirestore();
  const col = db.collection(PROPERTY_INDEX_COLLECTION);

  if (q.length >= MIN_QUERY_LENGTH) {
    // Text search mode: merge postcode + address prefix queries, sort (updatedAt desc, docId asc),
    // apply cursor skip, take limit.
    const qLower = q.toLowerCase();
    const qEnd = qLower + "\uf8ff";
    const fetchLimit = cursor ? limit * 4 : limit * 2;
    const [byPostcode, byAddress] = await Promise.all([
      col.where("postcodeLower", ">=", qLower).where("postcodeLower", "<=", qEnd).limit(fetchLimit).get(),
      col.where("addressLower", ">=", qLower).where("addressLower", "<=", qEnd).limit(fetchLimit).get(),
    ]);
    const byId = new Map<string, PropertySearchHit>();
    [...byPostcode.docs, ...byAddress.docs].forEach((doc) => {
      if (byId.has(doc.id)) return;
      const hit = docToHit(doc.id, doc.data() as Record<string, unknown>);
      if (matchesFilters(hit, listingType, minPrice, maxPrice, minBeds, availableFilter)) {
        byId.set(doc.id, hit);
      }
    });
    let list = Array.from(byId.values());
    sortByUpdatedAtDescThenDocId(list);
    if (cursor) {
      list = list.filter((hit) => isAfterCursor(hit, cursor));
    }
    const results = list.slice(0, limit);
    const last = results[results.length - 1];
    const nextCursor =
      results.length === limit && last
        ? encodeCursor(updatedAtSeconds(last), last.docId)
        : null;
    return NextResponse.json({ results, nextCursor } satisfies PropertySearchResponse);
  }

  // Default mode: single query, orderBy updatedAt desc, documentId asc (tiebreaker).
  // Cursor: startAfter(updatedAt, docId) for next page. Composite index: updatedAt Desc, __name__ Asc.
  let query: Query = col
    .orderBy("updatedAt", "desc")
    .orderBy(FieldPath.documentId(), "asc")
    .limit(limit + 1);
  if (listingType != null) query = query.where("listingType", "==", listingType);
  if (availableFilter === true) query = query.where("available", "==", true);
  if (cursor) {
    query = query.startAfter(
      Timestamp.fromMillis(cursor.t * 1000),
      cursor.id
    );
  }

  const snap = await query.get();
  const collected: PropertySearchHit[] = [];
  for (const doc of snap.docs) {
    const hit = docToHit(doc.id, doc.data() as Record<string, unknown>);
    if (!matchesFilters(hit, listingType, minPrice, maxPrice, minBeds, availableFilter)) continue;
    collected.push(hit);
  }
  const results = collected.slice(0, limit);
  const hasMore = collected.length > limit;
  const last = results[results.length - 1];
  const nextCursor =
    hasMore && last ? encodeCursor(updatedAtSeconds(last), last.docId) : null;
  return NextResponse.json({ results, nextCursor } satisfies PropertySearchResponse);
}
