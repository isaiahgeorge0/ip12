/**
 * Dev-only: remove existing dummy/test properties for woodcock-and-son and ip12,
 * then seed a realistic Suffolk (Woodbridge + surrounding) property dataset.
 * Also upserts propertyIndex so public /listings and map work without Cloud Function.
 *
 * Run from apps/web-portal:
 *   npx tsx scripts/seedProperties.ts
 * or: npm run seed:properties
 *
 * Idempotent in the sense: re-run replaces all properties for these two agencies.
 */

import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { getAdminFirestore } from "../src/lib/firebase/admin";
import {
  propertiesCol,
  PROPERTY_INDEX_COLLECTION,
} from "../src/lib/firestore/paths";
import { buildPropertyIndexDoc } from "../src/lib/properties/propertyIndex";

const AGENCY_IDS = ["woodcock-and-son", "ip12"] as const;
const SEED_CREATED_BY_UID = "seed-script";

type SeedEntry = {
  agencyId: "woodcock-and-son" | "ip12";
  displayAddress: string;
  postcode: string;
  type: "House" | "Flat" | "Studio" | "Other";
  bedrooms: number;
  bathrooms: number;
  /** Sale price (optional). */
  price?: number;
  /** Rent pcm (optional). */
  rentPcm?: number;
  listingType: "sale" | "rent";
  status: "Available" | "Let" | "Sold" | "Off-market";
  lat: number;
  lng: number;
};

const SEED_PROPERTIES: SeedEntry[] = [
  // Woodbridge (IP12)
  {
    agencyId: "woodcock-and-son",
    displayAddress: "12 Market Hill, Woodbridge",
    postcode: "IP12 4LU",
    type: "House",
    bedrooms: 3,
    bathrooms: 2,
    price: 385000,
    listingType: "sale",
    status: "Available",
    lat: 52.093,
    lng: 1.318,
  },
  {
    agencyId: "woodcock-and-son",
    displayAddress: "4 Quay Street, Woodbridge",
    postcode: "IP12 4BX",
    type: "House",
    bedrooms: 4,
    bathrooms: 2,
    rentPcm: 1650,
    listingType: "rent",
    status: "Available",
    lat: 52.092,
    lng: 1.322,
  },
  {
    agencyId: "ip12",
    displayAddress: "22 Thoroughfare, Woodbridge",
    postcode: "IP12 1AL",
    type: "Flat",
    bedrooms: 2,
    bathrooms: 1,
    rentPcm: 995,
    listingType: "rent",
    status: "Available",
    lat: 52.094,
    lng: 1.317,
  },
  {
    agencyId: "woodcock-and-son",
    displayAddress: "7 Burkitt Road, Woodbridge",
    postcode: "IP12 4JJ",
    type: "House",
    bedrooms: 3,
    bathrooms: 1,
    price: 425000,
    listingType: "sale",
    status: "Available",
    lat: 52.088,
    lng: 1.308,
  },
  // Melton (IP12)
  {
    agencyId: "ip12",
    displayAddress: "15 Wilford Bridge Road, Melton",
    postcode: "IP12 1NU",
    type: "House",
    bedrooms: 4,
    bathrooms: 2,
    price: 495000,
    listingType: "sale",
    status: "Available",
    lat: 52.102,
    lng: 1.338,
  },
  {
    agencyId: "woodcock-and-son",
    displayAddress: "3 Station Road, Melton",
    postcode: "IP12 1PT",
    type: "Flat",
    bedrooms: 1,
    bathrooms: 1,
    rentPcm: 750,
    listingType: "rent",
    status: "Let",
    lat: 52.098,
    lng: 1.332,
  },
  // Martlesham (IP5)
  {
    agencyId: "ip12",
    displayAddress: "28 Martlesham Heath, Martlesham",
    postcode: "IP5 3SL",
    type: "House",
    bedrooms: 3,
    bathrooms: 2,
    rentPcm: 1425,
    listingType: "rent",
    status: "Available",
    lat: 52.062,
    lng: 1.282,
  },
  {
    agencyId: "woodcock-and-son",
    displayAddress: "5 The Green, Martlesham",
    postcode: "IP5 3QB",
    type: "House",
    bedrooms: 5,
    bathrooms: 2,
    price: 575000,
    listingType: "sale",
    status: "Available",
    lat: 52.058,
    lng: 1.275,
  },
  // Kesgrave (IP5)
  {
    agencyId: "ip12",
    displayAddress: "42 Main Road, Kesgrave",
    postcode: "IP5 2EN",
    type: "House",
    bedrooms: 3,
    bathrooms: 1,
    price: 365000,
    listingType: "sale",
    status: "Available",
    lat: 52.062,
    lng: 1.236,
  },
  {
    agencyId: "woodcock-and-son",
    displayAddress: "18 Bell Lane, Kesgrave",
    postcode: "IP5 1EY",
    type: "House",
    bedrooms: 4,
    bathrooms: 2,
    rentPcm: 1550,
    listingType: "rent",
    status: "Available",
    lat: 52.058,
    lng: 1.242,
  },
  // Ipswich (IP1–IP4)
  {
    agencyId: "ip12",
    displayAddress: "9 St Margaret's Street, Ipswich",
    postcode: "IP4 2BH",
    type: "House",
    bedrooms: 2,
    bathrooms: 1,
    rentPcm: 1100,
    listingType: "rent",
    status: "Available",
    lat: 52.058,
    lng: 1.158,
  },
  {
    agencyId: "woodcock-and-son",
    displayAddress: "44 Norwich Road, Ipswich",
    postcode: "IP1 2NJ",
    type: "Flat",
    bedrooms: 2,
    bathrooms: 1,
    price: 195000,
    listingType: "sale",
    status: "Available",
    lat: 52.062,
    lng: 1.142,
  },
  {
    agencyId: "ip12",
    displayAddress: "21 Henley Road, Ipswich",
    postcode: "IP1 4SG",
    type: "House",
    bedrooms: 3,
    bathrooms: 2,
    price: 325000,
    listingType: "sale",
    status: "Sold",
    lat: 52.055,
    lng: 1.132,
  },
  {
    agencyId: "woodcock-and-son",
    displayAddress: "6 Cavendish Street, Ipswich",
    postcode: "IP3 8QE",
    type: "Studio",
    bedrooms: 1,
    bathrooms: 1,
    rentPcm: 695,
    listingType: "rent",
    status: "Available",
    lat: 52.048,
    lng: 1.168,
  },
  // Surrounding villages
  {
    agencyId: "ip12",
    displayAddress: "2 The Street, Grundisburgh",
    postcode: "IP13 6TY",
    type: "House",
    bedrooms: 3,
    bathrooms: 1,
    price: 395000,
    listingType: "sale",
    status: "Available",
    lat: 52.112,
    lng: 1.268,
  },
  {
    agencyId: "woodcock-and-son",
    displayAddress: "15 Hasketon Road, Woodbridge",
    postcode: "IP12 4JE",
    type: "House",
    bedrooms: 4,
    bathrooms: 2,
    rentPcm: 1750,
    listingType: "rent",
    status: "Available",
    lat: 52.085,
    lng: 1.298,
  },
  {
    agencyId: "woodcock-and-son",
    displayAddress: "8 Chapel Lane, Bredfield",
    postcode: "IP12 2AQ",
    type: "House",
    bedrooms: 2,
    bathrooms: 1,
    price: 285000,
    listingType: "sale",
    status: "Available",
    lat: 52.098,
    lng: 1.302,
  },
  {
    agencyId: "ip12",
    displayAddress: "33 Cauldwell Hall Road, Ipswich",
    postcode: "IP4 5AS",
    type: "House",
    bedrooms: 3,
    bathrooms: 2,
    rentPcm: 1325,
    listingType: "rent",
    status: "Available",
    lat: 52.052,
    lng: 1.178,
  },
];

async function deleteCollectionBatch(
  db: Firestore,
  collectionPath: string,
  batchSize: number
): Promise<number> {
  const col = db.collection(collectionPath);
  let deleted = 0;
  let snap = await col.limit(batchSize).get();
  while (!snap.empty) {
    const batch = db.batch();
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    deleted += snap.size;
    snap = await col.limit(batchSize).get();
  }
  return deleted;
}

async function deletePropertyIndexByAgency(
  db: Firestore,
  agencyId: string
): Promise<number> {
  const snap = await db
    .collection(PROPERTY_INDEX_COLLECTION)
    .where("agencyId", "==", agencyId)
    .get();
  if (snap.empty) return 0;
  const batch = db.batch();
  snap.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();
  return snap.size;
}

async function ensureAgency(db: Firestore, agencyId: string, name: string): Promise<void> {
  const ref = db.collection("agencies").doc(agencyId);
  const snap = await ref.get();
  if (!snap.exists) {
    await ref.set({
      name,
      slug: agencyId,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    console.log("[seedProperties] Created agency:", agencyId);
  }
}

async function main() {
  const db = getAdminFirestore();

  await ensureAgency(db, "woodcock-and-son", "Woodcock & Son");
  await ensureAgency(db, "ip12", "IP12 Estate");

  console.log("[seedProperties] Resetting properties for:", AGENCY_IDS.join(", "));

  for (const agencyId of AGENCY_IDS) {
    const colPath = propertiesCol(agencyId);
    const deleted = await deleteCollectionBatch(db, colPath, 100);
    console.log("[seedProperties] Deleted", deleted, "canonical properties from", agencyId);
  }

  console.log("[seedProperties] Clearing propertyIndex for seeded agencies...");
  let indexDeleted = 0;
  for (const agencyId of AGENCY_IDS) {
    const n = await deletePropertyIndexByAgency(db, agencyId);
    indexDeleted += n;
  }
  console.log("[seedProperties] Deleted", indexDeleted, "propertyIndex docs");

  console.log("[seedProperties] Seeding", SEED_PROPERTIES.length, "properties...");

  for (const entry of SEED_PROPERTIES) {
    const canonical: Record<string, unknown> = {
      displayAddress: entry.displayAddress,
      postcode: entry.postcode,
      type: entry.type,
      bedrooms: entry.bedrooms,
      bathrooms: entry.bathrooms,
      status: entry.status,
      listingType: entry.listingType,
      lat: entry.lat,
      lng: entry.lng,
      archived: false,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      createdByUid: SEED_CREATED_BY_UID,
    };
    if (entry.price != null) canonical.price = entry.price;
    if (entry.rentPcm != null) canonical.rentPcm = entry.rentPcm;

    const colRef = db.collection(propertiesCol(entry.agencyId));
    const ref = await colRef.add(canonical);
    const propertyId = ref.id;

    const indexDoc = buildPropertyIndexDoc(entry.agencyId, propertyId, {
      ...canonical,
      // buildPropertyIndexDoc expects optional createdAt; we used serverTimestamp so pass through
    });
    const indexRef = db
      .collection(PROPERTY_INDEX_COLLECTION)
      .doc(`${entry.agencyId}__${propertyId}`);
    await indexRef.set(
      { ...indexDoc, updatedAt: FieldValue.serverTimestamp() },
      { merge: true }
    );

    console.log(
      "[seedProperties] Added",
      entry.agencyId,
      propertyId,
      entry.displayAddress.slice(0, 30) + "..."
    );
  }

  const byAgency = SEED_PROPERTIES.reduce(
    (acc, p) => {
      acc[p.agencyId] = (acc[p.agencyId] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );
  const saleCount = SEED_PROPERTIES.filter((p) => p.listingType === "sale").length;
  const rentCount = SEED_PROPERTIES.filter((p) => p.listingType === "rent").length;

  console.log("[seedProperties] Done. Total:", SEED_PROPERTIES.length);
  console.log("[seedProperties] By agency:", byAgency);
  console.log("[seedProperties] Sale:", saleCount, "Rent:", rentCount);
}

main().catch((err) => {
  console.error("[seedProperties]", err);
  process.exit(1);
});
