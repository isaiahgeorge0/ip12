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
- **`(admin)`** — Admin CRM under `/admin/*` (dashboard, properties, tenancies, tickets, etc.). Sidebar layout.
- **`(landlord)`** — Landlord portal under `/landlord/*` (overview, properties, maintenance, etc.). Sidebar layout.

Parentheses mean the segment does not appear in the path. One root `layout.tsx` wraps all; each of `(admin)` and `(landlord)` has its own `layout.tsx` (sidebar shell).

## Firebase wiring (future)

Backend and auth are not connected yet. Placeholders live under:

- **`src/lib/config/`** — Firebase app init and config.
- **`src/lib/auth/`** — Auth helpers (current user, role checks).
- **`src/lib/data/`** — Data access (Firestore, etc.); currently mock data only in `mock.ts`.
- **`src/lib/types/`** — Shared TypeScript types.

Wire these when adding Firebase (and env vars) in a later step.
