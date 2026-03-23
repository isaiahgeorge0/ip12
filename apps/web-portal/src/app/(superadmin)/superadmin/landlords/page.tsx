import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";

export default function SuperAdminLandlordsPage() {
  return (
    <>
      <PageHeader
        title="Landlords"
        action={
          <Link href="/superadmin" className="text-sm text-zinc-600 hover:underline">
            ← Back to SuperAdmin
          </Link>
        }
      />
      <p className="text-sm text-zinc-500">Placeholder. Coming soon.</p>
    </>
  );
}
