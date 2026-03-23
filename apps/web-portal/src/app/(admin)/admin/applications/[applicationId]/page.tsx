"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { HistoryBackLink } from "@/components/HistoryBackLink";
import { AdminStatusBadge } from "@/components/admin/AdminStatusBadge";
import { AdminCreateOfferModal } from "@/components/admin/AdminCreateOfferModal";
import { getStatusBadgeVariant } from "@/lib/admin/statusBadge";
import { useAuth } from "@/contexts/AuthContext";
import { formatAdminDate } from "@/lib/admin/formatAdminDate";
import {
  PIPELINE_STAGE_LABELS,
  PIPELINE_STAGES,
  type PipelineStage,
} from "@/lib/types/applicationPipeline";

type ApplicationData = {
  id: string | null;
  fullName: string | null;
  email: string | null;
  phone: string | null;
  dateOfBirth: string | null;
  employmentStatus: string | null;
  employerName: string | null;
  jobTitle: string | null;
  monthlyIncome: number | null;
  annualIncome: number | null;
  additionalIncomeNotes: string | null;
  guarantorRequired: unknown;
  guarantorOffered: unknown;
  guarantorNotes: string | null;
  affordabilityNotes: string | null;
  extraNotes: string | null;
  applicationProgressStatus: string | null;
  submittedAtMs: number | null;
  lastEditedAtMs: number | null;
  createdAtMs: number | null;
  updatedAtMs: number | null;
};

type PipelineItem = {
  id: string;
  agencyId: string;
  applicantId: string | null;
  applicationId: string | null;
  propertyId: string | null;
  propertyDisplayLabel: string;
  stage: PipelineStage;
  notes: string | null;
  source: string | null;
  sourceEnquiryId: string | null;
  sourceViewingId: string | null;
  createdAtMs: number | null;
  updatedAtMs: number | null;
  lastActionAtMs: number | null;
  application: ApplicationData | null;
};

const REVIEW_STAGES: PipelineStage[] = [
  "application_submitted",
  "application_created",
  "application_started",
  "under_review",
  "referencing",
  "approved",
  "rejected",
  "withdrawn",
];

function formatDate(ms: number | null | undefined): string {
  if (ms == null || !Number.isFinite(ms)) return "—";
  return formatAdminDate(ms, "date");
}

function formatMoney(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: "GBP",
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return String(value);
  }
}

export default function AdminApplicationDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const pipelineItemId = params?.applicationId as string | undefined;
  const agencyIdParam = searchParams?.get("agencyId")?.trim() ?? "";
  const { profile } = useAuth();
  const sessionAgencyId = profile?.agencyId ?? null;
  const isSuperAdmin = profile?.role === "superAdmin";
  const effectiveAgencyId = isSuperAdmin ? agencyIdParam || null : sessionAgencyId;

  const [item, setItem] = useState<PipelineItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [createOfferOpen, setCreateOfferOpen] = useState(false);

  const loadItem = useCallback(() => {
    if (!pipelineItemId || !effectiveAgencyId) {
      setLoading(false);
      if (isSuperAdmin && !agencyIdParam) {
        setItem(null);
        setNotFound(false);
      } else if (!effectiveAgencyId) {
        setNotFound(true);
      }
      return;
    }
    setLoading(true);
    const url = `/api/admin/application-pipeline/${pipelineItemId}?agencyId=${encodeURIComponent(effectiveAgencyId)}`;
    fetch(url, { credentials: "include" })
      .then((res) => {
        if (res.status === 404) {
          setNotFound(true);
          setItem(null);
          return null;
        }
        return res.ok ? res.json() : null;
      })
      .then((data: PipelineItem | null) => {
        if (data) {
          setItem(data);
          setNotFound(false);
        } else if (!notFound) {
          setItem(null);
        }
      })
      .catch(() => setItem(null))
      .finally(() => setLoading(false));
  }, [pipelineItemId, effectiveAgencyId, isSuperAdmin, agencyIdParam]);

  useEffect(() => {
    loadItem();
  }, [loadItem]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const handleUpdateStage = useCallback(
    (newStage: PipelineStage) => {
      if (!pipelineItemId || !effectiveAgencyId) return;
      setUpdating(true);
      fetch(`/api/admin/application-pipeline/${pipelineItemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ agencyId: effectiveAgencyId, stage: newStage }),
      })
        .then(async (res) => {
          if (res.ok) {
            setToast("Status updated");
            loadItem();
          } else {
            const data = await res.json().catch(() => ({}));
            setToast(data?.error ?? "Update failed");
          }
        })
        .catch(() => setToast("Update failed"))
        .finally(() => setUpdating(false));
    },
    [pipelineItemId, effectiveAgencyId, loadItem]
  );

  if (isSuperAdmin && !agencyIdParam) {
    return (
      <>
        <HistoryBackLink href="/admin/applications">← Applications</HistoryBackLink>
        <PageHeader title="Application" />
        <EmptyState
          title="Select an agency from the header to view this page."
          description="Use the agency dropdown in the top bar."
        />
      </>
    );
  }

  if (!effectiveAgencyId && !isSuperAdmin) {
    return (
      <>
        <PageHeader title="Application" />
        <EmptyState
          title="No agency"
          description="Your account is not linked to an agency."
        />
      </>
    );
  }

  if (loading && !item) {
    return (
      <>
        <HistoryBackLink href={`/admin/applications${effectiveAgencyId ? `?agencyId=${encodeURIComponent(effectiveAgencyId)}` : ""}`}>← Applications</HistoryBackLink>
        <PageHeader title="Application" />
        <p className="text-sm text-zinc-500">Loading…</p>
      </>
    );
  }

  if (notFound || !item) {
    return (
      <>
        <HistoryBackLink href={`/admin/applications${effectiveAgencyId ? `?agencyId=${encodeURIComponent(effectiveAgencyId)}` : ""}`}>← Applications</HistoryBackLink>
        <PageHeader title="Application" />
        <EmptyState
          title="Application not found"
          description="This application or pipeline item may have been removed or you may not have access."
        />
      </>
    );
  }

  const app = item.application;
  const variant = getStatusBadgeVariant(item.stage, "application");
  const canCreateOffer = ["approved", "offer_accepted", "progressed"].includes(item.stage);
  const employmentLabel =
    app?.employmentStatus === "self_employed" || app?.employmentStatus === "self-employed"
      ? "Self-employed"
      : app?.employerName || app?.jobTitle || "—";

  return (
    <>
      {toast && (
        <div
          className="fixed bottom-4 right-4 z-20 rounded-lg bg-zinc-900 px-4 py-2 text-sm text-white shadow-lg"
          role="status"
        >
          {toast}
        </div>
      )}
      <HistoryBackLink
        href={`/admin/applications${effectiveAgencyId ? `?agencyId=${encodeURIComponent(effectiveAgencyId)}` : ""}`}
      >
        ← Applications
      </HistoryBackLink>
      <PageHeader
        title="Application"
        subtitle={`${app?.fullName ?? "Applicant"} · ${item.propertyDisplayLabel}`}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <Card className="p-4">
            <h2 className="text-sm font-semibold text-zinc-900 mb-3">
              Applicant summary
            </h2>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <dt className="text-zinc-500">Name</dt>
              <dd className="text-zinc-900">
                {item.applicantId ? (
                  <Link
                    href={`/admin/applicants/${item.applicantId}${effectiveAgencyId ? `?agencyId=${encodeURIComponent(effectiveAgencyId)}` : ""}`}
                    className="hover:underline"
                  >
                    {app?.fullName ?? "—"}
                  </Link>
                ) : (
                  app?.fullName ?? "—"
                )}
              </dd>
              <dt className="text-zinc-500">Email</dt>
              <dd className="text-zinc-900">{app?.email ?? "—"}</dd>
              <dt className="text-zinc-500">Phone</dt>
              <dd className="text-zinc-900">{app?.phone ?? "—"}</dd>
              <dt className="text-zinc-500">Date of birth</dt>
              <dd className="text-zinc-900">{app?.dateOfBirth ?? "—"}</dd>
            </dl>
          </Card>

          <Card className="p-4">
            <h2 className="text-sm font-semibold text-zinc-900 mb-3">
              Property applied for
            </h2>
            {item.propertyId ? (
              <Link
                href={`/admin/properties/${item.propertyId}?agencyId=${encodeURIComponent(item.agencyId)}`}
                className="text-zinc-700 hover:underline"
              >
                {item.propertyDisplayLabel}
              </Link>
            ) : (
              <p className="text-zinc-700">{item.propertyDisplayLabel}</p>
            )}
          </Card>

          <Card className="p-4">
            <h2 className="text-sm font-semibold text-zinc-900 mb-3">
              Employment
            </h2>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <dt className="text-zinc-500">Employer / role</dt>
              <dd className="text-zinc-900">{employmentLabel}</dd>
              <dt className="text-zinc-500">Job title</dt>
              <dd className="text-zinc-900">{app?.jobTitle ?? "—"}</dd>
            </dl>
          </Card>

          <Card className="p-4">
            <h2 className="text-sm font-semibold text-zinc-900 mb-3">Income</h2>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <dt className="text-zinc-500">Monthly</dt>
              <dd className="text-zinc-900">{formatMoney(app?.monthlyIncome)}</dd>
              <dt className="text-zinc-500">Annual</dt>
              <dd className="text-zinc-900">{formatMoney(app?.annualIncome)}</dd>
              {app?.additionalIncomeNotes && (
                <>
                  <dt className="text-zinc-500">Notes</dt>
                  <dd className="text-zinc-900">{app.additionalIncomeNotes}</dd>
                </>
              )}
            </dl>
          </Card>

          {(item.notes || app?.extraNotes || app?.affordabilityNotes) && (
            <Card className="p-4">
              <h2 className="text-sm font-semibold text-zinc-900 mb-3">Notes</h2>
              <div className="space-y-2 text-sm text-zinc-700">
                {item.notes && <p>{item.notes}</p>}
                {app?.extraNotes && <p>{app.extraNotes}</p>}
                {app?.affordabilityNotes && (
                  <p className="text-zinc-600">{app.affordabilityNotes}</p>
                )}
              </div>
            </Card>
          )}

          {/* Placeholders for future: credit checks, document uploads, guarantor, affordability */}
          <Card className="p-4 border-dashed border-zinc-200 bg-zinc-50/50">
            <p className="text-xs text-zinc-500">
              Future: credit checks, document uploads, guarantor details, affordability calculations.
            </p>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="p-4">
            <h2 className="text-sm font-semibold text-zinc-900 mb-3">Status</h2>
            <AdminStatusBadge variant={variant} className="mb-3">
              {PIPELINE_STAGE_LABELS[item.stage]}
            </AdminStatusBadge>

            <h3 className="text-xs font-medium text-zinc-600 mt-4 mb-2">
              Update status
            </h3>
            <select
              value={item.stage}
              disabled={updating}
              onChange={(e) => {
                const v = e.target.value;
                if (PIPELINE_STAGES.includes(v as PipelineStage)) {
                  handleUpdateStage(v as PipelineStage);
                }
              }}
              className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm disabled:opacity-50"
            >
              {REVIEW_STAGES.map((s) => (
                <option key={s} value={s}>
                  {PIPELINE_STAGE_LABELS[s]}
                </option>
              ))}
            </select>

            <div className="mt-4 flex flex-wrap gap-2">
              {!["referencing", "approved", "offer_accepted", "progressed"].includes(item.stage) && (
                <button
                  type="button"
                  disabled={updating}
                  onClick={() => handleUpdateStage("referencing")}
                  className="rounded border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-50"
                >
                  Move to referencing
                </button>
              )}
              {!["approved", "offer_accepted", "progressed"].includes(item.stage) && (
                <>
                  <button
                    type="button"
                    disabled={updating}
                    onClick={() => handleUpdateStage("approved")}
                    className="rounded border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    disabled={updating}
                    onClick={() => handleUpdateStage("rejected")}
                    className="rounded border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
                  >
                    Reject
                  </button>
                </>
              )}
            </div>
          </Card>

          {canCreateOffer && item.applicantId && effectiveAgencyId && item.propertyId && (
            <Card className="p-4 border-emerald-200 bg-emerald-50/50">
              <p className="text-sm font-medium text-zinc-900 mb-2">
                Application approved
              </p>
              <button
                type="button"
                onClick={() => setCreateOfferOpen(true)}
                className="inline-flex items-center rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700"
              >
                Create offer
              </button>
            </Card>
          )}

          <Card className="p-4">
            <p className="text-xs text-zinc-500">
              Submitted: {formatDate(app?.submittedAtMs ?? item.createdAtMs)}
            </p>
            <p className="text-xs text-zinc-500 mt-1">
              Last action: {formatDate(item.lastActionAtMs)}
            </p>
          </Card>
        </div>
      </div>

      {createOfferOpen && effectiveAgencyId && item.applicantId && item.propertyId && (
        <AdminCreateOfferModal
          open={createOfferOpen}
          onClose={() => setCreateOfferOpen(false)}
          agencyId={effectiveAgencyId}
          initialProperty={{
            agencyId: item.agencyId,
            propertyId: item.propertyId,
            displayAddress: item.propertyDisplayLabel,
          }}
          initialApplicant={{
            applicantId: item.applicantId,
            applicantName: app?.fullName ?? null,
            applicantEmail: app?.email ?? null,
            applicationId: item.applicationId ?? undefined,
          }}
          onSuccess={() => {
            setToast("Offer created");
            setCreateOfferOpen(false);
          }}
        />
      )}
    </>
  );
}
