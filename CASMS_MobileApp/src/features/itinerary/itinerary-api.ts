import { useQuery } from '@tanstack/react-query';

import { api, ApiError, getApiUrl } from '@/lib/api';
import { usePassengerContext, usePassengerQuery, passengerApi, passengerKey } from '@/features/passenger-actions/passenger-hooks';
import { voyagePassenger } from '@/features/passenger-actions/passenger-model';
import { useAuth } from '@/features/auth/session-store';
import { queryClient } from '@/lib/query-client';
import type { PersonalVoyage } from '@/features/passenger-actions/passenger-api';
import { availableVoyages, chooseVoyage, resolveVoyage, useVoyageSelection } from '@/features/passenger-actions/voyage-selection';

import { createItineraryApi } from './itinerary-client';
export type { CruiseDto, ItineraryDto, DayDto, StopDto, TourDto, GroupDto, HistoryDto } from './itinerary-client';
export const itineraryApi = createItineraryApi(api);
/** Selection comes only from the current authenticated /itineraries/mine cache. */
export function selectVoyage(owner: string, bookingId: string, bookingPassengerId?: string) {
  const { session, status } = useAuth.getState();
  if (!session || status !== 'authenticated' || session.user.id !== owner || session.expiresAt <= Date.now()) return;
  const apiUrl = getApiUrl();
  const state = queryClient.getQueryState<PersonalVoyage[]>(passengerKey(owner, session.signedInAt, 'voyages'));
  if (!state?.data || state.error) return false;
  return chooseVoyage({ owner, apiUrl, signedInAt: session.signedInAt }, state.data, bookingId, bookingPassengerId);
}
export function useSelectedItinerary() {
  const context = usePassengerContext();
  const userId = context.owner;
  const selected = useVoyageSelection(state => state.selection);
  const catalog = usePassengerQuery(['voyages'], passengerApi.voyages, 'BOOKING_READ');
  const rows = context.ready && context.can('BOOKING_READ') && !(catalog.error instanceof ApiError && [401, 403].includes(catalog.error.status))
    ? catalog.data ?? [] : [];
  const scope = userId && context.auth.session ? { owner: userId, apiUrl: getApiUrl(), signedInAt: context.auth.session.signedInAt } : null;
  const voyages = availableVoyages(rows);
  const voyage = resolveVoyage(scope, selected, rows);
  const itineraryId = voyage?.itineraryId ?? '';
  const cruiseId = voyage?.cruiseId ?? '';
  const bookingId = voyage?.bookingId ?? '';
  const booking = usePassengerQuery(['booking', bookingId], signal => passengerApi.booking(bookingId, signal), 'BOOKING_READ', !!bookingId);
  const person = voyagePassenger(voyage, booking.error ? undefined : booking.data, context.ready ? context.me.data?.passengerId : null);
  const cruise = usePassengerQuery(['cruise', cruiseId], signal => passengerApi.voyageCruise(cruiseId, signal), 'CRUISE_READ', !!cruiseId);
  return { ...catalog, context, voyage, voyages, itineraryId, booking, person, cruise: context.can('CRUISE_READ') ? cruise.data : undefined,
    cruiseError: cruise.error, refetchCruise: cruise.refetch, userId };
}
export function useLiveItinerary() {
  const catalog = useSelectedItinerary();
  const { context, itineraryId, voyage } = catalog;
  const canRead = context.can('ITINERARY_READ') || context.can('CRUISE_READ');
  const detail = useQuery({ queryKey: passengerKey(context.owner, context.auth.session?.signedInAt, 'itinerary', voyage?.cruiseId, itineraryId, context.can('CRUISE_READ')), queryFn: async ({ signal }) => {
    return itineraryApi.detail(itineraryId, signal, { history: false, cruise: context.can('CRUISE_READ'), expectedCruiseId: voyage?.cruiseId });
  }, enabled: canRead && !!itineraryId });
  return { catalog, canRead, detail: { ...detail, data: !canRead || (detail.error instanceof ApiError && [401, 403, 404].includes(detail.error.status)) ? undefined : detail.data } };
}
