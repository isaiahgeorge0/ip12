"use client";

/**
 * Application Journey: horizontal progress indicator for the lettings process.
 * Stages: Enquiry → Viewing → Application → Offer → Accepted → Tenancy.
 * Uses existing admin UI tokens (zinc, amber, emerald).
 */

export type JourneyStage =
  | "enquiry"
  | "viewing"
  | "application"
  | "offer"
  | "accepted"
  | "tenancy";

const STAGES: { key: JourneyStage; label: string }[] = [
  { key: "enquiry", label: "Enquiry" },
  { key: "viewing", label: "Viewing" },
  { key: "application", label: "Application" },
  { key: "offer", label: "Offer" },
  { key: "accepted", label: "Accepted" },
  { key: "tenancy", label: "Tenancy" },
];

const STAGE_INDEX: Record<JourneyStage, number> = {
  enquiry: 0,
  viewing: 1,
  application: 2,
  offer: 3,
  accepted: 4,
  tenancy: 5,
};

type StepState = "completed" | "current" | "pending";

export type AdminProgressJourneyProps = {
  /** Current stage in the journey (derived from existing data by parent). */
  currentStage: JourneyStage;
  className?: string;
};

function getStepState(stageIndex: number, currentIndex: number): StepState {
  if (stageIndex < currentIndex) return "completed";
  if (stageIndex === currentIndex) return "current";
  return "pending";
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

export function AdminProgressJourney({ currentStage, className = "" }: AdminProgressJourneyProps) {
  const currentIndex = STAGE_INDEX[currentStage];

  return (
    <div
      className={`rounded-lg border border-zinc-200 bg-white p-4 ${className}`}
      role="status"
      aria-label={`Application journey: current stage ${STAGES[currentIndex].label}`}
    >
      <p className="text-xs font-medium text-zinc-500 mb-3 uppercase tracking-wide">Application journey</p>
      <div className="flex items-center">
        {STAGES.map((stage, index) => {
          const state = getStepState(index, currentIndex);
          const isLast = index === STAGES.length - 1;
          const lineToRightCompleted = index < currentIndex;

          return (
            <div key={stage.key} className="flex flex-1 min-w-0 items-center">
              <div className="flex flex-col items-center flex-shrink-0">
                <div
                  className={`
                    flex h-8 w-8 sm:h-9 sm:w-9 flex-shrink-0 items-center justify-center rounded-full border-2
                    ${state === "completed" ? "border-emerald-300 bg-emerald-500 text-white" : ""}
                    ${state === "current" ? "border-amber-400 bg-amber-500 text-white" : ""}
                    ${state === "pending" ? "border-zinc-200 bg-zinc-100 text-zinc-400" : ""}
                  `}
                >
                  {state === "completed" ? (
                    <CheckIcon className="h-4 w-4 sm:h-5 sm:w-5" />
                  ) : (
                    <span className="text-xs font-semibold">{index + 1}</span>
                  )}
                </div>
                <span
                  className={`
                    mt-1.5 text-xs text-center max-w-[4rem] sm:max-w-none
                    ${state === "completed" ? "text-zinc-600" : ""}
                    ${state === "current" ? "font-semibold text-zinc-900" : ""}
                    ${state === "pending" ? "text-zinc-400" : ""}
                  `}
                >
                  {stage.label}
                </span>
              </div>
              {!isLast && (
                <div
                  className={`
                    flex-1 h-0.5 mx-0.5 sm:mx-1 min-w-[4px]
                    ${lineToRightCompleted ? "bg-emerald-300" : "bg-zinc-200"}
                  `}
                  aria-hidden
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Derives current journey stage from existing CRM data (no backend changes).
 * Use this when you have viewings, pipeline, offers (and optionally tenancy) for an applicant or property.
 */
export function getJourneyStageFromData(props: {
  hasTenancy?: boolean;
  hasAcceptedOffer?: boolean;
  hasOffer?: boolean;
  hasPipelineEntry?: boolean;
  hasViewing?: boolean;
}): JourneyStage {
  const { hasTenancy, hasAcceptedOffer, hasOffer, hasPipelineEntry, hasViewing } = props;
  if (hasTenancy) return "tenancy";
  if (hasAcceptedOffer) return "accepted";
  if (hasOffer) return "offer";
  if (hasPipelineEntry) return "application";
  if (hasViewing) return "viewing";
  return "enquiry";
}
