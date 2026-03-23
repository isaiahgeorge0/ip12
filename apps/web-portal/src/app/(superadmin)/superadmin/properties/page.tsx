import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";

export default function SuperAdminPropertiesPage() {
  return (
    <>
      <PageHeader
        title="Properties"
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
