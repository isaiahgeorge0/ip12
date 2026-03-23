import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { requireServerSessionApi, assertRoleApi } from "@/lib/auth/authz";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { contractorsCol, jobsCol } from "@/lib/firestore/paths";
import { writeContractorAudit } from "@/lib/audit/contractorAudit";
import { serializeTimestamp } from "@/lib/serialization";
import type { ContractorListItem } from "@/lib/types/contractor";

function resolveAgencyId(
  session: { role: string; agencyId: string | null },
  request: NextRequest,
  body?: { agencyId?: string }
): string | null {
  let agencyId = session.agencyId ?? "";
  if (!agencyId && session.role === "superAdmin") {
    const fromQuery = request.nextUrl.searchParams.get("agencyId")?.trim();
    const fromBody = typeof body?.agencyId === "string" ? body.agencyId.trim() : "";
    agencyId = fromQuery || fromBody || "";
  }
  return agencyId || null;
}

function toListItem(
  doc: FirebaseFirestore.QueryDocumentSnapshot,
  jobsCount?: number
): ContractorListItem {
  const d = doc.data();
  const skills = Array.isArray(d.skills) ? d.skills.filter((x: unknown) => typeof x === "string") : [];
  const coverageAreas = Array.isArray(d.coverageAreas)
    ? d.coverageAreas.filter((x: unknown) => typeof x === "string")
    : [];
  return {
    id: doc.id,
    agencyId: typeof d.agencyId === "string" ? d.agencyId : "",
    displayName: typeof d.displayName === "string" ? d.displayName : "",
    companyName: typeof d.companyName === "string" ? d.companyName : null,
    email: typeof d.email === "string" ? d.email : null,
    phone: typeof d.phone === "string" ? d.phone : null,
    trade: typeof d.trade === "string" ? d.trade : null,
    skills,
    coverageAreas,
    isActive: d.isActive === true,
    notes: typeof d.notes === "string" ? d.notes : null,
    createdAt: serializeTimestamp(d.createdAt) ?? null,
    updatedAt: serializeTimestamp(d.updatedAt) ?? null,
    ...(jobsCount !== undefined && { jobsCount }),
  };
}

/**
 * GET /api/admin/contractors
 * List contractors for the agency. superAdmin may pass ?agencyId=
 */
export async function GET(request: NextRequest) {
  const sessionOr401 = await requireServerSessionApi();
  if (sessionOr401 instanceof NextResponse) return sessionOr401;
  const session = sessionOr401;
  const role403 = assertRoleApi(session, ["admin", "superAdmin"]);
  if (role403) return role403;

  const agencyId = resolveAgencyId(session, request);
  if (!agencyId) {
    return NextResponse.json({ error: "agencyId required" }, { status: 400 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? "";
  const activeParam = searchParams.get("active")?.trim() ?? "true";
  const tradeParam = searchParams.get("trade")?.trim() ?? "";
  const limitParam = searchParams.get("limit");
  const limit = Math.min(Math.max(parseInt(limitParam ?? "200", 10), 1), 500);

  const db = getAdminFirestore();
  const snap = await db
    .collection(contractorsCol(agencyId))
    .orderBy("displayName")
    .limit(limit * 2)
    .get();

  let list: ContractorListItem[] = snap.docs.map((doc) => toListItem(doc));

  if (activeParam === "true") {
    list = list.filter((c) => c.isActive);
  } else if (activeParam === "false") {
    list = list.filter((c) => !c.isActive);
  }

  if (tradeParam) {
    const tradeLower = tradeParam.toLowerCase();
    list = list.filter((c) => c.trade?.toLowerCase() === tradeLower);
  }

  if (q) {
    const qLower = q.toLowerCase();
    list = list.filter(
      (c) =>
        c.displayName.toLowerCase().includes(qLower) ||
        c.companyName?.toLowerCase().includes(qLower) ||
        c.email?.toLowerCase().includes(qLower) ||
        c.trade?.toLowerCase().includes(qLower) ||
        c.skills.some((s) => s.toLowerCase().includes(qLower))
    );
  }

  list = list.slice(0, limit);

  if (list.length > 0 && list.length <= 50) {
    const jobsSnap = await db.collection(jobsCol(agencyId)).get();
    const countByContractor = new Map<string, number>();
    jobsSnap.docs.forEach((d) => {
      const cid = d.data().contractorId;
      if (typeof cid === "string") {
        countByContractor.set(cid, (countByContractor.get(cid) ?? 0) + 1);
      }
    });
    list = list.map((c) => ({
      ...c,
      jobsCount: countByContractor.get(c.id) ?? 0,
    }));
  }

  return NextResponse.json(list);
}

/**
 * POST /api/admin/contractors
 * Create a contractor. superAdmin must pass agencyId in body or query.
 */
export async function POST(request: NextRequest) {
  const sessionOr401 = await requireServerSessionApi();
  if (sessionOr401 instanceof NextResponse) return sessionOr401;
  const session = sessionOr401;
  const role403 = assertRoleApi(session, ["admin", "superAdmin"]);
  if (role403) return role403;

  let body: {
    agencyId?: string;
    displayName?: string;
    companyName?: string;
    email?: string;
    phone?: string;
    trade?: string;
    skills?: string[];
    coverageAreas?: string[];
    isActive?: boolean;
    notes?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const agencyId = resolveAgencyId(session, request, body);
  if (!agencyId) {
    return NextResponse.json({ error: "agencyId required" }, { status: 400 });
  }

  const displayName = typeof body.displayName === "string" ? body.displayName.trim() : "";
  if (!displayName) {
    return NextResponse.json({ error: "displayName required" }, { status: 400 });
  }

  const companyName =
    typeof body.companyName === "string" ? body.companyName.trim() || null : null;
  const email = typeof body.email === "string" ? body.email.trim() || null : null;
  const phone = typeof body.phone === "string" ? body.phone.trim() || null : null;
  const trade = typeof body.trade === "string" ? body.trade.trim() || null : null;
  const skills = Array.isArray(body.skills)
    ? body.skills.filter((x): x is string => typeof x === "string")
    : [];
  const coverageAreas = Array.isArray(body.coverageAreas)
    ? body.coverageAreas.filter((x): x is string => typeof x === "string")
    : [];
  const isActive = body.isActive !== false;
  const notes = typeof body.notes === "string" ? body.notes.trim() || null : null;

  const db = getAdminFirestore();
  const ref = await db.collection(contractorsCol(agencyId)).add({
    agencyId,
    displayName,
    companyName,
    email,
    phone,
    trade,
    skills,
    coverageAreas,
    isActive,
    notes,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    createdBy: session.uid,
    updatedBy: session.uid,
  });

  writeContractorAudit({
    action: "CONTRACTOR_CREATED",
    actorUid: session.uid,
    actorAgencyId: session.agencyId,
    role: session.role,
    contractorId: ref.id,
    agencyId,
    contractorName: displayName,
    isActive,
  });

  return NextResponse.json({
    id: ref.id,
    agencyId,
    displayName,
    companyName,
    email,
    phone,
    trade,
    skills,
    coverageAreas,
    isActive,
    notes,
  });
}
