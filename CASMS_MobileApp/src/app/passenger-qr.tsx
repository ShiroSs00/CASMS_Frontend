import { PassengerCardScreen } from '@/features/passenger-actions/PassengerCardScreen';
import { useSelectedItinerary } from '@/features/itinerary/itinerary-api';
import { getApiUrl } from '@/lib/api';

export default function PassengerQrRoute() {
  const { context, voyage } = useSelectedItinerary();
  return <PassengerCardScreen key={JSON.stringify([getApiUrl(), context.owner, context.auth.session?.signedInAt, voyage?.bookingId, voyage?.bookingPassengerId, voyage?.cruiseId])} />;
}
