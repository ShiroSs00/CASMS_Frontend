import { Redirect } from 'expo-router';
/** Legacy deep links must never open a ticket purchase flow in Mobile. */
export default function RetiredBookingCreationRoute() { return <Redirect href="/passenger-bookings" />; }
