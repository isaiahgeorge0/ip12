import Link from "next/link";
import { headers } from "next/headers";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";

type TicketItem = {
  id: string;
  agencyId: string;
  propertyId: string;
  landlordUid: string;
  status: string;
  category: string;
  title: string;
  description: string;
  createdAt: unknown;
  updatedAt: unknown;
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
    Open: "bg-amber-100 text-amber-800",
    "In progress": "bg-blue-100 text-blue-800",
    Resolved: "bg-zinc-100 text-zinc-700",
  };
  return (
    <span
      className={`rounded px-2 py-0.5 text-xs font-medium ${styles[status] ?? "bg-zinc-100 text-zinc-700"}`}
    >
      {status}
    </span>
  );
}

async function fetchTickets(): Promise<TicketItem[]> {
  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const cookie = h.get("cookie") ?? "";
  const protocol = process.env.NODE_ENV === "production" ? "https" : "http";
  const base = `${protocol}://${host}`;
  const res = await fetch(`${base}/api/landlord/tickets`, {
    headers: { cookie },
    cache: "no-store",
  });
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

export default async function LandlordTicketsPage() {
  const list = await fetchTickets();

  return (
    <>
      <PageHeader title="Tickets" />
      <p className="text-sm text-zinc-500 mb-4">Your maintenance tickets.</p>
      {list.length === 0 ? (
        <EmptyState
          title="No tickets yet"
          description="Create a ticket from Maintenance when you have an issue to report."
          action={
            <Link
              href="/landlord/maintenance"
              className="inline-block rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
            >
              Go to Maintenance
            </Link>
          }
        />
      ) : (
        <div className="space-y-2">
          {list.map((t) => (
            <Card key={`${t.agencyId}-${t.id}`}>
              <p className="font-medium text-zinc-900">{t.title || "—"}</p>
              <p className="text-sm text-zinc-500 mt-1">
                {t.category || "General"} · Property: {t.propertyId || "—"}
              </p>
              <p className="text-sm text-zinc-500 mt-1 flex items-center gap-2">
                <StatusChip status={t.status} />
                Updated: {formatDate(t.updatedAt)} · Created: {formatDate(t.createdAt)}
              </p>
              {t.description ? (
                <p className="text-sm text-zinc-600 mt-2 line-clamp-2">{t.description}</p>
              ) : null}
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
