import { ApiError, apiRequest, apiRequestRaw } from '@/shared/api'

import type {
  CruiseStop,
  CruiseStopDraft,
  Destination,
  DestinationDraft,
  DestinationPortSummary,
  Itinerary,
  ItineraryDay,
  ItineraryDayDraft,
  ItineraryDayType,
  ItineraryDraft,
  ItineraryCruiseOption,
  PageResult,
  Port,
  PortDraft,
} from '../model/itinerary'

type PageDto<T> = { content: T[]; number: number; size: number; totalPages: number; totalElements: number }

async function allPages<T>(path: string, signal?: AbortSignal): Promise<T[]> {
  const read = async (page: number) => {
    const value = await apiRequest<PageDto<T>>(path, { query: { page, size: 100 }, signal })
    if (!value || !Array.isArray(value.content) || !Number.isSafeInteger(value.totalPages) || value.totalPages < 0) throw new Error('Dữ liệu danh sách không đúng định dạng. Vui lòng thử lại.')
    return value
  }
  const first = await read(0)
  const items = [...first.content]
  for (let page = 1; page < first.totalPages; page++) items.push(...(await read(page)).content)
  return items
}

async function listCruises(signal?: AbortSignal): Promise<ItineraryCruiseOption[]> {
  const cruises = await allPages<ItineraryCruiseOption>('/cruise', signal)
  if (cruises.some(item => !item || ['cruiseId', 'cruiseCode', 'cruiseName', 'status'].some(field => typeof item[field as keyof ItineraryCruiseOption] !== 'string' || !item[field as keyof ItineraryCruiseOption].trim()) || [item.departureDatetime, item.returnDatetime].some(value => typeof value !== 'string' || Number.isNaN(Date.parse(value))))) throw new Error('Thông tin chuyến du lịch không đầy đủ. Vui lòng thử lại.')
  return cruises
}

function page<T>(value: PageDto<T> | T[]): PageResult<T> {
  if (Array.isArray(value)) return { items: value, page: 1, pageSize: value.length, pageCount: 1, total: value.length }
  return { items: value.content, page: value.number + 1, pageSize: value.size, pageCount: Math.max(1, value.totalPages), total: value.totalElements }
}

const itineraryPath = (id: string) => `/itineraries/${encodeURIComponent(id)}`
const dayPath = (id: string) => `/itinerary-days/${encodeURIComponent(id)}`
const stopPath = (id: string) => `/cruise-stops/${encodeURIComponent(id)}`
const portPath = (id: string) => `/ports/${encodeURIComponent(id)}`
const destinationPath = (id: string) => `/destinations/${encodeURIComponent(id)}`

function stopBody(draft: Partial<CruiseStopDraft>) {
  return {
    ...draft,
    plannedArrival: draft.plannedArrival ? new Date(draft.plannedArrival).toISOString() : undefined,
    plannedDeparture: draft.plannedDeparture ? new Date(draft.plannedDeparture).toISOString() : undefined,
  }
}

const historyChangeTypes = ['TIME_CHANGE', 'PORT_OMITTED', 'PORT_SUBSTITUTED', 'STOP_REORDERED', 'EXCURSION_IMPACT', 'OTHER'] as const
export type ItineraryHistoryEntry = {
  changeHistoryId: string
  itineraryId: string
  changeSummary: string | null
  reason: string | null
  changeType: typeof historyChangeTypes[number] | null
  changedAt: string | null
  changedByUserId: string | null
  cruiseStopId?: string | null
  changedEntityType?: string | null
  beforeData?: string | null
  afterData?: string | null
}
export type ItineraryChangeDraft = {
  itineraryId: string; cruiseStopId?: string; changedEntityType: 'Itinerary' | 'CruiseStop'; changedEntityId: string
  changeType: NonNullable<ItineraryHistoryEntry['changeType']>; changeSummary: string; reason: string; changedByUserId?: string
}

function decodeHistory(payload: unknown, status: number): ItineraryHistoryEntry[] {
  const invalid = () => new ApiError('Dữ liệu lịch sử thay đổi không đúng định dạng.', status)
  if (!Array.isArray(payload)) throw invalid()
  return payload.map((value: unknown) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw invalid()
    const row = value as Record<string, unknown>
    if (typeof row.changeHistoryId !== 'string' || !row.changeHistoryId || typeof row.itineraryId !== 'string' || !row.itineraryId) throw invalid()
    function text(field: string): string | null {
      if (row[field] == null) return null
      if (typeof row[field] !== 'string') throw invalid()
      return row[field]
    }
    const rawChangeType = text('changeType')
    const changeType = historyChangeTypes.find((type) => type === rawChangeType)
    if (rawChangeType !== null && changeType === undefined) throw invalid()
    return {
      changeHistoryId: row.changeHistoryId,
      itineraryId: row.itineraryId,
      changeSummary: text('changeSummary'),
      reason: text('reason'),
      changeType: changeType ?? null,
      changedAt: text('changedAt'),
      changedByUserId: text('changedByUserId'),
      cruiseStopId: text('cruiseStopId'), changedEntityType: text('changedEntityType'), beforeData: text('beforeData'), afterData: text('afterData'),
    }
  })
}

export const itineraryHistoryApi = {
  list: (itineraryId: string, signal?: AbortSignal): Promise<ItineraryHistoryEntry[]> => apiRequestRaw(
    `/itinerary-change-history/itineraries/${encodeURIComponent(itineraryId)}`, decodeHistory, { signal },
  ),
  search: (query: { itineraryId?: string; cruiseStopId?: string; changeType?: string }, signal?: AbortSignal): Promise<ItineraryHistoryEntry[]> => apiRequestRaw('/itinerary-change-history', decodeHistory, { query, signal }),
  get: (id: string, signal?: AbortSignal) => apiRequestRaw(`/itinerary-change-history/${encodeURIComponent(id)}`, (payload, status) => decodeHistory([payload], status)[0], { signal }),
  append: (draft: ItineraryChangeDraft) => apiRequestRaw('/itinerary-change-history', (payload, status) => decodeHistory([payload], status)[0], { method: 'POST', body: {
    itineraryId: draft.itineraryId, cruiseStopId: draft.cruiseStopId, changedEntityType: draft.changedEntityType, changedEntityId: draft.changedEntityId,
    changeType: draft.changeType, changeSummary: draft.changeSummary.trim(), reason: draft.reason.trim(), changedByUserId: draft.changedByUserId,
  } }),
}

export const itineraryApi = {
  async list(pageNumber = 1, signal?: AbortSignal) {
    return page(await apiRequest<PageDto<Itinerary>>('/itineraries', { query: { page: pageNumber - 1, size: 20, sort: 'startDate,desc' }, signal }))
  },
  get: (id: string, signal?: AbortSignal) => apiRequest<Itinerary>(itineraryPath(id), { signal }),
  listCruises,
  allItineraries: (signal?: AbortSignal) => allPages<Itinerary>('/itineraries', signal),
  create: (draft: ItineraryDraft) => apiRequest<Itinerary>('/itineraries', { method: 'POST', body: {
    cruiseId: draft.cruiseId, itineraryName: draft.itineraryName.trim(), startDate: draft.startDate, endDate: draft.endDate, itineraryType: draft.itineraryType,
  } }),
  async formContext(signal?: AbortSignal) {
    const [cruises, itineraries] = await Promise.all([listCruises(signal), allPages<Itinerary>('/itineraries', signal)])
    return { cruises, itineraries }
  },
  update: (id: string, draft: ItineraryDraft) => apiRequest<Itinerary>(`${itineraryPath(id)}/draft`, { method: 'PATCH', body: { itineraryName: draft.itineraryName, startDate: draft.startDate, endDate: draft.endDate, itineraryType: draft.itineraryType } }),
  removeDraft: (id: string) => apiRequest<void>(`${itineraryPath(id)}/draft`, { method: 'DELETE' }),
  validateFeasibility: (id: string) => apiRequest<unknown>(`${itineraryPath(id)}/validate-feasibility`, { method: 'POST' }),
  validateStructure: (id: string) => apiRequest<unknown>(`${itineraryPath(id)}/validate-structure`, { method: 'POST' }),
  validateSequence: (id: string) => apiRequest<unknown>(`${itineraryPath(id)}/validate-sequence`, { method: 'POST' }),
  submit: (id: string) => apiRequest<Itinerary>(`${itineraryPath(id)}/submit`, { method: 'POST' }),
  approve: (id: string) => apiRequest<Itinerary>(`${itineraryPath(id)}/approve`, { method: 'POST' }),
  reject: (id: string, reason: string) => apiRequest<Itinerary>(`${itineraryPath(id)}/reject`, { method: 'POST', query: { reason } }),
  applyChange: (id: string, changeDescription: string) => apiRequest<Itinerary>(`${itineraryPath(id)}/apply-change`, { method: 'POST', query: { changeDescription } }),
  publish: (id: string) => apiRequest<Itinerary>(`${itineraryPath(id)}/publish`, { method: 'POST' }),
  cancel: (id: string) => apiRequest<Itinerary>(`${itineraryPath(id)}/cancel`, { method: 'POST' }),

  listDays: (id: string, signal?: AbortSignal) => apiRequest<ItineraryDay[]>(`${itineraryPath(id)}/days`, { signal }),
  listDaysByItinerary: (itineraryId: string, signal?: AbortSignal) => apiRequest<ItineraryDay[]>(`/itinerary-days/by-itinerary/${encodeURIComponent(itineraryId)}`, { signal }),
  getDay: (id: string, signal?: AbortSignal) => apiRequest<ItineraryDay>(dayPath(id), { signal }),
  createDay: (draft: ItineraryDayDraft) => apiRequest<ItineraryDay>('/itinerary-days', { method: 'POST', body: { ...draft, dayNumber: draft.dayNumber === '' ? undefined : draft.dayNumber } }),
  updateDay: (id: string, draft: Partial<ItineraryDayDraft>) => apiRequest<ItineraryDay>(dayPath(id), { method: 'PATCH', body: { dayNumber: draft.dayNumber, date: draft.date, dayType: draft.dayType, shipTimeZoneId: draft.shipTimeZoneId, description: draft.description } }),
  setDayType: (id: string, dayType: ItineraryDayType) => apiRequest<ItineraryDay>(`${dayPath(id)}/day-type`, { method: 'POST', query: { dayType } }),
  setShipTimeZone: (id: string, shipTimeZoneId: string) => apiRequest<ItineraryDay>(`${dayPath(id)}/ship-timezone`, { method: 'POST', query: { shipTimeZoneId } }),
  removeDay: (id: string) => apiRequest<void>(`${dayPath(id)}/unused`, { method: 'DELETE' }),
  validateDay: (id: string) => apiRequest<unknown>(`${dayPath(id)}/validate`, { method: 'POST' }),
  validateDaySequence: (itineraryId: string) => apiRequest<unknown>(`/itinerary-days/by-itinerary/${encodeURIComponent(itineraryId)}/validate-sequence`, { method: 'POST' }),

  listStops: (id: string, signal?: AbortSignal) => apiRequest<CruiseStop[]>(`/cruise-stops/by-itinerary/${encodeURIComponent(id)}`, { signal }),
  getStop: (id: string, signal?: AbortSignal) => apiRequest<CruiseStop>(stopPath(id), { signal }),
  createStop: (draft: CruiseStopDraft) => apiRequest<CruiseStop>('/cruise-stops', { method: 'POST', body: stopBody({ ...draft, stopOrder: draft.stopOrder === '' ? undefined : draft.stopOrder }) }),
  updateStop: (id: string, draft: Partial<CruiseStopDraft>) => apiRequest<CruiseStop>(stopPath(id), { method: 'PATCH', body: stopBody(draft) }),
  removeStop: (id: string) => apiRequest<void>(`${stopPath(id)}/draft`, { method: 'DELETE' }),
  reorderStop: (id: string, newStopOrder: number) => apiRequest<CruiseStop>(`${stopPath(id)}/reorder`, { method: 'POST', query: { newStopOrder } }),
  setAllAboardTime: (id: string, allAboardTime: string) => apiRequest<CruiseStop>(`${stopPath(id)}/all-aboard-time`, { method: 'POST', query: { allAboardTime: new Date(allAboardTime).toISOString() } }),
  recordActualArrival: (id: string, actualArrival: string) => apiRequest<CruiseStop>(`${stopPath(id)}/actual-arrival`, { method: 'POST', query: { actualArrival: new Date(actualArrival).toISOString() } }),
  recordActualDeparture: (id: string, actualDeparture: string) => apiRequest<CruiseStop>(`${stopPath(id)}/actual-departure`, { method: 'POST', query: { actualDeparture: new Date(actualDeparture).toISOString() } }),
  omitStop: (id: string, reason: string) => apiRequest<CruiseStop>(`${stopPath(id)}/omit`, { method: 'POST', query: { reason } }),
  substituteStop: (id: string, newStopId: string) => apiRequest<CruiseStop>(`${stopPath(id)}/substitute`, { method: 'POST', query: { newStopId } }),
  setPlannedArrival: (id: string, plannedArrival: string) => apiRequest<CruiseStop>(`${stopPath(id)}/planned-arrival`, { method: 'POST', query: { plannedArrival: new Date(plannedArrival).toISOString() } }),
  setPlannedDeparture: (id: string, plannedDeparture: string) => apiRequest<CruiseStop>(`${stopPath(id)}/planned-departure`, { method: 'POST', query: { plannedDeparture: new Date(plannedDeparture).toISOString() } }),
  getStopDuration: (id: string, signal?: AbortSignal) => apiRequest<number>(`${stopPath(id)}/duration`, { signal }),
  checkStopPortAvailability: (id: string, signal?: AbortSignal) => apiRequest<boolean>(`${stopPath(id)}/port-availability`, { signal }),
  validateStop: (id: string) => apiRequest<unknown>(`${stopPath(id)}/validate`, { method: 'POST' }),

  async listPorts(pageNumber = 1, signal?: AbortSignal) {
    return page(await apiRequest<PageDto<Port>>('/ports', { query: { page: pageNumber - 1, size: 20, sort: 'portName,asc' }, signal }))
  },
  activePorts: (signal?: AbortSignal) => apiRequest<Port[]>('/ports/active', { signal }),
  getPort: (id: string, signal?: AbortSignal) => apiRequest<Port>(portPath(id), { signal }),
  createPort: (draft: PortDraft) => {
    const { portCode, portName, countryCode, timeZoneId, latitude, longitude, status } = draft
    return apiRequest<Port>('/ports', { method: 'POST', body: { portCode, portName, countryCode, timeZoneId, latitude, longitude, status } })
  },
  updatePort: (id: string, draft: PortDraft) => apiRequest<Port>(portPath(id), { method: 'PATCH', body: { portName: draft.portName, description: draft.description ?? undefined, latitude: draft.latitude ?? undefined, longitude: draft.longitude ?? undefined, timeZoneId: draft.timeZoneId } }),
  removePort: (id: string) => apiRequest<void>(`${portPath(id)}/unused`, { method: 'DELETE' }),
  activatePort: (id: string) => apiRequest<Port>(`${portPath(id)}/activate`, { method: 'POST' }),
  deactivatePort: (id: string) => apiRequest<Port>(`${portPath(id)}/deactivate`, { method: 'POST' }),
  validatePort: (id: string) => apiRequest<unknown>(`${portPath(id)}/validate`, { method: 'POST' }),
  checkPortAvailability: (id: string, signal?: AbortSignal) => apiRequest<boolean>(`${portPath(id)}/availability`, { signal }),

  async listDestinations(pageNumber = 1, signal?: AbortSignal) {
    return page(await apiRequest<PageDto<Destination>>('/destinations', { query: { page: pageNumber - 1, size: 20, sort: 'destinationName,asc' }, signal }))
  },
  activeDestinations: (signal?: AbortSignal) => apiRequest<Destination[]>('/destinations/active', { signal }),
  getDestination: (id: string, signal?: AbortSignal) => apiRequest<Destination>(destinationPath(id), { signal }),
  destinationPorts: (id: string, signal?: AbortSignal) => apiRequest<DestinationPortSummary[]>(`${destinationPath(id)}/ports`, { signal }),
  createDestination: (draft: DestinationDraft) => apiRequest<Destination>('/destinations', { method: 'POST', body: {
    destinationName: draft.destinationName, countryCode: draft.countryCode, description: draft.description, status: draft.status,
  } }),
  updateDestination: (id: string, draft: DestinationDraft) => apiRequest<Destination>(destinationPath(id), { method: 'PATCH', body: { destinationName: draft.destinationName, description: draft.description ?? undefined } }),
  removeDestination: (id: string) => apiRequest<void>(`${destinationPath(id)}/unused`, { method: 'DELETE' }),
  activateDestination: (id: string) => apiRequest<Destination>(`${destinationPath(id)}/activate`, { method: 'PATCH' }),
  deactivateDestination: (id: string) => apiRequest<Destination>(`${destinationPath(id)}/deactivate`, { method: 'PATCH' }),
  validateDestination: (id: string) => apiRequest<unknown>(`${destinationPath(id)}/validate`, { method: 'POST' }),
}
