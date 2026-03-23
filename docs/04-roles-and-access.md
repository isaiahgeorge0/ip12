# Roles and access

## Super-admin

The **superAdmin** role is the sole controller of the platform. Only super-admins can:

- Grant or revoke roles (including other super-admins, subject to safeguards).
- Perform system bootstrap (e.g. creating the first agency and first admin).
- Access the `system/bootstrap` document used for one-time setup.

There is no UI for self-service super-admin creation; it is done via a controlled bootstrap process (e.g. script or secure backdoor) that writes the first user with role `superAdmin` and optionally creates the first agency.

## Staff and admin permissions

- **admin** — Full agency access: CRM, properties, applications, tenancies, tickets, landlords, tenants, contractors, and settings. Intended for agency owners or office managers.
- **agent** — Day-to-day operations: read CRM; read/write properties, applications, tenancies, tickets; read landlords and tenants. No contractors or settings. Agents cannot see or change tenant PII beyond what’s needed for tenancy and ticket handling; sensitive data access follows the same rules as the data layer.

Permissions are stored on the user profile (e.g. in Firestore `users/{uid}`) and default from the role via `DEFAULT_PERMISSIONS_BY_ROLE`. A super-admin (or admin, if we allow it later) can override the list for a user. Authorization checks use the user’s `permissions` array, not only the role name.

## Tenants, landlords, contractors

- **tenant**, **landlord**, and **contractor** are provisioned only after a contract (or equivalent) is in place. They are linked to an agency via `agencyId` and, where relevant, to specific properties or tenancies.
- **landlord** — Can read their properties, applications, tenancies, and tickets; no access to tenant PII beyond what’s required for joint tenancy/ticket context.
- **tenant** — Can read/write their own tickets and read their own tenancy.
- **contractor** — Can read and update tickets (and optionally properties) assigned to them; no broad access to tenants or landlords.

All access is scoped by `agencyId` and by resource ownership/assignment in Firestore rules and in the data layer.

## Leads

- **lead** — Represents a quick signup (e.g. enquiry form). Permissions are minimal: read properties (listings) and write applications (apply). No CRM or tenancy access.
- Leads can be upgraded to **tenant** (or other roles) after signup/contract; the profile is updated and permissions change accordingly.

## Multi-agency

The model supports multiple agencies via `agencyId` on the user profile and scoped collections:

- Top-level collections like `users` are global.
- Agency-scoped data lives under `agencies/{agencyId}/...` (e.g. `properties`, `applications`, `tenancies`, `tickets`, `contractorJobs`).

Authorization must always consider `agencyId`: staff and contractors see only data for their agency; landlords and tenants see data for the agency and properties/tenancies they are linked to. Super-admins can operate across agencies for bootstrap and support; normal admins and agents are single-agency unless we introduce cross-agency roles later.

### Enquiries (applicant pipeline)

- **Collection:** `agencies/{agencyId}/enquiries/{enquiryId}`. Written only by the server (POST /api/enquiries); no client direct writes.
- **Applicant profiles:** Global `applicants/{userId}` stores stable, reusable applicant data; created/updated by the server on enquiry submit. Public users can read their own document for form prefill; admins read via server APIs.
- **Who can submit:** Any signed-in user (including **public** and **lead**). Submitter is stored as `applicantUserId`; name, email, phone, message, move-in date, pets, children, employment, smoker, occupants, and optional income notes are stored on the enquiry doc and used to upsert the applicant profile.
- **Who can read:** Admins (and superAdmin) with `applications.read` for that agency. Enquiries are listed on the property detail page (with enriched columns) and on the Applicants page (“Applicants from enquiries”, “Recent enquiries”).
- **Status:** New enquiries have `status: "new"` and `source: "public_listing"`. Future: viewing requests, offers, status workflow.

### Public users and sign-up

- **public** — Self-sign-up from the public site. No agency or privileged permissions; can browse public pages and submit enquiries via POST /api/enquiries. User doc at `users/{uid}` has `role: "public"`, `status: "active"`, `permissions: []`. Sign-up creates Firebase Auth user and Firestore user doc via POST /api/auth/register-profile (called after client createUserWithEmailAndPassword).
- **returnTo:** Sign-in and sign-up support a safe `returnTo` query param for public paths only (`/`, `/listings`, `/listings/[id]`); never `/admin`, `/landlord`, `/superadmin`, or external URLs.

### Admin properties tab vs landlord-scoped property access

- **Admin properties tab** (`/admin/properties`, `GET /api/admin/properties`): Intentionally **agency-scoped only**. An admin sees only properties belonging to their `session.agencyId`. A secondary-agency admin (one with a landlord grant allowing them to view another agency’s landlord) does **not** see that other agency’s properties in the main properties list.
- **Landlord context**: When an admin views a specific landlord (e.g. landlord detail or inventory), they can see and navigate to properties linked to that landlord even if those properties belong to another agency, as long as the grant allows it (`getAllowedAgencyIdsForLandlord`). So cross-agency property access is **only** in the context of “viewing this landlord,” not in the global properties tab.
