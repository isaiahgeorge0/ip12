"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { AdminSectionHeader } from "@/components/admin/AdminSectionHeader";
import { AdminStatusBadge } from "@/components/admin/AdminStatusBadge";
import { getStatusBadgeVariant } from "@/lib/admin/statusBadge";

type AgencyRow = {
  agencyId: string;
  name: string;
  status: string;
  createdAt: unknown;
  adminCount: number;
  propertyCount: number;
};

function formatCreatedAt(createdAt: unknown): string {
  if (createdAt == null) return "—";
  const t = createdAt as { seconds?: number; _seconds?: number };
  const sec = t.seconds ?? t._seconds;
  if (typeof sec === "number") {
    const d = new Date(sec * 1000);
    return d.toLocaleDateString(undefined, { dateStyle: "short" });
  }
  return String(createdAt);
}

export default function SuperAdminAgenciesPage() {
  const [q, setQ] = useState("");
  const [qDebounced, setQDebounced] = useState("");
  const [results, setResults] = useState<AgencyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [actioning, setActioning] = useState<string | null>(null);
  const [editingName, setEditingName] = useState<string | null>(null);
  const [editNameValue, setEditNameValue] = useState("");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setQDebounced(q), 300);
    return () => clearTimeout(t);
  }, [q]);

  const fetchAgencies = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (qDebounced.trim()) params.set("q", qDebounced.trim());
    params.set("limit", "25");
    try {
      const res = await fetch(`/api/superadmin/agencies?${params}`, { credentials: "include" });
      if (!res.ok) {
        setResults([]);
        return;
      }
      const data = await res.json();
      setResults(data.results ?? []);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [qDebounced]);

  useEffect(() => {
    fetchAgencies();
  }, [fetchAgencies]);

  useEffect(() => {
    if (message) {
      const t = setTimeout(() => setMessage(null), 4000);
      return () => clearTimeout(t);
    }
  }, [message]);

  const patchAgency = useCallback(
    async (agencyId: string, body: { name?: string; status?: string }) => {
      setActioning(agencyId);
      if (editingName === agencyId) {
        setEditingName(null);
        setEditNameValue("");
      }
      try {
        const res = await fetch(`/api/superadmin/agencies/${encodeURIComponent(agencyId)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          credentials: "include",
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          setMessage({ type: "error", text: (err as { error?: string }).error ?? "Update failed" });
          return;
        }
        setMessage({ type: "success", text: "Updated" });
        fetchAgencies();
      } catch {
        setMessage({ type: "error", text: "Request failed" });
      } finally {
        setActioning(null);
      }
    },
    [fetchAgencies, editingName]
  );

  const startEditName = (row: AgencyRow) => {
    setEditingName(row.agencyId);
    setEditNameValue(row.name);
  };

  const submitEditName = (agencyId: string) => {
    const trimmed = editNameValue.trim();
    if (trimmed) patchAgency(agencyId, { name: trimmed });
    else setEditingName(null);
    setEditNameValue("");
  };

  return (
    <>
      <PageHeader
        title="Agencies"
        subtitle="Manage live agencies, access operational views, and control platform availability."
        action={
          <Link href="/superadmin" className="text-sm text-zinc-600 hover:underline">
            ← Back to SuperAdmin
          </Link>
        }
      />
      {message && (
        <p
          className={`mb-4 text-sm ${message.type === "success" ? "text-green-600" : "text-red-600"}`}
        >
          {message.text}
        </p>
      )}

      <AdminSectionHeader title="Filters" />
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-zinc-500">Search by name</span>
          <input
            type="search"
            placeholder="Agency name…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none min-w-[200px]"
          />
        </label>
      </div>

      {loading ? (
        <div className="rounded-lg border border-zinc-200 bg-zinc-50/50 p-6 text-center">
          <p className="text-sm text-zinc-500">Loading agencies…</p>
        </div>
      ) : results.length === 0 ? (
        <EmptyState
          title="No agencies found"
          description={
            qDebounced.trim()
              ? "No agencies match your search. Try a different name."
              : "No agencies are set up yet."
          }
          action={
            <Link href="/superadmin" className="text-sm font-medium text-zinc-700 hover:text-zinc-900">
              ← Back to SuperAdmin
            </Link>
          }
        />
      ) : (
        <Card className="p-0 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50">
              <tr>
                <th className="px-4 py-2.5 font-medium text-zinc-900">Agency name</th>
                <th className="px-4 py-2.5 font-medium text-zinc-900">ID</th>
                <th className="px-4 py-2.5 font-medium text-zinc-900">Status</th>
                <th className="px-4 py-2.5 font-medium text-zinc-900">Admins</th>
                <th className="px-4 py-2.5 font-medium text-zinc-900">Properties</th>
                <th className="px-4 py-2.5 font-medium text-zinc-900">Created</th>
                <th className="px-4 py-2.5 font-medium text-zinc-900">Actions</th>
              </tr>
            </thead>
            <tbody>
              {results.map((row) => (
                <tr key={row.agencyId} className="border-b border-zinc-100 last:border-0">
                  <td className="px-4 py-2 text-zinc-900">
                    {editingName === row.agencyId ? (
                      <input
                        type="text"
                        value={editNameValue}
                        onChange={(e) => setEditNameValue(e.target.value)}
                        onBlur={() => submitEditName(row.agencyId)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") submitEditName(row.agencyId);
                          if (e.key === "Escape") {
                            setEditingName(null);
                            setEditNameValue("");
                          }
                        }}
                        autoFocus
                        className="w-full max-w-[200px] rounded border border-zinc-300 px-2 py-1 text-sm focus:border-zinc-400 focus:outline-none"
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => startEditName(row)}
                        className="text-left hover:underline font-medium"
                        title="Edit name"
                      >
                        {row.name || row.agencyId}
                      </button>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    <code className="text-xs text-zinc-500">{row.agencyId}</code>
                  </td>
                  <td className="px-4 py-2">
                    <AdminStatusBadge variant={getStatusBadgeVariant(row.status, "agency")}>
                      {row.status}
                    </AdminStatusBadge>
                  </td>
                  <td className="px-4 py-2 text-zinc-600">{row.adminCount}</td>
                  <td className="px-4 py-2 text-zinc-600">{row.propertyCount}</td>
                  <td className="px-4 py-2 text-zinc-600">{formatCreatedAt(row.createdAt)}</td>
                  <td className="px-4 py-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/admin?agencyId=${encodeURIComponent(row.agencyId)}`}
                        className="rounded border border-zinc-300 bg-zinc-50 px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100"
                      >
                        Open admin
                      </Link>
                      <Link
                        href={`/admin/properties?agencyId=${encodeURIComponent(row.agencyId)}`}
                        className="rounded border border-zinc-300 bg-zinc-50 px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100"
                      >
                        Properties
                      </Link>
                      <Link
                        href={`/admin/applicants?agencyId=${encodeURIComponent(row.agencyId)}`}
                        className="rounded border border-zinc-300 bg-zinc-50 px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100"
                      >
                        Applicants
                      </Link>
                      {row.status !== "active" && (
                        <button
                          type="button"
                          disabled={actioning === row.agencyId}
                          onClick={() => patchAgency(row.agencyId, { status: "active" })}
                          className="rounded border border-zinc-300 bg-zinc-50 px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-50"
                        >
                          Enable
                        </button>
                      )}
                      {row.status === "active" && (
                        <button
                          type="button"
                          disabled={actioning === row.agencyId}
                          onClick={() => patchAgency(row.agencyId, { status: "disabled" })}
                          className="rounded border border-zinc-300 bg-zinc-50 px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-50"
                        >
                          Disable
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </>
  );
}
