/**
 * Import legacy tenancies from Tenants.csv into agency tenancies collection.
 *
 * Targets:
 * - agencies/{agencyId}/tenancies/{tenancyDocId}
 * - optionally merge tenancySummary into matched property docs
 *
 * Safety:
 * - Dry-run by default
 * - Deterministic doc IDs
 * - Merge upserts only
 * - No deletes
 */

import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminFirestore } from "../../src/lib/firebase/admin";
import { propertiesCol, tenanciesCol } from "../../src/lib/firestore/paths";
import { readCsvFile, type CsvRow } from "./_csv";
import { normalizeAddress } from "./_normalizeAddress";
import { resolvePropertyMatch, type PropertyCandidate } from "./_tenancyMatching";

type Counters = {
  processedRows: number;
  created: number;
  updated: number;
  matched: number;
  unmatched: number;
  ambiguous: number;
  skipped: number;
  errors: number;
};

type TenancyGroup = {
  docId: string;
  rows: Array<{ row: CsvRow; rowIndex: number }>;
};

type PreparedTenancyDoc = {
  id: string;
  data: Record<string, unknown>;
  propertyId: string | null;
  occupancyStatus: "current" | "upcoming" | "ended" | "unknown";
  rentAmount: number | null;
  rentFrequency: string | null;
  startDate: string | null;
  endDate: string | null;
  leadTenantName: string | null;
  matchStatus: "matched" | "unmatched" | "ambiguous";
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
  const preferred = "/Users/zg/ip12/data/Tenants.csv";
  if (fs.existsSync(preferred)) return preferred;
  const fallback = path.resolve(process.cwd(), "../../data/Tenants.csv");
  if (fs.existsSync(fallback)) return fallback;
  throw new Error("Could not find Tenants.csv");
}

function t(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s || null;
}

function firstNonEmpty(...values: unknown[]): string | null {
  for (const v of values) {
    const s = t(v);
    if (s) return s;
  }
  return null;
}

function normalizeRef(v: string | null): string | null {
  const s = t(v);
  if (!s) return null;
  const cleaned = s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return cleaned || null;
}

function stableHash(input: string): string {
  return crypto.createHash("sha1").update(input).digest("hex").slice(0, 12);
}

function parseMoney(value: string | null): number | null {
  if (!value) return null;
  const cleaned = value.replace(/,/g, "").replace(/[^0-9.\-]/g, "").trim();
  if (!cleaned) return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

function splitMultiValue(value: string | null): string[] {
  if (!value) return [];
  return value
    .split(/[;,]/g)
    .map((x) => x.trim())
    .filter(Boolean);
}

function parseBoolLike(value: string | null): boolean | null {
  const s = (value ?? "").trim().toLowerCase();
  if (!s) return null;
  if (["true", "yes", "y", "1"].includes(s)) return true;
  if (["false", "no", "n", "0"].includes(s)) return false;
  return null;
}

function parseDateIso(value: string | null): { iso: string | null; invalid: boolean } {
  const raw = t(value);
  if (!raw) return { iso: null, invalid: false };
  const m = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})(?:\s+.*)?$/);
  if (!m) return { iso: null, invalid: true };
  const day = Number(m[1]);
  const month = Number(m[2]);
  const year = Number(m[3].length === 2 ? `20${m[3]}` : m[3]);
  const d = new Date(Date.UTC(year, month - 1, day));
  if (
    !Number.isFinite(d.getTime()) ||
    d.getUTCFullYear() !== year ||
    d.getUTCMonth() !== month - 1 ||
    d.getUTCDate() !== day
  ) {
    return { iso: null, invalid: true };
  }
  return { iso: d.toISOString().slice(0, 10), invalid: false };
}

function inferRentFrequency(raw: string | null): {
  frequency: "monthly" | "weekly" | "yearly";
  inferred: boolean;
} {
  const s = (raw ?? "").toLowerCase();
  if (/\b(pw|week|weekly)\b/.test(s)) return { frequency: "weekly", inferred: false };
  if (/\b(pa|annum|annual|year|yearly)\b/.test(s)) return { frequency: "yearly", inferred: false };
  if (/\b(pm|pcm|month|monthly)\b/.test(s)) return { frequency: "monthly", inferred: false };
  return { frequency: "monthly", inferred: true };
}

function occupancyFromDates(
  startDate: string | null,
  endDate: string | null
): "current" | "upcoming" | "ended" | "unknown" {
  if (!startDate && !endDate) return "unknown";
  const today = new Date().toISOString().slice(0, 10);
  if (startDate && startDate > today) return "upcoming";
  if (endDate && endDate < today) return "ended";
  if (startDate && startDate <= today && (!endDate || endDate >= today)) return "current";
  return "unknown";
}

function buildDocId(row: CsvRow): { id: string; missingRef: boolean } {
  const lettingRef = normalizeRef(row["Letting Ref"]);
  if (lettingRef) return { id: `legacy_tenancy_${lettingRef}`, missingRef: false };
  const addr = normalizeAddress(row["Property Address"]).normalizedNoPostcode || "unknown_address";
  const tenant =
    t(row["Tenant Fullname"]) ??
    `${t(row["Firstname"]) ?? ""} ${t(row["Surname"]) ?? ""}`.trim() ??
    "unknown_tenant";
  const date = parseDateIso(row["Start Date"]).iso ?? "unknown_start";
  const hash = stableHash(`${addr}|${tenant.toLowerCase()}|${date}`);
  return { id: `legacy_tenancy_fallback_${hash}`, missingRef: true };
}

async function loadPropertyCandidates(agencyId: string): Promise<PropertyCandidate[]> {
  const db = getAdminFirestore();
  const snap = await db.collection(propertiesCol(agencyId)).get();
  return snap.docs.map((doc) => {
    const d = doc.data() as Record<string, unknown>;
    const displayAddress =
      (typeof d.displayAddress === "string" && d.displayAddress.trim()) ||
      (typeof d.display_address === "string" && d.display_address.trim()) ||
      (typeof d.address_line_1 === "string" && d.address_line_1.trim()) ||
      doc.id;
    const line1 = typeof d.address_line_1 === "string" ? d.address_line_1.trim() : "";
    const line2 = typeof d.address_line_2 === "string" ? d.address_line_2.trim() : "";
    const city = typeof d.city === "string" ? d.city.trim() : "";
    const postcode = typeof d.postcode === "string" ? d.postcode.trim() : "";
    const rawCandidateAddress =
      firstNonEmpty(
        [line1, line2, city, postcode].filter(Boolean).join(", "),
        [displayAddress, city, postcode].filter(Boolean).join(", "),
        displayAddress
      ) ?? doc.id;
    const normalized = normalizeAddress(rawCandidateAddress);
    return {
      propertyId: doc.id,
      rawCandidateAddress,
      displayAddress,
      postcode: normalized.postcode,
      comparableAddress: normalized.comparable,
      numberToken: normalized.numberToken,
      type:
        (typeof d.type === "string" && d.type.trim()) ||
        (typeof d.property_type === "string" && d.property_type.trim()) ||
        null,
      bedrooms: typeof d.bedrooms === "number" && Number.isFinite(d.bedrooms) ? d.bedrooms : null,
      bathrooms:
        typeof d.bathrooms === "number" && Number.isFinite(d.bathrooms) ? d.bathrooms : null,
      normalizedAddress: normalized,
    };
  });
}

function pickLeadOccupant(
  occupantRows: Array<Record<string, unknown>>
): Record<string, unknown> | null {
  const explicitLead = occupantRows.find((r) => r.isLeadTenant === true);
  if (explicitLead) return explicitLead;
  return occupantRows[0] ?? null;
}

function chooseBestTenancyForProperty(docs: PreparedTenancyDoc[]): PreparedTenancyDoc | null {
  if (docs.length === 0) return null;
  const rank = (d: PreparedTenancyDoc): number => {
    if (d.occupancyStatus === "current") return 3;
    if (d.occupancyStatus === "upcoming") return 2;
    if (d.occupancyStatus === "ended") return 1;
    return 0;
  };
  return [...docs].sort((a, b) => {
    const r = rank(b) - rank(a);
    if (r !== 0) return r;
    const aDate = a.endDate ?? a.startDate ?? "";
    const bDate = b.endDate ?? b.startDate ?? "";
    return bDate.localeCompare(aDate);
  })[0];
}

async function main() {
  const { commit, agencyId, inputPath } = parseArgs(process.argv.slice(2));
  const csvPath = resolveInputPath(inputPath);
  const { rows } = readCsvFile(csvPath);
  const db = getAdminFirestore();
  const properties = await loadPropertyCandidates(agencyId);

  console.log(`[importTenancies] mode=${commit ? "COMMIT" : "DRY_RUN"} agencyId=${agencyId}`);
  console.log(`[importTenancies] input=${csvPath}`);
  console.log(`[importTenancies] rows=${rows.length} properties=${properties.length}`);

  const counters: Counters = {
    processedRows: 0,
    created: 0,
    updated: 0,
    matched: 0,
    unmatched: 0,
    ambiguous: 0,
    skipped: 0,
    errors: 0,
  };

  const unmatchedSamples: string[] = [];
  const ambiguousSamples: string[] = [];

  const grouped = new Map<string, TenancyGroup>();
  rows.forEach((row, idx) => {
    counters.processedRows += 1;
    const { id } = buildDocId(row);
    if (!grouped.has(id)) grouped.set(id, { docId: id, rows: [] });
    grouped.get(id)!.rows.push({ row, rowIndex: idx + 1 });
  });

  const preparedDocs: PreparedTenancyDoc[] = [];

  for (const group of grouped.values()) {
    const mainRow = group.rows[0].row;
    const rowIndexes = group.rows.map((r) => r.rowIndex);
    const lettingRefRaw = t(mainRow["Letting Ref"]);
    const propertyAddressRaw = t(mainRow["Property Address"]);
    const normalizedAddress = normalizeAddress(propertyAddressRaw ?? "");
    const startParsed = parseDateIso(mainRow["Start Date"]);
    const endParsed = parseDateIso(mainRow["End Date"]);
    const rentRaw = t(mainRow["Tenant's Rent"]);
    const rentAmount = parseMoney(rentRaw);
    const rentFreq = inferRentFrequency(rentRaw);
    const reviewFlags = new Set<string>();

    if (!propertyAddressRaw) reviewFlags.add("missing_property_address");
    if (startParsed.invalid) reviewFlags.add("invalid_start_date");
    if (endParsed.invalid) reviewFlags.add("invalid_end_date");
    if (!rentAmount) reviewFlags.add("missing_rent");
    if (rentFreq.inferred) reviewFlags.add("inferred_rent_frequency");
    if (!lettingRefRaw) reviewFlags.add("missing_letting_ref");

    const match = resolvePropertyMatch(propertyAddressRaw, properties);
    if (match.status === "unmatched") reviewFlags.add("unmatched_property");
    if (match.status === "ambiguous") reviewFlags.add("ambiguous_property_match");

    const occupantRows = group.rows.map(({ row, rowIndex }) => {
      const lead = parseBoolLike(row["Is Lead Tenant"]);
      const fullName =
        t(row["Tenant Fullname"]) ??
        `${t(row["Firstname"]) ?? ""} ${t(row["Surname"]) ?? ""}`.trim() ??
        null;
      if (!fullName) reviewFlags.add("missing_tenant_name");
      if (lead !== true && lead !== false) reviewFlags.add("missing_lead_tenant");
      const emailPrimary = splitMultiValue(t(row["Tenant Email"]))[0] ?? null;
      const phone =
        t(row["Tenant Mobile"]) ??
        t(row["Tenant Home Phone"]) ??
        t(row["Tenant Work Phone"]) ??
        null;
      return {
        sourceRowIndex: rowIndex,
        tenantName: fullName,
        tenantEmail: emailPrimary ? emailPrimary.toLowerCase() : null,
        tenantPhone: phone,
        isLeadTenant: lead === true,
        isLeadTenantRaw: t(row["Is Lead Tenant"]),
        title: t(row["Title"]),
        firstName: t(row["Firstname"]),
        surname: t(row["Surname"]),
        additionalContact: {
          title: t(row["Additional Contact Title"]),
          firstName: t(row["Additional Contact Firstname"]),
          surname: t(row["Additional Contact Surname"]),
          friendlyName: t(row["Additional Contact Friendly Name"]),
        },
      };
    });
    const leadTenant = pickLeadOccupant(occupantRows);

    const prepared: PreparedTenancyDoc = {
      id: group.docId,
      propertyId: match.propertyId,
      occupancyStatus: occupancyFromDates(startParsed.iso, endParsed.iso),
      rentAmount,
      rentFrequency: rentFreq.frequency,
      startDate: startParsed.iso,
      endDate: endParsed.iso,
      leadTenantName: t(leadTenant?.tenantName),
      matchStatus: match.status,
      data: {
        agencyId,
        tenancyRef: lettingRefRaw,
        source: "legacy_tenants_csv_v1",
        sourceRowIndex: rowIndexes[0] ?? null,
        sourceRowIndexes: rowIndexes,
        sourceHash: stableHash(
          `${lettingRefRaw ?? ""}|${propertyAddressRaw ?? ""}|${rowIndexes.join(",")}|${group.docId}`
        ),
        importedAt: FieldValue.serverTimestamp(),
        propertyId: match.propertyId,
        propertyMatchStatus: match.status,
        propertyMatchMethod: match.method,
        propertyMatchCandidates:
          match.status === "ambiguous"
            ? match.candidates.map((c) => ({
                propertyId: c.propertyId,
                displayAddress: c.displayAddress,
                postcode: c.postcode,
                score: c.score,
              }))
            : [],
        propertyAddressRaw,
        propertyAddressNormalized: normalizedAddress.normalized || null,
        postcodeExtracted: normalizedAddress.postcode,
        startDate: startParsed.iso,
        endDate: endParsed.iso,
        startDateRaw: t(mainRow["Start Date"]),
        endDateRaw: t(mainRow["End Date"]),
        rentAmount,
        rentAmountRaw: rentRaw,
        rentCurrency: "GBP",
        rentFrequency: rentFreq.frequency,
        occupancyStatus: occupancyFromDates(startParsed.iso, endParsed.iso),
        leadTenantName: t(leadTenant?.tenantName),
        leadTenantEmail: t(leadTenant?.tenantEmail),
        leadTenantPhone: t(leadTenant?.tenantPhone),
        leadTenantExists: Boolean(leadTenant),
        isLeadTenantRaw: t(mainRow["Is Lead Tenant"]),
        tenantName: t(mainRow["Tenant Fullname"]) ?? t(leadTenant?.tenantName),
        tenantEmail:
          splitMultiValue(t(mainRow["Tenant Email"]))[0]?.toLowerCase() ??
          t(leadTenant?.tenantEmail),
        tenantPhone:
          t(mainRow["Tenant Mobile"]) ??
          t(mainRow["Tenant Home Phone"]) ??
          t(mainRow["Tenant Work Phone"]) ??
          t(leadTenant?.tenantPhone),
        guarantorName: t(mainRow["Guarantor"]),
        guarantorEmail: t(mainRow["Guarantor Email"])?.toLowerCase() ?? null,
        guarantorPhone: t(mainRow["Guarantor Phone Number"]),
        tenantRows: occupantRows,
        needsReview: reviewFlags.size > 0 || match.status !== "matched",
        reviewFlags: Array.from(reviewFlags),
      },
    };
    preparedDocs.push(prepared);
  }

  const tenanciesRef = db.collection(tenanciesCol(agencyId));
  const matchedByProperty = new Map<string, PreparedTenancyDoc[]>();

  for (const tenancy of preparedDocs) {
    if (tenancy.matchStatus === "matched") counters.matched += 1;
    else if (tenancy.matchStatus === "ambiguous") counters.ambiguous += 1;
    else counters.unmatched += 1;

    if (tenancy.matchStatus === "unmatched" && unmatchedSamples.length < 10) {
      unmatchedSamples.push(
        `${tenancy.id} :: ${String(tenancy.data.propertyAddressRaw ?? "missing address")}`
      );
    }
    if (tenancy.matchStatus === "ambiguous" && ambiguousSamples.length < 10) {
      ambiguousSamples.push(
        `${tenancy.id} :: ${String(tenancy.data.propertyAddressRaw ?? "missing address")}`
      );
    }

    const ref = tenanciesRef.doc(tenancy.id);
    const existing = await ref.get();
    if (existing.exists) counters.updated += 1;
    else counters.created += 1;

    if (!commit) {
      console.log(`[DRY_RUN] tenancy upsert -> ${ref.path} (${tenancy.matchStatus})`);
    } else {
      try {
        await ref.set(tenancy.data, { merge: true });
      } catch (err) {
        counters.errors += 1;
        console.error(`[importTenancies] write failed tenancyId=${tenancy.id}`, err);
      }
    }

    if (tenancy.propertyId && tenancy.matchStatus === "matched") {
      const list = matchedByProperty.get(tenancy.propertyId) ?? [];
      list.push(tenancy);
      matchedByProperty.set(tenancy.propertyId, list);
    }
  }

  for (const [propertyId, docs] of matchedByProperty.entries()) {
    const best = chooseBestTenancyForProperty(docs);
    if (!best) continue;
    const propRef = db.collection(propertiesCol(agencyId)).doc(propertyId);
    if (!commit) {
      console.log(`[DRY_RUN] property tenancySummary merge -> ${propRef.path}`);
      continue;
    }
    try {
      await propRef.set(
        {
          tenancySummary: {
            hasTenancy: true,
            currentTenancyId: best.id,
            occupancyStatus: best.occupancyStatus,
            rentAmount: best.rentAmount,
            rentFrequency: best.rentFrequency,
            startDate: best.startDate,
            endDate: best.endDate,
            leadTenantName: best.leadTenantName,
            updatedAt: FieldValue.serverTimestamp(),
          },
        },
        { merge: true }
      );
    } catch (err) {
      counters.errors += 1;
      console.error(
        `[importTenancies] property tenancySummary merge failed propertyId=${propertyId}`,
        err
      );
    }
  }

  console.log("\n[importTenancies] summary");
  console.log(`- mode: ${commit ? "COMMIT" : "DRY_RUN"}`);
  console.log(`- input path: ${csvPath}`);
  console.log(`- agencyId: ${agencyId}`);
  console.log(`- total rows processed: ${counters.processedRows}`);
  console.log(`- tenancy docs created: ${counters.created}`);
  console.log(`- tenancy docs updated: ${counters.updated}`);
  console.log(`- matched count: ${counters.matched}`);
  console.log(`- unmatched count: ${counters.unmatched}`);
  console.log(`- ambiguous count: ${counters.ambiguous}`);
  console.log(`- skipped count: ${counters.skipped}`);
  console.log(`- error count: ${counters.errors}`);
  if (unmatchedSamples.length > 0) {
    console.log(`- unmatched sample (${unmatchedSamples.length}):`);
    unmatchedSamples.forEach((s) => console.log(`  - ${s}`));
  }
  if (ambiguousSamples.length > 0) {
    console.log(`- ambiguous sample (${ambiguousSamples.length}):`);
    ambiguousSamples.forEach((s) => console.log(`  - ${s}`));
  }
}

main().catch((err) => {
  console.error("[importTenancies] fatal", err);
  process.exit(1);
});

