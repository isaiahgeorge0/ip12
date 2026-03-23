/**
 * Read-only debug script for tenancy->property matching quality.
 *
 * Usage (from apps/web-portal):
 *   npx tsx scripts/debug/debugTenancyMatchSamples.ts --agencyId=ip12 --limit=10
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { getAdminFirestore } from "../../src/lib/firebase/admin";
import { propertiesCol } from "../../src/lib/firestore/paths";
import { readCsvFile, type CsvRow } from "../import/_csv";
import { normalizeAddress } from "../import/_normalizeAddress";
import {
  resolvePropertyMatch,
  scoreCandidateDetailed,
  explainMatchDecision,
  type PropertyCandidate,
} from "../import/_tenancyMatching";

function parseArgs(argv: string[]) {
  let agencyId = "ip12";
  let limit = 10;
  for (const arg of argv) {
    if (arg.startsWith("--agencyId=")) {
      const v = arg.slice("--agencyId=".length).trim();
      if (v) agencyId = v;
      continue;
    }
    if (arg.startsWith("--limit=")) {
      const n = Number(arg.slice("--limit=".length).trim());
      if (Number.isFinite(n) && n > 0) limit = Math.floor(n);
    }
  }
  return { agencyId, limit };
}

function resolveCsvPath(): string {
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

function groupDocId(row: CsvRow): string {
  const ref = normalizeRef(row["Letting Ref"]);
  if (ref) return `legacy_tenancy_${ref}`;
  const addr = normalizeAddress(row["Property Address"]).normalizedNoPostcode || "unknown_address";
  const tenant = t(row["Tenant Fullname"]) || "unknown_tenant";
  return `legacy_tenancy_fallback_${Buffer.from(`${addr}|${tenant}`).toString("hex").slice(0, 12)}`;
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
      type: null,
      bedrooms: null,
      bathrooms: null,
      normalizedAddress: normalized,
    };
  });
}

async function main() {
  const { agencyId, limit } = parseArgs(process.argv.slice(2));
  const csvPath = resolveCsvPath();
  const { rows } = readCsvFile(csvPath);
  const properties = await loadPropertyCandidates(agencyId);

  const grouped = new Map<string, CsvRow>();
  for (const row of rows) {
    const id = groupDocId(row);
    if (!grouped.has(id)) grouped.set(id, row);
  }

  const ambiguousSamples: Array<{ docId: string; row: CsvRow }> = [];
  for (const [docId, row] of grouped.entries()) {
    const match = resolvePropertyMatch(t(row["Property Address"]), properties);
    if (match.status === "ambiguous") {
      ambiguousSamples.push({ docId, row });
      if (ambiguousSamples.length >= limit) break;
    }
  }

  console.log(`[debugTenancyMatchSamples] agencyId=${agencyId} totalGroups=${grouped.size}`);
  console.log(`[debugTenancyMatchSamples] ambiguousSamples=${ambiguousSamples.length}`);

  for (const sample of ambiguousSamples) {
    const rawAddress = t(sample.row["Property Address"]);
    const n = normalizeAddress(rawAddress ?? "");
    const scoped = n.postcode
      ? properties.filter((p) => p.postcode && p.postcode === n.postcode)
      : properties;
    const pool = scoped.length > 0 ? scoped : properties;
    const scored = pool
      .map((p) => ({ p, detail: scoreCandidateDetailed(n, p) }))
      .filter((x) => x.detail.score > 0)
      .sort((a, b) => b.detail.score - a.detail.score)
      .slice(0, 8);

    console.log("\n---");
    console.log(`tenancyRef/docId: ${t(sample.row["Letting Ref"]) ?? sample.docId}`);
    console.log(`raw property address: ${rawAddress ?? "(missing)"}`);
    console.log(`normalized property address: ${n.normalizedNoPostcode}`);
    console.log(`normalized comparable: ${n.comparable}`);
    console.log(`postcode extracted: ${n.postcode ?? "(none)"}`);
    console.log(`candidate count considered: ${scored.length}`);
    console.log(`winner rejected reason: ${explainMatchDecision(scored.map((s) => ({ score: s.detail.score })))}`);

    for (const s of scored) {
      console.log(
        `- ${s.p.propertyId} | rawCandidateAddress=${s.p.rawCandidateAddress} | normalizedCandidate=${s.p.normalizedAddress.normalizedNoPostcode} | comparableCandidate=${s.p.comparableAddress} | candidateNumberToken=${s.p.numberToken ?? "—"} | tenancyNumberToken=${n.numberToken ?? "—"} | postcodeMatch=${s.detail.postcodeMatch} | numberMatch=${s.detail.numberMatch} | score=${s.detail.score} | sharedTokens=${s.detail.sharedTokenCount}`
      );
    }
  }
}

main().catch((err) => {
  console.error("[debugTenancyMatchSamples] fatal", err);
  process.exit(1);
});

