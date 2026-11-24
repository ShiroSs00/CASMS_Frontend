import type { Href } from 'expo-router';
import { posDestination } from '../pos/pos-access';

export function isPassengerWorkspace(user: { roles: readonly string[] } | undefined) {
  return !!user?.roles.length && user.roles.every(role => role === 'PASSENGER');
}

export function workspaceDestination(user: Parameters<typeof posDestination>[0]) {
  if (isPassengerWorkspace(user)) return '/home';
  if (posDestination(user)) return '/staff-pos';
  return null;
}

const passengerRoutes = new Set(['/home', '/account', '/itinerary', '/services', '/notifications', '/cruise',
  '/passenger-bookings', '/passenger-services', '/passenger-activities', '/passenger-packages', '/passenger-qr',
  '/check-in', '/spending']);
const posRoutes = new Set(['/staff-pos', '/staff-pos/activities', '/staff-pos/requests', '/staff-pos/scanner',
  '/staff-pos/services', '/staff-pos/usage']);
const routesWithBooking = ['/check-in', '/passenger-services', '/passenger-activities', '/passenger-packages', '/passenger-qr'] as const;
const bookingIdPattern = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

export function workspaceLink(path: unknown, bookingId?: unknown): Href | undefined {
  if (typeof path !== 'string') return;
  if (passengerRoutes.has(path) || posRoutes.has(path)) {
    const route = routesWithBooking.find(value => value === path);
    if (route && typeof bookingId === 'string' && bookingIdPattern.test(bookingId)) {
      return { pathname: route, params: { bookingId } };
    }
    return path as Href;
  }
  const match = /^\/passenger-bookings\/([^/]+)$/.exec(path);
  if (match && bookingIdPattern.test(match[1])) {
    return { pathname: '/passenger-bookings/[bookingId]', params: { bookingId: match[1] } };
  }
}

export function loginLink(status: string, path: string, bookingId?: unknown): Href {
  const target = workspaceLink(path, bookingId);
  return { pathname: '/login', params: {
    state: status === 'expired' ? 'expired' : 'default',
    ...(target && status === 'anonymous' ? { returnTo: path, ...(routesWithBooking.some(value => value === path)
      && typeof bookingId === 'string' && bookingIdPattern.test(bookingId) ? { bookingId } : {}) } : {}),
  } };
}

export function landingLink(user: Parameters<typeof posDestination>[0], path?: unknown, bookingId?: unknown): Href | null {
  const destination = workspaceDestination(user);
  const target = workspaceLink(path, bookingId);
  if (destination && target && typeof path === 'string'
    && (destination === '/staff-pos' ? posRoutes.has(path) : !posRoutes.has(path))) return target;
  return destination;
}
