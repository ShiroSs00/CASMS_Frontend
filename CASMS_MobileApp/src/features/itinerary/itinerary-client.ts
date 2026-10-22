import { ApiError, readSection, readErrorMessage, type createApiClient } from '../../lib/api/api-client';

export type CruiseDto = { cruiseId: string; cruiseCode: string; cruiseName: string; shipName?: string | null; departureDatetime: string; returnDatetime: string; status: string };
export type ItineraryDto = { itineraryId: string; cruiseId: string; itineraryName: string; startDate: string; endDate: string; status: string };
export type DayDto = { itineraryDayId: string; dayNumber: number; date: string; dayType: string; shipTimeZoneId?: string | null; description?: string | null };
export type StopDto = { cruiseStopId: string; arrivalItineraryDayId: string; departureItineraryDayId: string; stopOrder: number; portName?: string | null; destinationName?: string | null; plannedArrival: string; plannedDeparture: string; actualArrival?: string | null; actualDeparture?: string | null; allAboardTime?: string | null; status: string; cancellationReason?: string | null; notes?: string | null };
export type TourDto = { shoreExcursionId: string; excursionCode: string; excursionName: string; supplierName?: string | null; startTime?: string | null; plannedReturnTime?: string | null; meetingPoint?: string | null; status: string; cancellationReason?: string | null; price?: number | null; currencyCode?: string | null; availableCapacity?: number | null };
export type GroupDto = { tourGroupId: string; groupCode: string; assignedPassengers: number; maximumCapacity: number; guideId?: string | null; meetingPoint?: string | null; assemblyTime?: string | null; plannedDepartureTime?: string | null; plannedReturnTime?: string | null; actualDepartureTime?: string | null; actualReturnTime?: string | null; status: string };
export type HistoryDto = { changeHistoryId: string; changeSummary?: string | null; reason?: string | null; changeType: string; changedAt: string };

export function createItineraryApi(api: Pick<ReturnType<typeof createApiClient>, 'request'>) {
  type Page<T> = { content: T[]; number: number; totalPages: number; totalElements: number; last?: boolean };
  const idPath = (id: string) => { if (!id) throw new ApiError('Chưa chọn dữ liệu cần tải.', 400); return encodeURIComponent(id); };
  async function listAll<T>(path: string, signal?: AbortSignal): Promise<T[]> {
    const items: T[] = [];
    for (let page = 0; page < 50; page++) {
      const result = await api.request<Page<T> | T[]>(path, { query: { page, size: 50 }, signal });
      if (Array.isArray(result)) return result;
      if (!result || !Array.isArray(result.content) || !Number.isInteger(result.totalPages) || result.totalPages < 0 || result.number !== page || !Number.isInteger(result.totalElements) || result.totalElements < 0) throw new ApiError('Không tải được danh sách hải trình. Vui lòng thử lại.', 200);
      items.push(...result.content);
      if (page + 1 >= result.totalPages) {
        if (items.length !== result.totalElements || new Set(items.map(item => (item as ItineraryDto).itineraryId)).size !== items.length) throw new ApiError('Danh sách hải trình thiếu hoặc trùng dữ liệu. Vui lòng tải lại.', 200);
        return items;
      }
      if (!result.content.length || result.last) throw new ApiError('Phân trang hải trình không nhất quán.', 200);
    }
    throw new ApiError('Không tải được toàn bộ danh sách. Vui lòng thử lại sau.', 200);
  }
  return {
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
        api.request<HistoryDto[]>(`/itinerary-change-history/itineraries/${idPath(id)}`, { signal }).then(items => { if (!Array.isArray(items)) throw new ApiError('Lịch sử hải trình không đúng định dạng.', 200); return { items, error: null as string | null }; }).catch((error: unknown) => {
          if (signal?.aborted || (error instanceof ApiError && error.status === 401)) throw error;
          return { items: [] as HistoryDto[], error: readErrorMessage(error, 'lịch sử thay đổi hải trình') };
        }),
      ]);
      if ((!days.error && !Array.isArray(days.data)) || (!stops.error && !Array.isArray(stops.data))) throw new ApiError('Dữ liệu ngày/điểm dừng không đúng định dạng.', 200);
      return { itinerary, cruise: cruise.data, days: [...(days.data ?? [])].sort((a, b) => a.dayNumber - b.dayNumber), stops: [...(stops.data ?? [])].sort((a, b) => a.stopOrder - b.stopOrder), history,
        accessErrors: [cruise.error, days.error, stops.error].filter((message): message is string => !!message), daysDenied: !!days.error, stopsDenied: !!stops.error };
    },
    async tours(stopId: string, signal?: AbortSignal) {
      idPath(stopId);
      const items = await api.request<TourDto[]>('/shore-excursions', { query: { cruiseStopId: stopId }, signal });
      if (!Array.isArray(items)) throw new ApiError('Danh sách tour không đúng định dạng.', 200);
      return items;
    },
    async groups(excursionId: string, signal?: AbortSignal) {
      idPath(excursionId);
      const items = await api.request<GroupDto[]>('/tour-groups', { query: { excursionId }, signal });
      if (!Array.isArray(items)) throw new ApiError('Danh sách nhóm không đúng định dạng.', 200);
      return items;
    },
  };
}
