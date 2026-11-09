import { useQuery } from '@tanstack/react-query';
import { create } from 'zustand';

import { api, ApiError, getApiUrl } from '@/lib/api';
import { usePassengerContext, usePassengerQuery, passengerApi } from '@/features/passenger-actions/passenger-hooks';
import { useAuth } from '@/features/auth/session-store';

import { createItineraryApi, type CruiseDto } from './itinerary-client';
export type { CruiseDto, ItineraryDto, DayDto, StopDto, TourDto, GroupDto, HistoryDto } from './itinerary-client';
export const itineraryApi = createItineraryApi(api);
const useItinerarySelection = create<{ owner: string | null; signedInAt?: number; bookingId: string | null }>(() => ({ owner: null, bookingId: null }));
export function selectVoyage(owner: string, bookingId: string) {
  const session = useAuth.getState().session;
  if (session?.user.id === owner) useItinerarySelection.setState({ owner, signedInAt: session.signedInAt, bookingId });
}
const rank: Record<string, number> = { IN_PROGRESS: 0, PUBLISHED: 1, COMPLETED: 2, CANCELLED: 3 };
export function useSelectedItinerary() {
  const context = usePassengerContext();
  const userId = context.owner;
  const selected = useItinerarySelection();
  const catalog = usePassengerQuery(['voyages'], passengerApi.voyages, 'BOOKING_READ');
  const rows = context.ready && context.can('BOOKING_READ') && !(catalog.error instanceof ApiError && [401, 403].includes(catalog.error.status))
    ? catalog.data ?? [] : [];
  // /itineraries/mine already orders by the cruise departure timestamp, even without an itinerary.
  const voyages = [...new Map(rows.filter(item => item.bookingStatus === 'Confirmed' && item.participationStatus === 'Active')
    .map(item => [item.bookingId, item])).values()].map((item, index) => ({ item, index })).sort((a, b) => {
      const order = (rank[a.item.cruiseStatus] ?? 4) - (rank[b.item.cruiseStatus] ?? 4);
      return order || (a.item.cruiseStatus === 'COMPLETED' ? b.index - a.index : a.index - b.index);
    }).map(({ item }) => item);
  const hasSelection = selected.owner === userId && selected.signedInAt === context.auth.session?.signedInAt && !!selected.bookingId;
  const voyage = hasSelection ? voyages.find(item => item.bookingId === selected.bookingId) : voyages[0];
  const itineraryId = voyage?.itineraryId ?? '';
  const cruiseId = voyage?.cruiseId ?? '';
  const cruise = usePassengerQuery(['cruise', cruiseId], async signal => {
    const result = await api.request<CruiseDto>(`/cruise/${encodeURIComponent(cruiseId)}`, { signal });
    if (result?.cruiseId !== cruiseId) throw new Error('Thông tin chuyến đi không khớp đặt chỗ.');
    return result;
  }, 'CRUISE_READ', !!cruiseId);
  return { ...catalog, context, voyage, voyages, itineraryId, cruise: context.can('CRUISE_READ') ? cruise.data : undefined,
    cruiseError: cruise.error, refetchCruise: cruise.refetch, userId };
}
export function useLiveItinerary() {
  const catalog = useSelectedItinerary();
  const { context, itineraryId, voyage } = catalog;
  const canRead = context.can('ITINERARY_READ') || context.can('CRUISE_READ');
  const detail = useQuery({ queryKey: ['live', context.owner, getApiUrl(), 'itinerary', itineraryId], queryFn: async ({ signal }) => {
    return itineraryApi.detail(itineraryId, signal, { history: false, cruise: context.can('CRUISE_READ'), expectedCruiseId: voyage?.cruiseId });
  }, enabled: canRead && !!itineraryId });
  return { catalog, canRead, detail: { ...detail, data: !canRead || (detail.error instanceof ApiError && [401, 403, 404].includes(detail.error.status)) ? undefined : detail.data } };
}
