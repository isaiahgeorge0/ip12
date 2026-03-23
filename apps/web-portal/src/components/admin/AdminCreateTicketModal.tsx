"use client";

import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/Card";
import { useAuth } from "@/contexts/AuthContext";

const CATEGORIES = ["General", "Plumbing", "Electrical", "Heating", "Appliances", "Other"];

export type AdminPropertyOption = {
  id: string;
  agencyId: string;
  displayAddress: string;
  postcode: string;
  status: string;
};

export type AdminLandlordOption = { uid: string; email: string; displayName: string; status: string };

export type AdminInitialProperty = {
  agencyId: string;
  propertyId: string;
  displayAddress?: string;
  postcode?: string;
};

type AdminCreateTicketModalProps = {
  open: boolean;
  onClose: () => void;
  /** When set, property is pre-selected and read-only (e.g. from property detail page). */
  initialProperty?: AdminInitialProperty | null;
  /** Called after ticket is created successfully (with API response data). */
  onSuccess?: (data: { id: string; agencyId?: string; propertyId?: string; landlordUid?: string; category?: string; title?: string; description?: string }) => void;
};

export function AdminCreateTicketModal({
  open,
  onClose,
  initialProperty = null,
  onSuccess,
}: AdminCreateTicketModalProps) {
  const { profile } = useAuth();
  const agencyId = profile?.agencyId ?? null;

  const [properties, setProperties] = useState<AdminPropertyOption[]>([]);
  const [landlords, setLandlords] = useState<AdminLandlordOption[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [form, setForm] = useState({
    propertyId: "",
    landlordUid: "",
    category: "General",
    title: "",
    description: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const propertyLocked = !!initialProperty?.agencyId && !!initialProperty?.propertyId;

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (initialProperty?.agencyId && initialProperty?.propertyId) {
      setForm({
        propertyId: initialProperty.propertyId,
        landlordUid: "",
        category: "General",
        title: "",
        description: "",
      });
      setLoadingOptions(true);
      fetch("/api/admin/landlords", { credentials: "include" })
        .then((r) => (r.ok ? r.json() : []))
        .then((data: AdminLandlordOption[]) => setLandlords(Array.isArray(data) ? data : []))
        .catch(() => setLandlords([]))
        .finally(() => setLoadingOptions(false));
      return;
    }
    setForm({ propertyId: "", landlordUid: "", category: "General", title: "", description: "" });
    if (propertyLocked) return;
    setLoadingOptions(true);
    Promise.all([
      fetch("/api/admin/properties", { credentials: "include" }),
      fetch("/api/admin/landlords", { credentials: "include" }),
    ])
      .then(async ([r1, r2]) => {
        const [pList, lList] = await Promise.all([
          r1.ok ? r1.json() : [],
          r2.ok ? r2.json() : [],
        ]);
        setProperties(Array.isArray(pList) ? pList : []);
        setLandlords(Array.isArray(lList) ? lList : []);
      })
      .catch(() => {})
      .finally(() => setLoadingOptions(false));
  }, [open, initialProperty?.agencyId, initialProperty?.propertyId]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const effectiveAgencyId = propertyLocked
        ? initialProperty!.agencyId
        : (properties.find((p) => p.id === form.propertyId)?.agencyId ?? agencyId);
      const effectivePropertyId = propertyLocked ? initialProperty!.propertyId : form.propertyId.trim();
      if (!effectiveAgencyId || !effectivePropertyId || !form.title.trim()) {
        setError("Property and title are required.");
        return;
      }
      setSubmitting(true);
      setError(null);
      fetch("/api/admin/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          ...(effectiveAgencyId ? { agencyId: effectiveAgencyId } : {}),
          propertyId: effectivePropertyId,
          ...(form.landlordUid ? { landlordUid: form.landlordUid.trim() } : {}),
          category: form.category || "General",
          title: form.title.trim(),
          description: form.description.trim(),
        }),
      })
        .then(async (res) => {
          if (res.ok) {
            const data = await res.json();
            onSuccess?.(data);
            onClose();
            setForm({ propertyId: "", landlordUid: "", category: "General", title: "", description: "" });
            return;
          }
          const d = await res.json().catch(() => ({}));
          setError(d?.error ?? "Create failed");
        })
        .catch(() => setError("Create failed"))
        .finally(() => setSubmitting(false));
    },
    [propertyLocked, initialProperty, agencyId, properties, form, onClose, onSuccess]
  );

  const handleClose = useCallback(() => {
    setError(null);
    onClose();
  }, [onClose]);

  if (!open) return null;

  const effectiveAgencyId = propertyLocked
    ? initialProperty!.agencyId
    : (properties.find((p) => p.id === form.propertyId)?.agencyId ?? agencyId);

  return (
    <div
      className="fixed inset-0 z-10 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-create-ticket-title"
    >
      <Card className="w-full max-w-md">
        <h2 id="admin-create-ticket-title" className="text-lg font-semibold text-zinc-900">
          Create ticket
        </h2>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {propertyLocked ? (
            <div>
              <span className="block text-sm font-medium text-zinc-700">Property</span>
              <p className="mt-1 text-sm text-zinc-900">
                {initialProperty?.displayAddress ?? "Property"}
                {initialProperty?.postcode ? ` (${initialProperty.postcode})` : ""}
              </p>
            </div>
          ) : (
            <div>
              <label htmlFor="admin-create-property" className="block text-sm font-medium text-zinc-700">
                Property *
              </label>
              <select
                id="admin-create-property"
                required
                value={form.propertyId}
                onChange={(e) => setForm((prev) => ({ ...prev, propertyId: e.target.value }))}
                className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900"
              >
                <option value="">Select property…</option>
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.displayAddress} {p.postcode ? `(${p.postcode})` : ""}
                  </option>
                ))}
              </select>
              {loadingOptions && <p className="mt-1 text-sm text-zinc-500">Loading…</p>}
            </div>
          )}
          <div>
            <label htmlFor="admin-create-landlord" className="block text-sm font-medium text-zinc-700">
              Landlord (optional)
            </label>
            <select
              id="admin-create-landlord"
              value={form.landlordUid}
              onChange={(e) => setForm((prev) => ({ ...prev, landlordUid: e.target.value }))}
              className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900"
            >
              <option value="">None</option>
              {landlords.map((l) => (
                <option key={l.uid} value={l.uid}>
                  {l.displayName || l.email || l.uid}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="admin-create-category" className="block text-sm font-medium text-zinc-700">
              Category
            </label>
            <select
              id="admin-create-category"
              value={form.category}
              onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value }))}
              className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="admin-create-title" className="block text-sm font-medium text-zinc-700">
              Title *
            </label>
            <input
              id="admin-create-title"
              type="text"
              value={form.title}
              onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
              required
              className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900"
            />
          </div>
          <div>
            <label htmlFor="admin-create-description" className="block text-sm font-medium text-zinc-700">
              Description
            </label>
            <textarea
              id="admin-create-description"
              rows={3}
              value={form.description}
              onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
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
              disabled={submitting || (!propertyLocked && !effectiveAgencyId)}
              className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
            >
              {submitting ? "Creating…" : "Create"}
            </button>
          </div>
        </form>
      </Card>
    </div>
  );
}
