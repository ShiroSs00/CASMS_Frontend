import { apiRequest } from '@/shared/api'

import type {
  CruiseStop,
  CruiseStopDraft,
  Destination,
  DestinationDraft,
  Itinerary,
  ItineraryDay,
  ItineraryDayDraft,
  ItineraryDraft,
  PageResult,
  Port,
  PortDraft,
} from '../model/itinerary'

type PageDto<T> = { content: T[]; number: number; size: number; totalPages: number; totalElements: number }

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

// BE_CONTRACT_TO_NORMALIZE: the history controller does not yet return ApiResponse.
export const itineraryHistoryApi = {
  availability: 'pending' as const,
  list: async (): Promise<readonly { id: string; description: string; createdAt: string }[]> => [],
}

export const itineraryApi = {
  async list(pageNumber = 1, signal?: AbortSignal) {
    return page(await apiRequest<PageDto<Itinerary>>('/itineraries', { query: { page: pageNumber - 1, size: 20, sort: 'startDate,desc' }, signal }))
  },
  get: (id: string, signal?: AbortSignal) => apiRequest<Itinerary>(itineraryPath(id), { signal }),
  create: (draft: ItineraryDraft) => apiRequest<Itinerary>('/itineraries', { method: 'POST', body: draft }),
  update: (id: string, draft: ItineraryDraft) => apiRequest<Itinerary>(`${itineraryPath(id)}/draft`, { method: 'PATCH', body: { itineraryName: draft.itineraryName, startDate: draft.startDate, endDate: draft.endDate, itineraryType: draft.itineraryType } }),
  removeDraft: (id: string) => apiRequest<void>(`${itineraryPath(id)}/draft`, { method: 'DELETE' }),
  validateFeasibility: (id: string) => apiRequest<unknown>(`${itineraryPath(id)}/validate-feasibility`, { method: 'POST' }),
  validateStructure: (id: string) => apiRequest<unknown>(`${itineraryPath(id)}/validate-structure`, { method: 'POST' }),
  validateSequence: (id: string) => apiRequest<unknown>(`${itineraryPath(id)}/validate-sequence`, { method: 'POST' }),
  submit: (id: string) => apiRequest<Itinerary>(`${itineraryPath(id)}/submit`, { method: 'POST' }),
  approve: (id: string, approverId: string) => apiRequest<Itinerary>(`${itineraryPath(id)}/approve`, { method: 'POST', query: { approverId } }),
  reject: (id: string, approverId: string, reason: string) => apiRequest<Itinerary>(`${itineraryPath(id)}/reject`, { method: 'POST', query: { approverId, reason } }),
  applyChange: (id: string, changeDescription: string) => apiRequest<Itinerary>(`${itineraryPath(id)}/apply-change`, { method: 'POST', query: { changeDescription } }),
  publish: (id: string) => apiRequest<Itinerary>(`${itineraryPath(id)}/publish`, { method: 'POST' }),
  cancel: (id: string) => apiRequest<Itinerary>(`${itineraryPath(id)}/cancel`, { method: 'POST' }),

  listDays: (id: string, signal?: AbortSignal) => apiRequest<ItineraryDay[]>(`${itineraryPath(id)}/days`, { signal }),
  createDay: (draft: ItineraryDayDraft) => apiRequest<ItineraryDay>('/itinerary-days', { method: 'POST', body: draft }),
  updateDay: (id: string, draft: Partial<ItineraryDayDraft>) => apiRequest<ItineraryDay>(dayPath(id), { method: 'PATCH', body: draft }),
  removeDay: (id: string) => apiRequest<void>(`${dayPath(id)}/unused`, { method: 'DELETE' }),
  validateDay: (id: string) => apiRequest<unknown>(`${dayPath(id)}/validate`, { method: 'POST' }),

  listStops: (id: string, signal?: AbortSignal) => apiRequest<CruiseStop[]>(`/cruise-stops/by-itinerary/${encodeURIComponent(id)}`, { signal }),
  createStop: (draft: CruiseStopDraft) => apiRequest<CruiseStop>('/cruise-stops', { method: 'POST', body: stopBody(draft) }),
  updateStop: (id: string, draft: Partial<CruiseStopDraft>) => apiRequest<CruiseStop>(stopPath(id), { method: 'PATCH', body: stopBody(draft) }),
  removeStop: (id: string) => apiRequest<void>(`${stopPath(id)}/draft`, { method: 'DELETE' }),
  validateStop: (id: string) => apiRequest<unknown>(`${stopPath(id)}/validate`, { method: 'POST' }),

  async listPorts(pageNumber = 1, signal?: AbortSignal) {
    return page(await apiRequest<PageDto<Port>>('/ports', { query: { page: pageNumber - 1, size: 20, sort: 'portName,asc' }, signal }))
  },
  activePorts: (signal?: AbortSignal) => apiRequest<Port[]>('/ports/active', { signal }),
  getPort: (id: string, signal?: AbortSignal) => apiRequest<Port>(portPath(id), { signal }),
  createPort: (draft: PortDraft) => apiRequest<Port>('/ports', { method: 'POST', body: draft }),
  updatePort: (id: string, draft: PortDraft) => apiRequest<Port>(portPath(id), { method: 'PATCH', body: draft }),
  removePort: (id: string) => apiRequest<void>(`${portPath(id)}/unused`, { method: 'DELETE' }),
  activatePort: (id: string) => apiRequest<Port>(`${portPath(id)}/activate`, { method: 'POST' }),
  deactivatePort: (id: string) => apiRequest<Port>(`${portPath(id)}/deactivate`, { method: 'POST' }),
  validatePort: (id: string) => apiRequest<unknown>(`${portPath(id)}/validate`, { method: 'POST' }),

  async listDestinations(pageNumber = 1, signal?: AbortSignal) {
    return page(await apiRequest<PageDto<Destination>>('/destinations', { query: { page: pageNumber - 1, size: 20, sort: 'destinationName,asc' }, signal }))
  },
  activeDestinations: (signal?: AbortSignal) => apiRequest<Destination[]>('/destinations/active', { signal }),
  getDestination: (id: string, signal?: AbortSignal) => apiRequest<Destination>(destinationPath(id), { signal }),
  destinationPorts: (id: string, signal?: AbortSignal) => apiRequest<Port[]>(`${destinationPath(id)}/ports`, { signal }),
  createDestination: (draft: DestinationDraft) => apiRequest<Destination>('/destinations', { method: 'POST', body: draft }),
  updateDestination: (id: string, draft: DestinationDraft) => apiRequest<Destination>(destinationPath(id), { method: 'PATCH', body: draft }),
  removeDestination: (id: string) => apiRequest<void>(`${destinationPath(id)}/unused`, { method: 'DELETE' }),
  validateDestination: (id: string) => apiRequest<unknown>(`${destinationPath(id)}/validate`, { method: 'POST' }),
}
