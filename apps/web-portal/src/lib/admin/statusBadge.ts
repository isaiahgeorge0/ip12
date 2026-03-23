/**
 * Consistent status badge variant mapping across admin CRM.
 * neutral = passive / default
 * action = needs attention / pending (orange)
 * inProgress = in progress (muted blue)
 * success = completed / accepted
 * danger = rejected / cancelled / withdrawn
 */

export type StatusBadgeVariant = "neutral" | "action" | "inProgress" | "info" | "success" | "danger";

/** Pipeline stages */
const PIPELINE_ACTION = new Set(["prompt_sent", "ready_to_apply"]);
const PIPELINE_IN_PROGRESS = new Set(["application_started", "application_created", "application_submitted"]);
const PIPELINE_SUCCESS = new Set(["offer_accepted", "progressed", "archived"]);
const PIPELINE_DANGER = new Set(["withdrawn"]);

/** Enquiry statuses */
const ENQUIRY_ACTION = new Set(["new"]);
const ENQUIRY_IN_PROGRESS = new Set(["contacted", "viewing_booked", "viewing_complete", "application_requested"]);
const ENQUIRY_SUCCESS = new Set(["application_received"]);
const ENQUIRY_DANGER = new Set(["rejected", "archived"]);

/** Viewing statuses (scheduling lifecycle) */
const VIEWING_ACTION = new Set(["requested"]);
const VIEWING_IN_PROGRESS = new Set(["booked"]);
const VIEWING_SUCCESS = new Set(["completed"]);
const VIEWING_NEUTRAL = new Set(["cancelled"]);
const VIEWING_DANGER = new Set(["no_show"]);

/** Offer statuses: draft/withdrawn→neutral, sent→action, accepted→success, rejected→danger */
const OFFER_ACTION = new Set(["sent"]);
const OFFER_NEUTRAL = new Set(["draft", "withdrawn"]);
const OFFER_SUCCESS = new Set(["accepted"]);
const OFFER_DANGER = new Set(["rejected"]);

/** Staff action queue stages */
const QUEUE_ACTION = new Set(["offer_accepted"]);
const QUEUE_IN_PROGRESS = new Set(["picked_up", "referencing_sent", "docs_sent", "moved_to_external_system"]);
const QUEUE_SUCCESS = new Set(["completed", "archived"]);

/** Tenancy statuses: preparing→action, active→success, ending→inProgress, ended/cancelled→neutral */
const TENANCY_ACTION = new Set(["preparing"]);
const TENANCY_IN_PROGRESS = new Set(["ending"]);
const TENANCY_SUCCESS = new Set(["active"]);
const TENANCY_NEUTRAL = new Set(["ended", "cancelled"]);
const TENANCY_DANGER = new Set<string>();

/** Tenant statuses (derived: active = has active tenancy, former = no active tenancy) */
const TENANT_ACTIVE = new Set(["active"]);
const TENANT_NEUTRAL = new Set(["former"]);

/** Agency statuses (superadmin) */
const AGENCY_SUCCESS = new Set(["active"]);
const AGENCY_NEUTRAL = new Set(["disabled", "pending", "setup"]);

/** User/approval statuses (superadmin) */
const USER_ACTION = new Set(["pending"]);
const USER_SUCCESS = new Set(["active"]);
const USER_NEUTRAL = new Set(["invited", "disabled"]);

/** Job (maintenance) statuses */
const JOB_ACTION = new Set(["assigned", "scheduled"]);
const JOB_IN_PROGRESS = new Set(["in_progress"]);
const JOB_SUCCESS = new Set(["completed"]);
const JOB_DANGER = new Set(["cancelled"]);

/** Job priorities */
const JOB_PRIORITY_ACTION = new Set(["urgent"]);
const JOB_PRIORITY_IN_PROGRESS = new Set(["high"]);

/** Contractor active/inactive */
const CONTRACTOR_ACTIVE = new Set(["active", "true"]);
const CONTRACTOR_NEUTRAL = new Set(["inactive", "false"]);

/** Application review statuses (pipeline stages used for application review dashboard) */
const APPLICATION_ACTION = new Set(["application_submitted"]);
const APPLICATION_IN_PROGRESS = new Set(["under_review", "referencing", "application_created", "application_started"]);
const APPLICATION_SUCCESS = new Set(["approved", "offer_accepted", "progressed"]);
const APPLICATION_NEUTRAL = new Set(["withdrawn", "archived"]);
const APPLICATION_DANGER = new Set(["rejected"]);

/** Maintenance request statuses: reported→action, assigned→info, in_progress→inProgress, completed→success, cancelled→neutral */
const MAINTENANCE_ACTION = new Set(["reported"]);
const MAINTENANCE_INFO = new Set(["assigned"]);
const MAINTENANCE_IN_PROGRESS = new Set(["in_progress"]);
const MAINTENANCE_SUCCESS = new Set(["completed"]);
const MAINTENANCE_NEUTRAL = new Set(["cancelled"]);

/** Rent payment statuses: due→action, paid→success, late→danger, cancelled→neutral */
const RENT_ACTION = new Set(["due"]);
const RENT_SUCCESS = new Set(["paid"]);
const RENT_DANGER = new Set(["late"]);
const RENT_NEUTRAL = new Set(["cancelled"]);

export type StatusContext =
  | "pipeline"
  | "enquiry"
  | "viewing"
  | "offer"
  | "queue"
  | "queueWorkflow"
  | "queuePriority"
  | "tenancy"
  | "tenant"
  | "agency"
  | "userApproval"
  | "applicationProgress"
  | "jobStatus"
  | "jobPriority"
  | "contractor"
  | "application"
  | "maintenance"
  | "rent";

export function getStatusBadgeVariant(status: string, context: StatusContext): StatusBadgeVariant {
  const s = status.toLowerCase();
  switch (context) {
    case "pipeline":
      if (PIPELINE_ACTION.has(s)) return "action";
      if (PIPELINE_IN_PROGRESS.has(s)) return "inProgress";
      if (PIPELINE_SUCCESS.has(s)) return "success";
      if (PIPELINE_DANGER.has(s)) return "danger";
      return "neutral";
    case "enquiry":
      if (ENQUIRY_ACTION.has(s)) return "action";
      if (ENQUIRY_IN_PROGRESS.has(s)) return "inProgress";
      if (ENQUIRY_SUCCESS.has(s)) return "success";
      if (ENQUIRY_DANGER.has(s)) return "danger";
      return "neutral";
    case "viewing":
      if (VIEWING_ACTION.has(s)) return "action";
      if (VIEWING_IN_PROGRESS.has(s)) return "inProgress";
      if (VIEWING_SUCCESS.has(s)) return "success";
      if (VIEWING_NEUTRAL.has(s)) return "neutral";
      if (VIEWING_DANGER.has(s)) return "danger";
      return "neutral";
    case "offer":
      if (OFFER_ACTION.has(s)) return "action";
      if (OFFER_NEUTRAL.has(s)) return "neutral";
      if (OFFER_SUCCESS.has(s)) return "success";
      if (OFFER_DANGER.has(s)) return "danger";
      return "neutral";
    case "queue":
      if (QUEUE_ACTION.has(s)) return "action";
      if (QUEUE_IN_PROGRESS.has(s)) return "inProgress";
      if (QUEUE_SUCCESS.has(s)) return "success";
      return "neutral";
    case "queueWorkflow":
      if (s === "open") return "action";
      if (s === "snoozed") return "inProgress";
      if (s === "completed") return "success";
      return "neutral";
    case "queuePriority":
      if (s === "urgent") return "action";
      if (s === "high") return "inProgress";
      return "neutral";
    case "tenancy":
      if (TENANCY_ACTION.has(s)) return "action";
      if (TENANCY_IN_PROGRESS.has(s)) return "inProgress";
      if (TENANCY_SUCCESS.has(s)) return "success";
      if (TENANCY_NEUTRAL.has(s)) return "neutral";
      if (TENANCY_DANGER.has(s)) return "danger";
      return "neutral";
    case "tenant":
      if (TENANT_ACTIVE.has(s)) return "success";
      if (TENANT_NEUTRAL.has(s)) return "neutral";
      return "neutral";
    case "agency":
      if (AGENCY_SUCCESS.has(s)) return "success";
      if (AGENCY_NEUTRAL.has(s)) return "neutral";
      return "neutral";
    case "userApproval":
      if (USER_ACTION.has(s)) return "action";
      if (USER_SUCCESS.has(s)) return "success";
      if (USER_NEUTRAL.has(s)) return "neutral";
      return "neutral";
    case "applicationProgress":
      if (s === "draft") return "neutral";
      if (s === "in_progress") return "inProgress";
      if (s === "submitted") return "success";
      return "neutral";
    case "jobStatus":
      if (JOB_ACTION.has(s)) return "action";
      if (JOB_IN_PROGRESS.has(s)) return "inProgress";
      if (JOB_SUCCESS.has(s)) return "success";
      if (JOB_DANGER.has(s)) return "danger";
      return "neutral";
    case "jobPriority":
      if (JOB_PRIORITY_ACTION.has(s)) return "action";
      if (JOB_PRIORITY_IN_PROGRESS.has(s)) return "inProgress";
      return "neutral";
    case "contractor":
      if (CONTRACTOR_ACTIVE.has(s)) return "success";
      if (CONTRACTOR_NEUTRAL.has(s)) return "neutral";
      return "neutral";
    case "application":
      if (APPLICATION_ACTION.has(s)) return "action";
      if (APPLICATION_IN_PROGRESS.has(s)) return "inProgress";
      if (APPLICATION_SUCCESS.has(s)) return "success";
      if (APPLICATION_NEUTRAL.has(s)) return "neutral";
      if (APPLICATION_DANGER.has(s)) return "danger";
      return "neutral";
    case "maintenance":
      if (MAINTENANCE_ACTION.has(s)) return "action";
      if (MAINTENANCE_INFO.has(s)) return "info";
      if (MAINTENANCE_IN_PROGRESS.has(s)) return "inProgress";
      if (MAINTENANCE_SUCCESS.has(s)) return "success";
      if (MAINTENANCE_NEUTRAL.has(s)) return "neutral";
      return "neutral";
    case "rent":
      if (RENT_ACTION.has(s)) return "action";
      if (RENT_SUCCESS.has(s)) return "success";
      if (RENT_DANGER.has(s)) return "danger";
      if (RENT_NEUTRAL.has(s)) return "neutral";
      return "neutral";
    default:
      return "neutral";
  }
}
