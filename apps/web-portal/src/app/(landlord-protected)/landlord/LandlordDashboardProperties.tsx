"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card } from "@/components/Card";
import { CreateTicketModal } from "@/components/landlord/CreateTicketModal";

type PropertyData = {
  id: string;
  agencyId: string;
  title: string;
  postcode: string;
  status: string;
  createdAtMs: number | null;
};

type DashboardItem = {
  assignment: { agencyId: string; propertyId: string; createdAtMs: number | null };
  property: PropertyData;
};

function formatDate(ms: number | null): string {
  if (ms == null) return "—";
  return new Date(ms).toLocaleDateString();
}

export function LandlordDashboardProperties({ list }: { list: DashboardItem[] }) {
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const [initialProperty, setInitialProperty] = useState<{
    agencyId: string;
    propertyId: string;
    title?: string;
    postcode?: string;
  } | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(t);
    }
  }, [toast]);

  const openReportIssue = (p: PropertyData) => {
    setInitialProperty({
      agencyId: p.agencyId,
      propertyId: p.id,
      title: p.title,
      postcode: p.postcode || undefined,
    });
    setCreateOpen(true);
  };

  const handleCreateSuccess = () => {
    setToast("Ticket created successfully");
    setCreateOpen(false);
    setInitialProperty(null);
    router.push("/landlord/maintenance");
  };

  if (list.length === 0) return null;

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {list.map(({ property: p }) => (
          <Card
            key={`${p.agencyId}-${p.id}`}
            className="flex h-full flex-col hover:border-zinc-400 transition-colors"
          >
            <Link
              href={`/landlord/properties/${p.id}`}
              className="flex-1 min-w-0"
            >
              <p className="font-medium text-zinc-900">{p.title}</p>
              {p.postcode ? (
                <p className="text-sm text-zinc-600 mt-1">{p.postcode}</p>
              ) : null}
              <p className="text-sm text-zinc-500 mt-1">Status: {p.status}</p>
              <p className="text-sm text-zinc-400 mt-1">
                Created: {formatDate(p.createdAtMs)}
              </p>
            </Link>
            <div className="mt-3 flex gap-2">
              <Link
                href={`/landlord/properties/${p.id}`}
                className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 bg-zinc-50 hover:bg-zinc-100"
              >
                View
              </Link>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  openReportIssue(p);
                }}
                className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 bg-zinc-50 hover:bg-zinc-100"
              >
                Report issue
              </button>
            </div>
          </Card>
        ))}
      </div>

      <CreateTicketModal
        open={createOpen}
        onClose={() => {
          setCreateOpen(false);
          setInitialProperty(null);
        }}
        initialProperty={initialProperty ?? undefined}
        onSuccess={handleCreateSuccess}
      />

      {toast && (
        <div
          className="fixed bottom-4 right-4 z-20 rounded-lg bg-zinc-900 px-4 py-2 text-sm text-white shadow-lg"
          role="status"
        >
          {toast}
        </div>
      )}
    </>
  );
}
