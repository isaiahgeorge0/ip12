# Firestore indexes

## Where to create indexes

- **Firebase Console:** Firestore → Indexes. Create composite indexes there when the app or Cloud Functions report a missing-index error (Firebase logs the required index definition).
- **Deployed config:** Root file `firestore.indexes.json` is deployed with `firebase deploy --only firestore:indexes`. Add composite index entries there to version-control index definitions.

## propertyIndex collection

The global search/map layer `propertyIndex/{agencyId}__{propertyId}` is synced by the Cloud Function `syncPropertyIndex` from canonical `agencies/{agencyId}/properties/{propertyId}`.

- **Prefix / range queries:** Queries on `postcodeLower` or `addressLower` (e.g. prefix search) use single-field range filters. Firestore usually auto-creates single-field indexes; if a query fails with a missing-index error, add the suggested composite index in Firebase Console (or add it to `firestore.indexes.json` and deploy).
- **Geohash / map queries:** If you add geohash prefix or bounding-box queries on `geohash`, create the composite indexes suggested in the Firebase error or in [GeoFirestore](https://github.com/MichaelSolati/geofirestore-js) docs.

- **Default public listings (required):** The default `GET /api/properties/search` query when no `bounds`/`q` is sent is:
  - `where("available", "==", true)`
  - `orderBy("updatedAt", "desc")`
  - `orderBy(FieldPath.documentId(), "asc")`
  - This **requires** a composite index on collection `propertyIndex`: **available** (Ascending), **updatedAt** (Descending), **__name__** (Ascending). Defined in `firestore.indexes.json`.

- **Other cursor-pagination indexes:** (1) `updatedAt` Desc, `__name__` Asc — used when no `available` or `listingType` filter; (2) `listingType` Asc, `available` Asc, `updatedAt` Desc, `__name__` Asc — when both filters are used.

## enquiries subcollection

`agencies/{agencyId}/enquiries` is used for the applicant pipeline (public listing enquiries). Indexes in `firestore.indexes.json` (collection group `enquiries`):

- **Duplicate check (POST /api/enquiries):** `applicantUserId` (ASC), `propertyId` (ASC), `createdAt` (DESC).
- **Admin property enquiries:** `propertyId` (ASC), `createdAt` (DESC).

## applicants collection

Global collection `applicants/{userId}` stores reusable applicant profiles (keyed by Firebase Auth userId). No composite indexes required; reads are by document ID only (e.g. GET /api/applicant/me, and admin applicants-list API batch-get by userId).
