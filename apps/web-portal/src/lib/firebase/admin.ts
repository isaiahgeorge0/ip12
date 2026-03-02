/**
 * Firebase Admin SDK (server-side only).
 * Used in API routes for invite-landlord, etc.
 * No client-exposed env vars (no NEXT_PUBLIC_*).
 *
 * Credentials (first valid wins):
 * - FIREBASE_SERVICE_ACCOUNT_JSON = full JSON string (CI/hosting)
 * - GOOGLE_APPLICATION_CREDENTIALS = path to service account JSON file (local dev; we read it directly to avoid "Could not load default credentials")
 * - else applicationDefault() (GCP only)
 *
 * Project ID (priority order):
 * 1. FIREBASE_PROJECT_ID 2. GOOGLE_CLOUD_PROJECT 3. project_id from JSON 4. NEXT_PUBLIC_FIREBASE_PROJECT_ID
 * (JSON = FIREBASE_SERVICE_ACCOUNT_JSON or file at GOOGLE_APPLICATION_CREDENTIALS)
 */

import * as admin from "firebase-admin";
import * as fs from "node:fs";
import * as path from "node:path";

let defaultApp: admin.app.App | null = null;

type ServiceAccountLike = admin.ServiceAccount & { project_id?: string };

function projectIdFromJsonPath(filePath: string | undefined): string | undefined {
  if (!filePath?.trim()) return undefined;
  const resolved = path.resolve(filePath);
  try {
    const raw = fs.readFileSync(resolved, "utf8");
    const data = JSON.parse(raw) as ServiceAccountLike;
    return typeof data.project_id === "string" ? data.project_id : undefined;
  } catch {
    return undefined;
  }
}

function resolveProjectId(parsedJson?: ServiceAccountLike): string {
  const fromEnv =
    process.env.FIREBASE_PROJECT_ID?.trim() ||
    process.env.GOOGLE_CLOUD_PROJECT?.trim();
  if (fromEnv) return fromEnv;
  if (parsedJson?.project_id) return parsedJson.project_id;
  const fromFile = projectIdFromJsonPath(process.env.GOOGLE_APPLICATION_CREDENTIALS);
  if (fromFile) return fromFile;
  const fromClient = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim();
  if (fromClient) return fromClient;
  throw new Error(
    "Admin SDK missing projectId. Set FIREBASE_PROJECT_ID, GOOGLE_CLOUD_PROJECT, or ensure NEXT_PUBLIC_FIREBASE_PROJECT_ID is set in .env.local (same as your Firebase client config)."
  );
}

function getDefaultApp(): admin.app.App {
  if (defaultApp) return defaultApp;
  if (admin.apps.length > 0) {
    defaultApp = admin.app() as admin.app.App;
    return defaultApp;
  }

  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  const credsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim();
  let credential: admin.credential.Credential;
  let parsedJson: ServiceAccountLike | undefined;

  if (json) {
    try {
      parsedJson = JSON.parse(json) as ServiceAccountLike;
      credential = admin.credential.cert(parsedJson as admin.ServiceAccount);
    } catch {
      throw new Error(
        "FIREBASE_SERVICE_ACCOUNT_JSON is set but invalid JSON."
      );
    }
  } else if (credsPath) {
    const resolvedPath = path.isAbsolute(credsPath)
      ? credsPath
      : path.resolve(process.cwd(), credsPath);
    try {
      const raw = fs.readFileSync(resolvedPath, "utf8");
      parsedJson = JSON.parse(raw) as ServiceAccountLike;
      credential = admin.credential.cert(parsedJson as admin.ServiceAccount);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(
        `Could not load credentials from GOOGLE_APPLICATION_CREDENTIALS. Path tried: ${resolvedPath}. ${msg}`
      );
    }
  } else {
    throw new Error(
      "Admin SDK: GOOGLE_APPLICATION_CREDENTIALS is not set in the server environment. " +
        "Add it to apps/web-portal/.env.local (absolute path to your service account JSON), " +
        "then run 'npm run dev' from the apps/web-portal folder. " +
        "Alternatively, set FIREBASE_SERVICE_ACCOUNT_JSON to the full JSON content (minified to one line)."
    );
  }

  const projectId = resolveProjectId(parsedJson);

  defaultApp = admin.initializeApp({
    credential,
    projectId,
  });
  return defaultApp;
}

export function getAdminAuth(): admin.auth.Auth {
  return getDefaultApp().auth();
}

export function getAdminFirestore(): admin.firestore.Firestore {
  return getDefaultApp().firestore();
}
