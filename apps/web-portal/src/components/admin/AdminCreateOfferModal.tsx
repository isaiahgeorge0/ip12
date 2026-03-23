"use client";

import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/Card";
import { OFFER_STATUSES, OFFER_STATUS_LABELS, type OfferStatus } from "@/lib/types/offer";

export type AdminOfferInitialProperty = {
  agencyId: string;
  propertyId: string;
  displayAddress?: string;
};

export type AdminOfferInitialApplicant = {
  applicantId: string;
  applicantName?: string | null;
  applicantEmail?: string | null;
  applicationId?: string | null;
  applicantUserId?: string | null;
};

type PropertyOption = { id: string; agencyId?: string; displayAddress: string };

type AdminCreateOfferModalProps = {
  open: boolean;
  onClose: () => void;
  agencyId: string;
  /** When set, property is pre-selected (e.g. from property detail page). */
  initialProperty?: AdminOfferInitialProperty | null;
  /** When set, applicant/application context is prefilled (e.g. from applicant detail page). */
  initialApplicant?: AdminOfferInitialApplicant | null;
  onSuccess?: () => void;
};

export function AdminCreateOfferModal({
  open,
  onClose,
  agencyId,
  initialProperty = null,
  initialApplicant = null,
  onSuccess,
}: AdminCreateOfferModalProps) {
  const [properties, setProperties] = useState<PropertyOption[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [form, setForm] = useState({
    propertyId: "",
    amount: "",
    deposit: "",
    moveInDate: "",
    status: "draft" as OfferStatus,
    notes: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const propertyLocked = !!initialProperty?.agencyId && !!initialProperty?.propertyId;

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (initialProperty?.agencyId && initialProperty?.propertyId) {
      setForm((prev) => ({
        ...prev,
        propertyId: initialProperty.propertyId,
      }));
    } else {
      setForm((prev) => ({ ...prev, propertyId: "" }));
    }
    setForm((prev) => ({ ...prev, deposit: "", moveInDate: "" }));
    if (!open) return;
    setLoadingOptions(true);
    fetch(`/api/admin/properties?agencyId=${encodeURIComponent(agencyId)}`, { credentials: "include" })
      .then((res) => (res.ok ? res.json() : []))
      .then((data: { id: string; agencyId?: string; displayAddress?: string }[]) =>
        setProperties(
          Array.isArray(data)
            ? data.map((p) => ({
                id: p.id,
                agencyId: p.agencyId ?? agencyId,
                displayAddress: p.displayAddress ?? p.id,
              }))
            : []
        )
      )
      .catch(() => setProperties([]))
      .finally(() => setLoadingOptions(false));
  }, [open, agencyId, initialProperty?.agencyId, initialProperty?.propertyId]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const effectivePropertyId = propertyLocked ? initialProperty!.propertyId : form.propertyId.trim();
      if (!effectivePropertyId) {
        setError("Property is required.");
        return;
      }
      const amountNum = form.amount.trim() === "" ? NaN : parseFloat(form.amount);
      if (!Number.isFinite(amountNum) || amountNum < 0) {
        setError("Amount must be a non-negative number.");
        return;
      }
      setSubmitting(true);
      setError(null);
      const depositNum = form.deposit.trim() === "" ? null : parseFloat(form.deposit);
      const deposit = depositNum != null && Number.isFinite(depositNum) && depositNum >= 0 ? depositNum : null;
      const moveInDate = form.moveInDate.trim() || null;

      const body: Record<string, unknown> = {
        agencyId,
        propertyId: effectivePropertyId,
        amount: amountNum,
        status: form.status,
        notes: form.notes.trim() || null,
        source: initialApplicant ? "application" : "manual",
      };
      if (deposit != null) body.deposit = deposit;
      if (moveInDate) body.moveInDate = moveInDate;
      if (initialApplicant) {
        body.applicantId = initialApplicant.applicantId;
        body.applicantName = initialApplicant.applicantName ?? null;
        body.applicantEmail = initialApplicant.applicantEmail ?? null;
        if (initialApplicant.applicationId) body.applicationId = initialApplicant.applicationId;
        if (initialApplicant.applicantUserId) body.applicantUserId = initialApplicant.applicantUserId;
      }
      fetch("/api/admin/offers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      })
        .then(async (res) => {
          if (res.ok) {
            onSuccess?.();
            onClose();
            setForm({ propertyId: "", amount: "", deposit: "", moveInDate: "", status: "draft", notes: "" });
            return;
          }
          const d = await res.json().catch(() => ({}));
          setError((d?.error as string) ?? "Create failed");
        })
        .catch(() => setError("Create failed"))
        .finally(() => setSubmitting(false));
    },
    [agencyId, propertyLocked, initialProperty, initialApplicant, form, onClose, onSuccess]
  );

  const handleClose = useCallback(() => {
    setError(null);
    onClose();
  }, [onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-10 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-create-offer-title"
    >
      <Card className="w-full max-w-md max-h-[90vh] overflow-y-auto">
        <h2 id="admin-create-offer-title" className="text-lg font-semibold text-zinc-900">
          Create offer
        </h2>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {propertyLocked ? (
            <div>
              <span className="block text-sm font-medium text-zinc-700">Property *</span>
              <p className="mt-1 text-sm text-zinc-900">
                {initialProperty?.displayAddress ?? initialProperty?.propertyId ?? "Property"}
              </p>
            </div>
          ) : (
            <div>
              <label htmlFor="admin-create-offer-property" className="block text-sm font-medium text-zinc-700">
                Property *
              </label>
              <select
                id="admin-create-offer-property"
                required
                value={form.propertyId}
                onChange={(e) => setForm((prev) => ({ ...prev, propertyId: e.target.value }))}
                className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900"
              >
                <option value="">Select property…</option>
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.displayAddress}
                  </option>
                ))}
              </select>
              {loadingOptions && <p className="mt-1 text-sm text-zinc-500">Loading…</p>}
            </div>
          )}

          {initialApplicant && (
            <div>
              <span className="block text-sm font-medium text-zinc-700">Applicant</span>
              <p className="mt-1 text-sm text-zinc-900">
                {initialApplicant.applicantName || "—"}
                {initialApplicant.applicantEmail && (
                  <span className="block text-zinc-500">{initialApplicant.applicantEmail}</span>
                )}
              </p>
            </div>
          )}

          <div>
            <label htmlFor="admin-create-offer-amount" className="block text-sm font-medium text-zinc-700">
              Rent amount (£) *
            </label>
            <input
              id="admin-create-offer-amount"
              type="number"
              min={0}
              step={1}
              value={form.amount}
              onChange={(e) => setForm((prev) => ({ ...prev, amount: e.target.value }))}
              required
              className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900"
            />
          </div>

          <div>
            <label htmlFor="admin-create-offer-deposit" className="block text-sm font-medium text-zinc-700">
              Deposit (£)
            </label>
            <input
              id="admin-create-offer-deposit"
              type="number"
              min={0}
              step={1}
              value={form.deposit}
              onChange={(e) => setForm((prev) => ({ ...prev, deposit: e.target.value }))}
              className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900"
            />
          </div>

          <div>
            <label htmlFor="admin-create-offer-move-in" className="block text-sm font-medium text-zinc-700">
              Move-in date
            </label>
            <input
              id="admin-create-offer-move-in"
              type="date"
              value={form.moveInDate}
              onChange={(e) => setForm((prev) => ({ ...prev, moveInDate: e.target.value }))}
              className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900"
            />
          </div>

          <div>
            <label htmlFor="admin-create-offer-status" className="block text-sm font-medium text-zinc-700">
              Status
            </label>
            <select
              id="admin-create-offer-status"
              value={form.status}
              onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value as OfferStatus }))}
              className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900"
            >
              {OFFER_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {OFFER_STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="admin-create-offer-notes" className="block text-sm font-medium text-zinc-700">
              Notes (optional)
            </label>
            <textarea
              id="admin-create-offer-notes"
              rows={2}
              value={form.notes}
              onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
              className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          )}
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={handleClose}
              className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 bg-zinc-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
            >
              {submitting ? "Creating…" : "Create offer"}
            </button>
          </div>
        </form>
      </Card>
    </div>
  );
}
