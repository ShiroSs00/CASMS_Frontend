import { onboardScopeIsCurrent } from './onboard-contracts';
import { useEffect, useRef } from 'react';
import { useAuth } from '@/features/auth/session-store';
import { useVoyageSelection } from './voyage-selection';
import { useSelectedItinerary } from '@/features/itinerary/itinerary-api';
import { getApiUrl } from '@/lib/api';
import { useBookingSelection, usePassengerContext, usePassengerQuery, passengerApi } from './passenger-hooks';
import { voyagePassenger } from './passenger-model';

export function useOnboardKey() {
  const { context, voyage } = useSelectedItinerary();
  return JSON.stringify([getApiUrl(), context.owner, context.auth.session?.signedInAt, voyage?.bookingId, voyage?.bookingPassengerId, voyage?.cruiseId, voyage?.itineraryId]);
}
export function useOnboardSelection(initialId = '') {
  const selection = useBookingSelection('confirmed', initialId);
  const context = usePassengerContext();
  const voyage = selection.source.data?.find(row => 'bookingPassengerId' in row && row.bookingPassengerId === selection.bookingPassengerId);
  const current = voyage && 'bookingPassengerId' in voyage ? voyage : undefined;
  const person = voyagePassenger(current, selection.booking.data, context.me.data?.passengerId);
  return { ...selection, voyage: current, ready: selection.ready && !!person && !selection.booking.isFetching && !selection.booking.error && !selection.bookings.error };
}
export function useOnboardEntitlements(selection: ReturnType<typeof useOnboardSelection>) {
  return usePassengerQuery(['entitlements', selection.bookingId, selection.bookingPassengerId, selection.cruiseId],
    signal => passengerApi.entitlements(selection.bookingId, signal), 'BOOKING_READ', !!selection.bookingId && !!selection.bookingPassengerId);
}

export function useOnboardGuard(selection: ReturnType<typeof useOnboardSelection>) {
  const context = usePassengerContext();
  const mounted = useRef(true);
  const backend = getApiUrl(), owner = context.owner, epoch = context.auth.session?.signedInAt;
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  return () => {
    const current = useAuth.getState(), chosen = useVoyageSelection.getState().selection;
    if (!mounted.current || !onboardScopeIsCurrent({ backend, owner, epoch, bookingId: selection.bookingId, bookingPassengerId: selection.bookingPassengerId },
      { backend: getApiUrl(), owner: current.session?.user.id, epoch: current.session?.signedInAt, expiresAt: current.session?.expiresAt, authenticated: current.status === 'authenticated' }, chosen, Date.now()))
      throw new Error('Hồ sơ hoặc phiên đã thay đổi. Hãy kiểm tra lại trước khi tiếp tục.');
  };
}
