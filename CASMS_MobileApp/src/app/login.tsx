import { useLocalSearchParams } from 'expo-router';
import { PassengerLoginScreen } from '@/features/auth/PassengerLoginScreen';
import { loginStatusFromParam } from '@/features/auth/login-model';

export default function LoginRoute() {
  const { state } = useLocalSearchParams<{ state?: string | string[] }>();
  return <PassengerLoginScreen key={String(state)} initialStatus={loginStatusFromParam(state)} />;
}
