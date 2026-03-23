import { redirect } from "next/navigation";

type Props = { params: Promise<{ id: string }> };

export default async function ListingDetailPage({ params }: Props) {
  const { id } = await params;
  redirect(`/properties/${encodeURIComponent(id)}`);
}
