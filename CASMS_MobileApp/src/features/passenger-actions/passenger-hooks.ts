import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError, getApiUrl } from '@/lib/api';
import { useAuth } from '@/features/auth/session-store';
import { createPassengerApi } from './passenger-api';
import { useState } from 'react';
import { personalPermissions, usablePassengers } from './passenger-model';

export const passengerApi = createPassengerApi(api);
export function usePassengerContext() {
  const auth = useAuth(); const owner = auth.session?.user.id;
  // Staff endpoints can return all passengers. These screens are personal views.
  const personal = !!auth.session && auth.session.user.roles.length > 0 && auth.session.user.roles.every(r => r === 'PASSENGER');
  const live = auth.status === 'authenticated' && auth.mode === 'live' && personal;
  const me = useQuery({ queryKey: ['passenger', getApiUrl(), owner, 'me'], queryFn: ({ signal }) => passengerApi.me(signal), enabled: live });
  const permissions = personalPermissions(owner, me.data);
  const error = me.error ?? (me.data && permissions === null ? new Error('Thông tin phiên không còn khớp tài khoản hành khách. Vui lòng đăng nhập lại.') : null);
  return { auth, owner, me, error, live, ready: live && permissions !== null && !error, can: (permission: string) => live && !error && !!permissions?.includes(permission) };
}
export function usePassengerQuery<T>(key: readonly unknown[], fetcher: (signal: AbortSignal) => Promise<T>, permission: string | readonly string[], enabled = true) {
  const context = usePassengerContext();
  const allowed = context.ready && (typeof permission === 'string' ? context.can(permission) : permission.some(context.can));
  const query = useQuery({ queryKey: ['passenger', getApiUrl(), context.owner, ...key], queryFn: ({ signal }) => fetcher(signal), enabled: allowed && enabled });
  const denied = query.error instanceof ApiError && [401, 403, 404].includes(query.error.status);
  return { ...query, data: allowed && enabled && !denied ? query.data : undefined };
}
export function usePassengerAction<T = unknown>() {
  const client = useQueryClient();
  const owner = useAuth(state => state.session?.user.id);
  const signedInAt = useAuth(state => state.session?.signedInAt);
  return useMutation({ retry: false,
    mutationFn: async (action: (assertCurrent: () => void) => Promise<T>) => {
      function assertCurrent() {
        const { session, status } = useAuth.getState();
        if (!session || status !== 'authenticated' || session.expiresAt <= Date.now() || session.user.id !== owner || session.signedInAt !== signedInAt
          || !session.user.roles.length || !session.user.roles.every(role => role === 'PASSENGER')) {
          throw new Error('Phiên đăng nhập đã thay đổi. Hãy tải lại để kiểm tra kết quả thao tác.');
        }
      }
      assertCurrent();
      const result = await action(assertCurrent);
      assertCurrent();
      return { result, owner };
    },
    onSettled: async () => {
      const session = useAuth.getState().session;
      if (session?.user.id === owner && session?.signedInAt === signedInAt) {
        await client.invalidateQueries({ queryKey: ['passenger', getApiUrl(), owner] });
      }
    },
  });
}

export function useBookingSelection(mode: 'confirmed' | 'draft', initialId = '') {
  const [selection, setSelection] = useState({ initialId, chosen: initialId, person: '' });
  const { chosen, person } = selection.initialId === initialId ? selection : { chosen: initialId, person: '' };
  const bookings = usePassengerQuery(['bookings'], passengerApi.bookings, 'BOOKING_READ');
  const voyages = usePassengerQuery(['voyages'], passengerApi.voyages, 'BOOKING_READ', mode === 'confirmed');
  const confirmed = (voyages.data ?? []).filter(item => item.bookingStatus === 'Confirmed' && item.participationStatus === 'Active');
  const options = mode === 'confirmed' ? [...new Map(confirmed.map(item => [item.bookingId, item])).values()]
    : (bookings.data ?? []).filter(item => item.bookingStatus === 'Draft');
  const bookingId = chosen ? options.find(b => b.bookingId === chosen.toLowerCase())?.bookingId ?? ''
    : options.length === 1 ? options[0].bookingId : '';
  const ownBooking = !!bookingId && !!bookings.data?.some(item => item.bookingId === bookingId);
  const booking = usePassengerQuery(['booking', bookingId], signal => passengerApi.booking(bookingId, signal), 'BOOKING_READ', ownBooking);
  const selectedVoyages = confirmed.filter(item => item.bookingId === bookingId);
  const people = mode === 'draft' ? usablePassengers(booking.data, false) : selectedVoyages.map(item => {
    const details = booking.data?.passengers.find(row => row.bookingPassengerId === item.bookingPassengerId);
    return { bookingPassengerId: item.bookingPassengerId, fullName: details?.fullName ?? 'Hồ sơ của bạn', cabinNumber: details?.cabinNumber };
  });
  const bookingPassengerId = person ? people.find(p => p.bookingPassengerId === person)?.bookingPassengerId ?? ''
    : people.length === 1 ? people[0].bookingPassengerId : '';
  const source = mode === 'confirmed' ? voyages : bookings;
  const activeVoyage = selectedVoyages.find(item => item.bookingPassengerId === bookingPassengerId);
  const cruiseId = options.find(item => item.bookingId === bookingId)?.cruiseId ?? '';
  const ready = !!bookingPassengerId && !source.error && !source.isFetching && (mode === 'draft' ? !!booking.data && !booking.error && !booking.isFetching
    : !!activeVoyage && !['COMPLETED', 'CANCELLED'].includes(activeVoyage.cruiseStatus));
  return { bookings, source, options, bookingId, booking, ownBooking, cruiseId, ready, people, bookingPassengerId, invalidSelection: !!chosen && !bookingId,
    choose: (id: string) => setSelection({ initialId, chosen: id, person: '' }),
    choosePerson: (id: string) => setSelection({ initialId, chosen: bookingId, person: id }) };
}
