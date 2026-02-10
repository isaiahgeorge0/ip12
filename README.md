# IP12 Estate Portal

A unified estate agency platform for property listings, tenancy management, and agency operations.

## Problem it solves

Agencies need one place to publish listings, let tenants report issues and access documents, give landlords visibility and control, and let staff run everything from a single CRM. IP12 Estate Portal ties these into one platform with clear roles and a path to scale.

## Portals

| Portal | Status | Purpose |
|--------|--------|--------|
| **Public Listings** | Planned | Browse and search properties; contact agency. |
| **Tenant Portal** | Planned | Maintenance, messaging, documents (web + mobile). |
| **Landlord Portal** | Planned | Property and tenancy management. |
| **Admin CRM** | Planned | Full agency operations. |

*Future:* contractors, automation, payments.

## Folder structure

```
apps/
  web-portal/       # Next.js — Public Listings, Admin CRM, Landlord Portal
  tenant-mobile/    # Flutter — Tenant app (maintenance, messaging, documents)
backend/
  firebase-functions/  # Firebase Cloud Functions (TypeScript, Node 20)
docs/               # Documentation and setup guides
.github/            # CI and issue templates (minimal for now)
```

See [docs/02-folder-structure.md](docs/02-folder-structure.md) for details.

## Phased approach

- **Phase 1 (MVP):** Public listings, tenant portal (maintenance + docs), landlord portal, admin CRM. Next.js + Flutter + Firebase.
- **Later:** Contractor management, automation, payments, and further back-office features as needed.

## Documentation

- [00-overview.md](docs/00-overview.md) — Platform overview and portals
- [01-architecture.md](docs/01-architecture.md) — High-level architecture
- [02-folder-structure.md](docs/02-folder-structure.md) — Repo layout and monorepo rationale
- [03-setup-checklist.md](docs/03-setup-checklist.md) — Firebase, apps, env vars, security
