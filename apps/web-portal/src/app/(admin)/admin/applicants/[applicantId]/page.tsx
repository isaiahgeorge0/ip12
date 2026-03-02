"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/Card";
import { useAuth } from "@/contexts/AuthContext";
import { getFirebaseFirestore } from "@/lib/firebase/client";
import { applicationsCol } from "@/lib/firestore/paths";

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
  if (v == null) return "—";
  const t = v as { seconds?: number; toDate?: () => Date };
  if (typeof t.toDate === "function") return t.toDate().toLocaleDateString();
  if (typeof t.seconds === "number") {
    return new Date(t.seconds * 1000).toLocaleDateString();
  }
  return String(v);
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
  const [editForm, setEditForm] = useState<Partial<Applicant>>({});

  const agencyId = profile?.agencyId ?? null;
  const db = getFirebaseFirestore();

  useEffect(() => {
    if (!db || !agencyId || !applicantId) {
      setLoading(false);
      if (!applicantId) setNotFound(true);
      return;
    }
    const ref = doc(db, applicationsCol(agencyId), applicantId);
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
      });
    });
  }, [db, agencyId, applicantId]);

  const handleEditSave = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!db || !agencyId || !applicant) return;
      setSubmitting(true);
      try {
        const ref = doc(db, applicationsCol(agencyId), applicant.id);
        const phone = (editForm.phone ?? applicant.phone)?.trim() || null;
        const propertyRef =
          (editForm.propertyRef ?? applicant.propertyRef)?.trim() || null;
        const notes = (editForm.notes ?? applicant.notes)?.trim() || null;
        await updateDoc(ref, {
          fullName: (editForm.fullName ?? applicant.fullName).trim(),
          email: (editForm.email ?? applicant.email).trim(),
          phone,
          propertyRef,
          status: editForm.status ?? applicant.status,
          notes,
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
    [db, agencyId, applicant, editForm]
  );

  if (!agencyId) {
    return (
      <>
        <PageHeader title="Applicant" />
        <p className="text-sm text-zinc-500">No agency.</p>
      </>
    );
  }

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
        <Link
          href="/admin/applicants"
          className="mt-2 inline-block text-sm font-medium text-zinc-600 hover:underline"
        >
          ← Back to applicants
        </Link>
      </>
    );
  }

  return (
    <>
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
            <Link
              href="/admin/applicants"
              className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
            >
              ← Back
            </Link>
          </div>
        }
      />

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
          </form>
        </Card>
      )}
    </>
  );
}
