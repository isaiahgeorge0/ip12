"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { useAuth } from "@/contexts/AuthContext";
import { getFirebaseFirestore } from "@/lib/firebase/client";
import { applicationsCol } from "@/lib/firestore/paths";
import { HistoryBackLink } from "@/components/HistoryBackLink";
import { propertyDisplayLabel } from "@/lib/admin/normalizePropertyDisplay";
import { VIEWING_STATUS_LABELS, VIEWING_SOURCE_LABELS, type ViewingStatus } from "@/lib/types/viewing";
import { AdminCreateOfferModal } from "@/components/admin/AdminCreateOfferModal";
import { AdminProgressJourney, getJourneyStageFromData } from "@/components/admin/AdminProgressJourney";
import { AdminNextActionCard } from "@/components/admin/AdminNextActionCard";
import { AdminMatchScoreBadge } from "@/components/admin/AdminMatchScoreBadge";
import { getNextAction, getFurthestPipelineStage } from "@/lib/workflow/getNextAction";
import { AdminStatusBadge } from "@/components/admin/AdminStatusBadge";
import { getStatusBadgeVariant } from "@/lib/admin/statusBadge";
import { OFFER_STATUS_LABELS, type OfferStatus } from "@/lib/types/offer";
import type { ApplicantPreferences } from "@/lib/types/applicantPreferences";
import { normalizeApplicantPreferences, LOOKING_FOR_OPTIONS, PREFERRED_PROPERTY_TYPES } from "@/lib/types/applicantPreferences";
import { formatAdminDate } from "@/lib/admin/formatAdminDate";
import { useAdminAgency } from "@/lib/admin/useAdminAgency";

type ViewingRow = {
  id: string;
  propertyId: string;
  propertyDisplayLabel?: string;
  agencyId: string;
  applicantUserId: string | null;
  applicantName: string;
  applicantEmail: string;
  scheduledAt: number | null;
  status: ViewingStatus;
  notes: string | null;
  source: string;
};

type ApplicantStatus =
  | "New"
  | "Contacted"
  | "Viewing"
  | "Offered"
  | "Rejected"
  | "Accepted";

type Applicant = {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  propertyRef: string | null;
  status: ApplicantStatus;
  notes: string | null;
  preferences: ApplicantPreferences;
  createdAt: unknown;
  updatedAt: unknown;
  createdByUid: string;
};

function formatApplicantDate(v: unknown): string {
  return formatAdminDate(v as unknown as { seconds?: number; toDate?: () => Date } | number | null | undefined, "date");
}

const APPLICANT_STATUSES: ApplicantStatus[] = [
  "New",
  "Contacted",
  "Viewing",
  "Offered",
  "Accepted",
  "Rejected",
];

export default function AdminApplicantDetailPage() {
  const params = useParams();
  const applicantId = params?.applicantId as string | undefined;
  const { profile } = useAuth();
  const [applicant, setApplicant] = useState<Applicant | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [editing, setEditing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Applicant> & { preferences?: ApplicantPreferences }>({});
  const [viewings, setViewings] = useState<ViewingRow[]>([]);
  const [loadingViewings, setLoadingViewings] = useState(false);
  const [bookViewingOpen, setBookViewingOpen] = useState(false);
  const [bookViewingSubmitting, setBookViewingSubmitting] = useState(false);
  const [bookViewingForm, setBookViewingForm] = useState({ propertyId: "", scheduledAt: "", notes: "" });
  const [properties, setProperties] = useState<{ id: string; agencyId: string; displayAddress: string }[]>([]);
  const [proceedPromptViewingId, setProceedPromptViewingId] = useState<string | null>(null);
  const [createAppViewingId, setCreateAppViewingId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [pipelineItems, setPipelineItems] = useState<{ id: string; propertyDisplayLabel: string; stage: string }[]>([]);
  const [loadingPipeline, setLoadingPipeline] = useState(false);
  type OfferRow = { id: string; propertyId: string; propertyDisplayLabel: string; agencyId: string; amount: number; status: OfferStatus; source: string; updatedAt: string | null };
  const [offers, setOffers] = useState<OfferRow[]>([]);
  const [loadingOffers, setLoadingOffers] = useState(false);
  const [createOfferOpen, setCreateOfferOpen] = useState(false);
  const [propertyMatches, setPropertyMatches] = useState<{
    propertyId: string;
    propertyDisplayLabel: string;
    rentPcm: number | null;
    type: string;
    bedrooms: number;
    score: number;
    reasons: string[];
    warnings: string[];
    matched: boolean;
  }[]>([]);
  const [loadingMatches, setLoadingMatches] = useState(false);

  // IMPORTANT:
  // Admin pages must use effectiveAgencyId (superAdmin = URL param, admin = session).
  // Do not use session-only agencyId in admin pages.
  const { effectiveAgencyId, isSuperAdmin } = useAdminAgency();
  const db = getFirebaseFirestore();

  useEffect(() => {
    if (!db || !effectiveAgencyId || !applicantId) {
      setLoading(false);
      if (!applicantId) setNotFound(true);
      return;
    }
    const ref = doc(db, applicationsCol(effectiveAgencyId), applicantId);
    getDoc(ref).then((snap) => {
      setLoading(false);
      if (!snap.exists()) {
        setNotFound(true);
        return;
      }
      const data = snap.data()!;
      const a: Applicant = {
        id: snap.id,
        fullName: data.fullName ?? "",
        email: data.email ?? "",
        phone: data.phone ?? null,
        propertyRef: data.propertyRef ?? null,
        status: (data.status as ApplicantStatus) ?? "New",
        notes: data.notes ?? null,
        preferences: normalizeApplicantPreferences(data.preferences),
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
        createdByUid: data.createdByUid ?? "",
      };
      setApplicant(a);
      setEditForm({
        fullName: a.fullName,
        email: a.email,
        phone: a.phone,
        propertyRef: a.propertyRef,
        status: a.status,
        notes: a.notes,
        preferences: a.preferences,
      });
    });
  }, [db, effectiveAgencyId, applicantId]);

  useEffect(() => {
    if (!effectiveAgencyId || !applicantId) {
      setViewings([]);
      return;
    }
    setLoadingViewings(true);
    fetch(
      `/api/admin/viewings?agencyId=${encodeURIComponent(effectiveAgencyId)}&applicantId=${encodeURIComponent(applicantId)}&limit=50`,
      { credentials: "include" }
    )
      .then((res) => (res.ok ? res.json() : []))
      .then((data: ViewingRow[]) => setViewings(Array.isArray(data) ? data : []))
      .catch(() => setViewings([]))
      .finally(() => setLoadingViewings(false));
  }, [effectiveAgencyId, applicantId]);

  useEffect(() => {
    if (!effectiveAgencyId || !applicantId) {
      setOffers([]);
      return;
    }
    setLoadingOffers(true);
    fetch(
      `/api/admin/offers?agencyId=${encodeURIComponent(effectiveAgencyId)}&applicantId=${encodeURIComponent(applicantId)}`,
      { credentials: "include" }
    )
      .then((res) => (res.ok ? res.json() : []))
      .then((data: OfferRow[]) => setOffers(Array.isArray(data) ? data : []))
      .catch(() => setOffers([]))
      .finally(() => setLoadingOffers(false));
  }, [effectiveAgencyId, applicantId]);

  useEffect(() => {
    if (!effectiveAgencyId || !applicantId) {
      setPipelineItems([]);
      return;
    }
    setLoadingPipeline(true);
    fetch(
      `/api/admin/application-pipeline?agencyId=${encodeURIComponent(effectiveAgencyId)}&applicantId=${encodeURIComponent(applicantId)}&limit=20`,
      { credentials: "include" }
    )
      .then((res) => (res.ok ? res.json() : []))
      .then((data: { id: string; propertyDisplayLabel?: string; stage?: string }[]) =>
        setPipelineItems(
          Array.isArray(data)
            ? data.map((r) => ({
                id: r.id,
                propertyDisplayLabel: r.propertyDisplayLabel ?? "",
                stage: r.stage ?? "",
              }))
            : []
        )
      )
      .catch(() => setPipelineItems([]))
      .finally(() => setLoadingPipeline(false));
  }, [effectiveAgencyId, applicantId]);

  useEffect(() => {
    if (!effectiveAgencyId || !applicantId) {
      setPropertyMatches([]);
      return;
    }
    setLoadingMatches(true);
    const params = new URLSearchParams();
    params.set("agencyId", effectiveAgencyId);
    params.set("limit", "20");
    fetch(`/api/admin/applicants/${encodeURIComponent(applicantId)}/matches?${params.toString()}`, { credentials: "include" })
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setPropertyMatches(Array.isArray(data) ? data : []))
      .catch(() => setPropertyMatches([]))
      .finally(() => setLoadingMatches(false));
  }, [effectiveAgencyId, applicantId]);

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(t);
    }
  }, [toast]);

  useEffect(() => {
    if (bookViewingOpen && effectiveAgencyId) {
      const url = `/api/admin/properties?agencyId=${encodeURIComponent(effectiveAgencyId)}`;
      fetch(url, { credentials: "include" })
        .then((res) => (res.ok ? res.json() : []))
        .then((data: { id: string; agencyId?: string; displayAddress?: string }[]) =>
          setProperties(
            Array.isArray(data)
              ? data.map((p) => ({
                  id: p.id,
                  agencyId: p.agencyId ?? effectiveAgencyId,
                  displayAddress: p.displayAddress ?? p.id,
                }))
              : []
          )
        )
        .catch(() => setProperties([]));
    }
    if (bookViewingOpen && applicant?.propertyRef) {
      setBookViewingForm((prev) => (prev.propertyId ? prev : { ...prev, propertyId: applicant.propertyRef ?? "" }));
    }
  }, [bookViewingOpen, effectiveAgencyId, applicant?.id, applicant?.propertyRef]);

  const refetchViewings = useCallback(() => {
    if (!effectiveAgencyId || !applicantId) return;
    fetch(
      `/api/admin/viewings?agencyId=${encodeURIComponent(effectiveAgencyId)}&applicantId=${encodeURIComponent(applicantId)}&limit=50`,
      { credentials: "include" }
    )
      .then((res) => (res.ok ? res.json() : []))
      .then((data: ViewingRow[]) => setViewings(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, [effectiveAgencyId, applicantId]);

  const refetchOffers = useCallback(() => {
    if (!effectiveAgencyId || !applicantId) return;
    fetch(
      `/api/admin/offers?agencyId=${encodeURIComponent(effectiveAgencyId)}&applicantId=${encodeURIComponent(applicantId)}`,
      { credentials: "include" }
    )
      .then((res) => (res.ok ? res.json() : []))
      .then((data: OfferRow[]) => setOffers(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, [effectiveAgencyId, applicantId]);

  const handleBookViewingSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!effectiveAgencyId || !applicantId || !applicant) return;
      const propertyId = bookViewingForm.propertyId.trim();
      const scheduledAt = bookViewingForm.scheduledAt.trim();
      if (!propertyId || !scheduledAt) {
        setToast("Property and date & time required");
        return;
      }
      setBookViewingSubmitting(true);
      fetch("/api/admin/viewings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          agencyId: effectiveAgencyId,
          propertyId,
          applicantId,
          applicantName: applicant.fullName,
          applicantEmail: applicant.email,
          applicantPhone: applicant.phone ?? undefined,
          scheduledAt: new Date(scheduledAt).getTime(),
          notes: bookViewingForm.notes.trim() || undefined,
        }),
      })
        .then((res) => {
          if (res.ok) {
            refetchViewings();
            setBookViewingOpen(false);
            setBookViewingForm({ propertyId: "", scheduledAt: "", notes: "" });
            setToast("Viewing booked");
          } else {
            res.json().then((d: { error?: string }) => setToast(d?.error ?? "Failed to book"));
          }
        })
        .catch(() => setToast("Failed to book"))
        .finally(() => setBookViewingSubmitting(false));
    },
    [effectiveAgencyId, applicantId, applicant, bookViewingForm, refetchViewings]
  );

  const handleEditSave = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!db || !effectiveAgencyId || !applicant) return;
      setSubmitting(true);
      try {
        const ref = doc(db, applicationsCol(effectiveAgencyId), applicant.id);
        const phone = (editForm.phone ?? applicant.phone)?.trim() || null;
        const propertyRef =
          (editForm.propertyRef ?? applicant.propertyRef)?.trim() || null;
        const notes = (editForm.notes ?? applicant.notes)?.trim() || null;
        const prefs = editForm.preferences ?? applicant.preferences;
        const preferencesPayload = prefs
          ? {
              lookingFor: prefs.lookingFor ?? null,
              budgetMin: prefs.budgetMin ?? null,
              budgetMax: prefs.budgetMax ?? null,
              minBedrooms: prefs.minBedrooms ?? null,
              maxBedrooms: prefs.maxBedrooms ?? null,
              preferredAreas: Array.isArray(prefs.preferredAreas) ? prefs.preferredAreas : [],
              propertyTypes: Array.isArray(prefs.propertyTypes) ? prefs.propertyTypes : [],
              hasPets: prefs.hasPets ?? null,
              needsParking: prefs.needsParking ?? null,
              moveInWindow: prefs.moveInWindow ?? null,
              notes: prefs.notes ?? null,
            }
          : undefined;
        await updateDoc(ref, {
          fullName: (editForm.fullName ?? applicant.fullName).trim(),
          email: (editForm.email ?? applicant.email).trim(),
          phone,
          propertyRef,
          status: editForm.status ?? applicant.status,
          notes,
          ...(preferencesPayload && { preferences: preferencesPayload }),
          updatedAt: serverTimestamp(),
        });
        setApplicant((prev) =>
          prev ? { ...prev, ...editForm, updatedAt: null } : null
        );
        setEditing(false);
      } finally {
        setSubmitting(false);
      }
    },
    [db, effectiveAgencyId, applicant, editForm]
  );

  if (!effectiveAgencyId && !isSuperAdmin) {
    return (
      <>
        <PageHeader title="Applicant" />
        <EmptyState title="No agency" description="Your account is not linked to an agency." />
      </>
    );
  }

  if (isSuperAdmin && !effectiveAgencyId) {
    return (
      <>
        <PageHeader title="Applicant" subtitle="Review applicant details and move them through the pipeline." />
        <EmptyState
          title="Select an agency from the header to view this page."
          description="Use the agency dropdown in the top bar."
        />
      </>
    );
  }

  const query = effectiveAgencyId ? `?agencyId=${encodeURIComponent(effectiveAgencyId)}` : "";

  if (loading) {
    return (
      <>
        <PageHeader title="Applicant" />
        <p className="text-sm text-zinc-500">Loading…</p>
      </>
    );
  }

  if (notFound || !applicant) {
    return (
      <>
        <PageHeader title="Applicant" />
        <p className="text-sm text-zinc-500">Applicant not found.</p>
        <HistoryBackLink
          href="/admin/applicants"
          className="mt-2 inline-block text-sm font-medium text-zinc-600 hover:underline"
        >
          ← Back to applicants
        </HistoryBackLink>
      </>
    );
  }

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
      <PageHeader
        title={applicant.fullName}
        action={
          <div className="flex gap-2">
            {editing ? (
              <>
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  form="applicant-edit-form"
                  disabled={submitting}
                  className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
                >
                  {submitting ? "Saving…" : "Save"}
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
              >
                Edit
              </button>
            )}
            <HistoryBackLink
              href="/admin/applicants"
              className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
            >
              ← Back
            </HistoryBackLink>
          </div>
        }
      />

      {!editing && applicant && (
        <>
          <AdminNextActionCard
            action={getNextAction({
              enquiry: false,
              viewing: viewings.length > 0,
              viewingCompleted: viewings.some((v) => v.status === "completed"),
              pipelineStage: getFurthestPipelineStage(pipelineItems.map((p) => p.stage)),
              offer: offers.length > 0,
              offerAccepted: offers.some((o) => o.status === "accepted"),
              tenancy: false,
            })}
          />
          <AdminProgressJourney
            currentStage={getJourneyStageFromData({
              hasViewing: viewings.length > 0,
              hasPipelineEntry: pipelineItems.length > 0,
              hasOffer: offers.length > 0,
              hasAcceptedOffer: offers.some((o) => o.status === "accepted"),
              hasTenancy: false,
            })}
            className="mb-6"
          />
        </>
      )}

      {!editing && (
        <Card className="p-6 mb-6">
          <h2 className="text-base font-medium text-zinc-900 mb-0.5">Recommended properties</h2>
          <p className="text-xs text-zinc-500 mb-3">
            Rule-based matches using the applicant&apos;s preferences (budget, bedrooms, areas, type).
          </p>
          {loadingMatches ? (
            <p className="text-sm text-zinc-500">Loading…</p>
          ) : propertyMatches.filter((m) => m.matched).length === 0 ? (
            <p className="text-sm text-zinc-500">
              No strong property matches yet. Add preferences in edit mode to improve recommendations.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200">
                    <th className="text-left py-2 pr-4 font-medium text-zinc-700">Property</th>
                    <th className="text-left py-2 pr-4 font-medium text-zinc-700">Score</th>
                    <th className="text-left py-2 pr-4 font-medium text-zinc-700">Reasons</th>
                    <th className="text-left py-2 pr-4 font-medium text-zinc-700">Warnings</th>
                    <th className="text-left py-2 font-medium text-zinc-700">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {propertyMatches
                    .filter((m) => m.matched)
                    .slice(0, 10)
                    .map((m) => (
                      <tr key={m.propertyId} className="border-b border-zinc-100 align-top">
                        <td className="py-2 pr-4 text-zinc-900">
                        <Link
                          href={`/admin/properties/${m.propertyId}${query}`}
                          className="text-zinc-700 hover:underline"
                        >
                            {m.propertyDisplayLabel || `Property ${m.propertyId}`}
                          </Link>
                          <span className="block text-xs text-zinc-500">
                            {typeof m.bedrooms === "number" ? `${m.bedrooms} bed` : "—"} · {m.type || "—"}
                            {typeof m.rentPcm === "number" ? ` · £${m.rentPcm.toLocaleString()} pcm` : ""}
                          </span>
                        </td>
                        <td className="py-2 pr-4">
                          <AdminMatchScoreBadge score={m.score} />
                        </td>
                        <td className="py-2 pr-4 text-zinc-600">
                          {(m.reasons ?? []).slice(0, 3).join(" · ") || "—"}
                        </td>
                        <td className="py-2 pr-4 text-zinc-600">
                          {(m.warnings ?? []).length > 0 ? (
                            <span className="text-amber-800">
                              ⚠ {m.warnings.slice(0, 2).join(" · ")}
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="py-2">
                          <div className="flex flex-wrap gap-2">
                            <Link
                              href={`/admin/properties/${m.propertyId}${query}`}
                              className="text-zinc-600 hover:underline text-xs"
                            >
                              View property
                            </Link>
                            <button
                              type="button"
                              onClick={() => {
                                setBookViewingForm((prev) => ({ ...prev, propertyId: m.propertyId }));
                                setBookViewingOpen(true);
                              }}
                              className="text-zinc-600 hover:underline text-xs"
                            >
                              Book viewing
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {!editing && (
        <Card className="p-6">
          <dl className="grid gap-2 sm:grid-cols-2">
            <dt className="text-sm text-zinc-500">Full name</dt>
            <dd className="font-medium text-zinc-900">{applicant.fullName}</dd>
            <dt className="text-sm text-zinc-500">Email</dt>
            <dd>{applicant.email}</dd>
            <dt className="text-sm text-zinc-500">Phone</dt>
            <dd>{applicant.phone || "—"}</dd>
            <dt className="text-sm text-zinc-500">Property ref</dt>
            <dd>{applicant.propertyRef || "—"}</dd>
            <dt className="text-sm text-zinc-500">Status</dt>
            <dd>{applicant.status}</dd>
            <dt className="text-sm text-zinc-500">Notes</dt>
            <dd className="sm:col-span-2">
              {applicant.notes || "—"}
            </dd>
            <dt className="text-sm text-zinc-500">Created</dt>
            <dd>{formatApplicantDate(applicant.createdAt)}</dd>
            <dt className="text-sm text-zinc-500">Updated</dt>
            <dd>{formatApplicantDate(applicant.updatedAt)}</dd>
          </dl>
        </Card>
      )}

      {!editing && (
        <Card className="p-6 mt-6">
          <h2 className="text-base font-medium text-zinc-900 mb-0.5 flex items-center justify-between gap-2">
            <span>Viewings</span>
            <button
              type="button"
              onClick={() => setBookViewingOpen(true)}
              className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800"
            >
              Book viewing
            </button>
          </h2>
          <p className="text-xs text-zinc-500 mb-3">Viewing history for this applicant. Book viewings or send proceed prompts from completed viewings.</p>
          {loadingViewings ? (
            <p className="text-sm text-zinc-500">Loading…</p>
          ) : viewings.length === 0 ? (
            <div className="space-y-2">
              <p className="text-sm text-zinc-500">No viewings linked to this applicant.</p>
              <button
                type="button"
                onClick={() => setBookViewingOpen(true)}
                className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
              >
                Book viewing
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200">
                    <th className="text-left py-2 pr-4 font-medium text-zinc-700">Property</th>
                    <th className="text-left py-2 pr-4 font-medium text-zinc-700">Date / time</th>
                    <th className="text-left py-2 pr-4 font-medium text-zinc-700">Status</th>
                    <th className="text-left py-2 pr-4 font-medium text-zinc-700">Source</th>
                    <th className="text-left py-2 pr-4 font-medium text-zinc-700">Notes</th>
                    <th className="text-left py-2 font-medium text-zinc-700">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {viewings.map((v) => {
                    const isCompleted = v.status === "completed";
                    const sendingProceed = proceedPromptViewingId === v.id;
                    const creatingApp = createAppViewingId === v.id;
                    return (
                      <tr key={v.id} className="border-b border-zinc-100">
                        <td className="py-2 pr-4 text-zinc-900">
                          <Link
                            href={`/admin/properties/${v.propertyId}?agencyId=${encodeURIComponent(v.agencyId)}`}
                            className="text-zinc-700 hover:underline"
                          >
                            {v.propertyDisplayLabel ?? propertyDisplayLabel(null, v.propertyId)}
                          </Link>
                        </td>
                        <td className="py-2 pr-4 text-zinc-600">
                          {formatAdminDate(v.scheduledAt, "dateTime")}
                        </td>
                        <td className="py-2 pr-4">
                          <AdminStatusBadge variant={getStatusBadgeVariant(v.status, "viewing")}>
                            {VIEWING_STATUS_LABELS[v.status] ?? v.status}
                          </AdminStatusBadge>
                        </td>
                        <td className="py-2 pr-4 text-zinc-600">
                          {VIEWING_SOURCE_LABELS[v.source as keyof typeof VIEWING_SOURCE_LABELS] ?? v.source}
                        </td>
                        <td className="py-2 pr-4 text-zinc-600 max-w-[200px] truncate" title={v.notes ?? undefined}>
                          {v.notes ? `${v.notes.slice(0, 40)}${v.notes.length > 40 ? "…" : ""}` : "—"}
                        </td>
                        <td className="py-2">
                          {isCompleted && (
                            <div className="flex flex-wrap gap-1 items-center">
                              {v.applicantUserId ? (
                                <button
                                  type="button"
                                  disabled={sendingProceed}
                                  onClick={() => {
                                    setProceedPromptViewingId(v.id);
                                    fetch(`/api/admin/viewings/${v.id}/send-proceed-prompt`, {
                                      method: "POST",
                                      headers: { "Content-Type": "application/json" },
                                      credentials: "include",
                                      body: JSON.stringify({ agencyId: effectiveAgencyId }),
                                    })
                                      .then((res) => {
                                        if (res.ok) setToast("Proceed prompt sent");
                                        else res.json().then((d: { error?: string }) => setToast(d?.error ?? "Failed"));
                                      })
                                      .catch(() => setToast("Failed"))
                                      .finally(() => setProceedPromptViewingId(null));
                                  }}
                                  className="rounded border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-50"
                                >
                                  {sendingProceed ? "Sending…" : "Send proceed prompt"}
                                </button>
                              ) : (
                                <span
                                  className="rounded border border-zinc-200 px-2 py-1 text-xs text-zinc-500 bg-zinc-50 cursor-not-allowed"
                                  title="Proceed prompt is only available for applicants with a portal account."
                                >
                                  Send proceed prompt
                                </span>
                              )}
                              <button
                                type="button"
                                disabled={creatingApp}
                                onClick={() => {
                                  setCreateAppViewingId(v.id);
                                  fetch(`/api/admin/viewings/${v.id}/create-application`, {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    credentials: "include",
                                    body: JSON.stringify({ agencyId: effectiveAgencyId }),
                                  })
                                    .then(async (res) => {
                                      const data = await res.json().catch(() => ({}));
                                      if (res.ok && data.applicantId) {
                                        setToast(data.linked ? "Linked to existing applicant" : "Application created");
                                        refetchViewings();
                                      } else setToast(data?.error ?? "Failed");
                                    })
                                    .catch(() => setToast("Failed"))
                                    .finally(() => setCreateAppViewingId(null));
                                }}
                                className="rounded border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-50"
                              >
                                {creatingApp ? "Creating…" : "Create application"}
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {!editing && (pipelineItems.length > 0 || loadingPipeline) && (
        <Card className="p-6 mt-6">
          <h2 className="text-base font-medium text-zinc-900 mb-0.5 flex items-center justify-between gap-2">
            <span>Application pipeline</span>
            <Link
              href={`/admin/application-pipeline${query}${query ? "&" : "?"}applicantId=${encodeURIComponent(applicantId ?? "")}`}
              className="text-sm font-medium text-zinc-600 hover:text-zinc-900"
            >
              View all →
            </Link>
          </h2>
          <p className="text-xs text-zinc-500 mb-3">Applicant progress from prompt or application through to offer and completion.</p>
          {loadingPipeline ? (
            <p className="text-sm text-zinc-500">Loading…</p>
          ) : pipelineItems.length === 0 ? null : (
            <ul className="text-sm text-zinc-700 space-y-1">
              {pipelineItems.slice(0, 5).map((p) => (
                <li key={p.id}>
                  {p.propertyDisplayLabel} — {p.stage}
                </li>
              ))}
              {pipelineItems.length > 5 && (
                <li>
                  <Link
                    href={`/admin/application-pipeline${query}${query ? "&" : "?"}applicantId=${encodeURIComponent(applicantId ?? "")}`}
                    className="text-zinc-600 hover:underline"
                  >
                    +{pipelineItems.length - 5} more…
                  </Link>
                </li>
              )}
            </ul>
          )}
        </Card>
      )}

      {!editing && (
        <Card className="p-6 mt-6">
          <h2 className="text-base font-medium text-zinc-900 mb-0.5 flex items-center justify-between gap-2">
            <span>Offers</span>
            <button
              type="button"
              onClick={() => setCreateOfferOpen(true)}
              className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800"
            >
              Create offer
            </button>
          </h2>
          <p className="text-xs text-zinc-500 mb-3">Offers linked to this applicant. Create offers from here or from the property.</p>
          {loadingOffers ? (
            <p className="text-sm text-zinc-500">Loading…</p>
          ) : offers.length === 0 ? (
            <p className="text-sm text-zinc-500">No offers linked to this applicant.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200">
                    <th className="text-left py-2 pr-4 font-medium text-zinc-700">Property</th>
                    <th className="text-left py-2 pr-4 font-medium text-zinc-700">Amount</th>
                    <th className="text-left py-2 pr-4 font-medium text-zinc-700">Status</th>
                    <th className="text-left py-2 font-medium text-zinc-700">Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {offers.map((o) => (
                    <tr key={o.id} className="border-b border-zinc-100">
                      <td className="py-2 pr-4 text-zinc-900">
                        <Link
                          href={`/admin/properties/${o.propertyId}?agencyId=${encodeURIComponent(o.agencyId)}`}
                          className="text-zinc-700 hover:underline"
                        >
                          {o.propertyDisplayLabel || o.propertyId}
                        </Link>
                      </td>
                      <td className="py-2 pr-4 text-zinc-900">£{typeof o.amount === "number" ? o.amount.toLocaleString() : "0"}</td>
                      <td className="py-2 pr-4">
                        <AdminStatusBadge variant={getStatusBadgeVariant(o.status, "offer")}>
                          {OFFER_STATUS_LABELS[o.status] ?? o.status}
                        </AdminStatusBadge>
                      </td>
                      <td className="py-2 text-zinc-600">
                        {o.updatedAt ? formatAdminDate(new Date(o.updatedAt).getTime(), "date") : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {createOfferOpen && applicant && effectiveAgencyId && (
        <AdminCreateOfferModal
          open={createOfferOpen}
          onClose={() => setCreateOfferOpen(false)}
          agencyId={effectiveAgencyId}
          initialApplicant={{
            applicantId: applicant.id,
            applicantName: applicant.fullName,
            applicantEmail: applicant.email,
          }}
          onSuccess={() => {
            setToast("Offer created");
            refetchOffers();
            setCreateOfferOpen(false);
          }}
        />
      )}

      {bookViewingOpen && applicant && (
        <div
          className="fixed inset-0 z-10 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="applicant-book-viewing-title"
        >
          <Card className="w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h2 id="applicant-book-viewing-title" className="text-lg font-semibold text-zinc-900">
              Book viewing — {applicant.fullName}
            </h2>
            <form onSubmit={handleBookViewingSubmit} className="mt-4 space-y-4">
              <div>
                <label htmlFor="applicant-book-property" className="block text-sm font-medium text-zinc-700">
                  Property *
                </label>
                <select
                  id="applicant-book-property"
                  required
                  value={bookViewingForm.propertyId}
                  onChange={(e) => setBookViewingForm((prev) => ({ ...prev, propertyId: e.target.value }))}
                  className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900"
                >
                  <option value="">Select property…</option>
                  {properties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.displayAddress || p.id}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="applicant-book-datetime" className="block text-sm font-medium text-zinc-700">
                  Date & time *
                </label>
                <input
                  id="applicant-book-datetime"
                  type="datetime-local"
                  required
                  value={bookViewingForm.scheduledAt}
                  onChange={(e) => setBookViewingForm((prev) => ({ ...prev, scheduledAt: e.target.value }))}
                  className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900"
                />
              </div>
              <div>
                <label htmlFor="applicant-book-notes" className="block text-sm font-medium text-zinc-700">
                  Notes (optional)
                </label>
                <textarea
                  id="applicant-book-notes"
                  rows={2}
                  value={bookViewingForm.notes}
                  onChange={(e) => setBookViewingForm((prev) => ({ ...prev, notes: e.target.value }))}
                  className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900"
                />
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setBookViewingOpen(false)}
                  className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={bookViewingSubmitting}
                  className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
                >
                  {bookViewingSubmitting ? "Booking…" : "Book viewing"}
                </button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {editing && (
        <Card className="p-6">
          <form
            id="applicant-edit-form"
            onSubmit={handleEditSave}
            className="space-y-4"
          >
            <div>
              <label
                htmlFor="edit-fullName"
                className="block text-sm font-medium text-zinc-700"
              >
                Full name *
              </label>
              <input
                id="edit-fullName"
                type="text"
                value={editForm.fullName ?? ""}
                onChange={(e) =>
                  setEditForm((prev) => ({ ...prev, fullName: e.target.value }))
                }
                required
                className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900"
              />
            </div>
            <div>
              <label
                htmlFor="edit-email"
                className="block text-sm font-medium text-zinc-700"
              >
                Email *
              </label>
              <input
                id="edit-email"
                type="email"
                value={editForm.email ?? ""}
                onChange={(e) =>
                  setEditForm((prev) => ({ ...prev, email: e.target.value }))
                }
                required
                className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900"
              />
            </div>
            <div>
              <label
                htmlFor="edit-phone"
                className="block text-sm font-medium text-zinc-700"
              >
                Phone (optional)
              </label>
              <input
                id="edit-phone"
                type="tel"
                value={editForm.phone ?? ""}
                onChange={(e) =>
                  setEditForm((prev) => ({
                    ...prev,
                    phone: e.target.value || null,
                  }))
                }
                className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900"
              />
            </div>
            <div>
              <label
                htmlFor="edit-propertyRef"
                className="block text-sm font-medium text-zinc-700"
              >
                Property ref (optional)
              </label>
              <input
                id="edit-propertyRef"
                type="text"
                value={editForm.propertyRef ?? ""}
                onChange={(e) =>
                  setEditForm((prev) => ({
                    ...prev,
                    propertyRef: e.target.value || null,
                  }))
                }
                className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900"
              />
            </div>
            <div>
              <label
                htmlFor="edit-status"
                className="block text-sm font-medium text-zinc-700"
              >
                Status
              </label>
              <select
                id="edit-status"
                value={editForm.status ?? ""}
                onChange={(e) =>
                  setEditForm((prev) => ({
                    ...prev,
                    status: e.target.value as ApplicantStatus,
                  }))
                }
                className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900"
              >
                {APPLICANT_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor="edit-notes"
                className="block text-sm font-medium text-zinc-700"
              >
                Notes (optional)
              </label>
              <textarea
                id="edit-notes"
                rows={3}
                value={editForm.notes ?? ""}
                onChange={(e) =>
                  setEditForm((prev) => ({
                    ...prev,
                    notes: e.target.value || null,
                  }))
                }
                className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900"
              />
            </div>

            <div className="border-t border-zinc-200 pt-4 mt-6">
              <h3 className="text-sm font-semibold text-zinc-900 mb-3">Property preferences (for matching)</h3>
              <p className="text-xs text-zinc-500 mb-3">Used to recommend properties. Leave blank if not set.</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="edit-lookingFor" className="block text-sm font-medium text-zinc-700">Looking for</label>
                  <select
                    id="edit-lookingFor"
                    value={editForm.preferences?.lookingFor ?? ""}
                    onChange={(e) =>
                      setEditForm((prev) => ({
                        ...prev,
                        preferences: {
                          ...(prev.preferences ?? applicant.preferences),
                          lookingFor: (e.target.value || null) as ApplicantPreferences["lookingFor"],
                        },
                      }))
                    }
                    className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900"
                  >
                    <option value="">Not set</option>
                    {LOOKING_FOR_OPTIONS.map((o) => (
                      <option key={o} value={o}>{o}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="edit-budgetMin" className="block text-sm font-medium text-zinc-700">Budget min (pcm)</label>
                  <input
                    id="edit-budgetMin"
                    type="number"
                    min={0}
                    step={50}
                    value={editForm.preferences?.budgetMin ?? ""}
                    onChange={(e) =>
                      setEditForm((prev) => ({
                        ...prev,
                        preferences: {
                          ...(prev.preferences ?? applicant.preferences),
                          budgetMin: e.target.value === "" ? null : parseInt(e.target.value, 10) || null,
                        },
                      }))
                    }
                    className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900"
                  />
                </div>
                <div>
                  <label htmlFor="edit-budgetMax" className="block text-sm font-medium text-zinc-700">Budget max (pcm)</label>
                  <input
                    id="edit-budgetMax"
                    type="number"
                    min={0}
                    step={50}
                    value={editForm.preferences?.budgetMax ?? ""}
                    onChange={(e) =>
                      setEditForm((prev) => ({
                        ...prev,
                        preferences: {
                          ...(prev.preferences ?? applicant.preferences),
                          budgetMax: e.target.value === "" ? null : parseInt(e.target.value, 10) || null,
                        },
                      }))
                    }
                    className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900"
                  />
                </div>
                <div>
                  <label htmlFor="edit-minBedrooms" className="block text-sm font-medium text-zinc-700">Min bedrooms</label>
                  <input
                    id="edit-minBedrooms"
                    type="number"
                    min={0}
                    max={20}
                    value={editForm.preferences?.minBedrooms ?? ""}
                    onChange={(e) =>
                      setEditForm((prev) => ({
                        ...prev,
                        preferences: {
                          ...(prev.preferences ?? applicant.preferences),
                          minBedrooms: e.target.value === "" ? null : parseInt(e.target.value, 10) || null,
                        },
                      }))
                    }
                    className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900"
                  />
                </div>
                <div>
                  <label htmlFor="edit-maxBedrooms" className="block text-sm font-medium text-zinc-700">Max bedrooms</label>
                  <input
                    id="edit-maxBedrooms"
                    type="number"
                    min={0}
                    max={20}
                    value={editForm.preferences?.maxBedrooms ?? ""}
                    onChange={(e) =>
                      setEditForm((prev) => ({
                        ...prev,
                        preferences: {
                          ...(prev.preferences ?? applicant.preferences),
                          maxBedrooms: e.target.value === "" ? null : parseInt(e.target.value, 10) || null,
                        },
                      }))
                    }
                    className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="edit-preferredAreas" className="block text-sm font-medium text-zinc-700">Preferred areas</label>
                  <input
                    id="edit-preferredAreas"
                    type="text"
                    placeholder="e.g. Ipswich, Colchester"
                    value={(editForm.preferences?.preferredAreas ?? []).join(", ")}
                    onChange={(e) =>
                      setEditForm((prev) => ({
                        ...prev,
                        preferences: {
                          ...(prev.preferences ?? applicant.preferences),
                          preferredAreas: e.target.value
                            .split(",")
                            .map((s) => s.trim())
                            .filter(Boolean),
                        },
                      }))
                    }
                    className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900"
                  />
                </div>
                <div className="sm:col-span-2">
                  <span className="block text-sm font-medium text-zinc-700 mb-1">Property types</span>
                  <div className="flex flex-wrap gap-3">
                    {PREFERRED_PROPERTY_TYPES.map((t) => {
                      const selected = (editForm.preferences?.propertyTypes ?? []).includes(t);
                      return (
                        <label key={t} className="inline-flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() =>
                              setEditForm((prev) => {
                                const current = prev.preferences ?? applicant.preferences;
                                const arr = current.propertyTypes ?? [];
                                const next = arr.includes(t) ? arr.filter((x) => x !== t) : [...arr, t];
                                return {
                                  ...prev,
                                  preferences: { ...current, propertyTypes: next },
                                };
                              })
                            }
                            className="rounded border-zinc-300"
                          />
                          <span className="text-sm text-zinc-700">{t}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <label htmlFor="edit-hasPets" className="block text-sm font-medium text-zinc-700">Has pets</label>
                  <select
                    id="edit-hasPets"
                    value={editForm.preferences?.hasPets === true ? "yes" : editForm.preferences?.hasPets === false ? "no" : ""}
                    onChange={(e) =>
                      setEditForm((prev) => ({
                        ...prev,
                        preferences: {
                          ...(prev.preferences ?? applicant.preferences),
                          hasPets: e.target.value === "" ? null : e.target.value === "yes",
                        },
                      }))
                    }
                    className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900"
                  >
                    <option value="">Not set</option>
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="edit-needsParking" className="block text-sm font-medium text-zinc-700">Needs parking</label>
                  <select
                    id="edit-needsParking"
                    value={editForm.preferences?.needsParking === true ? "yes" : editForm.preferences?.needsParking === false ? "no" : ""}
                    onChange={(e) =>
                      setEditForm((prev) => ({
                        ...prev,
                        preferences: {
                          ...(prev.preferences ?? applicant.preferences),
                          needsParking: e.target.value === "" ? null : e.target.value === "yes",
                        },
                      }))
                    }
                    className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900"
                  >
                    <option value="">Not set</option>
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="edit-moveInWindow" className="block text-sm font-medium text-zinc-700">Move-in window</label>
                  <input
                    id="edit-moveInWindow"
                    type="text"
                    placeholder="e.g. March 2025"
                    value={editForm.preferences?.moveInWindow ?? ""}
                    onChange={(e) =>
                      setEditForm((prev) => ({
                        ...prev,
                        preferences: {
                          ...(prev.preferences ?? applicant.preferences),
                          moveInWindow: e.target.value.trim() || null,
                        },
                      }))
                    }
                    className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="edit-prefNotes" className="block text-sm font-medium text-zinc-700">Preference notes</label>
                  <textarea
                    id="edit-prefNotes"
                    rows={2}
                    value={editForm.preferences?.notes ?? ""}
                    onChange={(e) =>
                      setEditForm((prev) => ({
                        ...prev,
                        preferences: {
                          ...(prev.preferences ?? applicant.preferences),
                          notes: e.target.value.trim() || null,
                        },
                      }))
                    }
                    className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900"
                  />
                </div>
              </div>
            </div>
          </form>
        </Card>
      )}
    </>
  );
}
