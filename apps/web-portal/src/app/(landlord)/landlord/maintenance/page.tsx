import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/Card";
import { mockTickets } from "@/lib/data/mock";

export default function LandlordMaintenancePage() {
  const openCount = mockTickets.filter((t) => t.status !== "Resolved").length;
  const resolvedCount = mockTickets.filter((t) => t.status === "Resolved").length;

  return (
    <>
      <PageHeader title="Maintenance" />
      <div className="grid gap-4 sm:grid-cols-2 mb-6">
        <Card className="p-4">
          <p className="text-sm text-zinc-500">Open / in progress</p>
          <p className="text-2xl font-semibold text-zinc-900">{openCount}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-zinc-500">Resolved</p>
          <p className="text-2xl font-semibold text-zinc-900">{resolvedCount}</p>
        </Card>
      </div>
      <h2 className="text-lg font-medium text-zinc-900 mb-2">Recent issues</h2>
      <p className="text-sm text-zinc-500 mb-4">
        Shown by property and issue only. Tenant details are not displayed here.
      </p>
      <div className="space-y-2">
        {mockTickets.map((ticket) => (
          <Card key={ticket.id}>
            <p className="font-medium text-zinc-900">{ticket.title}</p>
            <p className="text-sm text-zinc-500">{ticket.propertyRef}</p>
            <p className="text-sm text-zinc-500 mt-1">Status: {ticket.status}</p>
          </Card>
        ))}
      </div>
    </>
  );
}
