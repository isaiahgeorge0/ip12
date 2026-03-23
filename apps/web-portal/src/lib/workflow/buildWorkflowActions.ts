/**
 * Rule-based workflow automation for the unified staff action queue.
 * Takes normalized agency records and outputs queue task candidates.
 * No Firestore writes; deterministic order; deduplication by stable id.
 */

import type {
  StaffActionQueueItem,
  StaffQueueItemType,
  StaffQueuePriority,
} from "@/lib/types/staffQueueItem";

const VIEWING_FOLLOW_UP_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const TENANCY_MOVE_IN_WINDOW_DAYS = 14;
const STAGES_AT_OR_BEYOND_PROMPT_SENT = new Set([
  "prompt_sent",
  "ready_to_apply",
  "application_started",
  "application_created",
  "application_submitted",
  "offer_accepted",
  "progressed",
  "archived",
]);

const DEFAULT_WORKFLOW = {
  workflowStatus: "open" as const,
  assignedToUid: null as string | null,
  assignedToName: null as string | null,
  snoozedUntil: null as number | null,
  completedAt: null as number | null,
  completedByUid: null as string | null,
  completionNote: null as string | null,
};

export type WorkflowViewing = {
  id: string;
  propertyId: string;
  applicantId: string | null;
  applicantUserId: string | null;
  status: string;
  updatedAtMs: number;
  createdAtMs: number;
  applicantName?: string | null;
};

export type WorkflowPipelineItem = {
  id: string;
  propertyId: string;
  applicantId: string | null;
  applicationId: string | null;
  stage: string;
  lastActionAtMs: number;
  applicantName?: string | null;
};

export type WorkflowOffer = {
  id: string;
  propertyId: string;
  applicantId: string | null;
  applicationId: string | null;
  status: string;
  applicantName?: string | null;
};

export type WorkflowTenancy = {
  id: string;
  propertyId: string;
  offerId: string | null;
  status: string;
  tenancyStartDate: string | null;
  tenantName?: string | null;
};

export type WorkflowTicket = {
  id: string;
  propertyId: string;
  status: string;
  title: string;
  category?: string | null;
  description?: string | null;
};

export type WorkflowQueueRow = {
  id: string;
  offerId: string;
  propertyId: string;
  applicantId: string | null;
  applicantName?: string | null;
};

export type WorkflowInput = {
  viewings: WorkflowViewing[];
  pipeline: WorkflowPipelineItem[];
  offers: WorkflowOffer[];
  tenancies: WorkflowTenancy[];
  tickets: WorkflowTicket[];
  queueRows: WorkflowQueueRow[];
  propertyLabels: Map<string, string>;
  now: number;
};

function label(propertyLabels: Map<string, string>, propertyId: string): string {
  return propertyLabels.get(propertyId) ?? `Property ${propertyId}`;
}

function toItem(
  input: Omit<
    StaffActionQueueItem,
    "workflowStatus" | "assignedToUid" | "assignedToName" | "snoozedUntil" | "completedAt" | "completedByUid" | "completionNote"
  >
): StaffActionQueueItem {
  return {
    ...input,
    ...DEFAULT_WORKFLOW,
  };
}

/** Rule A: Completed viewing with no pipeline at/beyond prompt_sent for that applicant+property */
function ruleViewingFollowUp(input: WorkflowInput): StaffActionQueueItem[] {
  const out: StaffActionQueueItem[] = [];
  const sevenDaysAgo = input.now - VIEWING_FOLLOW_UP_DAYS_MS;
  for (const v of input.viewings) {
    if (v.status !== "completed") continue;
    if (v.updatedAtMs < sevenDaysAgo) continue;
    const hasPipeline = input.pipeline.some(
      (p) =>
        p.propertyId === v.propertyId &&
        (p.applicantId === v.applicantId || (v.applicantId == null && p.applicantId == null)) &&
        STAGES_AT_OR_BEYOND_PROMPT_SENT.has(p.stage)
    );
    if (hasPipeline) continue;
    const propLabel = label(input.propertyLabels, v.propertyId);
    const desc = v.applicantName ? `${v.applicantName} – ${propLabel}` : propLabel;
    out.push(
      toItem({
        id: `viewing_followup_${v.id}`,
        type: "VIEWING_FOLLOW_UP",
        title: "Follow up completed viewing",
        description: desc,
        createdAt: v.createdAtMs,
        propertyId: v.propertyId,
        propertyDisplayLabel: propLabel,
        applicantId: v.applicantId,
        ticketId: null,
        offerId: null,
        queueItemId: null,
        priority: "high",
        status: "completed",
        applicantName: v.applicantName ?? null,
        reasonWhy: "Viewing completed; send proceed prompt or progress applicant.",
      })
    );
  }
  return out;
}

/** Rule B: Pipeline at application_submitted → Review application */
function ruleApplicationReview(input: WorkflowInput): StaffActionQueueItem[] {
  const out: StaffActionQueueItem[] = [];
  for (const p of input.pipeline) {
    if (p.stage !== "application_submitted") continue;
    const propLabel = label(input.propertyLabels, p.propertyId);
    const desc = p.applicantName ? `${p.applicantName} – ${propLabel}` : propLabel;
    out.push(
      toItem({
        id: `application_review_${p.id}`,
        type: "APPLICATION_REVIEW",
        title: "Review submitted application",
        description: desc,
        createdAt: p.lastActionAtMs,
        propertyId: p.propertyId,
        propertyDisplayLabel: propLabel,
        applicantId: p.applicantId,
        ticketId: null,
        offerId: null,
        queueItemId: null,
        priority: "urgent",
        status: "application_submitted",
        applicantName: p.applicantName ?? null,
        reasonWhy: "Application submitted; review and decide next step.",
      })
    );
  }
  return out;
}

/** Rule C: Pipeline at application_submitted and no related offer yet */
function rulePrepareOffer(input: WorkflowInput): StaffActionQueueItem[] {
  const out: StaffActionQueueItem[] = [];
  const hasOfferForPipeline = new Set<string>();
  const hasOfferForApplicantProperty = new Set<string>();
  for (const o of input.offers) {
    if (o.applicationId) hasOfferForPipeline.add(o.applicationId);
    const key = `${o.applicantId ?? ""}_${o.propertyId}`;
    hasOfferForApplicantProperty.add(key);
  }
  for (const p of input.pipeline) {
    if (p.stage !== "application_submitted") continue;
    const hasOffer =
      (p.applicationId && hasOfferForPipeline.has(p.applicationId)) ||
      hasOfferForApplicantProperty.has(`${p.applicantId ?? ""}_${p.propertyId}`);
    if (hasOffer) continue;
    const propLabel = label(input.propertyLabels, p.propertyId);
    const desc = p.applicantName ? `${p.applicantName} – ${propLabel}` : propLabel;
    out.push(
      toItem({
        id: `prepare_offer_${p.id}`,
        type: "PREPARE_OFFER",
        title: "Prepare tenancy offer",
        description: desc,
        createdAt: p.lastActionAtMs,
        propertyId: p.propertyId,
        propertyDisplayLabel: propLabel,
        applicantId: p.applicantId,
        ticketId: null,
        offerId: null,
        queueItemId: null,
        priority: "high",
        status: "application_submitted",
        applicantName: p.applicantName ?? null,
        reasonWhy: "Application submitted; no offer yet. Create and send offer.",
      })
    );
  }
  return out;
}

/** Rule D: Accepted offer with no tenancy yet → Create tenancy (canonical for accepted-offer work) */
function ruleCreateTenancy(input: WorkflowInput): StaffActionQueueItem[] {
  const out: StaffActionQueueItem[] = [];
  const tenancyByOfferId = new Map<string, WorkflowTenancy>();
  for (const t of input.tenancies) {
    if (t.offerId) tenancyByOfferId.set(t.offerId, t);
  }
  for (const row of input.queueRows) {
    if (tenancyByOfferId.has(row.offerId)) continue;
    const propLabel = input.propertyLabels.get(row.propertyId) ?? `Property ${row.propertyId}`;
    const desc = row.applicantName ? `${row.applicantName} – ${propLabel}` : propLabel;
    out.push(
      toItem({
        id: `create_tenancy_${row.offerId}`,
        type: "CREATE_TENANCY",
        title: "Create tenancy from accepted offer",
        description: desc,
        createdAt: input.now,
        propertyId: row.propertyId,
        propertyDisplayLabel: propLabel,
        applicantId: row.applicantId,
        ticketId: null,
        offerId: row.offerId,
        queueItemId: row.id,
        priority: "urgent",
        status: "offer_accepted",
        applicantName: row.applicantName ?? null,
        reasonWhy: "Offer accepted; create tenancy record.",
      })
    );
  }
  return out;
}

/** Rule E: Active tenancy with start date within next 14 days */
function ruleUpcomingMoveIn(input: WorkflowInput): StaffActionQueueItem[] {
  const out: StaffActionQueueItem[] = [];
  const todayStart = new Date(input.now);
  todayStart.setHours(0, 0, 0, 0);
  const windowEnd = new Date(todayStart);
  windowEnd.setDate(windowEnd.getDate() + TENANCY_MOVE_IN_WINDOW_DAYS);
  for (const t of input.tenancies) {
    if (t.status !== "active" || !t.tenancyStartDate) continue;
    const startDate = new Date(t.tenancyStartDate);
    if (Number.isNaN(startDate.getTime())) continue;
    if (startDate < todayStart || startDate > windowEnd) continue;
    const daysUntil = Math.ceil(
      (startDate.getTime() - todayStart.getTime()) / (24 * 60 * 60 * 1000)
    );
    const propLabel = label(input.propertyLabels, t.propertyId);
    const title =
      daysUntil <= 0
        ? "Prepare upcoming move-in (today)"
        : daysUntil === 1
          ? "Prepare upcoming move-in (tomorrow)"
          : `Prepare upcoming move-in (in ${daysUntil} days)`;
    const desc = `${t.tenantName ?? "Tenant"} – ${propLabel} · ${t.tenancyStartDate}`;
    out.push(
      toItem({
        id: `upcoming_move_in_${t.id}`,
        type: "UPCOMING_MOVE_IN",
        title,
        description: desc,
        createdAt: input.now,
        propertyId: t.propertyId,
        propertyDisplayLabel: propLabel,
        applicantId: null,
        ticketId: null,
        offerId: null,
        queueItemId: null,
        priority: "high",
        status: "active",
        reasonWhy: "Move-in date approaching; prepare handover.",
      })
    );
  }
  return out;
}

/** Rule F: Open ticket */
function ruleOpenTicket(input: WorkflowInput): StaffActionQueueItem[] {
  const out: StaffActionQueueItem[] = [];
  for (const t of input.tickets) {
    const statusLower = (t.status || "").toLowerCase();
    if (statusLower !== "open") continue;
    const propLabel = label(input.propertyLabels, t.propertyId);
    const sub = (t.category || t.title || "").trim();
    const desc = sub ? `${propLabel} · ${sub}` : propLabel;
    out.push(
      toItem({
        id: `open_ticket_${t.id}`,
        type: "OPEN_TICKET",
        title: "Review open maintenance ticket",
        description: desc,
        createdAt: input.now,
        propertyId: t.propertyId,
        propertyDisplayLabel: propLabel,
        applicantId: null,
        ticketId: t.id,
        offerId: null,
        queueItemId: null,
        priority: "normal",
        status: "Open",
        reasonWhy: "Ticket open; assign or resolve.",
      })
    );
  }
  return out;
}

/** Dedupe by stable id so the same task never appears twice */
function deduplicate(items: StaffActionQueueItem[]): StaffActionQueueItem[] {
  const byId = new Map<string, StaffActionQueueItem>();
  for (const item of items) {
    if (!byId.has(item.id)) byId.set(item.id, item);
  }
  return Array.from(byId.values());
}

/**
 * Build workflow task candidates from normalized input.
 * Deterministic order: A → B → C → D → E → F, then deduplicate.
 */
export function buildWorkflowActions(input: WorkflowInput): StaffActionQueueItem[] {
  const raw: StaffActionQueueItem[] = [];
  raw.push(...ruleViewingFollowUp(input));
  raw.push(...ruleApplicationReview(input));
  raw.push(...rulePrepareOffer(input));
  raw.push(...ruleCreateTenancy(input));
  raw.push(...ruleUpcomingMoveIn(input));
  raw.push(...ruleOpenTicket(input));
  return deduplicate(raw);
}
