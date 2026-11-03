import type { CruiseDraft } from './cruise-record'

export type CreationReturn = { owner: string; sourceVersionId: string; draft: CruiseDraft; nameEdited: boolean; appliedPreview: string; previewRevision: number | null }
export function creationReturn(value: unknown, owner: string | null, source: string | null): CreationReturn | null {
  if (!value || typeof value !== 'object' || !owner || !source) return null
  const saved = (value as { cruiseCreationDraft?: CreationReturn }).cruiseCreationDraft
  if (!saved || saved.owner !== owner || saved.sourceVersionId !== source || !saved.draft || typeof saved.draft !== 'object') return null
  const draft = saved.draft
  if (['cruiseCode','cruiseName','departureDatetime','returnDatetime','departurePortId','returnPortId'].some(key => typeof draft[key as keyof CruiseDraft] !== 'string') || !['','ONE_DAY','MULTI_DAYS'].includes(draft.cruiseType) || !['FIXED','CUSTOM'].includes(draft.itineraryMode ?? 'FIXED') || typeof saved.nameEdited !== 'boolean' || typeof saved.appliedPreview !== 'string' || saved.previewRevision !== null && (!Number.isSafeInteger(saved.previewRevision) || saved.previewRevision < 0)) return null
  return { owner, sourceVersionId: source, nameEdited: saved.nameEdited, appliedPreview: saved.appliedPreview, previewRevision: saved.previewRevision, draft: {
    cruiseCode: draft.cruiseCode, cruiseName: draft.cruiseName, cruiseType: draft.cruiseType,
    itineraryMode: draft.itineraryMode ?? 'FIXED', departureDatetime: draft.departureDatetime, returnDatetime: draft.returnDatetime,
    departurePortId: draft.departurePortId, returnPortId: draft.returnPortId,
  } }
}
