/**
 * Server-only: create or update an application pipeline item.
 * Links by: sourceViewingId, sourceEnquiryId, applicantId+propertyId, applicantUserId+propertyId (first match wins).
 * Never writes undefined to Firestore.
 */

import type { Firestore, QuerySnapshot } from "firebase-admin/firestore";
import { FieldValue } from "firebase-admin/firestore";
import { applicationPipelineCol } from "@/lib/firestore/paths";
import type { PipelineSource, PipelineStage } from "@/lib/types/applicationPipeline";

export type UpsertPipelineItemPayload = {
  applicantId: string | null;
  applicantUserId: string | null;
  propertyId: string;
  propertyDisplayLabel: string;
  source: PipelineSource;
  sourceEnquiryId: string | null;
  sourceViewingId: string | null;
  applicationId: string | null;
  stage: PipelineStage;
  notes?: string | null;
};

/**
 * Finds existing pipeline item by best available link, then updates or creates.
 * Returns the pipeline item document id.
 */
export async function upsertPipelineItem(
  db: Firestore,
  agencyId: string,
  payload: UpsertPipelineItemPayload
): Promise<string> {
  const col = db.collection(applicationPipelineCol(agencyId));
  const now = FieldValue.serverTimestamp();

  const {
    applicantId,
    applicantUserId,
    propertyId,
    propertyDisplayLabel,
    source,
    sourceEnquiryId,
    sourceViewingId,
    applicationId,
    stage,
    notes,
  } = payload;

  // Find existing by link order: sourceViewingId, sourceEnquiryId, applicantId+propertyId, applicantUserId+propertyId
  let existingSnap: QuerySnapshot | null = null;

  if (sourceViewingId) {
    existingSnap = await col.where("sourceViewingId", "==", sourceViewingId).limit(1).get();
  }
  if ((!existingSnap || existingSnap.empty) && sourceEnquiryId) {
    existingSnap = await col.where("sourceEnquiryId", "==", sourceEnquiryId).limit(1).get();
  }
  if ((!existingSnap || existingSnap.empty) && applicantId && propertyId) {
    existingSnap = await col
      .where("applicantId", "==", applicantId)
      .where("propertyId", "==", propertyId)
      .limit(1)
      .get();
  }
  if ((!existingSnap || existingSnap.empty) && applicantUserId && propertyId) {
    existingSnap = await col
      .where("applicantUserId", "==", applicantUserId)
      .where("propertyId", "==", propertyId)
      .limit(1)
      .get();
  }

  if (existingSnap && !existingSnap.empty) {
    const docRef = existingSnap.docs[0].ref;
    const updates: Record<string, unknown> = {
      stage,
      lastActionAt: now,
      updatedAt: now,
    };
    if (applicationId !== undefined && applicationId !== null) {
      updates.applicationId = applicationId;
    }
    if (notes !== undefined) {
      updates.notes = notes ?? null;
    }
    if (source) {
      updates.source = source;
    }
    if (propertyDisplayLabel) {
      updates.propertyDisplayLabel = propertyDisplayLabel;
    }
    await docRef.update(updates);
    return docRef.id;
  }

  const newDoc: Record<string, unknown> = {
    agencyId,
    applicantId: applicantId ?? null,
    applicantUserId: applicantUserId ?? null,
    propertyId,
    propertyDisplayLabel,
    source,
    sourceEnquiryId: sourceEnquiryId ?? null,
    sourceViewingId: sourceViewingId ?? null,
    applicationId: applicationId ?? null,
    stage,
    notes: notes ?? null,
    createdAt: now,
    updatedAt: now,
    lastActionAt: now,
  };
  const addRef = await col.add(newDoc);
  return addRef.id;
}
