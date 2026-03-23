/**
 * One-time seed: create agency "Woodcock & Son" with slug "woodcock-and-son".
 * GET or POST (superAdmin only). If agencies exist, mirrors the first doc's shape; otherwise uses name, slug, createdAt, updatedAt.
 *
 * Agencies collection schema (from codebase):
 * - Collection path: agencies (top-level). Document path: agencies/{agencyId}.
 * - agencyId: custom (document ID), not auto-generated.
 * - Required/used fields: name (string). This seed adds slug, createdAt, updatedAt if not present on existing docs.
 */

import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { requireServerSessionApi, assertRoleApi } from "@/lib/auth/authz";
import { getAdminFirestore } from "@/lib/firebase/admin";

const NEW_AGENCY_ID = "woodcock-and-son";
const NEW_AGENCY_NAME = "Woodcock & Son";
const NEW_AGENCY_SLUG = "woodcock-and-son";

export async function GET(_request: NextRequest) {
  return runSeed();
}

export async function POST(_request: NextRequest) {
  return runSeed();
}

async function runSeed() {
  const sessionOr401 = await requireServerSessionApi();
  if (sessionOr401 instanceof NextResponse) return sessionOr401;
  const session = sessionOr401;
  const role403 = assertRoleApi(session, ["superAdmin"]);
  if (role403) return role403;

  const db = getAdminFirestore();
  const col = db.collection("agencies");
  const existingSnap = await col.get();

  let payload: Record<string, unknown>;

  if (existingSnap.empty) {
    payload = {
      name: NEW_AGENCY_NAME,
      slug: NEW_AGENCY_SLUG,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };
  } else {
    const first = existingSnap.docs[0];
    const existingData = first.data();
    const keys = Object.keys(existingData);
    payload = {};
    for (const key of keys) {
      if (key === "name") payload[key] = NEW_AGENCY_NAME;
      else if (key === "slug") payload[key] = NEW_AGENCY_SLUG;
      else if (key === "createdAt" || key === "updatedAt") payload[key] = FieldValue.serverTimestamp();
      else payload[key] = existingData[key];
    }
    if (!("name" in payload)) payload.name = NEW_AGENCY_NAME;
    if (!("slug" in payload)) payload.slug = NEW_AGENCY_SLUG;
    if (!("createdAt" in payload)) payload.createdAt = FieldValue.serverTimestamp();
    if (!("updatedAt" in payload)) payload.updatedAt = FieldValue.serverTimestamp();
  }

  const ref = col.doc(NEW_AGENCY_ID);
  const existingDoc = await ref.get();
  if (existingDoc.exists) {
    const data = existingDoc.data() ?? {};
    const toSerializable = (v: unknown): unknown => {
      if (v && typeof v === "object" && "toDate" in v && typeof (v as { toDate: () => Date }).toDate === "function") {
        return { _timestamp: (v as { toDate: () => Date }).toDate().toISOString() };
      }
      if (v && typeof v === "object" && "seconds" in v) {
        return { seconds: (v as { seconds: number }).seconds, nanoseconds: (v as { nanoseconds?: number }).nanoseconds ?? 0 };
      }
      return v;
    };
    const docOut: Record<string, unknown> = { id: existingDoc.id };
    for (const [k, v] of Object.entries(data)) {
      docOut[k] = toSerializable(v);
    }
    const out = {
      message: "Agency already exists",
      agencyId: NEW_AGENCY_ID,
      document: docOut,
      schemaMatch: true,
    };
    console.log("[agencies/seed] Agency already exists:", NEW_AGENCY_ID);
    console.log("[agencies/seed] Full document:", JSON.stringify(out.document, null, 2));
    return NextResponse.json(out);
  }

  await ref.set(payload);

  const after = await ref.get();
  const createdData = after.data() ?? {};
  const toSerializable = (v: unknown): unknown => {
    if (v && typeof v === "object" && "toDate" in v && typeof (v as { toDate: () => Date }).toDate === "function") {
      return { _timestamp: (v as { toDate: () => Date }).toDate().toISOString() };
    }
    if (v && typeof v === "object" && "seconds" in v) {
      return { seconds: (v as { seconds: number }).seconds, nanoseconds: (v as { nanoseconds?: number }).nanoseconds ?? 0 };
    }
    return v;
  };
  const createdStructure: Record<string, unknown> = { id: after.id };
  for (const [k, v] of Object.entries(createdData)) {
    createdStructure[k] = toSerializable(v);
  }

  const existingKeys = !existingSnap.empty ? Object.keys(existingSnap.docs[0].data()).sort() : [];
  const createdKeys = Object.keys(createdData).sort();
  const schemaMatch = existingSnap.empty ? "N/A (no existing agency to compare)" : existingKeys.join(",") === createdKeys.join(",");

  const response = {
    message: "Agency created",
    agencyId: NEW_AGENCY_ID,
    document: createdStructure,
    schemaMatch,
  };

  console.log("[agencies/seed] Created agencyId:", NEW_AGENCY_ID);
  console.log("[agencies/seed] Full created document:", JSON.stringify(createdStructure, null, 2));
  console.log("[agencies/seed] Schema match:", schemaMatch);

  return NextResponse.json(response);
}
