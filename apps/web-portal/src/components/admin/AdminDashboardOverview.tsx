"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Card } from "@/components/Card";
import { AdminSummaryCard } from "@/components/admin/AdminSummaryCard";
import { AdminSectionHeader } from "@/components/admin/AdminSectionHeader";
import { useAuth } from "@/contexts/AuthContext";
import { getRentDashboardMetrics } from "@/lib/rent/getRentDashboardMetrics";
import { formatAdminDate } from "@/lib/admin/formatAdminDate";
import { Skeleton } from "@/components/ui/Skeleton";

type EnquiryRow = { id: string; status: string; applicantName: string; propertyDisplayLabel: string; createdAt: unknown; agencyId: string };
type ViewingRow = { id: string; status: string; applicantName: string; propertyDisplayLabel: string; scheduledAt: number | null; agencyId: string };
type PipelineRow = { id: string; stage: string; applicantName: string; propertyDisplayLabel: string; lastActionAt: number | null; agencyId: string };
type QueueRow = { id: string; stage: string; applicantName: string; propertyDisplayLabel: string; lastActionAt: number | null; agencyId: string };

type DashboardData = {
  enquiries: EnquiryRow[];
  viewings: ViewingRow[];
  pipeline: PipelineRow[];
  offers: { id: string; status: string; agencyId: string }[];
  queue: QueueRow[];
  queueUnified: { id: string; title: string; propertyDisplayLabel: string; applicantName?: string; createdAt: number | null; type: string }[];
  tenancies: { id: string; status: string; agencyId: string }[];
  jobs: { id: string; status: string; title: string; contractorName: string; propertyDisplayLabel: string | null }[];
  maintenance: { id: string; status: string; agencyId: string }[];
  rentPayments: { id: string; status: string; tenancyId?: string | null; dueDate?: string | null; rentAmount?: number; amountPaid?: number | null; paidAt?: number | null }[];
};

function formatGBP(value: number): string {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
}

export function AdminDashboardOverview() {
  const { profile } = useAuth();
  const searchParams = useSearchParams();
  const agencyIdParam = searchParams?.get("agencyId")?.trim() ?? null;
  const agencyId = profile?.agencyId ?? null;
  const isSuperAdmin = profile?.role === "superAdmin";
  const effectiveAgencyId = isSuperAdmin ? agencyIdParam : agencyId;

  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!effectiveAgencyId) {
      setData(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const base = `agencyId=${encodeURIComponent(effectiveAgencyId)}`;
    Promise.all([
      fetch(`/api/admin/enquiries?${base}&limit=50`, { credentials: "include" }).then((r) => (r.ok ? r.json() : [])),
      fetch(`/api/admin/viewings?${base}&limit=50`, { credentials: "include" }).then((r) => (r.ok ? r.json() : [])),
      fetch(`/api/admin/application-pipeline?${base}&limit=80`, { credentials: "include" }).then((r) => (r.ok ? r.json() : [])),
      fetch(`/api/admin/offers?${base}`, { credentials: "include" }).then((r) => (r.ok ? r.json() : [])),
      fetch(`/api/admin/staff-action-queue?${base}`, { credentials: "include" }).then((r) => (r.ok ? r.json() : [])),
      fetch(`/api/admin/staff-action-queue?${base}&unified=1&view=open`, { credentials: "include" }).then((r) => (r.ok ? r.json() : { items: [] })),
      fetch(`/api/admin/tenancies?${base}`, { credentials: "include" }).then((r) => (r.ok ? r.json() : [])),
      fetch(`/api/admin/jobs?${base}&limit=100`, { credentials: "include" }).then((r) => (r.ok ? r.json() : [])),
      fetch(`/api/admin/maintenance?${base}`, { credentials: "include" }).then((r) => (r.ok ? r.json() : [])),
      fetch(`/api/admin/rent?${base}`, { credentials: "include" }).then((r) => (r.ok ? r.json() : [])),
    ])
      .then(([enquiries, viewings, pipeline, offers, queue, queueUnifiedRes, tenancies, jobs, maintenance, rentPayments]) => {
        const queueUnified = Array.isArray((queueUnifiedRes as { items?: unknown[] })?.items)
          ? (queueUnifiedRes as { items: { id: string; title: string; propertyDisplayLabel: string; applicantName?: string; createdAt: number | null; type: string }[] }).items.slice(0, 5)
          : [];
        setData({
          enquiries: Array.isArray(enquiries) ? enquiries : [],
          viewings: Array.isArray(viewings) ? viewings : [],
          pipeline: Array.isArray(pipeline) ? pipeline : [],
          offers: Array.isArray(offers) ? offers : [],
          queue: Array.isArray(queue) ? queue : [],
          queueUnified,
          tenancies: Array.isArray(tenancies) ? tenancies : [],
          jobs: Array.isArray(jobs) ? jobs : [],
          maintenance: Array.isArray(maintenance) ? maintenance : [],
          rentPayments: Array.isArray(rentPayments) ? rentPayments : [],
        });
      })
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [effectiveAgencyId]);

  if (!effectiveAgencyId && !isSuperAdmin) return null;
  if (isSuperAdmin && !effectiveAgencyId) {
    return (
      <Card className="p-4 mb-6">
        <p className="text-sm font-medium text-admin-neutral-fg mb-1">
          Select an agency from the header to see the operational overview.
        </p>
        <p className="text-xs text-admin-muted-fg">Use the agency dropdown in the top bar.</p>
      </Card>
    );
  }

  if (loading || !data) {
    return (
      <Card className="p-6 mb-6">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-lg border border-admin-border bg-admin-surface p-5">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="mt-3 h-8 w-20" />
              <Skeleton className="mt-3 h-3 w-40" />
              <Skeleton className="mt-4 h-3 w-16" />
            </div>
          ))}
        </div>
        <p className="mt-5 text-sm text-admin-muted-fg text-center">Loading operational overview…</p>
      </Card>
    );
  }

  const newEnquiries = data.enquiries.filter((e) => e.status === "new");
  const now = Date.now();
  const upcomingViewings = data.viewings.filter(
    (v: { status: string; scheduledAt?: number | null }) =>
      (v.status === "requested" || v.status === "booked") &&
      v.scheduledAt != null &&
      Number.isFinite(v.scheduledAt) &&
      v.scheduledAt >= now
  );
  const viewingsAwaiting = data.viewings.filter((v) => v.status === "requested" || v.status === "booked");
  const pipelineInProgress = data.pipeline.filter((p) =>
    ["application_started", "application_created", "application_submitted", "prompt_sent", "ready_to_apply"].includes(p.stage)
  );
  const applicationsAwaitingReview = data.pipeline.filter((p) => p.stage === "application_submitted");
  const offersSent = data.offers.filter((o) => o.status === "sent");
  const queueAwaiting = data.queue.filter((q) => q.stage === "offer_accepted");
  const activeTenancies = data.tenancies.filter((t) => t.status === "active");
  const upcomingMoveIns = data.tenancies.filter((t) => t.status === "preparing");
  const openJobs = data.jobs.filter((j) => ["assigned", "scheduled", "in_progress"].includes(j.status));
  const openMaintenanceRequests = data.maintenance.filter((m) => m.status !== "completed");
  const rentMetrics = getRentDashboardMetrics(data.rentPayments);
  const rentHref = effectiveAgencyId ? `/admin/rent?agencyId=${encodeURIComponent(effectiveAgencyId)}` : "/admin/rent";

  const recentEnquiries = data.enquiries.slice(0, 3);
  const recentViewings = data.viewings.slice(0, 3);
  const recentPipeline = data.pipeline.slice(0, 3);
  const recentQueue = data.queue.filter((q) => q.stage === "offer_accepted").slice(0, 3);

  return (
    <>
      <AdminSectionHeader title="Pipeline" />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6 mb-10">
        <AdminSummaryCard
          title="New enquiries"
          count={newEnquiries.length}
          helperText="Inbound property interest awaiting review"
          ctaLabel="Open enquiries"
          ctaHref={effectiveAgencyId ? `/admin/enquiries?agencyId=${encodeURIComponent(effectiveAgencyId)}` : "/admin/enquiries"}
          highlight={newEnquiries.length > 0}
        />
        <AdminSummaryCard
          title="Upcoming viewings"
          count={upcomingViewings.length}
          helperText="Property viewings scheduled with prospective tenants."
          ctaLabel="Open viewings"
          ctaHref={effectiveAgencyId ? `/admin/viewings?agencyId=${encodeURIComponent(effectiveAgencyId)}` : "/admin/viewings"}
          highlight={upcomingViewings.length > 0}
        />
        <AdminSummaryCard
          title="Applications awaiting review"
          count={applicationsAwaitingReview.length}
          helperText="Tenant applications requiring staff review."
          ctaLabel="Open applications"
          ctaHref={effectiveAgencyId ? `/admin/applications?agencyId=${encodeURIComponent(effectiveAgencyId)}` : "/admin/applications"}
          highlight={applicationsAwaitingReview.length > 0}
        />
        <AdminSummaryCard
          title="Pipeline in progress"
          count={pipelineInProgress.length}
          helperText="Pipeline items in progress"
          ctaLabel="Open pipeline"
          ctaHref={effectiveAgencyId ? `/admin/application-pipeline?agencyId=${encodeURIComponent(effectiveAgencyId)}` : "/admin/application-pipeline"}
        />
        <AdminSummaryCard
          title="Offers awaiting response"
          count={offersSent.length}
          helperText="Tenancy offers awaiting tenant response."
          ctaLabel="Open offers"
          ctaHref={effectiveAgencyId ? `/admin/offers?agencyId=${encodeURIComponent(effectiveAgencyId)}` : "/admin/offers"}
        />
        <AdminSummaryCard
          title="Accepted offers (queue)"
          count={queueAwaiting.length}
          helperText="Need staff action"
          ctaLabel="Open action queue"
          ctaHref={effectiveAgencyId ? `/admin/staff-action-queue?agencyId=${encodeURIComponent(effectiveAgencyId)}` : "/admin/staff-action-queue"}
          highlight={queueAwaiting.length > 0}
        />
      </div>

      <AdminSectionHeader title="Tenancy management" />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 mb-10">
        <AdminSummaryCard
          title="Upcoming move-ins"
          count={upcomingMoveIns.length}
          helperText="Tenancies preparing for move-in."
          ctaLabel="Open tenancies"
          ctaHref={effectiveAgencyId ? `/admin/tenancies?agencyId=${encodeURIComponent(effectiveAgencyId)}` : "/admin/tenancies"}
          highlight={upcomingMoveIns.length > 0}
        />
        <AdminSummaryCard
          title="Active tenancies"
          count={activeTenancies.length}
          helperText="Current tenancies"
          ctaLabel="Open tenancies"
          ctaHref={effectiveAgencyId ? `/admin/tenancies?agencyId=${encodeURIComponent(effectiveAgencyId)}` : "/admin/tenancies"}
        />
      </div>

      <AdminSectionHeader title="Rent & financial" />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 mb-10">
        <AdminSummaryCard
          title="Rent collected this month"
          count={rentMetrics.rentCollectedThisMonth}
          helperText="Payments recorded this month."
          ctaLabel="Open rent"
          ctaHref={rentHref}
          displayValue={formatGBP(rentMetrics.rentCollectedThisMonth)}
        />
        <AdminSummaryCard
          title="Rent due this month"
          count={rentMetrics.rentDueThisMonth}
          helperText="Scheduled rent due this month."
          ctaLabel="Open rent"
          ctaHref={rentHref}
          displayValue={formatGBP(rentMetrics.rentDueThisMonth)}
        />
        <AdminSummaryCard
          title="Late rent payments"
          count={rentMetrics.latePayments}
          helperText="Overdue rent requiring follow-up."
          ctaLabel="Open rent"
          ctaHref={rentHref}
          highlight={rentMetrics.latePayments > 0}
        />
        <AdminSummaryCard
          title="Tenants in arrears"
          count={rentMetrics.tenantsInArrears}
          helperText="Tenancies with overdue rent."
          ctaLabel="Open rent"
          ctaHref={rentHref}
          highlight={rentMetrics.tenantsInArrears > 0}
        />
      </div>

      <AdminSectionHeader title="Maintenance" />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 mb-10">
        <AdminSummaryCard
          title="Open maintenance jobs"
          count={openJobs.length}
          helperText="Assigned, scheduled, or in progress"
          ctaLabel="Open jobs"
          ctaHref={effectiveAgencyId ? `/admin/jobs?agencyId=${encodeURIComponent(effectiveAgencyId)}` : "/admin/jobs"}
          highlight={openJobs.length > 0}
        />
        <AdminSummaryCard
          title="Open maintenance requests"
          count={openMaintenanceRequests.length}
          helperText="Repair requests not yet completed"
          ctaLabel="Open maintenance"
          ctaHref={effectiveAgencyId ? `/admin/maintenance?agencyId=${encodeURIComponent(effectiveAgencyId)}` : "/admin/maintenance"}
          highlight={openMaintenanceRequests.length > 0}
        />
        <AdminSummaryCard
          title="Tickets"
          count={0}
          helperText="Work items tracked as tickets."
          ctaLabel="Open tickets"
          ctaHref={effectiveAgencyId ? `/admin/tickets?agencyId=${encodeURIComponent(effectiveAgencyId)}` : "/admin/tickets"}
        />
      </div>

      {data.queueUnified.length > 0 ? (
        <Card className="p-5 mb-10 border-admin-warning-border bg-admin-warning/30">
          <h3 className="text-sm font-semibold text-admin-fg mb-1">Oversight: staff action queue</h3>
          <p className="text-xs text-admin-neutral-fg mb-3">
            Top open items from the staff action queue. Triage and act from the queue page.
          </p>
          <ul className="space-y-1.5">
            {data.queueUnified.map((item) => (
              <li key={item.id} className="text-sm">
                <Link
                  href={effectiveAgencyId ? `/admin/staff-action-queue?agencyId=${encodeURIComponent(effectiveAgencyId)}` : "/admin/staff-action-queue"}
                  className="text-admin-fg hover:underline font-medium"
                >
                  {item.title}
                  {item.propertyDisplayLabel ? ` · ${item.propertyDisplayLabel}` : ""}
                </Link>
                {item.applicantName && (
                  <span className="text-xs text-admin-muted-fg ml-1">({item.applicantName})</span>
                )}
                <span className="text-xs text-admin-muted-fg ml-1">
                  {formatAdminDate(item.createdAt, "prettyDate")}
                </span>
              </li>
            ))}
          </ul>
          <Link
            href={effectiveAgencyId ? `/admin/staff-action-queue?agencyId=${encodeURIComponent(effectiveAgencyId)}` : "/admin/staff-action-queue"}
            className="mt-4 inline-flex items-center text-sm font-medium text-admin-warning-fg hover:underline"
          >
            Open action queue
            <span className="ml-1">→</span>
          </Link>
        </Card>
      ) : (
        <Card className="p-5 mb-10 bg-admin-surface-muted/30">
          <h3 className="text-sm font-semibold text-admin-fg mb-1">Oversight: staff action queue</h3>
          <p className="text-xs text-admin-neutral-fg">No open items requiring staff action. Check the action queue for snoozed or completed items.</p>
          <Link
            href={effectiveAgencyId ? `/admin/staff-action-queue?agencyId=${encodeURIComponent(effectiveAgencyId)}` : "/admin/staff-action-queue"}
            className="mt-4 inline-flex items-center text-sm font-medium text-admin-neutral-fg hover:underline"
          >
            Open action queue
            <span className="ml-1">→</span>
          </Link>
        </Card>
      )}

      <AdminSectionHeader title="Recent activity" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-10">
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-admin-neutral-fg mb-2">Recent enquiries</h3>
          {recentEnquiries.length === 0 ? (
            <p className="text-xs text-admin-muted-fg">No recent enquiries.</p>
          ) : (
            <ul className="space-y-1.5">
              {recentEnquiries.map((e) => (
                <li key={e.id} className="text-sm">
                  <Link
                    href={`/admin/applicants?enquiryId=${e.id}${effectiveAgencyId ? `&agencyId=${encodeURIComponent(effectiveAgencyId)}` : ""}`}
                    className="text-admin-fg hover:underline truncate block"
                  >
                    {e.applicantName || "Applicant"} · {e.propertyDisplayLabel || "Property"}
                  </Link>
                  <span className="text-xs text-admin-muted-fg">{e.status}</span>
                </li>
              ))}
            </ul>
          )}
          <Link href={effectiveAgencyId ? `/admin/enquiries?agencyId=${encodeURIComponent(effectiveAgencyId)}` : "/admin/enquiries"} className="mt-3 inline-block text-xs font-medium text-admin-neutral-fg hover:underline">View all →</Link>
        </Card>

        <Card className="p-5">
          <h3 className="text-sm font-semibold text-admin-neutral-fg mb-2">Recent viewings</h3>
          {recentViewings.length === 0 ? (
            <p className="text-xs text-admin-muted-fg">No recent viewings.</p>
          ) : (
            <ul className="space-y-1.5">
              {recentViewings.map((v) => (
                <li key={v.id} className="text-sm">
                  <Link href={`/admin/viewings`} className="text-admin-fg hover:underline truncate block">
                    {v.applicantName || "—"} · {v.propertyDisplayLabel || "Property"}
                  </Link>
                  <span className="text-xs text-admin-muted-fg">
                    {v.scheduledAt ? formatAdminDate(v.scheduledAt, "prettyDate") : v.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <Link href={effectiveAgencyId ? `/admin/viewings?agencyId=${encodeURIComponent(effectiveAgencyId)}` : "/admin/viewings"} className="mt-3 inline-block text-xs font-medium text-admin-neutral-fg hover:underline">View all →</Link>
        </Card>

        <Card className="p-5">
          <h3 className="text-sm font-semibold text-admin-neutral-fg mb-2">Pipeline (latest)</h3>
          {recentPipeline.length === 0 ? (
            <p className="text-xs text-admin-muted-fg">No pipeline items.</p>
          ) : (
            <ul className="space-y-1.5">
              {recentPipeline.map((p) => (
                <li key={p.id} className="text-sm">
                  <Link
                    href={effectiveAgencyId ? `/admin/application-pipeline?agencyId=${encodeURIComponent(effectiveAgencyId)}` : "/admin/application-pipeline"}
                    className="text-admin-fg hover:underline truncate block"
                  >
                    {p.applicantName || "—"} · {p.propertyDisplayLabel || "Property"}
                  </Link>
                  <span className="text-xs text-admin-muted-fg">{p.stage}</span>
                </li>
              ))}
            </ul>
          )}
          <Link href={effectiveAgencyId ? `/admin/application-pipeline?agencyId=${encodeURIComponent(effectiveAgencyId)}` : "/admin/application-pipeline"} className="mt-3 inline-block text-xs font-medium text-admin-neutral-fg hover:underline">View all →</Link>
        </Card>

        <Card className="p-5">
          <h3 className="text-sm font-semibold text-admin-neutral-fg mb-2">Queue (awaiting action)</h3>
          {recentQueue.length === 0 ? (
            <p className="text-xs text-admin-muted-fg">No items awaiting action.</p>
          ) : (
            <ul className="space-y-1.5">
              {recentQueue.map((q) => (
                <li key={q.id} className="text-sm">
                  <Link
                    href={effectiveAgencyId ? `/admin/staff-action-queue?agencyId=${encodeURIComponent(effectiveAgencyId)}` : "/admin/staff-action-queue"}
                    className="text-admin-fg hover:underline truncate block"
                  >
                    {q.applicantName || "—"} · {q.propertyDisplayLabel || "Property"}
                  </Link>
                  <span className="text-xs text-admin-muted-fg">{formatAdminDate(q.lastActionAt, "prettyDate")}</span>
                </li>
              ))}
            </ul>
          )}
          <Link href={effectiveAgencyId ? `/admin/staff-action-queue?agencyId=${encodeURIComponent(effectiveAgencyId)}` : "/admin/staff-action-queue"} className="mt-3 inline-block text-xs font-medium text-admin-neutral-fg hover:underline">View all →</Link>
        </Card>
      </div>
    </>
  );
}
