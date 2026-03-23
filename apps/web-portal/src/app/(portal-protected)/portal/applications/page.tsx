"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";

type ApplicationRow = {
  id: string;
  agencyId: string;
  propertyDisplayLabel: string;
  applicationProgressStatus: string;
  lastEditedAt: number | null;
};

export default function PortalApplicationsPage() {
  const [applications, setApplications] = useState<ApplicationRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/portal/applications", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setApplications(Array.isArray(data) ? data : []))
      .catch(() => setApplications([]))
      .finally(() => setLoading(false));
  }, []);

  const statusLabel = (s: string) => {
    if (s === "submitted") return "Submitted";
    if (s === "in_progress") return "In progress";
    return "Draft";
  };

  return (
    <>
      <PageHeader title="Applications" />
      {loading ? (
        <p className="text-sm text-zinc-500">Loading…</p>
      ) : applications.length === 0 ? (
        <EmptyState
          title="No applications"
          description="When you proceed with an application from a message or create one, it will appear here."
        />
      ) : (
        <div className="space-y-3">
          {applications.map((a) => (
            <Link key={`${a.agencyId}-${a.id}`} href={`/portal/applications/${a.id}`}>
              <Card className="p-4 hover:border-zinc-400 transition-colors">
                <p className="font-medium text-zinc-900">{a.propertyDisplayLabel}</p>
                <p className="text-sm text-zinc-500 mt-0.5">
                  Last updated: {a.lastEditedAt != null ? new Date(a.lastEditedAt).toLocaleString() : "—"}
                </p>
                <span className="inline-block mt-2 rounded px-2 py-0.5 text-xs font-medium bg-zinc-200 text-zinc-700">
                  {statusLabel(a.applicationProgressStatus)}
                </span>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
