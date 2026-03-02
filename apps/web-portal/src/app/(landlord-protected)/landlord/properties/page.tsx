import { headers } from "next/headers";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { LandlordPropertiesList } from "./LandlordPropertiesList";

type PropertyItem = {
  id: string;
  agencyId: string;
  title: string;
  postcode: string;
  status: string;
};

async function fetchProperties(): Promise<PropertyItem[]> {
  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const cookie = h.get("cookie") ?? "";
  const protocol = process.env.NODE_ENV === "production" ? "https" : "http";
  const base = `${protocol}://${host}`;
  const res = await fetch(`${base}/api/landlord/properties`, {
    headers: { cookie },
    cache: "no-store",
  });
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

export default async function LandlordPropertiesPage() {
  const list = await fetchProperties();

  return (
    <>
      <PageHeader title="Properties" />
      <p className="text-sm text-zinc-500 mb-4">Your assigned properties.</p>
      {list.length === 0 ? (
        <EmptyState
          title="No properties assigned"
          description="Properties linked to your account will appear here."
        />
      ) : (
        <LandlordPropertiesList list={list} />
      )}
    </>
  );
}
