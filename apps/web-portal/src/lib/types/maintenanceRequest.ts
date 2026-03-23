/**
 * Maintenance / repair request. Linked to property and tenancy.
 * Firestore: agencies/{agencyId}/maintenanceRequests/{requestId}
 */

export const MAINTENANCE_STATUSES = [
  "reported",
  "assigned",
  "in_progress",
  "completed",
  "cancelled",
] as const;

export type MaintenanceStatus = (typeof MAINTENANCE_STATUSES)[number];

export const MAINTENANCE_STATUS_LABELS: Record<MaintenanceStatus, string> = {
  reported: "Reported",
  assigned: "Assigned",
  in_progress: "In progress",
  completed: "Completed",
  cancelled: "Cancelled",
};

export const MAINTENANCE_PRIORITIES = ["low", "normal", "urgent"] as const;

export type MaintenancePriority = (typeof MAINTENANCE_PRIORITIES)[number];

export const MAINTENANCE_PRIORITY_LABELS: Record<MaintenancePriority, string> = {
  low: "Low",
  normal: "Normal",
  urgent: "Urgent",
};

export type MaintenanceRequestDoc = {
  agencyId: string;
  propertyId: string;
  propertyDisplayLabel: string | null;
  tenancyId: string | null;
  tenantId: string | null;
  tenantName: string | null;
  title: string;
  description: string | null;
  priority: MaintenancePriority;
  status: MaintenanceStatus;
  contractorId: string | null;
  contractorName: string | null;
  reportedAt: unknown;
  completedAt: unknown;
  createdAt: unknown;
  updatedAt: unknown;
  createdBy: string;
};

export function isMaintenanceStatus(s: unknown): s is MaintenanceStatus {
  return typeof s === "string" && (MAINTENANCE_STATUSES as readonly string[]).includes(s);
}

export function isMaintenancePriority(s: unknown): s is MaintenancePriority {
  return typeof s === "string" && (MAINTENANCE_PRIORITIES as readonly string[]).includes(s);
}
