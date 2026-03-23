/**
 * Normalize raw Firestore property doc data for admin list/detail display.
 * Canonical path: agencies/{agencyId}/properties/{docId} — docId is the Firestore document id.
 * Handles mixed/legacy field shapes so we never render "[object Object]" or bad titles.
 */

function safeString(v: unknown, fallback: string): string {
  if (v == null) return fallback;
  if (typeof v === "string") return v.trim() || fallback;
  return fallback;
}

function safeNumber(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** Normalize price/rent to number or null; never return an object (avoids "[object Object]" in UI). */
export function safeRentPcm(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === "number" && Number.isFinite(v) && v >= 0) return v;
  if (typeof v === "object") return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/**
 * Display title fallback chain: displayAddress -> address -> title -> fallback.
 */
export function normalizedDisplayAddress(d: Record<string, unknown>, docId: string): string {
  const a = safeString(d.displayAddress, "");
  if (a) return a;
  const aSnake = safeString(d.display_address, "");
  if (aSnake) return aSnake;
  const line1 = safeString(d.address_line_1, "");
  if (line1) return line1;
  const headline = safeString(d.headline, "");
  if (headline) return headline;
  const postcode = safeString(d.postcode, "");
  if (postcode) return postcode;
  const b = safeString(d.address, "");
  if (b) return b;
  const c = safeString(d.title, "");
  if (c) return c;
  return "Untitled property";
}

function normalizeTypeLabel(v: unknown): string {
  const raw = safeString(v, "");
  if (!raw) return "";
  const low = raw.toLowerCase();
  if (low === "house") return "House";
  if (low === "flat") return "Flat";
  if (low === "studio") return "Studio";
  if (low === "other") return "Other";
  return raw;
}

/**
 * Human-readable property label for admin viewing/applicant flows.
 * Prefer displayAddress -> address -> title -> "Property {propertyId}".
 * Use when you have optional property doc data (e.g. from API); pass null if not loaded.
 */
export function propertyDisplayLabel(
  propertyData: Record<string, unknown> | null,
  propertyId: string
): string {
  if (propertyData && typeof propertyData === "object") {
    const a = safeString(propertyData.displayAddress, "");
    if (a) return a;
    const b = safeString(propertyData.address, "");
    if (b) return b;
    const c = safeString(propertyData.title, "");
    if (c) return c;
  }
  return propertyId ? `Property ${propertyId}` : "Property (unknown)";
}

export type NormalizedPropertyRow = {
  id: string;
  agencyId: string;
  displayAddress: string;
  postcode: string;
  status: string;
  type: string;
  bedrooms: number;
  bathrooms: number;
  rentPcm: number | null;
  archived: boolean;
  createdAt: unknown;
  updatedAt: unknown;
  createdByUid: string;
};

/**
 * Build a normalized property row from a Firestore doc (list/detail).
 * id = doc.id (canonical identity); agencyId must be passed in.
 */
export function normalizePropertyRow(
  docId: string,
  agencyId: string,
  d: Record<string, unknown>
): NormalizedPropertyRow {
  const normalizedType =
    normalizeTypeLabel(d.type) ||
    normalizeTypeLabel(d.property_type_raw) ||
    normalizeTypeLabel(d.property_type) ||
    "House";

  return {
    id: docId,
    agencyId,
    displayAddress: normalizedDisplayAddress(d, docId),
    postcode: safeString(d.postcode, ""),
    status: safeString(d.status, "—"),
    type: normalizedType,
    bedrooms: safeNumber(d.bedrooms),
    bathrooms: safeNumber(d.bathrooms),
    rentPcm: safeRentPcm(d.rentPcm ?? d.rent_pcm ?? d.price),
    archived: d.archived === true,
    createdAt: d.createdAt ?? null,
    updatedAt: d.updatedAt ?? null,
    createdByUid: safeString(d.createdByUid, ""),
  };
}
