/**
 * Server-only: unified append-only audit log.
 * Firestore collection: auditLogs.
 * Never blocks the main request; fire-and-forget. On failure, log and do not throw.
 */

import { getAdminFirestore } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";

const AUDIT_COLLECTION = "auditLogs";

export type AuditActorRole = "admin" | "superAdmin" | "landlord" | "public";
export type AuditTargetType = "landlord" | "property" | "ticket" | "agency" | "assignment" | "user" | "enquiry" | "viewing" | "application_pipeline" | "offer" | "staff_action_queue" | "tenancy" | "contractor" | "job";

export type AuditLogPayload = {
  action: string;
  actorUid: string;
  actorRole: AuditActorRole;
  actorAgencyId: string | null;
  targetType: AuditTargetType;
  targetId: string;
  /** Affected agency (e.g. property/ticket agency), not necessarily actor's agency */
  agencyId: string | null;
  /** Small, JSON-serializable; no large payloads. Do not store full note text. */
  meta?: Record<string, unknown>;
  /** true when superAdmin override/bypass path was used */
  bypass?: boolean;
  ip?: string | null;
  userAgent?: string | null;
};

function normalizeRole(role: string): AuditActorRole {
  if (role === "admin" || role === "superAdmin" || role === "landlord" || role === "public") return role;
  return role === "superAdmin" ? "superAdmin" : "admin";
}

/** Remove undefined values so Firestore never receives them (Firestore rejects undefined). */
function stripUndefined(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) {
      out[k] = v != null && typeof v === "object" && !Array.isArray(v) && !(v instanceof Date)
        ? stripUndefined(v as Record<string, unknown>)
        : v;
    }
  }
  return out;
}

/**
 * Writes one audit log entry. Validates required fields, adds createdAt, writes to auditLogs.
 * Fire-and-forget: does not throw; logs warning on failure.
 */
export function writeAuditLog(payload: AuditLogPayload): void {
  const {
    action,
    actorUid,
    actorRole,
    actorAgencyId,
    targetType,
    targetId,
    agencyId,
    meta,
    bypass,
    ip,
    userAgent,
  } = payload;

  if (typeof action !== "string" || !action.trim()) {
    if (process.env.NODE_ENV !== "production") console.warn("[writeAuditLog] missing or invalid action");
    return;
  }
  if (typeof actorUid !== "string" || !actorUid.trim()) {
    if (process.env.NODE_ENV !== "production") console.warn("[writeAuditLog] missing or invalid actorUid");
    return;
  }
  if (typeof targetType !== "string" || !targetType.trim()) {
    if (process.env.NODE_ENV !== "production") console.warn("[writeAuditLog] missing or invalid targetType");
    return;
  }
  if (typeof targetId !== "string" || !targetId.trim()) {
    if (process.env.NODE_ENV !== "production") console.warn("[writeAuditLog] missing or invalid targetId");
    return;
  }

  const doc: Record<string, unknown> = {
    createdAt: FieldValue.serverTimestamp(),
    action: action.trim(),
    actorUid: actorUid.trim(),
    actorRole: normalizeRole(actorRole),
    actorAgencyId: actorAgencyId != null && typeof actorAgencyId === "string" ? actorAgencyId : null,
    targetType: targetType.trim() as AuditTargetType,
    targetId: targetId.trim(),
    agencyId: agencyId != null && typeof agencyId === "string" ? agencyId : null,
    bypass: bypass === true,
  };
  if (meta != null && typeof meta === "object" && !Array.isArray(meta)) {
    doc.meta = stripUndefined(meta);
  }
  if (ip != null && typeof ip === "string") doc.ip = ip;
  if (userAgent != null && typeof userAgent === "string") doc.userAgent = userAgent;

  const db = getAdminFirestore();
  db.collection(AUDIT_COLLECTION)
    .add(doc)
    .catch((err) => {
      console.warn("[writeAuditLog] write failed:", err);
    });
}
