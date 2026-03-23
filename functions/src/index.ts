/**
 * Firebase Functions v2 entry point.
 */

import * as admin from "firebase-admin";
import {setGlobalOptions} from "firebase-functions/v2";
import {onRequest} from "firebase-functions/v2/https";
import {onDocumentWritten} from "firebase-functions/v2/firestore";
import * as logger from "firebase-functions/logger";
import {geohashForLocation} from "geofire-common";

if (!admin.apps.length) {
  admin.initializeApp();
}

// Pin region so Gen2 Eventarc triggers and functions colocate (avoids
// permission/location mismatch) and keeps latency low for UK/EU.
setGlobalOptions({maxInstances: 10, region: "europe-west2"});

const PROPERTY_INDEX_COLLECTION = "propertyIndex";
const BOOTSTRAP_PATH = "system/bootstrap";
const ALLOWED_ORIGINS = new Set([
  "http://localhost:3000",
  "http://127.0.0.1:3000",
]);

/** All permissions for superAdmin (matches web-portal ALL_PERMISSIONS). */
const ALL_PERMISSIONS = [
  "crm.read", "crm.write",
  "properties.read", "properties.write",
  "applications.read", "applications.write",
  "tenancies.read", "tenancies.write",
  "tickets.read", "tickets.write",
  "landlords.read", "landlords.write",
  "tenants.read", "tenants.write",
  "contractors.read", "contractors.write",
  "settings.read", "settings.write",
] as const;

/** Minimal response shape for HTTP handler (Express-like). */
interface HttpResponse {
  set(header: string, value: string): void;
  status(code: number): {
    contentType(t: string): {send(b: string): void};
    send(b?: string): void;
  };
  send(b?: string): void;
}

/**
 * Sets CORS headers for allowed origins (localhost dev).
 * @param {HttpResponse} res - HTTP response
 * @param {string | undefined} origin - Request Origin header
 */
function setCorsHeaders(res: HttpResponse, origin: string | undefined): void {
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    res.set("Access-Control-Allow-Origin", origin);
  }
  res.set("Access-Control-Allow-Methods", "POST");
  res.set("Access-Control-Allow-Headers", "Authorization, Content-Type");
}

/**
 * Sends a JSON response with the given status and body.
 * @param {HttpResponse} res - HTTP response
 * @param {number} status - Status code
 * @param {Record<string, unknown>} body - JSON-serializable object
 */
function sendJson(
  res: HttpResponse,
  status: number,
  body: Record<string, unknown>
): void {
  res.status(status)
    .contentType("application/json")
    .send(JSON.stringify(body));
}

// --- propertyIndex sync helpers (mirror web-portal field building)

/**
 * Coerces value to string; empty string for null/undefined.
 * @param {unknown} v - Value to coerce
 * @return {string} Non-null string
 */
function safeStr(v: unknown): string {
  if (v == null) return "";
  return typeof v === "string" ? v : String(v);
}

/**
 * Parses a finite number from value; undefined otherwise.
 * @param {unknown} v - Value to parse
 * @return {number | undefined} Finite number or undefined
 */
function safeNum(v: unknown): number | undefined {
  if (v == null) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Returns true if lat/lng are within valid geohash ranges.
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @return {boolean} True if lat in [-90,90] and lng in [-180,180]
 */
function isValidLatLng(lat: number, lng: number): boolean {
  return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

/**
 * Property index sync (Firestore trigger).
 *
 * Canonical write path: agencies/{agencyId}/properties/{propertyId}
 * (source of truth). Index write path: propertyIndex/{agencyId}__{propertyId}
 * (search/map layer).
 *
 * We keep index docs for archived/disabled properties and set available=false
 * instead of deleting so that search and analytics can still filter by status
 * and so re-enabling does not require a backfill.
 */
export const syncPropertyIndex = onDocumentWritten(
  "agencies/{agencyId}/properties/{propertyId}",
  async (event): Promise<void> => {
    const agencyId = event.params.agencyId;
    const propertyId = event.params.propertyId;
    const indexDocId = `${agencyId}__${propertyId}`;
    const db = admin.firestore();
    const indexRef = db.collection(PROPERTY_INDEX_COLLECTION).doc(indexDocId);

    const before = event.data?.before;
    const after = event.data?.after;

    const op = !after?.exists ?
      "delete" :
      !before?.exists ?
        "create" :
        "update";

    logger.info("syncPropertyIndex", {agencyId, propertyId, op});

    if (op === "delete") {
      await indexRef.delete();
      return;
    }

    const afterSnap = after;
    if (!afterSnap || !afterSnap.exists) {
      await indexRef.delete();
      return;
    }
    const d = afterSnap.data() as Record<string, unknown> | undefined;
    if (!d) {
      await indexRef.delete();
      return;
    }

    const displayAddress = safeStr(
      d.displayAddress ?? d.title ?? d.address
    ).trim();
    const postcode = safeStr(d.postcode).trim();
    const addressLower = displayAddress ? displayAddress.toLowerCase() : "";
    const postcodeLower = postcode ? postcode.toLowerCase() : "";
    const status = safeStr(d.status).trim() || undefined;
    const archived = d.archived === true;
    const statusDisabled = status === "disabled";
    const available = !archived && !statusDisabled;

    const rentPcm = safeNum(d.rentPcm ?? d.rent);
    const price = safeNum(d.price);
    const beds = safeNum(d.bedrooms ?? d.beds);
    const baths = safeNum(d.bathrooms ?? d.baths);
    const propertyType = safeStr(d.type ?? d.propertyType).trim() || undefined;
    let listingType: "sale" | "rent" | undefined;
    if (d.listingType === "sale" || d.listingType === "rent") {
      listingType = d.listingType;
    } else if (price != null && price > 0) {
      listingType = "sale";
    } else if (rentPcm != null && rentPcm > 0) {
      listingType = "rent";
    }

    const lat = safeNum(d.lat ?? d.latitude);
    const lng = safeNum(d.lng ?? d.longitude ?? d.lon);

    const indexData: Record<string, unknown> = {
      agencyId,
      propertyId,
      available,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    if (safeStr(d.title).trim()) indexData.title = safeStr(d.title).trim();
    if (displayAddress) indexData.displayAddress = displayAddress;
    if (postcode) indexData.postcode = postcode;
    if (addressLower) indexData.addressLower = addressLower;
    if (postcodeLower) indexData.postcodeLower = postcodeLower;
    if (lat != null) indexData.lat = lat;
    if (lng != null) indexData.lng = lng;
    if (lat != null && lng != null && isValidLatLng(lat, lng)) {
      indexData.geohash = geohashForLocation([lat, lng]);
    }
    if (listingType) indexData.listingType = listingType;
    if (status) indexData.status = status;
    if (price != null) indexData.price = price;
    if (rentPcm != null) indexData.rent = rentPcm;
    if (beds != null) indexData.beds = beds;
    if (baths != null) indexData.baths = baths;
    if (propertyType) indexData.propertyType = propertyType;
    if (d.createdAt != null) indexData.createdAt = d.createdAt;

    await indexRef.set(indexData, {merge: true});
  }
);

/**
 * Run once to create the first superAdmin; afterwards locked forever.
 * Caller must have Firebase ID token in Authorization: Bearer <token>.
 * Bootstrap doc system/bootstrap must contain adminEmail;
 * only that email may call.
 * On success, creates users/{uid} with role superAdmin and sets
 * bootstrappedAt on system/bootstrap.
 */
export const bootstrapSuperAdmin = onRequest(
  {cors: false},
  async (req, res): Promise<void> => {
    const origin = req.get("Origin");
    setCorsHeaders(res, origin);

    if (req.method === "OPTIONS") {
      res.status(204).send();
      return;
    }

    if (req.method !== "POST") {
      sendJson(res, 405, {error: "Method not allowed"});
      return;
    }

    const authHeader = req.get("Authorization");
    const token = authHeader?.startsWith("Bearer ") ?
      authHeader.slice(7) :
      null;
    if (!token) {
      sendJson(res, 401, {error: "Missing or invalid Authorization header"});
      return;
    }

    let decodedToken: admin.auth.DecodedIdToken;
    try {
      decodedToken = await admin.auth().verifyIdToken(token);
    } catch {
      sendJson(res, 401, {error: "Invalid or expired token"});
      return;
    }

    const db = admin.firestore();
    const bootstrapRef = db.doc(BOOTSTRAP_PATH);

    const bootstrapSnap = await bootstrapRef.get();
    if (!bootstrapSnap.exists) {
      sendJson(res, 403, {error: "Bootstrap document not found"});
      return;
    }

    const data = bootstrapSnap.data() as {
      superAdminEmail?: string;
      adminEmail?: string;
    };
    const superAdminEmail = typeof data?.superAdminEmail === "string" ?
      data.superAdminEmail.trim().toLowerCase() :
      "";
    const adminEmail = typeof data?.adminEmail === "string" ?
      data.adminEmail.trim().toLowerCase() :
      "";
    const allowedEmail = superAdminEmail || adminEmail;
    if (!allowedEmail) {
      sendJson(res, 403, {
        error: "Bootstrap document must contain superAdminEmail or adminEmail",
      });
      return;
    }
    const callerEmail = (decodedToken.email ?? "").trim().toLowerCase();
    if (callerEmail !== allowedEmail) {
      sendJson(res, 403, {error: "Not authorized to run bootstrap"});
      return;
    }

    const uid = decodedToken.uid;
    const userRef = db.doc(`users/${uid}`);

    try {
      await db.runTransaction(async (tx) => {
        const freshBootstrap = await tx.get(bootstrapRef);
        const freshData = freshBootstrap.data() as {
          bootstrappedAt?: unknown;
          bootstrapped?: boolean;
        } | undefined;
        if (
          freshData?.bootstrappedAt !== undefined &&
          freshData?.bootstrappedAt !== null
        ) {
          throw new Error("ALREADY_BOOTSTRAPPED");
        }
        if (freshData?.bootstrapped === true) {
          throw new Error("ALREADY_BOOTSTRAPPED");
        }

        const now = admin.firestore.FieldValue.serverTimestamp();
        tx.set(userRef, {
          uid,
          email: decodedToken.email ?? "",
          role: "superAdmin",
          permissions: [...ALL_PERMISSIONS],
          status: "active",
          agencyId: "ip12",
          createdAt: now,
          updatedAt: now,
        });

        tx.update(bootstrapRef, {
          bootstrappedAt: now,
          bootstrappedByUid: uid,
        });
      });
    } catch (e) {
      if (e instanceof Error && e.message === "ALREADY_BOOTSTRAPPED") {
        sendJson(res, 409, {error: "Already bootstrapped"});
        return;
      }
      logger.error("Bootstrap transaction failed", e);
      sendJson(res, 500, {error: "Bootstrap failed"});
      return;
    }

    sendJson(res, 200, {
      success: true,
      message: "SuperAdmin profile created",
      uid,
    });
  }
);
