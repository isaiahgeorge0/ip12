/**
 * Read-only debug script to validate property -> tenancies linkage.
 *
 * Usage (from apps/web-portal):
 *   npx tsx scripts/debug/testPropertyTenancyQuery.ts --agencyId=ip12 --propertyId=103
 */

import { getAdminFirestore } from "../../src/lib/firebase/admin";
import { propertiesCol, tenanciesCol } from "../../src/lib/firestore/paths";

function parseArgs(argv: string[]) {
  let agencyId = "ip12";
  let propertyId: string | null = null;
  for (const arg of argv) {
    if (arg.startsWith("--agencyId=")) {
      const v = arg.slice("--agencyId=".length).trim();
      if (v) agencyId = v;
      continue;
    }
    if (arg.startsWith("--propertyId=")) {
      const v = arg.slice("--propertyId=".length).trim();
      if (v) propertyId = v;
    }
  }
  return { agencyId, propertyId };
}

function s(v: unknown): string | null {
  if (v == null) return null;
  const x = String(v).trim();
  return x || null;
}

async function main() {
  const { agencyId, propertyId } = parseArgs(process.argv.slice(2));
  if (!propertyId) {
    console.error("[testPropertyTenancyQuery] Missing --propertyId argument.");
    process.exit(1);
  }

  const db = getAdminFirestore();
  const propRef = db.collection(propertiesCol(agencyId)).doc(propertyId);
  const propSnap = await propRef.get();

  if (!propSnap.exists) {
    console.error(`[testPropertyTenancyQuery] Property not found: ${propRef.path}`);
    process.exit(1);
  }

  const p = propSnap.data() as Record<string, unknown>;
  const propertyAddress =
    s(p.displayAddress) ?? s(p.display_address) ?? s(p.address_line_1) ?? `Property ${propertyId}`;

  const tenancySnap = await db
    .collection(tenanciesCol(agencyId))
    .where("propertyId", "==", propertyId)
    .get();

  console.log(`[testPropertyTenancyQuery] agencyId=${agencyId} propertyId=${propertyId}`);
  console.log(`[testPropertyTenancyQuery] property address: ${propertyAddress}`);
  console.log(`[testPropertyTenancyQuery] linked tenancies: ${tenancySnap.docs.length}`);

  for (const d of tenancySnap.docs) {
    const t = d.data() as Record<string, unknown>;
    const ref = s(t.tenancyRef) ?? d.id;
    const occupancyStatus = s(t.occupancyStatus) ?? "unknown";
    const startDate = s(t.startDate) ?? s(t.tenancyStartDate) ?? "—";
    const endDate = s(t.endDate) ?? s(t.tenancyEndDate) ?? "—";
    const rentAmount =
      typeof t.rentAmount === "number" && Number.isFinite(t.rentAmount) ? t.rentAmount : null;
    const rentFrequency = s(t.rentFrequency) ?? "—";
    const leadTenantName = s(t.leadTenantName) ?? s(t.tenantName) ?? "—";
    const needsReview = t.needsReview === true;
    const flags = Array.isArray(t.reviewFlags)
      ? (t.reviewFlags as unknown[]).map((x) => String(x))
      : [];
    console.log(
      `- ${d.id} | ref=${ref} | status=${occupancyStatus} | start=${startDate} | end=${endDate} | rent=${rentAmount ?? "—"} ${rentFrequency} | lead=${leadTenantName} | needsReview=${needsReview} | flags=${flags.join(", ") || "none"}`
    );
  }

  console.log("[testPropertyTenancyQuery] done.");
}

main().catch((err) => {
  console.error("[testPropertyTenancyQuery] fatal", err);
  process.exit(1);
});

