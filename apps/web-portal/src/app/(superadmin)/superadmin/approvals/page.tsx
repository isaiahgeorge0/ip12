"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { AdminSectionHeader } from "@/components/admin/AdminSectionHeader";
import { AdminStatusBadge } from "@/components/admin/AdminStatusBadge";
import { getStatusBadgeVariant } from "@/lib/admin/statusBadge";

const STATUS_OPTIONS = ["all", "active", "pending", "invited", "disabled"] as const;
const ROLE_OPTIONS = [
  "all",
  "superAdmin",
  "admin",
  "agent",
  "landlord",
  "tenant",
  "contractor",
  "lead",
] as const;

type UserRow = {
  uid: string;
  email: string;
  role: string;
  status: string;
  primaryAgencyId?: string | null;
  agencyIds?: string[];
  agencyId?: string | null;
};

function copyUid(uid: string) {
  navigator.clipboard.writeText(uid).catch(() => {});
}

export default function SuperAdminApprovalsPage() {
  const [q, setQ] = useState("");
  const [qDebounced, setQDebounced] = useState("");
  const [status, setStatus] = useState<(typeof STATUS_OPTIONS)[number]>("all");
  const [role, setRole] = useState<(typeof ROLE_OPTIONS)[number]>("all");
  const [agencyId, setAgencyId] = useState("");
  const [results, setResults] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [actioning, setActioning] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setQDebounced(q), 300);
    return () => clearTimeout(t);
  }, [q]);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (qDebounced.trim()) params.set("q", qDebounced.trim());
    if (status !== "all") params.set("status", status);
    if (role !== "all") params.set("role", role);
    if (agencyId.trim()) params.set("agencyId", agencyId.trim());
    params.set("limit", "25");
    try {
      const res = await fetch(`/api/superadmin/users?${params}`, { credentials: "include" });
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
  }, [qDebounced, status, role, agencyId]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    if (message) {
      const t = setTimeout(() => setMessage(null), 4000);
      return () => clearTimeout(t);
    }
  }, [message]);

  const patchUser = useCallback(
    async (uid: string, body: { status?: string; role?: string }) => {
      setActioning(uid);
      try {
        const res = await fetch(`/api/superadmin/users/${uid}`, {
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
        fetchUsers();
      } catch {
        setMessage({ type: "error", text: "Request failed" });
      } finally {
        setActioning(null);
      }
    },
    [fetchUsers]
  );

  return (
    <>
      <PageHeader
        title="User approvals"
        subtitle="Review pending access, assign roles, and approve platform users."
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
          <span className="text-xs font-medium text-zinc-500">Email search</span>
          <input
            type="search"
            placeholder="Email…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none min-w-[180px]"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-zinc-500">Status</span>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as (typeof STATUS_OPTIONS)[number])}
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-zinc-400 focus:outline-none"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s === "all" ? "All" : s}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-zinc-500">Role</span>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as (typeof ROLE_OPTIONS)[number])}
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-zinc-400 focus:outline-none"
          >
            {ROLE_OPTIONS.map((r) => (
              <option key={r} value={r}>
                {r === "all" ? "All" : r}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-zinc-500">Agency ID</span>
          <input
            type="text"
            placeholder="Optional"
            value={agencyId}
            onChange={(e) => setAgencyId(e.target.value)}
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none min-w-[140px]"
          />
        </label>
      </div>

      {loading ? (
        <div className="rounded-lg border border-zinc-200 bg-zinc-50/50 p-6 text-center">
          <p className="text-sm text-zinc-500">Loading users…</p>
        </div>
      ) : results.length === 0 ? (
        <EmptyState
          title="No users match"
          description={
            status !== "all" || role !== "all" || qDebounced.trim() || agencyId.trim()
              ? "Try adjusting filters or search."
              : "No platform users found."
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
                <th className="px-4 py-2.5 font-medium text-zinc-900">Email</th>
                <th className="px-4 py-2.5 font-medium text-zinc-900">Role</th>
                <th className="px-4 py-2.5 font-medium text-zinc-900">Status</th>
                <th className="px-4 py-2.5 font-medium text-zinc-900">Agency</th>
                <th className="px-4 py-2.5 font-medium text-zinc-900">UID</th>
                <th className="px-4 py-2.5 font-medium text-zinc-900">Actions</th>
              </tr>
            </thead>
            <tbody>
              {results.map((row) => (
                <tr key={row.uid} className="border-b border-zinc-100 last:border-0">
                  <td className="px-4 py-2 text-zinc-900 font-medium">{row.email}</td>
                  <td className="px-4 py-2 text-zinc-600">{row.role}</td>
                  <td className="px-4 py-2">
                    <AdminStatusBadge variant={getStatusBadgeVariant(row.status, "userApproval")}>
                      {row.status}
                    </AdminStatusBadge>
                  </td>
                  <td className="px-4 py-2 text-zinc-600 text-xs">
                    {row.primaryAgencyId ?? row.agencyId ?? "—"}
                  </td>
                  <td className="px-4 py-2">
                    <code className="text-xs text-zinc-500">{row.uid.slice(0, 8)}…</code>
                    <button
                      type="button"
                      onClick={() => copyUid(row.uid)}
                      className="ml-1 text-zinc-500 hover:text-zinc-700 text-xs"
                      title="Copy UID"
                    >
                      Copy
                    </button>
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex flex-wrap items-center gap-2">
                      {row.status !== "active" && (
                        <button
                          type="button"
                          disabled={actioning === row.uid}
                          onClick={() => patchUser(row.uid, { status: "active" })}
                          className="rounded border border-zinc-300 bg-zinc-50 px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-50"
                        >
                          Activate
                        </button>
                      )}
                      {row.status === "active" && (
                        <button
                          type="button"
                          disabled={actioning === row.uid}
                          onClick={() => patchUser(row.uid, { status: "disabled" })}
                          className="rounded border border-zinc-300 bg-zinc-50 px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-50"
                        >
                          Disable
                        </button>
                      )}
                      <select
                        value={row.role}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (v && v !== row.role) patchUser(row.uid, { role: v });
                        }}
                        disabled={actioning === row.uid}
                        className="rounded border border-zinc-300 px-2 py-1 text-xs disabled:opacity-50 bg-white"
                      >
                        {ROLE_OPTIONS.filter((r) => r !== "all").map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
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
