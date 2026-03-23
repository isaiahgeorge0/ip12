"use client";

import { useCallback, useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { AdminStatusBadge } from "@/components/admin/AdminStatusBadge";
import { AdminTable, type AdminTableColumn, AdminTableActionLink } from "@/components/admin/AdminTable";
import { getStatusBadgeVariant } from "@/lib/admin/statusBadge";
import { useAuth } from "@/contexts/AuthContext";
import {
  ENQUIRY_STATUSES,
  ENQUIRY_STATUS_LABELS,
  type EnquiryStatus,
} from "@/lib/types/enquiry";
import { formatAdminDate } from "@/lib/admin/formatAdminDate";

type EnquiryRow = {
  id: string;
  propertyId: string;
  propertyDisplayLabel: string;
  agencyId: string;
  applicantUserId: string;
  applicantName: string;
  applicantEmail: string;
  applicantPhone: string | null;
  message: string;
  status: EnquiryStatus;
  source: string;
  createdAt: number | null;
  updatedAt: number | null;
};

function messagePreview(msg: string, maxLen: number = 80): string {
  if (!msg || !msg.trim()) return "—";
  const t = msg.trim().replace(/\s+/g, " ");
  return t.length <= maxLen ? t : t.slice(0, maxLen) + "…";
}

function ConvertButton({
  enquiryId,
  agencyId,
  onSuccess,
  onError,
}: {
  enquiryId: string;
  agencyId: string;
  onSuccess: () => void;
  onError: (msg: string) => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  return (
    <button
      type="button"
      disabled={submitting}
      onClick={() => {
        setSubmitting(true);
        fetch(`/api/admin/enquiries/${enquiryId}/convert`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ agencyId }),
        })
          .then(async (res) => {
            const data = await res.json().catch(() => ({}));
            if (res.ok && data.applicantId) {
              onSuccess();
            } else {
              onError((data as { error?: string }).error ?? "Convert failed");
            }
          })
          .catch(() => onError("Convert failed"))
          .finally(() => setSubmitting(false));
      }}
      className="rounded-md border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-700 bg-zinc-50 hover:bg-zinc-100 disabled:opacity-50"
    >
      {submitting ? "Converting…" : "Convert to applicant"}
    </button>
  );
}

export default function AdminEnquiriesPage() {
  const { profile } = useAuth();
  const searchParams = useSearchParams();
  const agencyIdParam = searchParams?.get("agencyId")?.trim() ?? null;
  const isSuperAdmin = profile?.role === "superAdmin";
  const sessionAgencyId = profile?.agencyId ?? null;
  const effectiveAgencyId = isSuperAdmin ? agencyIdParam : sessionAgencyId;

  const [enquiries, setEnquiries] = useState<EnquiryRow[]>([]);
  const [applicantsList, setApplicantsList] = useState<
    { recentEnquiries: { enquiryId: string }[]; existingApplicantId: string | null }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [propertyFilter, setPropertyFilter] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  const loadData = useCallback(() => {
    if (!effectiveAgencyId) {
      setEnquiries([]);
      setApplicantsList([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const params = new URLSearchParams();
    params.set("agencyId", effectiveAgencyId);
    params.set("limit", "200");
    Promise.all([
      fetch(`/api/admin/enquiries?${params}`, { credentials: "include" }),
      fetch(`/api/admin/applicants-list?agencyId=${encodeURIComponent(effectiveAgencyId)}&limit=100`, {
        credentials: "include",
      }),
    ])
      .then(async ([r1, r2]) => {
        const list = r1.ok ? await r1.json() : [];
        setEnquiries(Array.isArray(list) ? list : []);
        const list2 = r2.ok ? await r2.json() : [];
        setApplicantsList(Array.isArray(list2) ? list2 : []);
      })
      .catch(() => {
        setEnquiries([]);
        setApplicantsList([]);
      })
      .finally(() => setLoading(false));
  }, [effectiveAgencyId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(t);
    }
  }, [toast]);

  const enquiryIdToApplicantId = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of applicantsList) {
      const applicantId = row.existingApplicantId ?? null;
      if (!applicantId) continue;
      for (const re of row.recentEnquiries ?? []) {
        if (re.enquiryId) map.set(re.enquiryId, applicantId);
      }
    }
    return map;
  }, [applicantsList]);

  const filtered = useMemo(() => {
    let list = enquiries;
    if (statusFilter) {
      list = list.filter((e) => e.status === statusFilter);
    }
    if (propertyFilter) {
      list = list.filter((e) => e.propertyId === propertyFilter);
    }
    if (q.trim()) {
      const lower = q.trim().toLowerCase();
      list = list.filter(
        (e) =>
          (e.applicantName && e.applicantName.toLowerCase().includes(lower)) ||
          (e.applicantEmail && e.applicantEmail.toLowerCase().includes(lower)) ||
          (e.message && e.message.toLowerCase().includes(lower))
      );
    }
    return list;
  }, [enquiries, statusFilter, propertyFilter, q]);

  const propertyOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const e of enquiries) {
      if (e.propertyId && !seen.has(e.propertyId)) {
        seen.set(e.propertyId, e.propertyDisplayLabel || `Property ${e.propertyId}`);
      }
    }
    return Array.from(seen.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [enquiries]);

  const newCount = enquiries.filter((e) => e.status === "new").length;
  const qualifiedNotConverted = enquiries.filter((e) =>
    ["contacted", "viewing_booked", "viewing_complete", "application_requested"].includes(e.status)
  ).length;
  const hasFilters = !!q.trim() || !!statusFilter || !!propertyFilter;
  const pageSubtitle = "Track incoming property interest and convert leads into applicants.";

  if (!effectiveAgencyId && !isSuperAdmin) {
    return (
      <>
        <AdminPageHeader title="Enquiries" subtitle={pageSubtitle} />
        <EmptyState title="No agency" description="Your account is not linked to an agency." />
      </>
    );
  }

  if (isSuperAdmin && !effectiveAgencyId) {
    return (
      <>
        <AdminPageHeader title="Enquiries" subtitle={pageSubtitle} />
        <EmptyState
          title="Select an agency from the header to view enquiries."
          description="Use the agency dropdown in the header to see enquiries for that agency."
        />
      </>
    );
  }

  const query = effectiveAgencyId ? `?agencyId=${encodeURIComponent(effectiveAgencyId)}` : "";

  return (
    <>
      {toast && (
        <div
          className="fixed bottom-4 right-4 z-20 rounded-lg bg-zinc-900 px-4 py-2 text-sm text-white shadow-lg"
          role="status"
        >
          {toast}
        </div>
      )}
      <AdminPageHeader title="Enquiries" subtitle={pageSubtitle} />

      {effectiveAgencyId && (
        <Card className="mt-4 p-4 border-zinc-200 bg-zinc-50/50">
          <h2 className="text-sm font-semibold text-zinc-900">Next recommended action</h2>
          {newCount > 0 ? (
            <>
              <p className="mt-1 text-sm text-zinc-700">
                You have new inbound property interest that still needs review.
              </p>
              <p className="mt-0.5 text-xs text-zinc-500">
                {newCount} uncontacted {newCount === 1 ? "enquiry" : "enquiries"} below.
              </p>
              <a
                href="#enquiries-list"
                className="mt-2 inline-block text-sm font-medium text-amber-700 hover:text-amber-900"
              >
                Review new enquiries →
              </a>
            </>
          ) : qualifiedNotConverted > 0 ? (
            <>
              <p className="mt-1 text-sm text-zinc-700">
                Turn qualified interest into applicants when they are ready to move forward.
              </p>
              <Link
                href={`/admin/enquiries${query}#enquiries-list`}
                className="mt-2 inline-block text-sm font-medium text-zinc-700 hover:text-zinc-900"
              >
                Convert qualified enquiries →
              </Link>
            </>
          ) : (
            <p className="mt-1 text-sm text-zinc-600">No urgent enquiry actions right now.</p>
          )}
        </Card>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg border border-zinc-200 bg-zinc-50/50 px-4 py-3">
        <input
          type="search"
          placeholder="Search name, email, message…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 w-56 bg-white"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 bg-white"
        >
          <option value="">All statuses</option>
          {ENQUIRY_STATUSES.map((s) => (
            <option key={s} value={s}>
              {ENQUIRY_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        <select
          value={propertyFilter}
          onChange={(e) => setPropertyFilter(e.target.value)}
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 bg-white min-w-[180px]"
        >
          <option value="">All properties</option>
          {propertyOptions.map(([id, label]) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <div id="enquiries-list" className="mt-4">
        {(() => {
          const columns: Array<AdminTableColumn<EnquiryRow>> = [
            {
              key: "contact",
              label: "Contact",
              render: (e) => (
                <div>
                  <span className="font-medium text-admin-fg">
                    {e.applicantName?.trim() || e.applicantEmail || "—"}
                  </span>
                  {(e.applicantEmail || e.applicantPhone) ? (
                    <p className="text-xs text-admin-muted-fg mt-0.5">
                      {[e.applicantEmail, e.applicantPhone].filter(Boolean).join(" · ")}
                    </p>
                  ) : null}
                </div>
              ),
            },
            {
              key: "property",
              label: "Property",
              render: (e) => (
                <Link
                  href={`/admin/properties/${e.propertyId}${query}`}
                  className="text-admin-neutral-fg hover:underline"
                >
                  {e.propertyDisplayLabel || e.propertyId || "—"}
                </Link>
              ),
            },
            {
              key: "status",
              label: "Status",
              render: (e) => (
                <AdminStatusBadge variant={getStatusBadgeVariant(e.status, "enquiry")}>
                  {ENQUIRY_STATUS_LABELS[e.status]}
                </AdminStatusBadge>
              ),
            },
            {
              key: "message",
              label: "Message",
              cellClassName: "max-w-[220px] text-admin-neutral-fg",
              render: (e) => <span title={e.message || undefined}>{messagePreview(e.message)}</span>,
            },
            {
              key: "updated",
              label: "Updated",
              cellClassName: "text-admin-muted-fg whitespace-nowrap",
              render: (e) => formatAdminDate(e.updatedAt ?? e.createdAt, "dateTime"),
            },
          ];

          const emptyState =
            filtered.length === 0 && !hasFilters
              ? {
                  title: "No enquiries yet",
                  description:
                    "Enquiries appear here when someone contacts a listing from the public site or portal.",
                }
              : filtered.length === 0 && hasFilters
                ? {
                    title: "No enquiries match your filters",
                    description: "Try changing search, status, or property.",
                  }
                : undefined;

          return (
            <AdminTable<EnquiryRow>
              title="Enquiries"
              description="Inbound interest from listings. Convert to applicants when ready."
              columns={columns}
              rows={filtered}
              getRowKey={(e) => e.id}
              isLoading={loading}
              loadingText="Loading enquiries…"
              emptyState={emptyState}
              renderActions={(e) => {
                const applicantId = enquiryIdToApplicantId.get(e.id);
                return (
                  <>
                    {applicantId ? (
                      <>
                        <span className="text-xs text-admin-muted-fg">Applicant created</span>
                        <AdminTableActionLink href={`/admin/applicants/${applicantId}${query}`}>
                          Open applicant
                        </AdminTableActionLink>
                      </>
                    ) : (
                      !["rejected", "archived"].includes(e.status) && (
                        <ConvertButton
                          enquiryId={e.id}
                          agencyId={e.agencyId}
                          onSuccess={() => {
                            setToast("Applicant created");
                            loadData();
                          }}
                          onError={(msg) => setToast(msg)}
                        />
                      )
                    )}
                    <AdminTableActionLink href={`/admin/properties/${e.propertyId}${query}`}>
                      Open property
                    </AdminTableActionLink>
                  </>
                );
              }}
            />
          );
        })()}
      </div>
    </>
  );
}
