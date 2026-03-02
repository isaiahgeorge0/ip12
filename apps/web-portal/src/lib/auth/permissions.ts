/**
 * Single source of truth for permission strings (must match firestore.rules)
 * and role presets for building user docs.
 */

export type Permission =
  | "crm.read"
  | "crm.write"
  | "properties.read"
  | "properties.write"
  | "applications.read"
  | "applications.write"
  | "tenancies.read"
  | "tenancies.write"
  | "tickets.read"
  | "tickets.write"
  | "landlords.read"
  | "landlords.write"
  | "tenants.read"
  | "tenants.write"
  | "contractors.read"
  | "contractors.write"
  | "settings.read"
  | "settings.write";

/** Ordered list of all permissions used in firestore.rules. */
export const ALL_PERMISSIONS: Permission[] = [
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
  "settings.write",
];

/**
 * Permission presets (least privilege).
 * Use preset name as key when building user docs.
 */
export const PERMISSION_PRESETS = {
  /** Read-only access to agency data. */
  viewer: [
    "crm.read",
    "properties.read",
    "applications.read",
    "tenancies.read",
    "tickets.read",
    "landlords.read",
    "tenants.read",
    "contractors.read",
    "settings.read",
  ] as const,

  /** Lettings: properties, applications, tenancies; read-only CRM. */
  lettingsStaff: [
    "crm.read",
    "properties.read",
    "properties.write",
    "applications.read",
    "applications.write",
    "tenancies.read",
    "tenancies.write",
  ] as const,

  /** Maintenance: tickets, contractors; read-only properties. */
  maintenanceStaff: [
    "tickets.read",
    "tickets.write",
    "contractors.read",
    "contractors.write",
    "properties.read",
  ] as const,

  /** Full agency access (all permissions). */
  officeAdmin: [...ALL_PERMISSIONS] as const,
} as const;

export type PresetName = keyof typeof PERMISSION_PRESETS;

/**
 * Payload for a user document in Firestore.
 * When writing, set createdAt and updatedAt to serverTimestamp().
 */
export type UserDocPayload = {
  uid: string;
  email: string;
  agencyId: string | null;
  role: string;
  status: "active";
  permissions: Permission[];
  displayName?: string;
  /** Set to serverTimestamp() when writing to Firestore. */
  createdAt: null;
  /** Set to serverTimestamp() when writing to Firestore. */
  updatedAt: null;
};

export type BuildUserDocParams = {
  uid: string;
  email: string;
  agencyId: string | null;
  role: string;
  displayName?: string;
  presetName: PresetName;
};

/**
 * Builds the object to use as a Firestore user document.
 * Does not write to Firestore. When writing, replace createdAt and updatedAt
 * with serverTimestamp().
 */
export function buildUserDoc(params: BuildUserDocParams): UserDocPayload {
  const { uid, email, agencyId, role, displayName, presetName } = params;
  const permissions = [...PERMISSION_PRESETS[presetName]] as Permission[];
  return {
    uid,
    email,
    agencyId,
    role,
    status: "active",
    permissions,
    ...(displayName !== undefined && displayName !== "" && { displayName }),
    createdAt: null,
    updatedAt: null,
  };
}
