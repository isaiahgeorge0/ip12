import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/Card";
import { mockTickets } from "@/lib/data/mock";

function StatusChip({ status }: { status: string }) {
  const styles: Record<string, string> = {
    Open: "bg-amber-100 text-amber-800",
    "In progress": "bg-blue-100 text-blue-800",
    Resolved: "bg-zinc-100 text-zinc-700",
  };
  return (
    <span className={`rounded px-2 py-0.5 text-xs font-medium ${styles[status] ?? "bg-zinc-100 text-zinc-700"}`}>
      {status}
    </span>
  );
}

export default function AdminTicketsPage() {
  return (
    <>
      <PageHeader title="Tickets" />
      <div className="space-y-2">
        {mockTickets.map((ticket) => (
          <Link key={ticket.id} href={`/admin/tickets/${ticket.id}`}>
            <Card className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between hover:border-zinc-400 transition-colors">
              <div>
                <p className="font-medium text-zinc-900">{ticket.title}</p>
                <p className="text-sm text-zinc-500">{ticket.propertyRef}</p>
              </div>
              <div className="flex items-center gap-2">
                <StatusChip status={ticket.status} />
                <span className="text-sm text-zinc-500">{ticket.updatedAt}</span>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </>
  );
}
