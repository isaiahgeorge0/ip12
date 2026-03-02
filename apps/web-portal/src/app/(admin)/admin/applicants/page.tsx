"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  addDoc,
  collection,
  orderBy,
  query,
  serverTimestamp,
  onSnapshot,
} from "firebase/firestore";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
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
  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [createForm, setCreateForm] = useState(defaultCreateForm);
  const [toast, setToast] = useState<string | null>(null);

  const agencyId = profile?.agencyId ?? null;
  const db = getFirebaseFirestore();

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(t);
    }
  }, [toast]);

  useEffect(() => {
    if (!db || !agencyId) {
      setLoading(false);
      setApplicants([]);
      return;
    }
    const colRef = collection(db, applicationsCol(agencyId));
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
  }, [db, agencyId]);

  const handleCreateSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!db || !agencyId || !user) return;
      if (!createForm.fullName.trim() || !createForm.email.trim()) return;
      setSubmitting(true);
      try {
        const colRef = collection(db, applicationsCol(agencyId));
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
    [db, agencyId, user, createForm]
  );

  if (!agencyId) {
    return (
      <>
        <PageHeader title="Applicants" />
        <EmptyState
          title="No agency"
          description="Your account is not linked to an agency."
        />
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
        title="Applicants"
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

      {loading && (
        <div className="text-sm text-zinc-500">Loading applicants…</div>
      )}

      {!loading && applicants.length === 0 && (
        <EmptyState
          title="No applicants yet"
          description="Create an applicant to get started."
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

      {!loading && applicants.length > 0 && (
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
