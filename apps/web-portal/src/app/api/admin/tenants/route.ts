/**
 * GET /api/admin/tenants?agencyId=...&status=...&q=...&propertyId=...&limit=...
 * List tenants derived from tenancy records. admin = own agency; superAdmin may pass agencyId.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireServerSessionApi, assertRoleApi } from "@/lib/auth/authz";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { tenanciesCol } from "@/lib/firestore/paths";
import { serializeTimestamp } from "@/lib/serialization";
import type { TenancyStatus } from "@/lib/types/tenancy";
import type { TenantSummary } from "@/lib/types/tenancy";
import { groupTenanciesIntoTenants } from "@/lib/tenants/groupTenanciesIntoTenants";
import type { TenancyRowForGrouping } from "@/lib/tenants/groupTenanciesIntoTenants";

function resolveAgencyId(
  session: { role: string; agencyId: string | null },
  params: { agencyId?: string }
): string | null {
  let agencyId = session.agencyId ?? "";
  if (!agencyId && session.role === "superAdmin" && typeof params?.agencyId === "string") {
    agencyId = params.agencyId.trim();
  }
  return agencyId || null;
}

export async function GET(request: NextRequest) {
  const sessionOr401 = await requireServerSessionApi();
  if (sessionOr401 instanceof NextResponse) return sessionOr401;
  const session = sessionOr401;
  const role403 = assertRoleApi(session, ["admin", "superAdmin"]);
  if (role403) return role403;

  const { searchParams } = new URL(request.url);
  const agencyIdParam = searchParams.get("agencyId")?.trim() || null;
  const statusParam = searchParams.get("status")?.trim().toLowerCase() || "";
  const q = searchParams.get("q")?.trim().toLowerCase() || "";
  const propertyIdParam = searchParams.get("propertyId")?.trim() || "";
  const limitParam = searchParams.get("limit")?.trim();

  const agencyId = resolveAgencyId(session, { agencyId: agencyIdParam ?? undefined });
  if (!agencyId) {
    return NextResponse.json({ error: "agencyId required" }, { status: 400 });
  }

  const db = getAdminFirestore();
  const snap = await db.collection(tenanciesCol(agencyId)).orderBy("createdAt", "desc").get();

  const rows: TenancyRowForGrouping[] = snap.docs.map((doc) => {
    const d = doc.data();
    return {
      id: doc.id,
      agencyId: (d.agencyId as string) ?? agencyId,
      propertyId: (d.propertyId as string) ?? "",
      propertyDisplayLabel: (d.propertyDisplayLabel as string) ?? "",
      applicantId: typeof d.applicantId === "string" ? d.applicantId : null,
      applicantUserId: typeof d.applicantUserId === "string" ? d.applicantUserId : null,
      applicationId: typeof d.applicationId === "string" ? d.applicationId : null,
      offerId: (d.offerId as string) ?? "",
      tenantName: (d.tenantName as string) ?? "",
      tenantEmail: (d.tenantEmail as string) ?? "",
      tenantPhone: typeof d.tenantPhone === "string" ? d.tenantPhone : null,
      rentAmount: typeof d.rentAmount === "number" && Number.isFinite(d.rentAmount) ? d.rentAmount : 0,
      currency: (d.currency as string) ?? "GBP",
      tenancyStartDate: typeof d.tenancyStartDate === "string" ? d.tenancyStartDate : null,
      tenancyEndDate: typeof d.tenancyEndDate === "string" ? d.tenancyEndDate : null,
      status: (d.status as TenancyStatus) ?? "active",
      createdAt: serializeTimestamp(d.createdAt) ?? null,
      updatedAt: serializeTimestamp(d.updatedAt) ?? null,
      notes: typeof d.notes === "string" ? d.notes : null,
    };
  });

  let items: TenantSummary[] = groupTenanciesIntoTenants(rows);

  if (statusParam === "active") {
    items = items.filter((t) => t.status === "active");
  } else if (statusParam === "former") {
    items = items.filter((t) => t.status === "former");
  }

  if (q) {
    items = items.filter(
      (t) =>
        (t.tenantName && t.tenantName.toLowerCase().includes(q)) ||
        (t.tenantEmail && t.tenantEmail.toLowerCase().includes(q)) ||
        (t.tenantPhone && t.tenantPhone.toLowerCase().includes(q)) ||
        (t.currentPropertyDisplayLabel && t.currentPropertyDisplayLabel.toLowerCase().includes(q))
    );
  }

  if (propertyIdParam) {
    items = items.filter((t) => t.currentPropertyId === propertyIdParam);
  }

  const limit = limitParam ? Math.min(500, Math.max(1, parseInt(limitParam, 10) || 50)) : 500;
  items = items.slice(0, limit);

  return NextResponse.json({ items });
}
