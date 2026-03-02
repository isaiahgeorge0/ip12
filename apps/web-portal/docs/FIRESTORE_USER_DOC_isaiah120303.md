# Firestore user document for isaiah120303@gmail.com

## Why you see "No access"

The app shows **"No access"** when:

1. **No user document exists** at `users/{uid}` in Firestore, or  
2. **The document is invalid**: it must have the right fields and types (see below), or  
3. **The user’s role is not a staff role**: only `superAdmin`, `admin`, or `agent` are allowed to access the admin app.

So it can be missing permissions, but often the issue is that the **user document is missing or incomplete** (e.g. missing `role`, `permissions`, `status`, `createdAt`, `updatedAt`).

---

## What to create in Firestore

- **Collection:** `users`
- **Document ID:** `oO6VjDlVaRdJwsF1NGd9LtfA5wQ2` (the UID)

The document **must** have these fields (exact names and types):

| Field         | Type     | Example / notes |
|---------------|----------|------------------|
| `uid`         | string   | `oO6VjDlVaRdJwsF1NGd9LtfA5wQ2` |
| `email`       | string   | `isaiah120303@gmail.com` |
| `agencyId`    | string or null | Your agency ID, or `null` if not assigned yet |
| `role`        | string   | One of: `superAdmin`, `admin`, `agent` (others get "No access") |
| `status`      | string   | `active` |
| `permissions` | array    | Array of permission strings (see below) |
| `createdAt`   | timestamp| Set to current time when creating |
| `updatedAt`   | timestamp| Set to current time when creating |

Optional: `displayName`, `phone`, `jobTitle`.

---

## Example document (copy into Firestore)

Use this as a template. In Firebase Console → Firestore → `users` → Add document with ID `oO6VjDlVaRdJwsF1NGd9LtfA5wQ2`, then add the fields below. For **createdAt** and **updatedAt** choose type **timestamp** and set to current time.

```json
{
  "uid": "oO6VjDlVaRdJwsF1NGd9LtfA5wQ2",
  "email": "isaiah120303@gmail.com",
  "agencyId": null,
  "role": "admin",
  "status": "active",
  "permissions": [
    "crm.read",
    "crm.write",
    "properties.read",
    "properties.write",
    "applications.read",
    "applications.write",
    "tenancies.read",
    "tenancies.write",
    "tickets.read",
    "tickets.write",
    "landlords.read",
    "landlords.write",
    "tenants.read",
    "tenants.write",
    "contractors.read",
    "contractors.write",
    "settings.read",
    "settings.write"
  ],
  "createdAt": "<set to timestamp – current time>",
  "updatedAt": "<set to timestamp – current time>"
}
```

- If this user should be tied to an agency, set `agencyId` to that agency’s ID (e.g. `ip12`).
- If you want fewer permissions, use a smaller list (e.g. only `["properties.read","properties.write","applications.read","applications.write"]`). The app’s **Admin → Security test** (dev only) has a “Permission presets & buildUserDoc” section you can use to generate payloads.

After saving this document, sign in again with isaiah120303@gmail.com; the app should load the profile and grant access (as long as `role` is `superAdmin`, `admin`, or `agent`).
