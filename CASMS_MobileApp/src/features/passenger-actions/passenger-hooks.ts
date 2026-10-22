import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, getApiUrl } from '@/lib/api';
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
export function usePassengerQuery<T>(key: readonly unknown[], fetcher: (signal: AbortSignal) => Promise<T>, permission: string, enabled = true) {
  const context = usePassengerContext();
  return useQuery({ queryKey: ['passenger', getApiUrl(), context.owner, ...key], queryFn: ({ signal }) => fetcher(signal), enabled: context.ready && context.can(permission) && enabled });
}
export function usePassengerAction() {
  const client = useQueryClient();
  return useMutation({ retry: false,
    mutationFn: async (action: () => Promise<unknown>) => {
      const auth = useAuth.getState();
      if (!auth.session || auth.mode !== 'live' || auth.status !== 'authenticated') throw new Error('Vui lòng đăng nhập để tiếp tục.');
      const owner = auth.session.user.id; const token = auth.session.accessToken;
      const result = await action();
      if (useAuth.getState().session?.accessToken !== token) throw new Error('Phiên đăng nhập đã thay đổi. Hãy tải lại để kiểm tra kết quả thao tác.');
      return { result, owner };
    },
    onSettled: async () => {
      const owner = useAuth.getState().session?.user.id;
      await client.invalidateQueries({ queryKey: ['passenger', getApiUrl(), owner] });
    },
  });
}

export function useBookingSelection(mode: 'confirmed' | 'draft', initialId = '') {
  const [chosen, choose] = useState(initialId); const [person, choosePerson] = useState('');
  const bookings = usePassengerQuery(['bookings'], passengerApi.bookings, 'BOOKING_READ');
  const options = (bookings.data ?? []).filter(b => b.bookingStatus === (mode === 'confirmed' ? 'Confirmed' : 'Draft'));
  const bookingId = options.some(b => b.bookingId === chosen) ? chosen : options[0]?.bookingId ?? '';
  const booking = usePassengerQuery(['booking', bookingId], signal => passengerApi.booking(bookingId, signal), 'BOOKING_READ', !!bookingId);
  const people = usablePassengers(booking.data, mode === 'confirmed');
  const bookingPassengerId = people.some(p => p.bookingPassengerId === person) ? person : people[0]?.bookingPassengerId ?? '';
  return { bookings, options, bookingId, booking, people, bookingPassengerId, choose: (id: string) => { choose(id); choosePerson(''); }, choosePerson };
}
