/**
 * Overlay staff workflow state onto generated queue items.
 * Reads agencies/{agencyId}/staffActionQueueState/{itemId} and merges into items.
 */

import type { Firestore } from "firebase-admin/firestore";
import { staffActionQueueStateCol } from "@/lib/firestore/paths";
import { serializeTimestamp } from "@/lib/serialization";
import type {
  StaffActionQueueItem,
  QueueWorkflowStatus,
} from "@/lib/types/staffQueueItem";

export type QueueItemStateDoc = {
  itemId: string;
  agencyId: string;
  status: QueueWorkflowStatus;
  assignedToUid: string | null;
  assignedToName: string | null;
  snoozedUntil: number | null;
  completedAt: number | null;
  completedByUid: string | null;
  completionNote: string | null;
  updatedAt: unknown;
  updatedBy: string;
};

const WORKFLOW_STATUSES: QueueWorkflowStatus[] = ["open", "snoozed", "completed"];

function isWorkflowStatus(v: unknown): v is QueueWorkflowStatus {
  return typeof v === "string" && WORKFLOW_STATUSES.includes(v as QueueWorkflowStatus);
}

export function parseStateDoc(
  itemId: string,
  agencyId: string,
  d: Record<string, unknown>
): QueueItemStateDoc | null {
  const status = d.status;
  if (!isWorkflowStatus(status)) return null;
  return {
    itemId,
    agencyId,
    status,
    assignedToUid: typeof d.assignedToUid === "string" ? d.assignedToUid : null,
    assignedToName: typeof d.assignedToName === "string" ? d.assignedToName : null,
    snoozedUntil:
      typeof d.snoozedUntil === "number" && Number.isFinite(d.snoozedUntil)
        ? d.snoozedUntil
        : serializeTimestamp(d.snoozedUntil) ?? null,
    completedAt:
      typeof d.completedAt === "number" && Number.isFinite(d.completedAt)
        ? d.completedAt
        : serializeTimestamp(d.completedAt) ?? null,
    completedByUid: typeof d.completedByUid === "string" ? d.completedByUid : null,
    completionNote: typeof d.completionNote === "string" ? d.completionNote : null,
    updatedAt: d.updatedAt ?? null,
    updatedBy: typeof d.updatedBy === "string" ? d.updatedBy : "",
  };
}

/**
 * Load state docs for the given item ids and return a map.
 */
export async function loadQueueStateMap(
  db: Firestore,
  agencyId: string,
  itemIds: string[]
): Promise<Map<string, QueueItemStateDoc>> {
  const map = new Map<string, QueueItemStateDoc>();
  if (itemIds.length === 0) return map;
  const uniq = [...new Set(itemIds)];
  const refs = uniq.map((id) =>
    db.collection(staffActionQueueStateCol(agencyId)).doc(id)
  );
  const snaps = await db.getAll(...refs);
  snaps.forEach((snap, idx) => {
    const id = uniq[idx];
    if (!id || !snap.exists) return;
    const data = snap.data();
    if (!data) return;
    const parsed = parseStateDoc(id, agencyId, data as Record<string, unknown>);
    if (parsed) map.set(id, parsed);
  });
  return map;
}

/**
 * Merge state overlay into items. Mutates items in place.
 */
export function mergeStateIntoItems(
  items: StaffActionQueueItem[],
  stateMap: Map<string, QueueItemStateDoc>
): StaffActionQueueItem[] {
  for (const item of items) {
    const state = stateMap.get(item.id);
    if (!state) continue;
    item.workflowStatus = state.status;
    item.assignedToUid = state.assignedToUid;
    item.assignedToName = state.assignedToName;
    item.snoozedUntil = state.snoozedUntil;
    item.completedAt = state.completedAt;
    item.completedByUid = state.completedByUid;
    item.completionNote = state.completionNote;
  }
  return items;
}
