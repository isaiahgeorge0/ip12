# Folder structure

## Top-level folders

| Folder | Purpose |
|--------|--------|
| `apps/web-portal` | Next.js app: Public Listings, Admin CRM, Landlord Portal. |
| `apps/tenant-mobile` | Flutter app for tenants: maintenance, messaging, documents. |
| `backend/firebase-functions` | Firebase Cloud Functions (TypeScript, Node 20): API, triggers, shared backend logic. |
| `docs` | Project documentation and setup guides. |
| `.github` | CI workflows, issue/PR templates (minimal for now). |

## Why a monorepo

- **Single source of truth** — One repo for web, mobile, and backend; shared docs and conventions.
- **Easier cross-app changes** — Updates that touch web + backend or mobile + backend stay in one place and one history.
- **Unified tooling** — Linting, formatting, and CI can be configured once at the root and applied per app.
- **Clear ownership** — One team or project owns the full platform; structure makes each app’s boundary obvious.
