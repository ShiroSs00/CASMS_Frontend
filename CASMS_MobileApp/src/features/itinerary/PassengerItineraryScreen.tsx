import { useAuth } from '@/features/auth/session-store';
import { PassengerItineraryDemoScreen } from './PassengerItineraryDemoScreen';
import { PassengerLiveItineraryScreen } from './PassengerLiveItineraryScreen';

export function PassengerItineraryScreen() {
  const mode = useAuth(state => state.mode);
  return mode === 'demo' ? <PassengerItineraryDemoScreen /> : <PassengerLiveItineraryScreen />;
}
