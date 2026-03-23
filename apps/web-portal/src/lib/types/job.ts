/**
 * Maintenance job (contractor assignment from a ticket) types.
 * Firestore: agencies/{agencyId}/jobs/{jobId}
 */

export const JOB_STATUSES = [
  "assigned",
  "scheduled",
  "in_progress",
  "completed",
  "cancelled",
] as const;

export type JobStatus = (typeof JOB_STATUSES)[number];

export const JOB_STATUS_LABELS: Record<JobStatus, string> = {
  assigned: "Assigned",
  scheduled: "Scheduled",
  in_progress: "In progress",
  completed: "Completed",
  cancelled: "Cancelled",
};

export const JOB_PRIORITIES = ["low", "normal", "high", "urgent"] as const;

export type JobPriority = (typeof JOB_PRIORITIES)[number];

export const JOB_PRIORITY_LABELS: Record<JobPriority, string> = {
  low: "Low",
  normal: "Normal",
  high: "High",
  urgent: "Urgent",
};

export type JobDoc = {
  agencyId: string;
  ticketId: string;
  propertyId: string | null;
  propertyDisplayLabel: string | null;
  contractorId: string;
  contractorName: string;
  title: string;
  description: string | null;
  status: JobStatus;
  priority: JobPriority;
  scheduledFor: string | null;
  completedAt: unknown;
  notes: string | null;
  createdAt: unknown;
  updatedAt: unknown;
  createdBy: string;
  updatedBy: string;
};

export type JobListItem = {
  id: string;
  title: string;
  contractorName: string;
  contractorId: string;
  propertyDisplayLabel: string | null;
  propertyId: string | null;
  ticketId: string;
  status: JobStatus;
  priority: JobPriority;
  scheduledFor: string | null;
  updatedAt: number | null;
  createdAt: number | null;
};

export function isJobStatus(s: unknown): s is JobStatus {
  return typeof s === "string" && (JOB_STATUSES as readonly string[]).includes(s);
}

export function isJobPriority(s: unknown): s is JobPriority {
  return typeof s === "string" && (JOB_PRIORITIES as readonly string[]).includes(s);
}
