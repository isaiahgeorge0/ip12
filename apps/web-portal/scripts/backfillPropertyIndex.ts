/**
 * Dev-only: backfill propertyIndex from all canonical agencies/{agencyId}/properties.
 * Idempotent (upsert). Run from apps/web-portal:
 *   npx tsx scripts/backfillPropertyIndex.ts
 * or: npm run backfill:property-index
 */
import { getAdminFirestore } from "../src/lib/firebase/admin";
import { propertiesCol, propertyIndexDocId, PROPERTY_INDEX_COLLECTION } from "../src/lib/firestore/paths";
import { buildPropertyIndexDoc } from "../src/lib/properties/propertyIndex";
import { FieldValue } from "firebase-admin/firestore";

async function main() {
  const db = getAdminFirestore();
  const agenciesSnap = await db.collection("agencies").get();
  let totalProperties = 0;
  let totalUpserted = 0;

  for (const agencyDoc of agenciesSnap.docs) {
    const agencyId = agencyDoc.id;
    const propsSnap = await db.collection(propertiesCol(agencyId)).get();
    totalProperties += propsSnap.size;
    for (const propDoc of propsSnap.docs) {
      const propertyId = propDoc.id;
      const propertyData = propDoc.data() as Record<string, unknown>;
      const indexDoc = buildPropertyIndexDoc(agencyId, propertyId, propertyData);
      const docId = propertyIndexDocId(agencyId, propertyId);
      await db
        .collection(PROPERTY_INDEX_COLLECTION)
        .doc(docId)
        .set({ ...indexDoc, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      totalUpserted += 1;
    }
  }

  console.log("[backfillPropertyIndex] agencies:", agenciesSnap.size);
  console.log("[backfillPropertyIndex] properties processed:", totalProperties);
  console.log("[backfillPropertyIndex] index docs upserted:", totalUpserted);
}

main().catch((err) => {
  console.error("[backfillPropertyIndex]", err);
  process.exit(1);
});
