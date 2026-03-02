import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/serverSession";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { serializeTimestamp } from "@/lib/serialization";

const AUDIT_COLLECTION = "auditLogs";
const MAX_LIMIT = 200;

/**
 * GET /api/admin/audit
 * Returns last N audit log entries (default 200). superAdmin only.
 * Query: actionContains, actorUidContains, dateFrom (ISO), dateTo (ISO). All optional.
 * Timestamps serialized to ms for client.
 */
export async function GET(request: NextRequest) {
  const session = await getServerSession();
  if (!session || session.role !== "superAdmin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const actionContains = searchParams.get("actionContains")?.trim() ?? "";
  const actorUidContains = searchParams.get("actorUidContains")?.trim() ?? "";
  const dateFrom = searchParams.get("dateFrom")?.trim();
  const dateTo = searchParams.get("dateTo")?.trim();

  const db = getAdminFirestore();
  const snap = await db
    .collection(AUDIT_COLLECTION)
    .orderBy("createdAt", "desc")
    .limit(MAX_LIMIT)
    .get();

  let list = snap.docs.map((doc) => {
    const d = doc.data();
    const createdAtMs = serializeTimestamp(d.createdAt);
    return {
      id: doc.id,
      createdAtMs,
      action: typeof d.action === "string" ? d.action : "",
      actorUid: typeof d.actorUid === "string" ? d.actorUid : "",
      actorRole: typeof d.actorRole === "string" ? d.actorRole : "",
      actorAgencyId: d.actorAgencyId != null && typeof d.actorAgencyId === "string" ? d.actorAgencyId : null,
      targetType: typeof d.targetType === "string" ? d.targetType : "",
      targetId: typeof d.targetId === "string" ? d.targetId : "",
      agencyId: d.agencyId != null && typeof d.agencyId === "string" ? d.agencyId : null,
      bypass: d.bypass === true,
      meta: d.meta != null && typeof d.meta === "object" ? d.meta : undefined,
    };
  });

  if (actionContains) {
    const lower = actionContains.toLowerCase();
    list = list.filter((e) => e.action.toLowerCase().includes(lower));
  }
  if (actorUidContains) {
    const lower = actorUidContains.toLowerCase();
    list = list.filter((e) => e.actorUid.toLowerCase().includes(lower));
  }
  if (dateFrom) {
    const fromMs = new Date(dateFrom).getTime();
    if (!Number.isNaN(fromMs)) list = list.filter((e) => (e.createdAtMs ?? 0) >= fromMs);
  }
  if (dateTo) {
    const toMs = new Date(dateTo).getTime();
    if (!Number.isNaN(toMs)) list = list.filter((e) => (e.createdAtMs ?? 0) <= toMs);
  }

  return NextResponse.json(list);
}
