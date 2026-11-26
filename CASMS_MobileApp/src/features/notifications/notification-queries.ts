export function notificationQueryAllowed(key: readonly unknown[], scope: { backend: string; owner: string; epoch: number }, permissions: readonly string[], kind: 'inbox' | 'all' | 'auth') {
  if (key[0] !== 'passenger' || key[1] !== scope.backend || key[2] !== scope.owner || key[3] !== scope.epoch) return false;
  const name = String(key[4]);
  if (kind === 'auth') return name === 'me';
  if (['notifications','notification-unread'].includes(name)) return permissions.includes('NOTIFICATION_READ');
  if (kind === 'inbox') return false;
  const required: Record<string, string[]> = {
    voyages: ['BOOKING_READ'], bookings: ['BOOKING_READ'], booking: ['BOOKING_READ'], entitlements: ['BOOKING_READ'],
    itinerary: ['ITINERARY_READ','CRUISE_READ'], cruise: ['CRUISE_READ'], decks: ['DECK_READ'], 'public-ship-model': ['BOOKING_READ'],
    services: ['SERVICE_REQUEST_READ','SERVICE_REQUEST_CREATE'], 'service-detail': ['SERVICE_REQUEST_READ','SERVICE_REQUEST_CREATE'], 'service-slots': ['SERVICE_REQUEST_READ','SERVICE_REQUEST_CREATE'], 'service-availability': ['SERVICE_READ'],
    'service-requests': ['SERVICE_REQUEST_READ','SERVICE_REQUEST_CREATE','SERVICE_REQUEST_EXECUTE'],
    activities: ['ACTIVITY_READ'], 'activity-availability': ['ACTIVITY_READ'], excursions: ['EXCURSION_READ'], registrations: ['ACTIVITY_REGISTRATION'],
  };
  return !!required[name]?.some(permission => permissions.includes(permission));
}
