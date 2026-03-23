# IP12 Estate Portal — Web app

Next.js app for **Public Listings**, **Admin CRM**, and **Landlord Portal**.

## Setup and run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Build for production: `npm run build`.

## Route groups

Routes are grouped by audience without changing the URL:

- **`(public)`** — Home (`/`), Listings (`/listings`, `/listings/[id]`). Public header.
- **`(auth)`** — Sign in (`/sign-in`). Auth flows.
- **`(admin)`** — Admin CRM under `/admin/*` (dashboard, properties, tenancies, tickets, applicants, viewings, etc.). Sidebar layout.
- **`(landlord)`** — Landlord portal under `/landlord/*` (overview, properties, maintenance, etc.). Sidebar layout.

Parentheses mean the segment does not appear in the path. One root `layout.tsx` wraps all; each of `(admin)` and `(landlord)` has its own `layout.tsx` (sidebar shell).

## Firebase wiring (future)

Backend and auth are not connected yet. Placeholders live under:

- **`src/lib/config/`** — Firebase app init and config.
- **`src/lib/auth/`** — Auth helpers (current user, role checks).
- **`src/lib/data/`** — Data access (Firestore, etc.); currently mock data only in `mock.ts`.
- **`src/lib/types/`** — Shared TypeScript types.

Wire these when adding Firebase (and env vars) in a later step.

## Landlord dashboard — test data (dev only)

The landlord dashboard at `/landlord` shows properties from the join collection **`propertyLandlords`**. To test locally, add a document in that collection (e.g. via Firebase Console or Admin SDK) with:

- **`landlordUid`** (string): Firebase UID of the landlord user.
- **`propertyId`** (string): Document ID of the property in `agencies/{agencyId}/properties/{propertyId}`.
- **`agencyId`** (string): Agency that owns the property.
- **`createdAt`** (optional): Server timestamp.

Example (Firebase Console or script): collection `propertyLandlords`, document ID any; fields: `landlordUid`, `propertyId`, `agencyId`, `createdAt`. The property must already exist under `agencies/{agencyId}/properties/{propertyId}` with at least `displayAddress` (or `address`/`title`) and optionally `postcode`, `status`.

## Viewings (CRM)

Agency-scoped property viewings are stored at **`agencies/{agencyId}/viewings/{viewingId}`**. Statuses: `requested`, `booked`, `completed`, `cancelled`, `no_show`. Source: `enquiry` or `manual`. Admins book viewings from the property detail page (optionally from an enquiry) and manage status from the viewings list, property detail, or applicant detail. **Admin API routes:** `POST/GET /api/admin/viewings`, `GET/PATCH /api/admin/viewings/[viewingId]`. Agency scoping: admin sees only own agency; superAdmin must pass `agencyId` when acting cross-agency. All create/update go through the API (Firestore rules disallow client writes).
