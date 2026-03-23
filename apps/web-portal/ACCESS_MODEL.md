# Access control model (web-portal)

This document describes roles, status, app sections, and multi-agency visibility. All server-side access checks use the helpers in `src/lib/auth/authz.ts` and `src/lib/landlordGrants.ts`; API routes must not use ad-hoc `if (!session)` or `if (session.role !== ...)` for guards.

---

## 1. Roles

| Role         | Description |
|-------------|-------------|
| **superAdmin** | Full access; can scope by agency via query params; bypasses primary-agency rules where applicable. |
| **admin**   | Agency-scoped staff; access via session agency + landlord grants (see multi-agency). |
| **agent**   | Agency-scoped staff; same layout as admin but with reduced permissions (see permissions). |
| **landlord**| Portal user; sees own properties/tickets; invite-only onboarding. |
| **tenant**  | Tenant portal (tickets, tenancies). |
| **contractor** | Contractor portal (tickets, properties). |
| **lead**    | Lead (properties, applications). |

Defined in: `src/lib/types/roles.ts` (`Role` union and `DEFAULT_PERMISSIONS_BY_ROLE`).

---

## 2. Status

| Status    | Meaning | Blocks access? |
|----------|---------|----------------|
| **active**  | Normal access. | No. |
| **pending** | Invited landlord not yet activated. | No. Upgraded to `active` on first server session read (`serverSession.ts`). |
| **invited** | Invited (e.g. before first login). | No. |
| **disabled**| Account disabled by admin. | **Yes.** Only this status blocks access. |

- **Layouts:** Redirect to `/auth/disabled` only when `session.status === "disabled"`.
- **AuthContext:** Sign-out and “Account disabled” only when `profile.status === "disabled"`.
- Pending/invited do not hard-block; landlords become active on first login.

Defined in: `src/lib/types/userProfile.ts` (`UserProfileStatus`).

---

## 3. App sections and role access

| Section | Route group / path | Allowed roles | Guard |
|--------|--------------------|---------------|--------|
| **Admin** | `(admin)` e.g. `/admin`, `/admin/*` | superAdmin, admin, agent | Layout: `requireServerSession("/auth/sign-in")` → `session.status === "disabled"` redirect → `assertRole(session, ["superAdmin","admin","agent"], "/landlord")`. |
| **Landlord** | `(landlord-protected)/landlord` e.g. `/landlord`, `/landlord/*` | landlord, superAdmin | Layout: `requireServerSession("/landlord/sign-in")` → `session.status === "disabled"` redirect → `assertRole(session, ["landlord","superAdmin"], "/admin")`. |
| **Auth pages** | `(auth)` e.g. `/sign-in`, `/auth/sign-in`, `/auth/disabled` | Any (unauthenticated or authenticated) | No role gate; sign-in pages and disabled page. |
| **Landlord sign-in** | `(landlord-public)/landlord/sign-in` | Public | No role gate. |
| **Public** | `(public)` e.g. `/`, `/listings/*` | Public | No role gate. |

- Admins must not land in landlord routes; landlord layout sends wrong role to `/admin`.
- Landlords (and non-admin roles) hitting admin layout are sent to `/landlord`.

---

## 4. API route guards

- **Require login:** Use `requireServerSessionApi()`. Returns 401 when there is no session.
- **Role gating:** Use `assertRoleApi(session, allowedRoles)`. Returns 403 when role is not in the list.
- **No redirects in API routes;** use `NextResponse.json(..., { status: 401|403 })` only.

### Admin API (`/api/admin/*`)

- **admin | superAdmin:** properties (list, detail, assignments), property-landlords, tickets (list, patch, notes), landlords (list, get detail), landlords/[uid]/inventory, landlord-grants GET.
- **superAdmin only:** landlords/[uid] PATCH, landlord-grants POST, audit, agencies, agencies/seed.

### Landlord API (`/api/landlord/*`)

- **landlord | superAdmin:** tickets (GET, POST), tickets/[id]/notes (GET, POST), properties GET.

### Auth API (`/api/auth/*`)

- **session GET:** Optional session; uses `getServerSession()` and returns `{ user }` or `{ user: null }`. No guard.
- **session-login POST:** Accepts `idToken`; no session guard.
- **session-logout POST:** Clears cookie; no session guard.

### Other

- **invite-landlord POST:** Uses **Bearer token** (Firebase ID token) and Firestore user doc for caller role (admin | superAdmin). Not cookie-based; not using `requireServerSessionApi`.
- **_debug/env GET:** No auth.

---

## 5. Multi-agency visibility

Used for admin views over landlords and their properties/tickets.

### Data

- **Landlord profile:** `users/{uid}` with `agencyIds[]`, optional `agencyId` (legacy), `primaryAgencyId`.
- **Grant:** `landlordAgencyGrants/{landlordUid}` with `sharedWithAgencyIds[]`. If an agency ID is in this array, that agency’s staff can see the landlord’s full inventory (across the landlord’s agencies).

### Helpers (`src/lib/landlordGrants.ts`)

- **canAdminViewLandlord(db, session, landlordUid)**  
  Returns `{ ok, reason? }`.  
  Allowed if: `session.role === 'superAdmin'` OR landlord’s `agencyIds`/legacy `agencyId` contains `session.agencyId` OR grant’s `sharedWithAgencyIds` contains `session.agencyId`.

- **getAllowedAgencyIdsForLandlord(db, session, landlordUid)**  
  Returns agency IDs the admin may use for this landlord’s inventory.  
  - superAdmin → `null` (no restriction).  
  - Else: `[session.agencyId]`; if grant exists and session’s agency is in `sharedWithAgencyIds`, returns union of session agency and landlord’s `agencyIds`.

- **getAllowedAgencyIdsForAdminTickets(db, session)**  
  Returns agency IDs the admin can list tickets for.  
  - superAdmin → `null`.  
  - Else: `[session.agencyId]` plus agencies from landlords visible via grant (sharedWithAgencyIds contains session.agencyId).

Use these helpers for all multi-agency access; do not reimplement the same logic in routes.

---

## 6. Implementation checklist

- Server components/layouts: `requireServerSession(redirectTo)` + status === "disabled" redirect + `assertRole(session, allowedRoles, redirectTo)`.
- API routes that require login: `requireServerSessionApi()` then `assertRoleApi(session, allowedRoles)`; return 401/403 from helpers when applicable.
- Status: only **disabled** blocks access; pending/invited do not hard-block.
- Multi-agency: use `canAdminViewLandlord`, `getAllowedAgencyIdsForLandlord`, `getAllowedAgencyIdsForAdminTickets`; no bespoke reimplementations.
