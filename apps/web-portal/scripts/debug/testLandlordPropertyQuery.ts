/**
 * Read-only debug script to verify landlord -> property ownership links.
 *
 * Usage (from apps/web-portal):
 *   npx tsx scripts/debug/testLandlordPropertyQuery.ts --agencyId=ip12 --landlordExternalId=252
 */

import { getAdminFirestore } from "../../src/lib/firebase/admin";
import { propertyLandlordsCol } from "../../src/lib/firestore/paths";

function parseArgs(argv: string[]) {
  let agencyId = "ip12";
  let landlordExternalId: string | null = null;

  for (const arg of argv) {
    if (arg.startsWith("--agencyId=")) {
      const v = arg.slice("--agencyId=".length).trim();
      if (v) agencyId = v;
      continue;
    }
    if (arg.startsWith("--landlordExternalId=")) {
      const v = arg.slice("--landlordExternalId=".length).trim();
      if (v) landlordExternalId = v;
    }
  }

  return { agencyId, landlordExternalId };
}

function safeString(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s || null;
}

function displayAddressFromProperty(data: Record<string, unknown>): string {
  return (
    safeString(data.displayAddress) ??
    safeString(data.display_address) ??
    safeString(data.address_line_1) ??
    "Untitled property"
  );
}

async function main() {
  const { agencyId, landlordExternalId } = parseArgs(process.argv.slice(2));
  if (!landlordExternalId) {
    console.error(
      "[testLandlordPropertyQuery] Missing required --landlordExternalId=<externalId> argument."
    );
    process.exit(1);
  }

  const db = getAdminFirestore();
  console.log(
    `[testLandlordPropertyQuery] agencyId=${agencyId} landlordExternalId=${landlordExternalId}`
  );

  const usersRef = db.collection("users");
  const landlordQuery = await usersRef.where("externalId", "==", landlordExternalId).get();

  if (landlordQuery.empty) {
    console.error(
      `[testLandlordPropertyQuery] No landlord found for externalId=${landlordExternalId}`
    );
    process.exit(1);
  }

  const roleFiltered = landlordQuery.docs.filter((d) => {
    const role = safeString(d.get("role"));
    return role == null || role === "landlord";
  });

  if (roleFiltered.length === 0) {
    console.error(
      `[testLandlordPropertyQuery] Found users for externalId=${landlordExternalId}, but none match role=landlord`
    );
    process.exit(1);
  }

  if (roleFiltered.length > 1) {
    console.warn(
      `[testLandlordPropertyQuery] Multiple landlord users matched; using first doc: ${roleFiltered[0].id}`
    );
  }

  const landlordDoc = roleFiltered[0];
  const landlordUid = landlordDoc.id;
  const landlordDisplayName = safeString(landlordDoc.get("displayName")) ?? "(no display name)";

  const linksSnap = await db
    .collection(propertyLandlordsCol())
    .where("agencyId", "==", agencyId)
    .where("landlordUid", "==", landlordUid)
    .get();

  const propertyIds = linksSnap.docs
    .map((d) => safeString(d.get("propertyId")))
    .filter((v): v is string => Boolean(v));

  console.log(`[testLandlordPropertyQuery] resolved landlord uid: ${landlordUid}`);
  console.log(`[testLandlordPropertyQuery] landlord display name: ${landlordDisplayName}`);
  console.log(`[testLandlordPropertyQuery] linked properties: ${propertyIds.length}`);
  console.log(
    `[testLandlordPropertyQuery] linked propertyIds: ${
      propertyIds.length ? propertyIds.join(", ") : "(none)"
    }`
  );

  if (propertyIds.length === 0) {
    console.log(
      `[testLandlordPropertyQuery] No linked properties found for landlordUid=${landlordUid} in agencyId=${agencyId}`
    );
    console.log("[testLandlordPropertyQuery] summary: landlord resolved, 0 links found.");
    return;
  }

  const propertiesCol = db.collection(`agencies/${agencyId}/properties`);
  console.log("\n[testLandlordPropertyQuery] property summaries");
  for (const propertyId of propertyIds) {
    const snap = await propertiesCol.doc(propertyId).get();
    if (!snap.exists) {
      console.log(`- ${propertyId} | address=(missing doc) | status=(n/a)`);
      continue;
    }
    const data = snap.data() as Record<string, unknown>;
    const address = displayAddressFromProperty(data);
    const status = safeString(data.status) ?? "(none)";
    console.log(`- ${propertyId} | address=${address} | status=${status}`);
  }

  console.log(
    `\n[testLandlordPropertyQuery] summary: resolved landlord ${landlordUid}, found ${propertyIds.length} linked properties in ${agencyId}.`
  );
}

main().catch((err) => {
  console.error("[testLandlordPropertyQuery] fatal", err);
  process.exit(1);
});

