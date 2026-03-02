"use client";

import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/Card";

const CATEGORIES = ["General", "Plumbing", "Electrical", "Heating", "Appliances", "Other"];

export type PropertyOption = {
  id: string;
  agencyId: string;
  title: string;
  postcode: string;
  status: string;
};

export type InitialProperty = {
  agencyId: string;
  propertyId: string;
  title?: string;
  postcode?: string;
};

type CreateTicketModalProps = {
  open: boolean;
  onClose: () => void;
  /** When set, property is pre-selected and not editable; category defaults to General. */
  initialProperty?: InitialProperty | null;
  /** Called after ticket is created successfully (with new ticket id). */
  onSuccess?: (ticketId: string) => void;
};

export function CreateTicketModal({
  open,
  onClose,
  initialProperty = null,
  onSuccess,
}: CreateTicketModalProps) {
  const [properties, setProperties] = useState<PropertyOption[]>([]);
  const [loadingProperties, setLoadingProperties] = useState(false);
  const [form, setForm] = useState({
    agencyId: "",
    propertyId: "",
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
        agencyId: initialProperty.agencyId,
        propertyId: initialProperty.propertyId,
        category: "General",
        title: "",
        description: "",
      });
      return;
    }
    setForm({ agencyId: "", propertyId: "", category: "General", title: "", description: "" });
    setLoadingProperties(true);
    fetch("/api/landlord/properties", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : []))
      .then((data: PropertyOption[]) => setProperties(Array.isArray(data) ? data : []))
      .catch(() => setProperties([]))
      .finally(() => setLoadingProperties(false));
  }, [open, initialProperty?.agencyId, initialProperty?.propertyId]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!form.agencyId || !form.propertyId || !form.title.trim()) {
        setError("Property and title are required.");
        return;
      }
      setSubmitting(true);
      setError(null);
      fetch("/api/landlord/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          agencyId: form.agencyId,
          propertyId: form.propertyId,
          category: form.category || "General",
          title: form.title.trim(),
          description: form.description.trim(),
        }),
      })
        .then(async (res) => {
          if (res.ok) {
            const data = await res.json();
            const ticketId = typeof data?.id === "string" ? data.id : "";
            onSuccess?.(ticketId);
            onClose();
            setForm({ agencyId: "", propertyId: "", category: "General", title: "", description: "" });
            return;
          }
          const d = await res.json().catch(() => ({}));
          setError(d?.error ?? "Create failed");
        })
        .catch(() => setError("Create failed"))
        .finally(() => setSubmitting(false));
    },
    [form, onClose, onSuccess]
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
      aria-labelledby="create-ticket-title"
    >
      <Card className="w-full max-w-md">
        <h2 id="create-ticket-title" className="text-lg font-semibold text-zinc-900">
          Create ticket
        </h2>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {propertyLocked ? (
            <div>
              <span className="block text-sm font-medium text-zinc-700">Property</span>
              <p className="mt-1 text-sm text-zinc-900">
                {initialProperty?.title ?? "Property"}
                {initialProperty?.postcode ? ` (${initialProperty.postcode})` : ""}
              </p>
            </div>
          ) : (
            <div>
              <label htmlFor="ticket-property" className="block text-sm font-medium text-zinc-700">
                Property *
              </label>
              <select
                id="ticket-property"
                required={!propertyLocked}
                value={form.propertyId ? `${form.agencyId}:${form.propertyId}` : ""}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v) {
                    const [aid, pid] = v.split(":");
                    setForm((prev) => ({ ...prev, agencyId: aid ?? "", propertyId: pid ?? "" }));
                  } else {
                    setForm((prev) => ({ ...prev, agencyId: "", propertyId: "" }));
                  }
                }}
                className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900"
              >
                <option value="">Select property…</option>
                {properties.map((p) => (
                  <option key={`${p.agencyId}-${p.id}`} value={`${p.agencyId}:${p.id}`}>
                    {p.title} {p.postcode ? `(${p.postcode})` : ""}
                  </option>
                ))}
              </select>
              {loadingProperties && (
                <p className="mt-1 text-sm text-zinc-500">Loading properties…</p>
              )}
            </div>
          )}
          <div>
            <label htmlFor="ticket-category" className="block text-sm font-medium text-zinc-700">
              Category
            </label>
            <select
              id="ticket-category"
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
            <label htmlFor="ticket-title" className="block text-sm font-medium text-zinc-700">
              Title *
            </label>
            <input
              id="ticket-title"
              type="text"
              value={form.title}
              onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
              required
              className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900"
            />
          </div>
          <div>
            <label htmlFor="ticket-description" className="block text-sm font-medium text-zinc-700">
              Description
            </label>
            <textarea
              id="ticket-description"
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
              disabled={submitting}
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
