/**
 * Server-only: global property index for map search, filtering, saved searches.
 * Collection: propertyIndex. Doc id: {agencyId}__{propertyId}.
 * Canonical source remains agencies/{agencyId}/properties/{propertyId}.
 *
 * Write-through: call upsertPropertyIndex after any server-side canonical property create/update.
 * (Currently admin portal writes via client Firestore; backfill script syncs existing data.)
 */

import { FieldValue } from "firebase-admin/firestore";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { PROPERTY_INDEX_COLLECTION, propertyIndexDocId } from "@/lib/firestore/paths";

export type PropertyIndexListingType = "sale" | "rent";

export type PropertyIndexDoc = {
  agencyId: string;
  propertyId: string;
  title?: string;
  displayAddress?: string;
  postcode?: string;
  addressLower?: string;
  postcodeLower?: string;
  lat?: number;
  lng?: number;
  listingType?: PropertyIndexListingType;
  status?: string;
  available?: boolean;
  price?: number;
  rent?: number;
  beds?: number;
  baths?: number;
  propertyType?: string;
  createdAt?: unknown;
  updatedAt: ReturnType<typeof FieldValue.serverTimestamp>;
};

/** Canonical property data shape (subset we read from Firestore). */
export type CanonicalPropertyData = Record<string, unknown>;

function safeStr(v: unknown): string {
  if (v == null) return "";
  return typeof v === "string" ? v : String(v);
}

function safeNum(v: unknown): number | undefined {
  if (v == null) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Build the index document (plain object). Does not write. Handles missing fields safely.
 */
export function buildPropertyIndexDoc(
  agencyId: string,
  propertyId: string,
  propertyData: CanonicalPropertyData
): Omit<PropertyIndexDoc, "updatedAt"> & { updatedAt: ReturnType<typeof FieldValue.serverTimestamp> } {
  const displayAddress = safeStr(propertyData.displayAddress ?? propertyData.title ?? propertyData.address).trim();
  const postcode = safeStr(propertyData.postcode).trim();
  const addressLower = displayAddress.toLowerCase();
  const postcodeLower = postcode.toLowerCase();

  const status = safeStr(propertyData.status).trim() || undefined;
  const archived = propertyData.archived === true;
  const available = !archived;

  const rentPcm = safeNum(propertyData.rentPcm ?? propertyData.rent);
  const price = safeNum(propertyData.price);
  const beds = safeNum(propertyData.bedrooms ?? propertyData.beds);
  const baths = safeNum(propertyData.bathrooms ?? propertyData.baths);
  const propertyType = safeStr(propertyData.type ?? propertyData.propertyType).trim() || undefined;

  let listingType: PropertyIndexListingType | undefined;
  if (propertyData.listingType === "sale" || propertyData.listingType === "rent") {
    listingType = propertyData.listingType;
  } else if (price != null && price > 0) {
    listingType = "sale";
  } else if (rentPcm != null && rentPcm > 0) {
    listingType = "rent";
  }

  const lat = safeNum(propertyData.lat ?? propertyData.latitude);
  const lng = safeNum(propertyData.lng ?? propertyData.longitude ?? propertyData.lon);

  const doc: Omit<PropertyIndexDoc, "updatedAt"> & { updatedAt: ReturnType<typeof FieldValue.serverTimestamp> } = {
    agencyId,
    propertyId,
    updatedAt: FieldValue.serverTimestamp(),
  };
  if (displayAddress) doc.displayAddress = displayAddress;
  if (propertyData.title != null && safeStr(propertyData.title).trim()) doc.title = safeStr(propertyData.title).trim();
  if (postcode) doc.postcode = postcode;
  doc.addressLower = addressLower;
  doc.postcodeLower = postcodeLower;
  if (lat != null) doc.lat = lat;
  if (lng != null) doc.lng = lng;
  if (listingType) doc.listingType = listingType;
  if (status) doc.status = status;
  doc.available = available;
  if (price != null) doc.price = price;
  if (rentPcm != null) doc.rent = rentPcm;
  if (beds != null) doc.beds = beds;
  if (baths != null) doc.baths = baths;
  if (propertyType) doc.propertyType = propertyType;
  if (propertyData.createdAt != null) doc.createdAt = propertyData.createdAt;

  return doc;
}

/**
 * Upsert one document into propertyIndex. Call after canonical property create/update.
 * If property is archived/disabled, index doc gets status and available=false (we do not delete).
 */
export function upsertPropertyIndex(
  agencyId: string,
  propertyId: string,
  propertyData: CanonicalPropertyData
): void {
  const db = getAdminFirestore();
  const docId = propertyIndexDocId(agencyId, propertyId);
  const indexDoc = buildPropertyIndexDoc(agencyId, propertyId, propertyData);
  db.collection(PROPERTY_INDEX_COLLECTION)
    .doc(docId)
    .set(indexDoc, { merge: true })
    .catch((err) => {
      console.warn("[propertyIndex] upsert failed", docId, err);
    });
}
