/**
 * Link existing property docs to imported landlord users.
 *
 * Target:
 * - propertyLandlords/{agencyId}_{propertyId}_{landlordUid}
 *
 * Safety:
 * - Dry-run by default
 * - Exact external ID matching only
 * - Idempotent merge upserts
 * - No deletes
 *
 * Usage (from apps/web-portal):
 *   npx tsx scripts/import/linkPropertyLandlords.ts
 *   npx tsx scripts/import/linkPropertyLandlords.ts --commit
 *   npx tsx scripts/import/linkPropertyLandlords.ts --agencyId=ip12
 *   npx tsx scripts/import/linkPropertyLandlords.ts --propertiesCsv=/Users/zg/ip12/data/Properties.csv
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminFirestore } from "../../src/lib/firebase/admin";
import { propertyLandlordsCol } from "../../src/lib/firestore/paths";
import { readCsvFile } from "./_csv";

type Counters = {
  processed: number;
  created: number;
  updated: number;
  skipped: number;
  errors: number;
  unmatched: number;
};

function parseArgs(argv: string[]) {
  let commit = false;
  let agencyId = "ip12";
  let propertiesCsv: string | null = null;
  for (const arg of argv) {
    if (arg === "--commit") {
      commit = true;
      continue;
    }
    if (arg.startsWith("--agencyId=")) {
      const v = arg.slice("--agencyId=".length).trim();
      if (v) agencyId = v;
      continue;
    }
    if (arg.startsWith("--propertiesCsv=")) {
      const v = arg.slice("--propertiesCsv=".length).trim();
      if (v) propertiesCsv = v;
    }
  }
  return { commit, agencyId, propertiesCsv };
}

function resolvePropertiesCsvPath(fromArg: string | null): string {
  if (fromArg) {
    const abs = path.isAbsolute(fromArg) ? fromArg : path.resolve(process.cwd(), fromArg);
    if (!fs.existsSync(abs)) throw new Error(`Properties CSV not found: ${abs}`);
    return abs;
  }
  const preferred = "/Users/zg/ip12/data/Properties.csv";
  if (fs.existsSync(preferred)) return preferred;
  const fallback = path.resolve(process.cwd(), "../../data/Properties.csv");
  if (fs.existsSync(fallback)) return fallback;
  throw new Error("Could not find Properties.csv");
}

function t(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s || null;
}

function landlordUid(externalId: string): string {
  return `legacy_landlord_${externalId}`;
}

async function loadImportedLandlordExternalIds(): Promise<Set<string>> {
  const db = getAdminFirestore();
  const out = new Set<string>();
  const snap = await db.collection("users").where("sourceType", "==", "landlords_csv").get();
  for (const d of snap.docs) {
    const raw = d.get("externalId");
    const externalId = t(raw);
    if (externalId) out.add(externalId);
  }
  return out;
}

async function loadPropertyLandlordMapFromFirestore(
  agencyId: string
): Promise<Map<string, string> | null> {
  const db = getAdminFirestore();
  const snap = await db.collection(`agencies/${agencyId}/properties`).get();
  const map = new Map<string, string>();
  for (const d of snap.docs) {
    const data = d.data();
    const landlordExternalId = t(
      data.landlordExternalId ??
        data.landlord_external_id ??
        data.landlordId ??
        data.landlord_id ??
        data.source_landlord_id
    );
    if (landlordExternalId) {
      map.set(d.id, landlordExternalId);
    }
  }
  if (map.size === 0) return null;
  return map;
}

function loadPropertyLandlordMapFromCsv(propertiesCsvPath: string): Map<string, string> {
  const { rows } = readCsvFile(propertiesCsvPath);
  const map = new Map<string, string>();
  for (const row of rows) {
    const propertyId = t(row["Id"]);
    const landlordExternalId = t(row["Landlord Id"]);
    if (!propertyId || !landlordExternalId) continue;
    map.set(propertyId, landlordExternalId);
  }
  return map;
}

async function main() {
  const { commit, agencyId, propertiesCsv } = parseArgs(process.argv.slice(2));
  const db = getAdminFirestore();
  const counters: Counters = {
    processed: 0,
    created: 0,
    updated: 0,
    skipped: 0,
    errors: 0,
    unmatched: 0,
  };

  let propertyLandlordMap = await loadPropertyLandlordMapFromFirestore(agencyId);
  let mapSource = `firestore agencies/${agencyId}/properties`;
  let propertiesCsvPath: string | null = null;

  if (!propertyLandlordMap || propertyLandlordMap.size === 0) {
    propertiesCsvPath = resolvePropertiesCsvPath(propertiesCsv);
    propertyLandlordMap = loadPropertyLandlordMapFromCsv(propertiesCsvPath);
    mapSource = `csv ${propertiesCsvPath}`;
  }

  const importedLandlordIds = await loadImportedLandlordExternalIds();
  const unmatchedIds = new Set<string>();

  console.log(`[linkPropertyLandlords] mode=${commit ? "COMMIT" : "DRY_RUN"} agencyId=${agencyId}`);
  console.log(`[linkPropertyLandlords] property-landlord source=${mapSource}`);
  console.log(`[linkPropertyLandlords] matched candidate rows=${propertyLandlordMap.size}`);

  for (const [propertyId, landlordExternalId] of propertyLandlordMap.entries()) {
    counters.processed += 1;
    if (!importedLandlordIds.has(landlordExternalId)) {
      counters.unmatched += 1;
      unmatchedIds.add(landlordExternalId);
      continue;
    }

    const uid = landlordUid(landlordExternalId);
    const linkId = `${agencyId}_${propertyId}_${uid}`;
    const ref = db.collection(propertyLandlordsCol()).doc(linkId);
    const existing = await ref.get();
    if (existing.exists) counters.updated += 1;
    else counters.created += 1;

    const data = {
      agencyId,
      propertyId,
      landlordUid: uid,
      landlordExternalId,
      source: "legacy_csv_v1",
      linkedAt: FieldValue.serverTimestamp(),
    };

    if (!commit) {
      console.log(`[DRY_RUN] propertyLandlord upsert -> ${ref.path}`);
      continue;
    }

    try {
      await ref.set(data, { merge: true });
    } catch (err) {
      counters.errors += 1;
      console.error(
        `[linkPropertyLandlords] write failed propertyId=${propertyId} landlordExternalId=${landlordExternalId}`,
        err
      );
    }
  }

  console.log("\n[linkPropertyLandlords] summary");
  console.log(`- mode: ${commit ? "COMMIT" : "DRY_RUN"}`);
  console.log(`- input path: ${propertiesCsvPath ?? "(from Firestore properties docs)"}`);
  console.log(`- agencyId: ${agencyId}`);
  console.log(`- total rows processed: ${counters.processed}`);
  console.log(`- created: ${counters.created}`);
  console.log(`- updated: ${counters.updated}`);
  console.log(`- skipped: ${counters.skipped}`);
  console.log(`- error count: ${counters.errors}`);
  console.log(`- unmatched property->landlord links: ${counters.unmatched}`);
  if (unmatchedIds.size > 0) {
    console.log(
      `- unmatched landlordExternalId sample: ${Array.from(unmatchedIds).slice(0, 20).join(", ")}`
    );
  }
}

main().catch((err) => {
  console.error("[linkPropertyLandlords] fatal", err);
  process.exit(1);
});

