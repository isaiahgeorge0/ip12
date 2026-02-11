export type Role =
  | "superAdmin"
  | "admin"
  | "agent"
  | "landlord"
  | "tenant"
  | "contractor"
  | "lead";

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

export const DEFAULT_PERMISSIONS_BY_ROLE: Record<Role, Permission[]> = {
  superAdmin: ALL_PERMISSIONS,

  admin: [
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
  ],

  agent: [
    "crm.read",
    "properties.read",
    "properties.write",
    "applications.read",
    "applications.write",
    "tenancies.read",
    "tenancies.write",
    "tickets.read",
    "tickets.write",
    "landlords.read",
    "tenants.read",
  ],

  landlord: [
    "properties.read",
    "applications.read",
    "applications.write",
    "tenancies.read",
    "tickets.read",
  ],

  tenant: ["tickets.read", "tickets.write", "tenancies.read"],

  contractor: ["tickets.read", "tickets.write", "properties.read"],

  lead: ["properties.read", "applications.write"],
};
