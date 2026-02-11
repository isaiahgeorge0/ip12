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

Authorization must always consider `agencyId`: staff and contractors see only data for their agency; landlords and tenants see only data for the agency and properties/tenancies they are linked to. Super-admins can operate across agencies for bootstrap and support; normal admins and agents are single-agency unless we introduce cross-agency roles later.
