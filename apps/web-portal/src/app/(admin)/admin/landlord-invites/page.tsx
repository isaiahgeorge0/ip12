"use client";

import { useCallback, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/Card";
import { useAuth } from "@/contexts/AuthContext";
import { getFirebaseAuth } from "@/lib/firebase/client";

export default function AdminLandlordInvitesPage() {
  const { user, profile } = useAuth();
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{
    type: "success" | "error";
    message: string;
    resetLink?: string;
  } | null>(null);

  const canInvite = profile?.role === "superAdmin" || profile?.role === "admin";

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!user || !canInvite) return;
      const emailTrim = email.trim();
      const displayNameTrim = displayName.trim();
      if (!emailTrim || !displayNameTrim) {
        setResult({ type: "error", message: "Email and display name are required." });
        return;
      }
      setSubmitting(true);
      setResult(null);
      try {
        const auth = getFirebaseAuth();
        if (!auth?.currentUser) {
          setResult({ type: "error", message: "Not signed in." });
          setSubmitting(false);
          return;
        }
        const token = await auth.currentUser.getIdToken();
        const res = await fetch("/api/admin/invite-landlord", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            landlordEmail: emailTrim,
            landlordDisplayName: displayNameTrim,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setResult({
            type: "error",
            message: data.error ?? `Request failed (${res.status})`,
          });
          setSubmitting(false);
          return;
        }
        const resetLink = data.resetLink as string | undefined;
        setResult({
          type: "success",
          message: "Invite sent. Share the reset link with the landlord (dev: link below).",
          resetLink,
        });
        setEmail("");
        setDisplayName("");
      } catch (err) {
        const message = err instanceof Error ? err.message : "Request failed";
        setResult({ type: "error", message });
      } finally {
        setSubmitting(false);
      }
    },
    [user, canInvite, email, displayName]
  );

  if (!canInvite) {
    return (
      <>
        <PageHeader title="Landlord Invites" />
        <Card className="p-6">
          <p className="text-zinc-600">Not authorized.</p>
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Landlord Invites" />
      <Card className="p-6 max-w-lg">
        <p className="text-sm text-zinc-500 mb-4">
          Create a landlord account and send an invite. They will set their password via the reset link.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="landlord-email"
              className="block text-sm font-medium text-zinc-700"
            >
              Landlord email *
            </label>
            <input
              id="landlord-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900"
            />
          </div>
          <div>
            <label
              htmlFor="landlord-displayName"
              className="block text-sm font-medium text-zinc-700"
            >
              Display name *
            </label>
            <input
              id="landlord-displayName"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
              className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900"
            />
          </div>
          {result && (
            <div
              className={`rounded-md px-4 py-2 text-sm ${
                result.type === "success"
                  ? "bg-green-50 text-green-800"
                  : "bg-red-50 text-red-800"
              }`}
              role="alert"
            >
              {result.message}
              {result.resetLink && (
                <div className="mt-2">
                  <p className="font-medium text-zinc-700">Reset link (dev — copy and share):</p>
                  <textarea
                    readOnly
                    value={result.resetLink}
                    rows={3}
                    className="mt-1 block w-full rounded border border-zinc-200 bg-zinc-50 p-2 text-xs font-mono text-zinc-800"
                  />
                </div>
              )}
            </div>
          )}
          <button
            type="submit"
            disabled={submitting}
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
          >
            {submitting ? "Sending…" : "Send invite"}
          </button>
        </form>
      </Card>
    </>
  );
}
