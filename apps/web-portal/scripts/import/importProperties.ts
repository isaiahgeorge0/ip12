/**
 * Import cleaned legacy properties/listings into Firestore.
 *
 * Source JSON shape:
 * {
 *   "properties": [...],
 *   "listings": [...]
 * }
 *
 * Firestore targets:
 * - agencies/{agencyId}/properties/{propertyId}
 * - agencies/{agencyId}/listings/{listingId}
 *
 * Safety:
 * - Dry-run by default
 * - Use merge upserts (idempotent)
 * - No deletes
 *
 * Usage (from apps/web-portal):
 *   npx tsx scripts/import/importProperties.ts
 *   npx tsx scripts/import/importProperties.ts --commit
 *   npx tsx scripts/import/importProperties.ts --commit --agencyId=ip12
 *   npx tsx scripts/import/importProperties.ts --input=/absolute/path/properties_cleaned.json
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminFirestore } from "../../src/lib/firebase/admin";
import { propertiesCol } from "../../src/lib/firestore/paths";

type PropertyRow = {
  id: string | null;
  [key: string]: unknown;
};

type ListingRow = {
  property_id: string | null;
  [key: string]: unknown;
};

type ImportPayload = {
  properties: PropertyRow[];
  listings: ListingRow[];
};

type Counters = {
  propertiesProcessed: number;
  listingsProcessed: number;
  propertiesCreated: number;
  propertiesUpdated: number;
  listingsCreated: number;
  listingsUpdated: number;
  skipped: number;
  errors: number;
};

function parseArgs(argv: string[]) {
  let commit = false;
  let agencyId = "ip12";
  let inputPath: string | null = null;

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
    if (arg.startsWith("--input=")) {
      const v = arg.slice("--input=".length).trim();
      if (v) inputPath = v;
    }
  }

  return { commit, agencyId, inputPath };
}

function resolveInputPath(fromArg: string | null): string {
  if (fromArg) {
    const abs = path.isAbsolute(fromArg) ? fromArg : path.resolve(process.cwd(), fromArg);
    if (!fs.existsSync(abs)) {
      throw new Error(`Input file not found: ${abs}`);
    }
    return abs;
  }

  const preferred = "/data/properties_cleaned.json";
  if (fs.existsSync(preferred)) return preferred;

  const fallback = path.resolve(process.cwd(), "../../data/properties_cleaned.json");
  if (fs.existsSync(fallback)) return fallback;

  throw new Error(
    "Could not find properties_cleaned.json. Checked /data/properties_cleaned.json and ../../data/properties_cleaned.json"
  );
}

function readPayload(inputPath: string): ImportPayload {
  const raw = fs.readFileSync(inputPath, "utf8");
  const parsed = JSON.parse(raw) as Partial<ImportPayload>;
  if (!Array.isArray(parsed.properties) || !Array.isArray(parsed.listings)) {
    throw new Error("Invalid JSON shape: expected { properties: [], listings: [] }");
  }
  return {
    properties: parsed.properties as PropertyRow[],
    listings: parsed.listings as ListingRow[],
  };
}

function safeId(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s || null;
}

function firstNonEmpty(...values: unknown[]): string | null {
  for (const v of values) {
    if (v == null) continue;
    const s = String(v).trim();
    if (s) return s;
  }
  return null;
}

function listingsCol(agencyId: string): string {
  return `agencies/${agencyId}/listings`;
}

async function main() {
  const { commit, agencyId, inputPath } = parseArgs(process.argv.slice(2));
  const sourcePath = resolveInputPath(inputPath);
  const payload = readPayload(sourcePath);
  const db = getAdminFirestore();

  console.log(`[importProperties] mode=${commit ? "COMMIT" : "DRY_RUN"} agencyId=${agencyId}`);
  console.log(`[importProperties] input=${sourcePath}`);
  console.log(
    `[importProperties] properties=${payload.properties.length} listings=${payload.listings.length}`
  );

  const counters: Counters = {
    propertiesProcessed: 0,
    listingsProcessed: 0,
    propertiesCreated: 0,
    propertiesUpdated: 0,
    listingsCreated: 0,
    listingsUpdated: 0,
    skipped: 0,
    errors: 0,
  };

  const propertyIdSet = new Set<string>();
  for (const row of payload.properties) {
    const id = safeId(row.id);
    if (!id) {
      counters.skipped += 1;
      console.warn("[importProperties] skip property (missing id)");
      continue;
    }
    propertyIdSet.add(id);
  }

  for (const row of payload.properties) {
    const propertyId = safeId(row.id);
    if (!propertyId) continue;

    counters.propertiesProcessed += 1;
    const ref = db.collection(propertiesCol(agencyId)).doc(propertyId);
    const existing = await ref.get();
    if (existing.exists) counters.propertiesUpdated += 1;
    else counters.propertiesCreated += 1;

    const writeData = {
      ...row,
      id: propertyId,
      // Backward/forward compatibility with existing admin property list expectations.
      displayAddress: firstNonEmpty(
        row.displayAddress,
        row.display_address,
        row.address_line_1,
        row.headline,
        row.postcode
      ),
      source: "legacy_csv_v1",
      source_id: propertyId,
      imported_at: FieldValue.serverTimestamp(),
    };

    if (!commit) {
      console.log(`[DRY_RUN] property upsert -> ${ref.path}`);
      continue;
    }

    try {
      await ref.set(writeData, { merge: true });
    } catch (err) {
      counters.errors += 1;
      console.error(`[importProperties] property write failed id=${propertyId}`, err);
    }
  }

  for (const row of payload.listings) {
    const propertyId = safeId(row.property_id);
    if (!propertyId) {
      counters.skipped += 1;
      console.warn("[importProperties] skip listing (missing property_id)");
      continue;
    }
    if (!propertyIdSet.has(propertyId)) {
      counters.skipped += 1;
      console.warn(
        `[importProperties] skip listing (property_id not in payload properties) property_id=${propertyId}`
      );
      continue;
    }

    const listingId = propertyId;
    counters.listingsProcessed += 1;

    const ref = db.collection(listingsCol(agencyId)).doc(listingId);
    const existing = await ref.get();
    if (existing.exists) counters.listingsUpdated += 1;
    else counters.listingsCreated += 1;

    const writeData = {
      ...row,
      property_id: propertyId,
      source: "legacy_csv_v1",
      source_id: propertyId,
      imported_at: FieldValue.serverTimestamp(),
    };

    if (!commit) {
      console.log(`[DRY_RUN] listing upsert -> ${ref.path}`);
      continue;
    }

    try {
      await ref.set(writeData, { merge: true });
    } catch (err) {
      counters.errors += 1;
      console.error(`[importProperties] listing write failed property_id=${propertyId}`, err);
    }
  }

  console.log("\n[importProperties] summary");
  console.log(`- properties processed: ${counters.propertiesProcessed}`);
  console.log(`- listings processed: ${counters.listingsProcessed}`);
  console.log(
    `- properties created/updated: ${counters.propertiesCreated}/${counters.propertiesUpdated}`
  );
  console.log(
    `- listings created/updated: ${counters.listingsCreated}/${counters.listingsUpdated}`
  );
  console.log(`- skipped: ${counters.skipped}`);
  console.log(`- errors: ${counters.errors}`);
  console.log(`[importProperties] done (${commit ? "COMMIT" : "DRY_RUN"})`);
}

main().catch((err) => {
  console.error("[importProperties] fatal", err);
  process.exit(1);
});

