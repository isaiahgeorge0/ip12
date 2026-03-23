/**
 * Import legacy landlords CSV into Firestore-only landlord user docs.
 *
 * Targets:
 * - users/{landlordUid}
 * - landlordAgencyGrants/{landlordUid}
 *
 * Safety:
 * - Dry-run by default
 * - Idempotent merge upserts
 * - No Auth user creation
 * - No deletes
 *
 * Usage (from apps/web-portal):
 *   npx tsx scripts/import/importLandlords.ts
 *   npx tsx scripts/import/importLandlords.ts --commit
 *   npx tsx scripts/import/importLandlords.ts --commit --agencyId=ip12
 *   npx tsx scripts/import/importLandlords.ts --input=/Users/zg/ip12/data/landlords.csv
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminFirestore } from "../../src/lib/firebase/admin";
import { landlordAgencyGrantDoc } from "../../src/lib/firestore/paths";
import { readCsvFile, type CsvRow } from "./_csv";

type Counters = {
  processed: number;
  created: number;
  updated: number;
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
    if (!fs.existsSync(abs)) throw new Error(`Input file not found: ${abs}`);
    return abs;
  }
  const preferred = "/Users/zg/ip12/data/landlords.csv";
  if (fs.existsSync(preferred)) return preferred;
  const fallback = path.resolve(process.cwd(), "../../data/landlords.csv");
  if (fs.existsSync(fallback)) return fallback;
  throw new Error("Could not find landlords.csv");
}

function t(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s || null;
}

function email(v: unknown): string | null {
  const s = t(v);
  return s ? s.toLowerCase() : null;
}

function firstNonEmpty(...vals: unknown[]): string | null {
  for (const v of vals) {
    const s = t(v);
    if (s) return s;
  }
  return null;
}

function statusNormalized(v: unknown): "active" | "inactive" | "unknown" {
  const s = (t(v) ?? "").toLowerCase();
  if (!s) return "unknown";
  if (
    s.includes("inactive") ||
    s.includes("archiv") ||
    s.includes("closed") ||
    s.includes("deleted") ||
    s.includes("disabled")
  ) {
    return "inactive";
  }
  if (
    s.includes("active") ||
    s.includes("current") ||
    s.includes("live") ||
    s.includes("registered")
  ) {
    return "active";
  }
  return "unknown";
}

function makeDisplayName(r: CsvRow, externalId: string): string {
  return (
    firstNonEmpty(
      r["Full name"],
      `${t(r["Firstname"]) ?? ""} ${t(r["Surname"]) ?? ""}`.trim(),
      r["Company name"],
      r["Landlord"]
    ) ?? `Landlord ${externalId}`
  );
}

function landlordUid(externalId: string): string {
  return `legacy_landlord_${externalId}`;
}

async function upsertGrant(
  landlordUidValue: string,
  agencyId: string,
  commit: boolean
): Promise<"created" | "updated"> {
  const db = getAdminFirestore();
  const ref = db.doc(landlordAgencyGrantDoc(landlordUidValue));
  const snap = await ref.get();
  const existing = snap.exists ? (snap.data() as Record<string, unknown>) : null;
  const existingIds = Array.isArray(existing?.sharedWithAgencyIds)
    ? (existing?.sharedWithAgencyIds as unknown[]).map((x) => String(x))
    : [];
  const merged = Array.from(new Set([...existingIds, agencyId]));

  if (!commit) return snap.exists ? "updated" : "created";

  await ref.set(
    {
      landlordUid: landlordUidValue,
      sharedWithAgencyIds: merged,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: "legacy_import",
    },
    { merge: true }
  );
  return snap.exists ? "updated" : "created";
}

async function main() {
  const { commit, agencyId, inputPath } = parseArgs(process.argv.slice(2));
  const csvPath = resolveInputPath(inputPath);
  const { rows } = readCsvFile(csvPath);
  const db = getAdminFirestore();

  console.log(`[importLandlords] mode=${commit ? "COMMIT" : "DRY_RUN"} agencyId=${agencyId}`);
  console.log(`[importLandlords] input=${csvPath}`);
  console.log(`[importLandlords] total rows=${rows.length}`);

  const idCounter = new Map<string, number>();
  for (const r of rows) {
    const id = t(r["Id"]);
    if (!id) continue;
    idCounter.set(id, (idCounter.get(id) ?? 0) + 1);
  }
  const duplicateIds = [...idCounter.entries()].filter(([, c]) => c > 1).map(([id]) => id);
  if (duplicateIds.length > 0) {
    console.warn(`[importLandlords] duplicate Ids found: ${duplicateIds.length}`);
    console.warn(`[importLandlords] sample duplicates: ${duplicateIds.slice(0, 20).join(", ")}`);
  }

  const counters: Counters = { processed: 0, created: 0, updated: 0, skipped: 0, errors: 0 };
  const grantCounters = { created: 0, updated: 0 };

  for (const row of rows) {
    const externalId = t(row["Id"]);
    if (!externalId) {
      counters.skipped += 1;
      continue;
    }
    counters.processed += 1;
    const uid = landlordUid(externalId);
    const ref = db.collection("users").doc(uid);
    const existing = await ref.get();

    const firstName = t(row["Firstname"]);
    const lastName = t(row["Surname"]);
    const data = {
      uid,
      role: "landlord",
      externalId,
      displayName: makeDisplayName(row, externalId),
      firstName,
      lastName,
      companyName: t(row["Company name"]),
      title: t(row["Title"]),
      email: email(row["Email"]),
      phone: firstNonEmpty(row["Mobile phone"], row["Work phone"], row["Home phone"]),
      address: {
        line1: t(row["Address Line 1"]),
        line2: t(row["Address Line 2"]),
        city: t(row["Town/City"]),
        county: t(row["County"]),
        postcode: t(row["Postcode"]),
        country: t(row["Country"]),
      },
      statusRaw: t(row["Status"]),
      statusNormalized: statusNormalized(row["Status"]),
      branchRaw: t(row["Branches"]),
      source: "legacy_csv_v1",
      sourceType: "landlords_csv",
      sourceId: externalId,
      importedAt: FieldValue.serverTimestamp(),
      authProvisioned: false,
      needsInvite: true,
      createdVia: "legacy_import",
    };

    if (!commit) {
      console.log(`[DRY_RUN] landlord upsert -> users/${uid}`);
      try {
        const gRes = await upsertGrant(uid, agencyId, false);
        if (gRes === "created") grantCounters.created += 1;
        else grantCounters.updated += 1;
      } catch (err) {
        counters.errors += 1;
        console.error(`[importLandlords] grant dry-run failed uid=${uid}`, err);
      }
      if (existing.exists) counters.updated += 1;
      else counters.created += 1;
      continue;
    }

    try {
      await ref.set(data, { merge: true });
      if (existing.exists) counters.updated += 1;
      else counters.created += 1;

      const gRes = await upsertGrant(uid, agencyId, true);
      if (gRes === "created") grantCounters.created += 1;
      else grantCounters.updated += 1;
    } catch (err) {
      counters.errors += 1;
      console.error(`[importLandlords] write failed uid=${uid}`, err);
    }
  }

  console.log("\n[importLandlords] summary");
  console.log(`- mode: ${commit ? "COMMIT" : "DRY_RUN"}`);
  console.log(`- input path: ${csvPath}`);
  console.log(`- agencyId: ${agencyId}`);
  console.log(`- total rows processed: ${counters.processed}`);
  console.log(`- created: ${counters.created}`);
  console.log(`- updated: ${counters.updated}`);
  console.log(`- skipped: ${counters.skipped}`);
  console.log(`- errors: ${counters.errors}`);
  console.log(`- grant docs created/updated: ${grantCounters.created}/${grantCounters.updated}`);
}

main().catch((err) => {
  console.error("[importLandlords] fatal", err);
  process.exit(1);
});

