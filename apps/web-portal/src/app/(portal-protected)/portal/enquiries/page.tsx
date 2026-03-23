"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { ENQUIRY_STATUS_LABELS, type EnquiryStatus } from "@/lib/types/enquiry";

type EnquiryRow = {
  id: string;
  agencyId: string;
  propertyDisplayLabel: string;
  message: string;
  status: EnquiryStatus;
  createdAt: number | null;
};

export default function PortalEnquiriesPage() {
  const [enquiries, setEnquiries] = useState<EnquiryRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/portal/enquiries", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setEnquiries(Array.isArray(data) ? data : []))
      .catch(() => setEnquiries([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <PageHeader title="Enquiries" />
      {loading ? (
        <p className="text-sm text-zinc-500">Loading…</p>
      ) : enquiries.length === 0 ? (
        <EmptyState
          title="No enquiries"
          description="Enquiries you submit from property listings will appear here."
        />
      ) : (
        <div className="space-y-3">
          {enquiries.map((e) => (
            <Card key={`${e.agencyId}-${e.id}`} className="p-4">
              <p className="font-medium text-zinc-900">{e.propertyDisplayLabel}</p>
              <p className="text-sm text-zinc-500 mt-0.5">
                {e.createdAt != null ? new Date(e.createdAt).toLocaleString() : "—"}
              </p>
              <p className="text-sm text-zinc-600 mt-2 line-clamp-2">{e.message || "—"}</p>
              <span className="inline-block mt-2 rounded px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-800">
                {ENQUIRY_STATUS_LABELS[e.status] ?? e.status}
              </span>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
