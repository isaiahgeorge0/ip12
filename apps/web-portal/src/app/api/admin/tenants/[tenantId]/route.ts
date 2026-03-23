/**
 * GET /api/admin/tenants/[tenantId]?agencyId=...
 * Returns a single tenant (derived from tenancies) with tenancy history.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireServerSessionApi, assertRoleApi } from "@/lib/auth/authz";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { tenanciesCol } from "@/lib/firestore/paths";
import { serializeTimestamp } from "@/lib/serialization";
import type { TenancyStatus } from "@/lib/types/tenancy";
import { buildTenantDetail } from "@/lib/tenants/groupTenanciesIntoTenants";
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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  const sessionOr401 = await requireServerSessionApi();
  if (sessionOr401 instanceof NextResponse) return sessionOr401;
  const session = sessionOr401;
  const role403 = assertRoleApi(session, ["admin", "superAdmin"]);
  if (role403) return role403;

  const { tenantId } = await params;
  if (!tenantId) {
    return NextResponse.json({ error: "tenantId required" }, { status: 400 });
  }

  const { searchParams } = new URL(request.url);
  const agencyIdParam = searchParams.get("agencyId")?.trim() || null;
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

  const detail = buildTenantDetail(rows, tenantId);
  if (!detail) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  return NextResponse.json({
    tenant: detail.tenant,
    tenancies: detail.tenancies,
  });
}
