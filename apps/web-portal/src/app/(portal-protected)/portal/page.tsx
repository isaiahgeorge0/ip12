"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/Card";

type DashboardData = {
  messageCount: number;
  unreadMessageCount: number;
  enquiryCount: number;
  viewingCount: number;
  applicationCount: number;
  offerCount: number;
  latestApplicationId: string | null;
};

export default function PortalDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/portal/messages", { credentials: "include" }).then((r) => (r.ok ? r.json() : [])),
      fetch("/api/portal/enquiries", { credentials: "include" }).then((r) => (r.ok ? r.json() : [])),
      fetch("/api/portal/viewings", { credentials: "include" }).then((r) => (r.ok ? r.json() : [])),
      fetch("/api/portal/applications", { credentials: "include" }).then((r) => (r.ok ? r.json() : [])),
      fetch("/api/portal/offers", { credentials: "include" }).then((r) => (r.ok ? r.json() : [])),
    ])
      .then(([messages, enquiries, viewings, applications, offers]) => {
        const unread = Array.isArray(messages) ? messages.filter((m: { readAt: unknown }) => !m.readAt).length : 0;
        const apps = Array.isArray(applications) ? applications : [];
        const latest = apps.length > 0 ? apps[0].id : null;
        setData({
          messageCount: Array.isArray(messages) ? messages.length : 0,
          unreadMessageCount: unread,
          enquiryCount: Array.isArray(enquiries) ? enquiries.length : 0,
          viewingCount: Array.isArray(viewings) ? viewings.length : 0,
          applicationCount: apps.length,
          offerCount: Array.isArray(offers) ? offers.length : 0,
          latestApplicationId: latest,
        });
      })
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <PageHeader title="Dashboard" />
      {loading ? (
        <p className="text-sm text-zinc-500">Loading…</p>
      ) : data ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Link href="/portal/messages">
            <Card className="h-full hover:border-zinc-400 transition-colors p-4">
              <p className="font-medium text-zinc-900">Messages</p>
              <p className="text-2xl font-semibold text-zinc-900 mt-1">{data.messageCount}</p>
              {data.unreadMessageCount > 0 && (
                <p className="text-sm text-amber-600 mt-1">{data.unreadMessageCount} unread</p>
              )}
            </Card>
          </Link>
          <Link href="/portal/enquiries">
            <Card className="h-full hover:border-zinc-400 transition-colors p-4">
              <p className="font-medium text-zinc-900">Enquiries</p>
              <p className="text-2xl font-semibold text-zinc-900 mt-1">{data.enquiryCount}</p>
            </Card>
          </Link>
          <Link href="/portal/viewings">
            <Card className="h-full hover:border-zinc-400 transition-colors p-4">
              <p className="font-medium text-zinc-900">Viewings</p>
              <p className="text-2xl font-semibold text-zinc-900 mt-1">{data.viewingCount}</p>
            </Card>
          </Link>
          <Link href="/portal/applications">
            <Card className="h-full hover:border-zinc-400 transition-colors p-4">
              <p className="font-medium text-zinc-900">Applications</p>
              <p className="text-2xl font-semibold text-zinc-900 mt-1">{data.applicationCount}</p>
            </Card>
          </Link>
          <Link href="/portal/offers">
            <Card className="h-full hover:border-zinc-400 transition-colors p-4">
              <p className="font-medium text-zinc-900">Offers</p>
              <p className="text-2xl font-semibold text-zinc-900 mt-1">{data.offerCount}</p>
            </Card>
          </Link>
          {data.latestApplicationId && (
            <Card className="p-4 sm:col-span-2 lg:col-span-3">
              <p className="font-medium text-zinc-900 mb-2">Continue your application</p>
              <Link
                href={`/portal/applications/${data.latestApplicationId}`}
                className="inline-block rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
              >
                Open latest application →
              </Link>
            </Card>
          )}
        </div>
      ) : (
        <Card className="p-6">
          <p className="text-zinc-600">Unable to load dashboard. Please try again.</p>
        </Card>
      )}
    </>
  );
}
