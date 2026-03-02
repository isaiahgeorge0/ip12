/**
 * Audit logging for critical admin actions.
 * Append-only; never blocks the main action on failure.
 *
 * Manual test checklist:
 * - SuperAdmin: Create user in /admin/users -> Firestore auditLogs has USER_CREATED.
 * - SuperAdmin: Edit user role/status in /admin/users -> USER_ROLE_CHANGED and/or USER_STATUS_CHANGED.
 * - Any admin: Update own profile in /admin/profile -> PROFILE_UPDATED with before/after safe fields.
 * - Non-superAdmin: Cannot read auditLogs (rules). SuperAdmin can read auditLogs.
 */

import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import type { Firestore } from "firebase/firestore";

export type AuditLogPayload = {
  action: string;
  agencyId: string | null;
  performedByUid: string;
  targetUid: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
};

/**
 * Writes one audit log document to top-level collection auditLogs.
 * Returns a promise so callers can .catch() without blocking the main action.
 * Caller should .catch() and show a secondary warning; do not surface as main error.
 */
export function writeAuditLog(
  db: Firestore,
  payload: Omit<AuditLogPayload, "createdAt">
): Promise<void> {
  return addDoc(collection(db, "auditLogs"), {
    action: payload.action,
    agencyId: payload.agencyId,
    performedByUid: payload.performedByUid,
    targetUid: payload.targetUid,
    before: payload.before,
    after: payload.after,
    createdAt: serverTimestamp(),
  }).then(() => {});
}
