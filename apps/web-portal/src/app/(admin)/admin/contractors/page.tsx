"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { AdminStatusBadge } from "@/components/admin/AdminStatusBadge";
import { getStatusBadgeVariant } from "@/lib/admin/statusBadge";
import { useAuth } from "@/contexts/AuthContext";
import { CONTRACTOR_TRADES } from "@/lib/types/contractor";
import { formatAdminDate } from "@/lib/admin/formatAdminDate";

type Contractor = {
  id: string;
  agencyId: string;
  displayName: string;
  companyName: string | null;
  email: string | null;
  phone: string | null;
  trade: string | null;
  skills: string[];
  coverageAreas: string[];
  isActive: boolean;
  notes: string | null;
  createdAt: number | null;
  updatedAt: number | null;
  jobsCount?: number;
};

function formatDate(ms: number | null): string {
  return formatAdminDate(ms, "date");
}

const defaultForm = {
  displayName: "",
  companyName: "",
  email: "",
  phone: "",
  trade: "",
  skills: "",
  coverageAreas: "",
  isActive: true,
  notes: "",
};

type AdminCreateContractorModalProps = {
  open: boolean;
  onClose: () => void;
  onSuccess: (c: Contractor) => void;
  agencyId: string | null;
};

function AdminCreateContractorModal({
  open,
  onClose,
  onSuccess,
  agencyId,
}: AdminCreateContractorModalProps) {
  const [form, setForm] = useState(defaultForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setForm(defaultForm);
      setError(null);
    }
  }, [open]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!form.displayName.trim()) {
        setError("Name is required.");
        return;
      }
      if (!agencyId) {
        setError("Agency context required.");
        return;
      }
      setSubmitting(true);
      setError(null);
      const skills = form.skills
        .split(/[,;]/)
        .map((s) => s.trim())
        .filter(Boolean);
      const coverageAreas = form.coverageAreas
        .split(/[,;]/)
        .map((s) => s.trim())
        .filter(Boolean);
      fetch("/api/admin/contractors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          ...(agencyId ? { agencyId } : {}),
          displayName: form.displayName.trim(),
          companyName: form.companyName.trim() || undefined,
          email: form.email.trim() || undefined,
          phone: form.phone.trim() || undefined,
          trade: form.trade.trim() || undefined,
          skills: skills.length ? skills : undefined,
          coverageAreas: coverageAreas.length ? coverageAreas : undefined,
          isActive: form.isActive,
          notes: form.notes.trim() || undefined,
        }),
      })
        .then(async (res) => {
          const data = await res.json();
          if (res.ok) {
            const contractor: Contractor = {
              id: data.id,
              agencyId: data.agencyId ?? agencyId,
              displayName: data.displayName ?? "",
              companyName: data.companyName ?? null,
              email: data.email ?? null,
              phone: data.phone ?? null,
              trade: data.trade ?? null,
              skills: Array.isArray(data.skills) ? data.skills : [],
              coverageAreas: Array.isArray(data.coverageAreas) ? data.coverageAreas : [],
              isActive: data.isActive !== false,
              notes: data.notes ?? null,
              createdAt: null,
              updatedAt: null,
            };
            onSuccess(contractor);
            onClose();
            return;
          }
          setError(data?.error ?? "Create failed");
        })
        .catch(() => setError("Create failed"))
        .finally(() => setSubmitting(false));
    },
    [form, agencyId, onClose, onSuccess]
  );

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-10 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-create-contractor-title"
    >
      <Card className="w-full max-w-md max-h-[90vh] overflow-y-auto">
        <h2 id="admin-create-contractor-title" className="text-lg font-semibold text-zinc-900">
          New contractor
        </h2>
        <p className="text-sm text-zinc-500 mt-1">
          Add a maintenance partner to assign to tickets.
        </p>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label htmlFor="contractor-displayName" className="block text-sm font-medium text-zinc-700">
              Name *
            </label>
            <input
              id="contractor-displayName"
              type="text"
              value={form.displayName}
              onChange={(e) => setForm((p) => ({ ...p, displayName: e.target.value }))}
              required
              className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900"
            />
          </div>
          <div>
            <label htmlFor="contractor-companyName" className="block text-sm font-medium text-zinc-700">
              Company
            </label>
            <input
              id="contractor-companyName"
              type="text"
              value={form.companyName}
              onChange={(e) => setForm((p) => ({ ...p, companyName: e.target.value }))}
              className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="contractor-email" className="block text-sm font-medium text-zinc-700">
                Email
              </label>
              <input
                id="contractor-email"
                type="email"
                value={form.email}
                onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900"
              />
            </div>
            <div>
              <label htmlFor="contractor-phone" className="block text-sm font-medium text-zinc-700">
                Phone
              </label>
              <input
                id="contractor-phone"
                type="tel"
                value={form.phone}
                onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900"
              />
            </div>
          </div>
          <div>
            <label htmlFor="contractor-trade" className="block text-sm font-medium text-zinc-700">
              Trade
            </label>
            <select
              id="contractor-trade"
              value={form.trade}
              onChange={(e) => setForm((p) => ({ ...p, trade: e.target.value }))}
              className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900"
            >
              <option value="">Select…</option>
              {CONTRACTOR_TRADES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="contractor-skills" className="block text-sm font-medium text-zinc-700">
              Skills (comma-separated)
            </label>
            <input
              id="contractor-skills"
              type="text"
              value={form.skills}
              onChange={(e) => setForm((p) => ({ ...p, skills: e.target.value }))}
              placeholder="e.g. Boilers, Radiators"
              className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900"
            />
          </div>
          <div>
            <label htmlFor="contractor-coverage" className="block text-sm font-medium text-zinc-700">
              Coverage areas (comma-separated)
            </label>
            <input
              id="contractor-coverage"
              type="text"
              value={form.coverageAreas}
              onChange={(e) => setForm((p) => ({ ...p, coverageAreas: e.target.value }))}
              placeholder="e.g. London, Surrey"
              className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900"
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              id="contractor-active"
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))}
              className="rounded border-zinc-300"
            />
            <label htmlFor="contractor-active" className="text-sm font-medium text-zinc-700">
              Active
            </label>
          </div>
          <div>
            <label htmlFor="contractor-notes" className="block text-sm font-medium text-zinc-700">
              Notes
            </label>
            <textarea
              id="contractor-notes"
              rows={2}
              value={form.notes}
              onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
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
              onClick={onClose}
              className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 bg-zinc-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !form.displayName.trim()}
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

export default function AdminContractorsPage() {
  const { profile } = useAuth();
  const searchParams = useSearchParams();
  const agencyIdParam = searchParams?.get("agencyId")?.trim() ?? null;
  const isSuperAdmin = profile?.role === "superAdmin";
  const sessionAgencyId = profile?.agencyId ?? null;
  const effectiveAgencyId = isSuperAdmin ? agencyIdParam : sessionAgencyId;
  const pageSubtitle = "Maintenance partners you can assign to tickets as jobs.";

  const [list, setList] = useState<Contractor[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [activeFilter, setActiveFilter] = useState<"all" | "true" | "false">("true");
  const [tradeFilter, setTradeFilter] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  const loadContractors = useCallback(() => {
    if (!effectiveAgencyId) {
      setLoading(false);
      setList([]);
      return;
    }
    setLoading(true);
    const params = new URLSearchParams();
    params.set("agencyId", effectiveAgencyId);
    if (q.trim()) params.set("q", q.trim());
    params.set("active", activeFilter);
    if (tradeFilter.trim()) params.set("trade", tradeFilter.trim());
    fetch(`/api/admin/contractors?${params}`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : []))
      .then((data: Contractor[]) => setList(Array.isArray(data) ? data : []))
      .catch(() => setList([]))
      .finally(() => setLoading(false));
  }, [effectiveAgencyId, q, activeFilter, tradeFilter]);

  useEffect(() => {
    loadContractors();
  }, [loadContractors]);

  const handleCreateSuccess = useCallback(
    (c: Contractor) => {
      setList((prev) => [c, ...prev]);
    },
    []
  );

  if (!effectiveAgencyId && !isSuperAdmin) {
    return (
      <>
        <AdminPageHeader title="Contractors" subtitle={pageSubtitle} />
        <EmptyState title="No agency" description="Your account is not linked to an agency." />
      </>
    );
  }

  if (isSuperAdmin && !effectiveAgencyId) {
    return (
      <>
        <AdminPageHeader title="Contractors" subtitle={pageSubtitle} />
        <EmptyState
          title="Select an agency from the header to view this page."
          description="Use the agency dropdown in the top bar."
        />
      </>
    );
  }

  const query = effectiveAgencyId ? `?agencyId=${encodeURIComponent(effectiveAgencyId)}` : "";

  return (
    <>
      <AdminPageHeader
        title="Contractors"
        subtitle={pageSubtitle}
        primaryAction={
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
          >
            New contractor
          </button>
        }
      />

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <input
          type="search"
          placeholder="Search…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-900 w-48"
        />
        <select
          value={activeFilter}
          onChange={(e) => setActiveFilter(e.target.value as "all" | "true" | "false")}
          className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-900"
        >
          <option value="all">All status</option>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>
        <select
          value={tradeFilter}
          onChange={(e) => setTradeFilter(e.target.value)}
          className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-900"
        >
          <option value="">All trades</option>
          {CONTRACTOR_TRADES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

      <Card className="mt-4 overflow-hidden">
        {loading && (
          <div className="p-4 text-sm text-zinc-500">
            Loading contractors…
          </div>
        )}
        {!loading && list.length === 0 && (
          <EmptyState
            title="No contractors yet"
            description="Add trusted maintenance partners to assign work from tickets."
          />
        )}
        {!loading && list.length > 0 && (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-zinc-200">
              <thead>
                <tr className="bg-zinc-50">
                  <th className="px-4 py-2 text-left text-xs font-medium text-zinc-500 uppercase">Contractor</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-zinc-500 uppercase">Trade</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-zinc-500 uppercase">Skills</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-zinc-500 uppercase">Coverage</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-zinc-500 uppercase">Status</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-zinc-500 uppercase">Jobs</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-zinc-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                {list.map((c) => (
                  <tr key={c.id} className="hover:bg-zinc-50">
                    <td className="px-4 py-2">
                      <Link
                        href={`/admin/contractors/${c.id}${query}`}
                        className="font-medium text-zinc-900 hover:underline"
                      >
                        {c.displayName}
                      </Link>
                      {(c.email || c.phone) && (
                        <p className="text-xs text-zinc-500 mt-0.5">
                          {[c.email, c.phone].filter(Boolean).join(" · ")}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-2 text-sm text-zinc-700">{c.trade ?? "—"}</td>
                    <td className="px-4 py-2 text-sm text-zinc-600">
                      {c.skills.length ? c.skills.slice(0, 3).join(", ") : "—"}
                      {c.skills.length > 3 ? "…" : ""}
                    </td>
                    <td className="px-4 py-2 text-sm text-zinc-600">
                      {c.coverageAreas.length ? c.coverageAreas.slice(0, 2).join(", ") : "—"}
                      {c.coverageAreas.length > 2 ? "…" : ""}
                    </td>
                    <td className="px-4 py-2">
                      <AdminStatusBadge variant={getStatusBadgeVariant(c.isActive ? "active" : "inactive", "contractor")}>
                        {c.isActive ? "Active" : "Inactive"}
                      </AdminStatusBadge>
                    </td>
                    <td className="px-4 py-2 text-sm text-zinc-600">
                      {c.jobsCount !== undefined ? String(c.jobsCount) : "—"}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <Link
                        href={`/admin/contractors/${c.id}${query}`}
                        className="rounded-md border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-700 bg-zinc-50 hover:bg-zinc-100"
                      >
                        Open
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {createOpen && (
        <AdminCreateContractorModal
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          onSuccess={handleCreateSuccess}
          agencyId={effectiveAgencyId}
        />
      )}
    </>
  );
}
