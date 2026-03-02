"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";

type LandlordRow = {
  uid: string;
  email: string;
  displayName: string;
  status: string;
  agencyIds: string[];
  agencyId: string | null;
  createdAt: unknown;
};

function formatDate(v: unknown): string {
  if (v == null) return "—";
  const t = v as { seconds?: number; toDate?: () => Date };
  if (typeof t.toDate === "function") return t.toDate().toLocaleDateString();
  if (typeof t.seconds === "number") return new Date(t.seconds * 1000).toLocaleDateString();
  return String(v);
}

function StatusChip({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active: "bg-green-100 text-green-800",
    pending: "bg-amber-100 text-amber-800",
    disabled: "bg-zinc-100 text-zinc-600",
  };
  return (
    <span
      className={`rounded px-2 py-0.5 text-xs font-medium ${styles[status] ?? "bg-zinc-100 text-zinc-700"}`}
    >
      {status}
    </span>
  );
}

export default function AdminLandlordsPage() {
  const [list, setList] = useState<LandlordRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/landlords", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : []))
      .then((data: LandlordRow[]) => setList(Array.isArray(data) ? data : []))
      .catch(() => setList([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <PageHeader title="Landlords" />
      <Card className="p-6 mt-4">
        {loading ? (
          <p className="text-sm text-zinc-500">Loading…</p>
        ) : list.length === 0 ? (
          <EmptyState
            title="No landlords"
            description="Invite landlords from Landlord Invites to see them here."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-zinc-200">
              <thead>
                <tr>
                  <th className="py-2 px-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="py-2 px-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="py-2 px-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="py-2 px-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="py-2 px-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">
                    Agency
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                {list.map((row) => (
                  <tr key={row.uid} className="bg-white">
                    <td className="py-2 px-3 text-sm text-zinc-900">
                      <Link
                        href={`/admin/landlords/${encodeURIComponent(row.uid)}`}
                        className="text-zinc-900 hover:underline"
                      >
                        {row.email || "—"}
                      </Link>
                    </td>
                    <td className="py-2 px-3 text-sm text-zinc-900">
                      <Link
                        href={`/admin/landlords/${encodeURIComponent(row.uid)}`}
                        className="text-zinc-900 hover:underline"
                      >
                        {row.displayName || "—"}
                      </Link>
                    </td>
                    <td className="py-2 px-3">
                      <StatusChip status={row.status} />
                    </td>
                    <td className="py-2 px-3 text-sm text-zinc-600">{formatDate(row.createdAt)}</td>
                    <td className="py-2 px-3">
                      {row.agencyId ? (
                        <span className="text-sm text-zinc-600">{row.agencyId}</span>
                      ) : (
                        <span
                          className="inline-flex items-center rounded px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-800"
                          title="No agency assigned"
                        >
                          No agency
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
