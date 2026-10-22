import { useAuth } from '@/features/auth/session-store';
import { PassengerServiceRequestsScreen } from '@/features/passenger-actions/PassengerServiceRequestsScreen';
export function PassengerServicesScreen() {
  const auth = useAuth();
  return <PassengerServiceRequestsScreen key={`${auth.status}:${auth.session?.user.id ?? 'anonymous'}`} embedded />;
}
