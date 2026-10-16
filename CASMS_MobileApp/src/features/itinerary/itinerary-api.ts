import { useQuery } from '@tanstack/react-query';
import { create } from 'zustand';

import { api, ApiError, getApiUrl, readSection, readErrorMessage } from '@/lib/api';
import { useAuth } from '@/features/auth/session-store';

export type CruiseDto = { cruiseId: string; cruiseCode: string; cruiseName: string; shipName?: string | null; departureDatetime: string; returnDatetime: string; status: string };
export type ItineraryDto = { itineraryId: string; cruiseId: string; itineraryName: string; startDate: string; endDate: string; status: string };
export type DayDto = { itineraryDayId: string; dayNumber: number; date: string; dayType: string; shipTimeZoneId?: string | null; description?: string | null };
export type StopDto = { cruiseStopId: string; arrivalItineraryDayId: string; departureItineraryDayId: string; stopOrder: number; portName?: string | null; destinationName?: string | null; plannedArrival: string; plannedDeparture: string; actualArrival?: string | null; actualDeparture?: string | null; allAboardTime?: string | null; status: string; cancellationReason?: string | null; notes?: string | null };
export type TourDto = { shoreExcursionId: string; excursionCode: string; excursionName: string; supplierName?: string | null; startTime?: string | null; plannedReturnTime?: string | null; meetingPoint?: string | null; status: string; cancellationReason?: string | null; price?: number | null; currencyCode?: string | null; availableCapacity?: number | null };
export type GroupDto = { tourGroupId: string; groupCode: string; assignedPassengers: number; maximumCapacity: number; guideId?: string | null; meetingPoint?: string | null; assemblyTime?: string | null; plannedDepartureTime?: string | null; plannedReturnTime?: string | null; actualDepartureTime?: string | null; actualReturnTime?: string | null; status: string };
export type HistoryDto = { changeHistoryId: string; changeSummary?: string | null; reason?: string | null; changeType: string; changedAt: string };
type Page<T> = { content: T[]; number: number; totalPages: number; last?: boolean };
const idPath = (id: string) => encodeURIComponent(id);
async function listAll<T>(path: string, signal?: AbortSignal): Promise<T[]> {
  const items: T[] = [];
  for (let page = 0; page < 50; page++) {
    const result = await api.request<Page<T> | T[]>(path, { query: { page, size: 50 }, signal });
    if (Array.isArray(result)) return result;
    if (!result || !Array.isArray(result.content) || !Number.isFinite(result.totalPages)) throw new ApiError('Danh sách API không đúng định dạng.', 200);
    items.push(...result.content);
    if (result.last || page + 1 >= result.totalPages) return items;
  }
  throw new ApiError('Danh sách quá lớn để tải. Cần bổ sung bộ lọc phía backend.', 200);
}
export const itineraryApi = {
  async catalog(signal?: AbortSignal) {
    const itineraries = await listAll<ItineraryDto>('/itineraries', signal);
    return { itineraries };
  },
  async detail(id: string, signal?: AbortSignal) {
    const itinerary = await api.request<ItineraryDto>(`/itineraries/${idPath(id)}`, { signal });
    const [days, stops, cruise, history] = await Promise.all([
      readSection(api.request<DayDto[]>(`/itineraries/${idPath(id)}/days`, { signal }), 'ngày trong hải trình'),
      readSection(api.request<StopDto[]>(`/cruise-stops/by-itinerary/${idPath(id)}`, { signal }), 'điểm dừng'),
      readSection(api.request<CruiseDto>(`/cruise/${idPath(itinerary.cruiseId)}`, { signal }), 'thông tin chuyến tàu'),
      api.request<HistoryDto[]>(`/itinerary-change-history/itineraries/${idPath(id)}`, { signal }).then(items => ({ items, error: null as string | null })).catch((error: unknown) => {
        if (signal?.aborted || (error instanceof ApiError && error.status === 401)) throw error;
        return { items: [] as HistoryDto[], error: readErrorMessage(error, 'lịch sử thay đổi hải trình') };
      }),
    ]);
    if ((!days.error && !Array.isArray(days.data)) || (!stops.error && !Array.isArray(stops.data))) throw new ApiError('Dữ liệu ngày/điểm dừng không đúng định dạng.', 200);
    return { itinerary, cruise: cruise.data, days: [...(days.data ?? [])].sort((a, b) => a.dayNumber - b.dayNumber), stops: [...(stops.data ?? [])].sort((a, b) => a.stopOrder - b.stopOrder), history,
      accessErrors: [cruise.error, days.error, stops.error].filter((message): message is string => !!message), daysDenied: !!days.error, stopsDenied: !!stops.error };
  },
  async tours(stopId: string, signal?: AbortSignal) {
    const items = await api.request<TourDto[]>('/shore-excursions', { query: { cruiseStopId: stopId }, signal });
    if (!Array.isArray(items)) throw new ApiError('Danh sách tour không đúng định dạng.', 200);
    return items;
  },
  async groups(excursionId: string, signal?: AbortSignal) {
    const items = await api.request<GroupDto[]>('/tour-groups', { query: { excursionId }, signal });
    if (!Array.isArray(items)) throw new ApiError('Danh sách nhóm không đúng định dạng.', 200);
    return items;
  },
};
const useItinerarySelection = create<{ owner: string | null; itineraryId: string | null }>(() => ({ owner: null, itineraryId: null }));
export function selectItinerary(owner: string, itineraryId: string) { useItinerarySelection.setState({ owner, itineraryId }); }
export function useItineraryCatalog() {
  const auth = useAuth();
  const query = useQuery({ queryKey: ['live', auth.session?.user.id, getApiUrl(), 'catalog'], queryFn: ({ signal }) => itineraryApi.catalog(signal), enabled: auth.status === 'authenticated' && auth.mode === 'live' && !!auth.session });
  return { ...query, data: query.error instanceof ApiError && query.error.status === 403 ? undefined : query.data };
}
export function useSelectedItinerary() {
  const userId = useAuth(state => state.session?.user.id);
  const selected = useItinerarySelection();
  const catalog = useItineraryCatalog();
  const itinerary = catalog.data?.itineraries.find(item => item.itineraryId === (selected.owner === userId ? selected.itineraryId : null)) ?? catalog.data?.itineraries[0];
  const cruise = useQuery({ queryKey: ['live', userId, getApiUrl(), 'cruise', itinerary?.cruiseId], queryFn: ({ signal }) => api.request<CruiseDto>(`/cruise/${idPath(itinerary!.cruiseId)}`, { signal }), enabled: !!itinerary && !!userId });
  return { ...catalog, itinerary, cruise: cruise.error instanceof ApiError && cruise.error.status === 403 ? undefined : cruise.data, cruiseError: cruise.error, userId };
}
export function useLiveItinerary() {
  const catalog = useSelectedItinerary();
  const auth = useAuth();
  const itineraryId = catalog.itinerary?.itineraryId;
  const detail = useQuery({ queryKey: ['live', auth.session?.user.id, getApiUrl(), 'itinerary', itineraryId], queryFn: ({ signal }) => itineraryApi.detail(itineraryId!, signal), enabled: auth.mode === 'live' && !!auth.session && !!itineraryId });
  return { catalog, detail: { ...detail, data: (catalog.error instanceof ApiError && catalog.error.status === 403) || (detail.error instanceof ApiError && detail.error.status === 403) ? undefined : detail.data } };
}
