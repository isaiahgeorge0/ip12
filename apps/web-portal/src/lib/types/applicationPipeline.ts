/**
 * Application pipeline: operational workflow for proceed-prompt → ready-to-apply → application-created.
 * Collection: agencies/{agencyId}/applicationPipeline/{pipelineItemId}.
 */

export const PIPELINE_SOURCES = ["proceed_prompt", "viewing_manual", "listing_enquiry"] as const;
export type PipelineSource = (typeof PIPELINE_SOURCES)[number];

export const PIPELINE_STAGES = [
  "prompt_sent",
  "ready_to_apply",
  "application_started",
  "application_created",
  "application_submitted",
  "under_review",
  "referencing",
  "approved",
  "rejected",
  "offer_accepted",
  "progressed",
  "withdrawn",
  "archived",
] as const;
export type PipelineStage = (typeof PIPELINE_STAGES)[number];

export function isPipelineSource(s: unknown): s is PipelineSource {
  return typeof s === "string" && (PIPELINE_SOURCES as readonly string[]).includes(s);
}

export function isPipelineStage(s: unknown): s is PipelineStage {
  return typeof s === "string" && (PIPELINE_STAGES as readonly string[]).includes(s);
}

export const PIPELINE_SOURCE_LABELS: Record<PipelineSource, string> = {
  proceed_prompt: "Proceed prompt",
  viewing_manual: "Viewing (manual)",
  listing_enquiry: "Listing enquiry",
};

export const PIPELINE_STAGE_LABELS: Record<PipelineStage, string> = {
  prompt_sent: "Prompt sent",
  ready_to_apply: "Ready to apply",
  application_started: "Application started",
  application_created: "Application created",
  application_submitted: "Application submitted",
  under_review: "Under review",
  referencing: "Referencing",
  approved: "Approved",
  rejected: "Rejected",
  offer_accepted: "Offer accepted",
  progressed: "Progressed",
  withdrawn: "Withdrawn",
  archived: "Archived",
};

export type ApplicationPipelineItem = {
  id: string;
  agencyId: string;
  applicantId: string | null;
  applicantUserId: string | null;
  propertyId: string;
  propertyDisplayLabel: string;
  source: PipelineSource;
  sourceEnquiryId: string | null;
  sourceViewingId: string | null;
  applicationId: string | null;
  stage: PipelineStage;
  notes: string | null;
  createdAt: number | null;
  updatedAt: number | null;
  lastActionAt: number | null;
};
