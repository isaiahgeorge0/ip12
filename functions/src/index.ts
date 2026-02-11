/**
 * Firebase Functions v2 entry point.
 */

import * as admin from "firebase-admin";
import {setGlobalOptions} from "firebase-functions/v2";
import {onRequest} from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";

if (!admin.apps.length) {
  admin.initializeApp();
}

setGlobalOptions({maxInstances: 10});

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
