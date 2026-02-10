# Architecture

## High-level architecture

- **Next.js web** (`apps/web-portal`) — Public listings site plus authenticated Admin CRM and Landlord Portal (multi-tenant by role).
- **Flutter mobile** (`apps/tenant-mobile`) — Native iOS/Android app for tenants (maintenance, messaging, documents).
- **Firebase backend** (`backend/firebase-functions`) — Auth, Firestore, Cloud Functions (TypeScript, Node 20). Functions handle business logic, triggers, and APIs.

## Core principles

- **Role-based access** — Each portal and API enforces roles (public, tenant, landlord, admin) so users only see and do what they’re allowed to.
- **Data privacy** — Tenant, landlord, and property data is isolated; security rules and function checks enforce tenant/landlord boundaries.
- **Scalability / future migration** — Design with clear boundaries so that, if needed, parts can be moved to other backends or services without rewriting the whole platform.
