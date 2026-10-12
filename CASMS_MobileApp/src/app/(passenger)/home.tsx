import { useLocalSearchParams } from 'expo-router';

import { PassengerHomeScreen } from '@/features/home/PassengerHomeScreen';
import { homeStatusFromParam } from '@/features/home/home-model';

export default function PassengerHomeRoute() {
  const { state } = useLocalSearchParams<{ state?: string | string[] }>();
  return <PassengerHomeScreen key={String(state)} initialStatus={homeStatusFromParam(state)} />;
}
