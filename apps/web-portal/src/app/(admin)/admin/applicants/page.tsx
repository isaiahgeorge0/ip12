"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  addDoc,
  collection,
  orderBy,
  query,
  serverTimestamp,
  onSnapshot,
} from "firebase/firestore";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { useAuth } from "@/contexts/AuthContext";
import { getFirebaseFirestore } from "@/lib/firebase/client";
import { ENQUIRY_STATUS_LABELS, type EnquiryStatus } from "@/lib/types/enquiry";
import { applicationsCol } from "@/lib/firestore/paths";
import { formatAdminDate } from "@/lib/admin/formatAdminDate";

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
  createdAt: unknown;
  updatedAt: unknown;
  createdByUid: string;
};

function formatApplicantDate(v: unknown): string {
  return formatAdminDate(
    v as unknown as number | string | { seconds?: number; toDate?: () => Date } | null | undefined,
    "date"
  );
}

function StatusChip({ status }: { status: string }) {
  const styles: Record<string, string> = {
    New: "bg-amber-100 text-amber-800",
    Contacted: "bg-blue-100 text-blue-800",
    Viewing: "bg-sky-100 text-sky-800",
    Offered: "bg-violet-100 text-violet-800",
    Accepted: "bg-green-100 text-green-800",
    Rejected: "bg-zinc-100 text-zinc-600",
  };
  return (
    <span
      className={`rounded px-2 py-0.5 text-xs font-medium ${styles[status] ?? "bg-zinc-100 text-zinc-700"}`}
    >
      {status}
    </span>
  );
}

const APPLICANT_STATUSES: ApplicantStatus[] = [
  "New",
  "Contacted",
  "Viewing",
  "Offered",
  "Accepted",
  "Rejected",
];

function ConvertEnquiryButton({
  enquiryId,
  agencyId,
  onSuccess,
  onError,
}: {
  enquiryId: string | null;
  agencyId: string;
  onSuccess: () => void;
  onError: (msg: string) => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  if (!enquiryId) return <span className="text-zinc-400">—</span>;
  return (
    <button
      type="button"
      disabled={submitting}
      onClick={() => {
        setSubmitting(true);
        fetch(`/api/admin/enquiries/${enquiryId}/convert`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ agencyId }),
        })
          .then(async (res) => {
            const data = await res.json().catch(() => ({}));
            if (res.ok && data.applicantId) {
              onSuccess();
            } else {
              onError(data?.error ?? "Convert failed");
            }
          })
          .catch(() => onError("Convert failed"))
          .finally(() => setSubmitting(false));
      }}
      className="rounded border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-50"
    >
      {submitting ? "Converting…" : "Convert to CRM"}
    </button>
  );
}

const defaultCreateForm = {
  fullName: "",
  email: "",
  phone: "",
  propertyRef: "",
  status: "New" as ApplicantStatus,
  notes: "",
};

export default function AdminApplicantsPage() {
  const { profile, user } = useAuth();
  const searchParams = useSearchParams();
  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [createForm, setCreateForm] = useState(defaultCreateForm);
  const [toast, setToast] = useState<string | null>(null);

  const agencyIdParam = searchParams?.get("agencyId")?.trim() ?? null;
  const isSuperAdmin = profile?.role === "superAdmin";
  const sessionAgencyId = profile?.agencyId ?? null;
  const effectiveAgencyId = isSuperAdmin ? agencyIdParam : sessionAgencyId;
  const pageSubtitle = "Track applicants and conversions from enquiries.";
  const db = getFirebaseFirestore();

  type EnquiryRow = {
    id: string;
    propertyId: string;
    propertyDisplayLabel?: string;
    agencyId: string;
    applicantName: string;
    applicantEmail: string;
    applicantPhone?: string | null;
    message: string;
    moveInDate?: string | null;
    status: EnquiryStatus;
    internalNotes?: string | null;
    createdAt: unknown;
  };
  const [enquiries, setEnquiries] = useState<EnquiryRow[]>([]);
  const [loadingEnquiries, setLoadingEnquiries] = useState(false);

  type ApplicantFromEnquiry = {
    userId: string;
    fullName: string;
    email: string;
    phone: string | null;
    lastEnquiryAt: number | null;
    enquiryCount: number;
    latestEnquiryStatus: EnquiryStatus;
    latestEnquiryId: string | null;
    existingApplicantId: string | null;
    recentEnquiries: { enquiryId: string; propertyId: string; propertyDisplayLabel?: string; createdAt: number | null; status: EnquiryStatus }[];
  };
  const [applicantsFromEnquiries, setApplicantsFromEnquiries] = useState<ApplicantFromEnquiry[]>([]);
  const [loadingApplicantsList, setLoadingApplicantsList] = useState(false);

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(t);
    }
  }, [toast]);

  useEffect(() => {
    if (!db || !effectiveAgencyId) {
      setLoading(false);
      setApplicants([]);
      return;
    }
    const colRef = collection(db, applicationsCol(effectiveAgencyId));
    const q = query(colRef, orderBy("updatedAt", "desc"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: Applicant[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            fullName: data.fullName ?? "",
            email: data.email ?? "",
            phone: data.phone ?? null,
            propertyRef: data.propertyRef ?? null,
            status: (data.status as ApplicantStatus) ?? "New",
            notes: data.notes ?? null,
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
            createdByUid: data.createdByUid ?? "",
          };
        });
        setApplicants(list);
        setLoading(false);
      },
      () => {
        setApplicants([]);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [db, effectiveAgencyId]);

  useEffect(() => {
    if (!effectiveAgencyId) {
      setEnquiries([]);
      return;
    }
    setLoadingEnquiries(true);
    fetch(`/api/admin/enquiries?agencyId=${encodeURIComponent(effectiveAgencyId)}&limit=30`, {
      credentials: "include",
    })
      .then((res) => (res.ok ? res.json() : []))
      .then((data: EnquiryRow[]) => setEnquiries(Array.isArray(data) ? data : []))
      .catch(() => setEnquiries([]))
      .finally(() => setLoadingEnquiries(false));
  }, [effectiveAgencyId]);

  useEffect(() => {
    if (!effectiveAgencyId) {
      setApplicantsFromEnquiries([]);
      return;
    }
    setLoadingApplicantsList(true);
    fetch(`/api/admin/applicants-list?agencyId=${encodeURIComponent(effectiveAgencyId)}&limit=50`, {
      credentials: "include",
    })
      .then((res) => (res.ok ? res.json() : []))
      .then((data: ApplicantFromEnquiry[]) => setApplicantsFromEnquiries(Array.isArray(data) ? data : []))
      .catch(() => setApplicantsFromEnquiries([]))
      .finally(() => setLoadingApplicantsList(false));
  }, [effectiveAgencyId]);

  const handleCreateSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!db || !effectiveAgencyId || !user) return;
      if (!createForm.fullName.trim() || !createForm.email.trim()) return;
      setSubmitting(true);
      try {
        const colRef = collection(db, applicationsCol(effectiveAgencyId));
        await addDoc(colRef, {
          fullName: createForm.fullName.trim(),
          email: createForm.email.trim(),
          phone: createForm.phone.trim() || null,
          propertyRef: createForm.propertyRef.trim() || null,
          status: createForm.status,
          notes: createForm.notes.trim() || null,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          createdByUid: user.uid,
        });
        setCreateForm(defaultCreateForm);
        setCreateOpen(false);
        setToast("Applicant created");
      } finally {
        setSubmitting(false);
      }
    },
    [db, effectiveAgencyId, user, createForm]
  );

  if (!effectiveAgencyId && !isSuperAdmin) {
    return (
      <>
        <AdminPageHeader title="Applicants" subtitle={pageSubtitle} />
        <EmptyState
          title="No agency"
          description="Your account is not linked to an agency."
        />
      </>
    );
  }

  if (isSuperAdmin && !effectiveAgencyId) {
    return (
      <>
        <AdminPageHeader title="Applicants" subtitle={pageSubtitle} />
        <EmptyState
          title="Select an agency from the header to view applicants."
          description="Use the agency dropdown in the top bar."
        />
      </>
    );
  }

  const queryStr = effectiveAgencyId ? `?agencyId=${encodeURIComponent(effectiveAgencyId)}` : "";

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

      <AdminPageHeader
        title="Applicants"
        subtitle={pageSubtitle}
        primaryAction={
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
          >
            Create applicant
          </button>
        }
      />

      {loading && (
        <div className="text-sm text-zinc-500">Loading applicants…</div>
      )}

      {!loading && applicants.length === 0 && enquiries.length === 0 && applicantsFromEnquiries.length === 0 && (
        <EmptyState
          title="No applicants yet"
          description="Create an applicant or wait for enquiries from the public listings."
          action={
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
            >
              Create applicant
            </button>
          }
        />
      )}

      {!loading && (applicants.length > 0 || enquiries.length > 0 || applicantsFromEnquiries.length > 0) && (
        <>
          {applicantsFromEnquiries.length > 0 && (
            <Card className="mb-6 p-4">
              <h2 className="text-base font-medium text-zinc-900 mb-3">Applicants from enquiries</h2>
              {loadingApplicantsList ? (
                <p className="text-sm text-zinc-500">Loading…</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="border-b border-zinc-200">
                        <th className="text-left py-2 pr-4 font-medium text-zinc-700">Name</th>
                        <th className="text-left py-2 pr-4 font-medium text-zinc-700">Email</th>
                        <th className="text-left py-2 pr-4 font-medium text-zinc-700">Phone</th>
                        <th className="text-left py-2 pr-4 font-medium text-zinc-700">Enquiries</th>
                        <th className="text-left py-2 pr-4 font-medium text-zinc-700">Last enquiry</th>
                        <th className="text-left py-2 pr-4 font-medium text-zinc-700">Status</th>
                        <th className="text-left py-2 pr-4 font-medium text-zinc-700">Property / context</th>
                        <th className="text-left py-2 font-medium text-zinc-700">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {applicantsFromEnquiries.map((a) => (
                        <tr key={a.userId} className="border-b border-zinc-100">
                          <td className="py-2 pr-4 text-zinc-900">{a.fullName || "—"}</td>
                          <td className="py-2 pr-4 text-zinc-600">{a.email || "—"}</td>
                          <td className="py-2 pr-4 text-zinc-600">{a.phone || "—"}</td>
                          <td className="py-2 pr-4 text-zinc-600">{a.enquiryCount}</td>
                          <td className="py-2 pr-4 text-zinc-600">
                            {a.lastEnquiryAt
                              ? new Date(a.lastEnquiryAt).toLocaleString()
                              : "—"}
                          </td>
                          <td className="py-2 pr-4">
                            <span className="rounded px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-800">
                              {ENQUIRY_STATUS_LABELS[a.latestEnquiryStatus] ?? a.latestEnquiryStatus}
                            </span>
                          </td>
                          <td className="py-2 text-zinc-600">
                            {a.recentEnquiries.slice(0, 3).map((e) => (
                              <Link
                                key={e.enquiryId}
                                href={`/admin/properties/${e.propertyId}${queryStr}`}
                                className="block text-xs text-zinc-600 hover:underline"
                              >
                                {e.propertyDisplayLabel ?? `Property ${e.propertyId}`}
                              </Link>
                            ))}
                          </td>
                          <td className="py-2">
                            {a.existingApplicantId ? (
                              <Link
                                href={`/admin/applicants/${a.existingApplicantId}${queryStr}`}
                                className="text-xs font-medium text-zinc-700 hover:underline"
                              >
                                View applicant →
                              </Link>
                            ) : (
                              <ConvertEnquiryButton
                                enquiryId={a.latestEnquiryId}
                                agencyId={effectiveAgencyId!}
                                onSuccess={() => {
                                  setToast("Applicant created");
                                  setLoadingApplicantsList(true);
                                  fetch(`/api/admin/applicants-list?agencyId=${encodeURIComponent(effectiveAgencyId!)}&limit=50`, { credentials: "include" })
                                    .then((res) => (res.ok ? res.json() : []))
                                    .then((data: ApplicantFromEnquiry[]) => setApplicantsFromEnquiries(Array.isArray(data) ? data : []))
                                    .catch(() => {})
                                    .finally(() => setLoadingApplicantsList(false));
                                }}
                                onError={(msg) => setToast(msg)}
                              />
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          )}
          {enquiries.length > 0 && (
            <Card className="mb-6 p-4">
              <h2 className="text-base font-medium text-zinc-900 mb-3">Recent enquiries (from listings)</h2>
              {loadingEnquiries ? (
                <p className="text-sm text-zinc-500">Loading…</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="border-b border-zinc-200">
                        <th className="text-left py-2 pr-4 font-medium text-zinc-700">Name</th>
                        <th className="text-left py-2 pr-4 font-medium text-zinc-700">Email</th>
                        <th className="text-left py-2 pr-4 font-medium text-zinc-700">When</th>
                        <th className="text-left py-2 pr-4 font-medium text-zinc-700">Status</th>
                        <th className="text-left py-2 font-medium text-zinc-700">Message / Property</th>
                      </tr>
                    </thead>
                    <tbody>
                      {enquiries.slice(0, 15).map((e) => (
                        <tr key={e.id} className="border-b border-zinc-100">
                          <td className="py-2 pr-4 text-zinc-900">{e.applicantName || "—"}</td>
                          <td className="py-2 pr-4 text-zinc-600">{e.applicantEmail || "—"}</td>
                          <td className="py-2 pr-4 text-zinc-600">
                            {typeof e.createdAt === "number"
                              ? new Date(e.createdAt).toLocaleString()
                              : formatApplicantDate(e.createdAt)}
                          </td>
                          <td className="py-2 pr-4">
                            <span className="rounded px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-800">
                              {ENQUIRY_STATUS_LABELS[e.status as EnquiryStatus] ?? e.status}
                            </span>
                          </td>
                          <td className="py-2 text-zinc-600">
                            <span className="max-w-[200px] truncate block" title={e.message}>
                              {e.message || "—"}
                            </span>
                            <Link
                              href={`/admin/properties/${e.propertyId}?agencyId=${encodeURIComponent(e.agencyId)}`}
                              className="text-xs text-zinc-500 hover:underline mt-0.5 inline-block"
                            >
                              {e.propertyDisplayLabel ?? `Property ${e.propertyId}`} →
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          )}
          {applicants.length > 0 && (
            <>
              <h2 className="text-base font-medium text-zinc-900 mb-3">Applicants (CRM)</h2>
              <div className="space-y-2">
              {applicants.map((app) => (
            <Link key={app.id} href={`/admin/applicants/${app.id}`}>
              <Card className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between hover:border-zinc-400 transition-colors">
                <div>
                  <p className="font-medium text-zinc-900">{app.fullName}</p>
                  <p className="text-sm text-zinc-500">{app.email}</p>
                  {app.propertyRef && (
                    <p className="text-sm text-zinc-500">{app.propertyRef}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <StatusChip status={app.status} />
                  <span className="text-sm text-zinc-500">
                    {formatApplicantDate(app.updatedAt)}
                  </span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
            </>
          )}
        </>
      )}

      {createOpen && (
        <div
          className="fixed inset-0 z-10 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-applicant-title"
        >
          <Card className="w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h2
              id="create-applicant-title"
              className="text-lg font-semibold text-zinc-900"
            >
              Create applicant
            </h2>
            <form onSubmit={handleCreateSubmit} className="mt-4 space-y-4">
              <div>
                <label
                  htmlFor="app-fullName"
                  className="block text-sm font-medium text-zinc-700"
                >
                  Full name *
                </label>
                <input
                  id="app-fullName"
                  type="text"
                  value={createForm.fullName}
                  onChange={(e) =>
                    setCreateForm((prev) => ({
                      ...prev,
                      fullName: e.target.value,
                    }))
                  }
                  required
                  className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900"
                />
              </div>
              <div>
                <label
                  htmlFor="app-email"
                  className="block text-sm font-medium text-zinc-700"
                >
                  Email *
                </label>
                <input
                  id="app-email"
                  type="email"
                  value={createForm.email}
                  onChange={(e) =>
                    setCreateForm((prev) => ({ ...prev, email: e.target.value }))
                  }
                  required
                  className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900"
                />
              </div>
              <div>
                <label
                  htmlFor="app-phone"
                  className="block text-sm font-medium text-zinc-700"
                >
                  Phone (optional)
                </label>
                <input
                  id="app-phone"
                  type="tel"
                  value={createForm.phone}
                  onChange={(e) =>
                    setCreateForm((prev) => ({ ...prev, phone: e.target.value }))
                  }
                  className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900"
                />
              </div>
              <div>
                <label
                  htmlFor="app-propertyRef"
                  className="block text-sm font-medium text-zinc-700"
                >
                  Property ref (optional)
                </label>
                <input
                  id="app-propertyRef"
                  type="text"
                  value={createForm.propertyRef}
                  onChange={(e) =>
                    setCreateForm((prev) => ({
                      ...prev,
                      propertyRef: e.target.value,
                    }))
                  }
                  className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900"
                />
              </div>
              <div>
                <label
                  htmlFor="app-status"
                  className="block text-sm font-medium text-zinc-700"
                >
                  Status
                </label>
                <select
                  id="app-status"
                  value={createForm.status}
                  onChange={(e) =>
                    setCreateForm((prev) => ({
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
                  htmlFor="app-notes"
                  className="block text-sm font-medium text-zinc-700"
                >
                  Notes (optional)
                </label>
                <textarea
                  id="app-notes"
                  rows={3}
                  value={createForm.notes}
                  onChange={(e) =>
                    setCreateForm((prev) => ({ ...prev, notes: e.target.value }))
                  }
                  className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900"
                />
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setCreateOpen(false)}
                  className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
                >
                  {submitting ? "Creating…" : "Create"}
                </button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </>
  );
}
