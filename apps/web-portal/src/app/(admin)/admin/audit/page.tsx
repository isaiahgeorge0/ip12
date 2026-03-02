"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/Card";
import { useAuth } from "@/contexts/AuthContext";

type AuditRow = {
  id: string;
  createdAtMs: number | null;
  action: string;
  actorUid: string;
  actorRole: string;
  actorAgencyId: string | null;
  targetType: string;
  targetId: string;
  agencyId: string | null;
  bypass: boolean;
  meta?: Record<string, unknown>;
};

function formatDate(ms: number | null): string {
  if (ms == null) return "—";
  return new Date(ms).toLocaleString();
}

export default function AdminAuditPage() {
  const { profile } = useAuth();
  const [list, setList] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionContains, setActionContains] = useState("");
  const [actorUidContains, setActorUidContains] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const fetchLogs = useCallback(() => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (actionContains.trim()) params.set("actionContains", actionContains.trim());
    if (actorUidContains.trim()) params.set("actorUidContains", actorUidContains.trim());
    if (dateFrom.trim()) params.set("dateFrom", dateFrom.trim());
    if (dateTo.trim()) params.set("dateTo", dateTo.trim());
    const q = params.toString() ? `?${params.toString()}` : "";
    fetch(`/api/admin/audit${q}`, { credentials: "include" })
      .then((res) => {
        if (!res.ok) {
          if (res.status === 403) setError("Forbidden. superAdmin only.");
          else setError(`Failed to load (${res.status})`);
          return [];
        }
        return res.json();
      })
      .then((data: AuditRow[]) => setList(Array.isArray(data) ? data : []))
      .catch(() => setError("Failed to load"))
      .finally(() => setLoading(false));
  }, [actionContains, actorUidContains, dateFrom, dateTo]);

  useEffect(() => {
    if (profile?.role !== "superAdmin") {
      setLoading(false);
      setError("Forbidden. superAdmin only.");
      return;
    }
    fetchLogs();
  }, [profile?.role, fetchLogs]);

  if (profile?.role !== "superAdmin") {
    return (
      <>
        <PageHeader title="Audit log" />
        <Card className="p-6 mt-4">
          <p className="text-sm text-zinc-500">Only superAdmin can view the audit log.</p>
          <Link href="/admin" className="mt-2 inline-block text-sm font-medium text-zinc-600 hover:underline">
            ← Back to Admin
          </Link>
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Audit log" />
      <Card className="p-6 mt-4">
        <div className="flex flex-wrap gap-4 items-end mb-4">
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-zinc-700">Action contains</span>
            <input
              type="text"
              value={actionContains}
              onChange={(e) => setActionContains(e.target.value)}
              placeholder="e.g. TICKET"
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 w-48"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-zinc-700">Actor UID contains</span>
            <input
              type="text"
              value={actorUidContains}
              onChange={(e) => setActorUidContains(e.target.value)}
              placeholder="e.g. uid"
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 w-48"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-zinc-700">Date from</span>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-zinc-700">Date to</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900"
            />
          </label>
          <button
            type="button"
            onClick={fetchLogs}
            disabled={loading}
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
          >
            {loading ? "Loading…" : "Apply"}
          </button>
        </div>

        {error && (
          <p className="text-sm text-red-600 mb-4" role="alert">
            {error}
          </p>
        )}

        <p className="text-sm text-zinc-500 mb-2">Last 200 entries (filtered client-side).</p>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-zinc-200 text-sm">
            <thead>
              <tr>
                <th className="py-2 px-2 text-left text-xs font-medium text-zinc-500 uppercase">Time</th>
                <th className="py-2 px-2 text-left text-xs font-medium text-zinc-500 uppercase">Action</th>
                <th className="py-2 px-2 text-left text-xs font-medium text-zinc-500 uppercase">Actor role</th>
                <th className="py-2 px-2 text-left text-xs font-medium text-zinc-500 uppercase">Actor agency</th>
                <th className="py-2 px-2 text-left text-xs font-medium text-zinc-500 uppercase">Target</th>
                <th className="py-2 px-2 text-left text-xs font-medium text-zinc-500 uppercase">Target ID</th>
                <th className="py-2 px-2 text-left text-xs font-medium text-zinc-500 uppercase">Agency</th>
                <th className="py-2 px-2 text-left text-xs font-medium text-zinc-500 uppercase">Bypass</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {list.map((row) => (
                <tr key={row.id} className="bg-white">
                  <td className="py-2 px-2 text-zinc-600 whitespace-nowrap">{formatDate(row.createdAtMs)}</td>
                  <td className="py-2 px-2 font-medium text-zinc-900">{row.action}</td>
                  <td className="py-2 px-2 text-zinc-600">{row.actorRole}</td>
                  <td className="py-2 px-2 text-zinc-600">{row.actorAgencyId ?? "—"}</td>
                  <td className="py-2 px-2 text-zinc-600">{row.targetType}</td>
                  <td className="py-2 px-2 text-zinc-600 truncate max-w-[120px]" title={row.targetId}>{row.targetId}</td>
                  <td className="py-2 px-2 text-zinc-600">{row.agencyId ?? "—"}</td>
                  <td className="py-2 px-2">{row.bypass ? "Yes" : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {list.length === 0 && !loading && !error && (
          <p className="text-sm text-zinc-500 mt-4">No audit entries match the filters.</p>
        )}
      </Card>
    </>
  );
}
