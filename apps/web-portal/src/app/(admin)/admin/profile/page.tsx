"use client";

import { useCallback, useEffect, useState } from "react";
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/Card";
import { useAuth } from "@/contexts/AuthContext";
import { getFirebaseFirestore } from "@/lib/firebase/client";
import { writeAuditLog } from "@/lib/firestore/audit";
import { userDoc } from "@/lib/firestore/paths";

type FormState = {
  displayName: string;
  phone: string;
  jobTitle: string;
};

const initialForm: FormState = {
  displayName: "",
  phone: "",
  jobTitle: "",
};

export default function AdminProfilePage() {
  const { user, profile } = useAuth();
  const [form, setForm] = useState<FormState>(initialForm);
  const [initial, setInitial] = useState<FormState>(initialForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [auditWarning, setAuditWarning] = useState<string | null>(null);
  const db = getFirebaseFirestore();

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(t);
    }
  }, [toast]);

  useEffect(() => {
    if (!db || !user?.uid) {
      setLoading(false);
      return;
    }
    const ref = doc(db, userDoc(user.uid));
    getDoc(ref).then((snap) => {
      setLoading(false);
      if (!snap.exists()) {
        return;
      }
      const d = snap.data();
      const displayName =
        typeof d.displayName === "string" ? d.displayName : "";
      const phone = typeof d.phone === "string" ? d.phone : "";
      const jobTitle = typeof d.jobTitle === "string" ? d.jobTitle : "";
      const state = { displayName, phone, jobTitle };
      setForm(state);
      setInitial(state);
    });
  }, [db, user?.uid]);

  const handleSave = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!db || !user?.uid) return;
      const displayName = form.displayName.trim();
      if (displayName.length < 2) {
        setSaveError("Display name must be at least 2 characters.");
        return;
      }
      setSaveError(null);
      setAuditWarning(null);
      setSaving(true);
      try {
        const ref = doc(db, userDoc(user.uid));
        await updateDoc(ref, {
          displayName,
          phone: form.phone.trim() || null,
          jobTitle: form.jobTitle.trim() || null,
          updatedAt: serverTimestamp(),
        });
        setInitial({ ...form, displayName, phone: form.phone.trim(), jobTitle: form.jobTitle.trim() });
        setToast("Profile updated");
        writeAuditLog(db, {
          action: "PROFILE_UPDATED",
          agencyId: profile?.agencyId ?? null,
          performedByUid: user.uid,
          targetUid: user.uid,
          before: {
            displayName: initial.displayName,
            phone: initial.phone || null,
            jobTitle: initial.jobTitle || null,
          },
          after: {
            displayName,
            phone: form.phone.trim() || null,
            jobTitle: form.jobTitle.trim() || null,
          },
        }).catch((err) => {
          setAuditWarning("Audit log failed (check rules)");
          console.error("[audit]", err);
        });
      } catch (err: unknown) {
        const message =
          err && typeof err === "object" && "message" in err
            ? String((err as { message: string }).message)
            : "Update failed";
        const code =
          err && typeof err === "object" && "code" in err
            ? (err as { code: string }).code
            : "";
        setSaveError(
          code === "permission-denied"
            ? "You don’t have permission to update this profile."
            : message
        );
      } finally {
        setSaving(false);
      }
    },
    [db, user?.uid, profile?.agencyId, form, initial]
  );

  const handleReset = useCallback(() => {
    setForm(initial);
    setSaveError(null);
    setAuditWarning(null);
  }, [initial]);

  if (!user) {
    return (
      <>
        <PageHeader title="Profile" />
        <p className="text-sm text-zinc-500">Please sign in.</p>
      </>
    );
  }

  if (loading) {
    return (
      <>
        <PageHeader title="Profile" />
        <p className="text-sm text-zinc-500">Loading…</p>
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

      <PageHeader title="Profile" />

      <Card className="p-6">
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label
              htmlFor="profile-displayName"
              className="block text-sm font-medium text-zinc-700"
            >
              Display name *
            </label>
            <input
              id="profile-displayName"
              type="text"
              value={form.displayName}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, displayName: e.target.value }))
              }
              required
              minLength={2}
              className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900"
            />
          </div>
          <div>
            <label
              htmlFor="profile-phone"
              className="block text-sm font-medium text-zinc-700"
            >
              Phone (optional)
            </label>
            <input
              id="profile-phone"
              type="tel"
              value={form.phone}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, phone: e.target.value }))
              }
              className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900"
            />
          </div>
          <div>
            <label
              htmlFor="profile-jobTitle"
              className="block text-sm font-medium text-zinc-700"
            >
              Job title (optional)
            </label>
            <input
              id="profile-jobTitle"
              type="text"
              value={form.jobTitle}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, jobTitle: e.target.value }))
              }
              className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900"
            />
          </div>

          {saveError && (
            <p className="text-sm text-red-600" role="alert">
              {saveError}
            </p>
          )}
          {auditWarning && (
            <p className="text-sm text-amber-700" role="alert">
              {auditWarning}
            </p>
          )}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={handleReset}
              disabled={saving}
              className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
            >
              Cancel / Reset
            </button>
          </div>
        </form>
      </Card>
    </>
  );
}
