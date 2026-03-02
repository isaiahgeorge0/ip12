/**
 * Firebase client initialization for the web portal.
 * Reads config from env: NEXT_PUBLIC_FIREBASE_* (set in .env.local).
 * Only initializes in the browser; do not commit .env.local or secrets.
 */

import { getApps, initializeApp } from "firebase/app";
import type { FirebaseApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

function getConfig() {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "";
  const messagingSenderId =
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "";
  const appId = process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "";
  const measurementId =
    process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID ?? "";
  if (!apiKey || !authDomain || !projectId) {
    return null;
  }
  return {
    apiKey,
    authDomain,
    projectId,
    storageBucket,
    messagingSenderId,
    appId,
    ...(measurementId && { measurementId }),
  };
}

let app: FirebaseApp | null = null;

let firebaseConfigDebugLogged = false;

export function getFirebaseApp(): FirebaseApp | null {
  if (typeof window === "undefined") return null;
  if (!firebaseConfigDebugLogged) {
    firebaseConfigDebugLogged = true;
    const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
    const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
    const messagingSenderId =
      process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID;
    const appId = process.env.NEXT_PUBLIC_FIREBASE_APP_ID;
    const measurementId = process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID;
    console.log("[Firebase config debug]", {
      hasApiKey: !!apiKey,
      hasAuthDomain: !!authDomain,
      hasProjectId: !!projectId,
      hasStorageBucket: !!storageBucket,
      hasMessagingSenderId: !!messagingSenderId,
      hasAppId: !!appId,
      hasMeasurementId: !!measurementId,
      apiKeyLength: (apiKey ?? "").length,
      authDomainLength: (authDomain ?? "").length,
      projectIdLength: (projectId ?? "").length,
      storageBucketLength: (storageBucket ?? "").length,
      messagingSenderIdLength: (messagingSenderId ?? "").length,
      appIdLength: (appId ?? "").length,
      measurementIdLength: (measurementId ?? "").length,
    });
  }
  if (app) return app;
  const config = getConfig();
  if (!config) return null;
  const existing = getApps();
  if (existing.length > 0) return existing[0] as FirebaseApp;
  app = initializeApp(config);
  return app;
}

export function getFirebaseAuth() {
  const a = getFirebaseApp();
  return a ? getAuth(a) : null;
}

export function getFirebaseFirestore() {
  const a = getFirebaseApp();
  return a ? getFirestore(a) : null;
}

export function isFirebaseConfigured(): boolean {
  return getConfig() !== null;
}
