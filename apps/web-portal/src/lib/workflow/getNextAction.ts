/**
 * Recommended next action derived from workflow state.
 * Used on applicant detail, property detail, and dashboard.
 * Does not change workflows; only derives a suggested action from existing data.
 */

export type NextActionInput = {
  /** Has at least one enquiry (e.g. for this property or applicant). */
  enquiry?: boolean;
  /** Has at least one viewing. */
  viewing?: boolean;
  /** At least one viewing is completed. */
  viewingCompleted?: boolean;
  /** Current or latest pipeline stage (e.g. application_submitted, offer_accepted). */
  pipelineStage?: string | null;
  /** Has at least one offer. */
  offer?: boolean;
  /** At least one offer has status accepted. */
  offerAccepted?: boolean;
  /** A tenancy exists (for this applicant/property or linked to this context). */
  tenancy?: boolean;
};

export type NextActionResult = {
  label: string;
  description: string;
  actionLink?: string;
  priority: "normal" | "urgent";
};

const STAGES_AFTER_PROMPT = new Set([
  "prompt_sent",
  "ready_to_apply",
  "application_started",
  "application_created",
  "application_submitted",
  "offer_accepted",
  "progressed",
  "withdrawn",
  "archived",
]);

/** Order of pipeline stages from earliest to furthest in the workflow. */
const PIPELINE_STAGE_ORDER = [
  "prompt_sent",
  "ready_to_apply",
  "application_started",
  "application_created",
  "application_submitted",
  "offer_accepted",
  "progressed",
  "withdrawn",
  "archived",
];

/**
 * Returns the furthest (most advanced) pipeline stage from a list.
 * Useful when aggregating multiple pipeline items (e.g. on a property with several applicants).
 */
export function getFurthestPipelineStage(stages: string[]): string | null {
  if (stages.length === 0) return null;
  const ordered = [...stages].sort(
    (a, b) =>
      (PIPELINE_STAGE_ORDER.indexOf(b) ?? -1) - (PIPELINE_STAGE_ORDER.indexOf(a) ?? -1)
  );
  return ordered[0] ?? null;
}

/**
 * Returns the recommended next action for the given workflow context.
 * Rules are evaluated in priority order (urgent first, then by workflow order).
 */
export function getNextAction(input: NextActionInput): NextActionResult | null {
  const {
    enquiry = false,
    viewing = false,
    viewingCompleted = false,
    pipelineStage = null,
    offer = false,
    offerAccepted = false,
    tenancy = false,
  } = input;

  // 1. Tenancy active → no further action
  if (tenancy) {
    return {
      label: "Tenancy active",
      description: "No further action required.",
      priority: "normal",
    };
  }

  // 2. Offer accepted but no tenancy → create tenancy (urgent)
  if (offerAccepted) {
    return {
      label: "Create tenancy",
      description: "Complete the handoff in the action queue to create the tenancy.",
      actionLink: "/admin/staff-action-queue",
      priority: "urgent",
    };
  }

  // 3. Application submitted (or at that stage) and no offer yet → prepare offer
  if (pipelineStage === "application_submitted" && !offer) {
    return {
      label: "Prepare offer",
      description: "Application submitted; create an offer from the applicant or property page.",
      actionLink: "/admin/offers",
      priority: "normal",
    };
  }

  // 4. Viewing completed but application prompt not sent (no pipeline or stage before prompt_sent)
  if (viewingCompleted) {
    const promptSentOrLater =
      pipelineStage != null && STAGES_AFTER_PROMPT.has(pipelineStage);
    if (!promptSentOrLater) {
      return {
        label: "Send application prompt",
        description: "Viewing completed; send proceed prompt or create application from the viewing.",
        actionLink: "/admin/viewings",
        priority: "normal",
      };
    }
  }

  // 5. Enquiry exists but no viewing booked
  if (enquiry && !viewing) {
    return {
      label: "Book viewing",
      description: "New enquiry has not yet been scheduled for a viewing.",
      actionLink: "/admin/viewings",
      priority: "normal",
    };
  }

  return null;
}
