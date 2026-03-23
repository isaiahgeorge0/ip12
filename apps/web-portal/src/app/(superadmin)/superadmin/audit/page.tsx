import { redirect } from "next/navigation";

/**
 * Superadmin audit tile points to the real audit experience at /admin/audit (superAdmin-only).
 */
export default function SuperAdminAuditPage() {
  redirect("/admin/audit");
}
