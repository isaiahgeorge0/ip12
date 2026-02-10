import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/Card";
import { mockTickets } from "@/lib/data/mock";

type Props = { params: Promise<{ id: string }> };

export default async function AdminTicketDetailPage({ params }: Props) {
  const { id } = await params;
  const ticket = mockTickets.find((t) => t.id === id);
  if (!ticket) notFound();

  const mockTimeline = [
    { at: "2024-01-15 10:00", text: "Ticket opened by tenant." },
    { at: "2024-01-15 11:30", text: "Agency assigned to contractor." },
    { at: "2024-01-16 09:00", text: "Visit scheduled." },
  ];

  return (
    <>
      <PageHeader
        title={`Ticket ${ticket.id}`}
        action={
          <Link
            href="/admin/tickets"
            className="text-sm text-zinc-600 hover:underline"
          >
            ← Back to tickets
          </Link>
        }
      />
      <Card className="mb-6">
        <p className="font-medium text-zinc-900">{ticket.title}</p>
        <p className="text-sm text-zinc-500 mt-1">{ticket.propertyRef}</p>
        <p className="text-sm text-zinc-500 mt-1">Status: {ticket.status}</p>
      </Card>
      <h2 className="text-lg font-medium text-zinc-900 mb-2">Timeline</h2>
      <div className="space-y-2">
        {mockTimeline.map((item, i) => (
          <Card key={i} className="text-sm">
            <span className="text-zinc-500">{item.at}</span>
            <p className="mt-1 text-zinc-900">{item.text}</p>
          </Card>
        ))}
      </div>
    </>
  );
}
