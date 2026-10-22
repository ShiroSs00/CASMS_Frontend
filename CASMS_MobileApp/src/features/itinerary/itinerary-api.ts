import { useQuery } from '@tanstack/react-query';
import { create } from 'zustand';

import { api, ApiError, getApiUrl } from '@/lib/api';
import { useAuth } from '@/features/auth/session-store';

import { createItineraryApi, type CruiseDto } from './itinerary-client';
export type { CruiseDto, ItineraryDto, DayDto, StopDto, TourDto, GroupDto, HistoryDto } from './itinerary-client';
export const itineraryApi = createItineraryApi(api);
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
  const cruiseId = itinerary?.cruiseId ?? '';
  const cruise = useQuery({ queryKey: ['live', userId, getApiUrl(), 'cruise', itinerary?.cruiseId], queryFn: ({ signal }) => api.request<CruiseDto>(`/cruise/${encodeURIComponent(cruiseId)}`, { signal }), enabled: !!itinerary && !!userId });
  return { ...catalog, itinerary, cruise: cruise.error instanceof ApiError && cruise.error.status === 403 ? undefined : cruise.data, cruiseError: cruise.error, userId };
}
export function useLiveItinerary() {
  const catalog = useSelectedItinerary();
  const auth = useAuth();
  const itineraryId = catalog.itinerary?.itineraryId ?? '';
  const detail = useQuery({ queryKey: ['live', auth.session?.user.id, getApiUrl(), 'itinerary', itineraryId], queryFn: ({ signal }) => itineraryApi.detail(itineraryId, signal), enabled: auth.mode === 'live' && !!auth.session && !!itineraryId });
  return { catalog, detail: { ...detail, data: (catalog.error instanceof ApiError && catalog.error.status === 403) || (detail.error instanceof ApiError && detail.error.status === 403) ? undefined : detail.data } };
}
