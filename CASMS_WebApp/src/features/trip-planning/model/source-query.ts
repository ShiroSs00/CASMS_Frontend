import type { SourceKind, SourceQuery } from './plan'

/** Revision is only a client cache key; it is never sent as an unsupported query. */
export function sourceQueryKey(kind:SourceKind,query:SourceQuery,revision?:number) {
  return JSON.stringify([kind,query.keyword??'',query.category??'',query.portId??'',query.destinationId??'',query.tripId??'',query.countryCode??'',query.countryCodes??[],revision])
}
