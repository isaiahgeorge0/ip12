"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/Card";
import { AdminSummaryCard } from "@/components/admin/AdminSummaryCard";
import { AdminSectionHeader } from "@/components/admin/AdminSectionHeader";

type AgencyRow = { agencyId: string; name: string; status: string };
type UserRow = { uid: string; email: string; role: string; status: string; primaryAgencyId?: string | null };
type AuditRow = { id: string; action: string; actorUid: string; createdAtMs: number | null; targetType: string };

type DashboardData = {
  agencies: AgencyRow[];
  pendingUsers: UserRow[];
  activeUsersCount: number;
  auditLogs: AuditRow[];
};

function formatDate(ms: number | null | undefined): string {
  if (ms == null) return "—";
  return new Date(ms).toLocaleDateString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function SuperAdminDashboardOverview() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch("/api/superadmin/agencies?limit=100", { credentials: "include" }).then((r) => (r.ok ? r.json() : { results: [] })),
      fetch("/api/superadmin/users?status=pending&limit=100", { credentials: "include" }).then((r) => (r.ok ? r.json() : { results: [] })),
      fetch("/api/superadmin/users?status=active&limit=500", { credentials: "include" }).then((r) => (r.ok ? r.json() : { results: [] })),
      fetch("/api/admin/audit", { credentials: "include" }).then((r) => (r.ok ? r.json() : [])),
    ])
      .then(([agenciesRes, pendingRes, activeRes, auditRes]) => {
        const agencies = Array.isArray(agenciesRes?.results) ? agenciesRes.results : [];
        const pendingUsers = Array.isArray(pendingRes?.results) ? pendingRes.results : [];
        const activeUsers = Array.isArray(activeRes?.results) ? activeRes.results : [];
        const auditLogs = Array.isArray(auditRes) ? auditRes : [];
        setData({
          agencies,
          pendingUsers,
          activeUsersCount: activeUsers.length,
          auditLogs,
        });
      })
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="rounded-lg border border-zinc-200 bg-zinc-50/50 p-6 text-center mb-8">
        <p className="text-sm text-zinc-500">Loading platform overview…</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-lg border border-zinc-200 bg-zinc-50/50 p-6 text-center mb-8">
        <p className="text-sm text-zinc-500">Unable to load overview. Check your connection and try again.</p>
      </div>
    );
  }

  const activeAgencies = data.agencies.filter((a) => a.status === "active");
  const disabledAgencies = data.agencies.filter((a) => a.status === "disabled");
  const pendingCount = data.pendingUsers.length;
  const recentAudit = data.auditLogs.slice(0, 5);
  const recentDisabled = disabledAgencies.slice(0, 3);

  return (
    <>
      <AdminSectionHeader title="Platform overview" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 mb-8">
        <AdminSummaryCard
          title="Pending approvals"
          count={pendingCount}
          helperText="Users awaiting access"
          ctaLabel="Review"
          ctaHref="/superadmin/approvals"
          highlight={pendingCount > 0}
        />
        <AdminSummaryCard
          title="Active agencies"
          count={activeAgencies.length}
          helperText="Live on platform"
          ctaLabel="View agencies"
          ctaHref="/superadmin/agencies"
        />
        <AdminSummaryCard
          title="Disabled agencies"
          count={disabledAgencies.length}
          helperText="Currently disabled"
          ctaLabel="View agencies"
          ctaHref="/superadmin/agencies"
          highlight={disabledAgencies.length > 0}
        />
        <AdminSummaryCard
          title="Active users"
          count={data.activeUsersCount}
          helperText="Platform-wide"
          ctaLabel="User approvals"
          ctaHref="/superadmin/approvals"
        />
        <AdminSummaryCard
          title="Recent audit"
          count={data.auditLogs.length}
          helperText="Last 200 entries"
          ctaLabel="View audit"
          ctaHref="/admin/audit"
        />
      </div>

      <AdminSectionHeader title="Needs review" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-8">
        <Card className="p-4">
          <h3 className="text-sm font-medium text-zinc-700 mb-2">Pending approvals</h3>
          {data.pendingUsers.length === 0 ? (
            <p className="text-xs text-zinc-500">No pending approvals.</p>
          ) : (
            <ul className="space-y-1.5">
              {data.pendingUsers.slice(0, 5).map((u) => (
                <li key={u.uid} className="text-sm">
                  <Link href="/superadmin/approvals" className="text-zinc-900 hover:underline truncate block">
                    {u.email || u.uid}
                  </Link>
                  <span className="text-xs text-zinc-500">{u.role}</span>
                </li>
              ))}
            </ul>
          )}
          <Link href="/superadmin/approvals" className="mt-2 inline-block text-xs font-medium text-zinc-600 hover:text-zinc-900">
            View all →
          </Link>
        </Card>

        <Card className="p-4">
          <h3 className="text-sm font-medium text-zinc-700 mb-2">Disabled agencies</h3>
          {recentDisabled.length === 0 ? (
            <p className="text-xs text-zinc-500">No disabled agencies.</p>
          ) : (
            <ul className="space-y-1.5">
              {recentDisabled.map((a) => (
                <li key={a.agencyId} className="text-sm">
                  <Link href="/superadmin/agencies" className="text-zinc-900 hover:underline">
                    {a.name || a.agencyId}
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <Link href="/superadmin/agencies" className="mt-2 inline-block text-xs font-medium text-zinc-600 hover:text-zinc-900">
            View all →
          </Link>
        </Card>

        <Card className="p-4">
          <h3 className="text-sm font-medium text-zinc-700 mb-2">Recent audit</h3>
          {recentAudit.length === 0 ? (
            <p className="text-xs text-zinc-500">No audit entries.</p>
          ) : (
            <ul className="space-y-1.5">
              {recentAudit.map((e) => (
                <li key={e.id} className="text-sm">
                  <Link href="/admin/audit" className="text-zinc-900 hover:underline">
                    {e.action}
                  </Link>
                  <span className="text-xs text-zinc-500 block">{e.targetType} · {formatDate(e.createdAtMs)}</span>
                </li>
              ))}
            </ul>
          )}
          <Link href="/admin/audit" className="mt-2 inline-block text-xs font-medium text-zinc-600 hover:text-zinc-900">
            View audit →
          </Link>
        </Card>
      </div>

      <AdminSectionHeader title="Platform navigation" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Link href="/superadmin/approvals">
          <Card className="p-4 h-full hover:border-zinc-400 transition-colors">
            <p className="text-sm font-medium text-zinc-900">User approvals</p>
            <p className="text-xs text-zinc-500 mt-0.5">Review access and roles</p>
          </Card>
        </Link>
        <Link href="/superadmin/agencies">
          <Card className="p-4 h-full hover:border-zinc-400 transition-colors">
            <p className="text-sm font-medium text-zinc-900">Agencies</p>
            <p className="text-xs text-zinc-500 mt-0.5">Manage agencies</p>
          </Card>
        </Link>
        <Link href="/admin/audit">
          <Card className="p-4 h-full hover:border-zinc-400 transition-colors">
            <p className="text-sm font-medium text-zinc-900">Audit log</p>
            <p className="text-xs text-zinc-500 mt-0.5">Platform activity</p>
          </Card>
        </Link>
        <Card className="p-4 h-full border-zinc-200 bg-zinc-50/50">
          <p className="text-sm font-medium text-zinc-700">Global search</p>
          <p className="text-xs text-zinc-500 mt-0.5">Use search above</p>
        </Card>
      </div>
    </>
  );
}
