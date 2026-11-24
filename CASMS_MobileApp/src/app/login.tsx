import { Redirect, useLocalSearchParams } from 'expo-router';
import { PassengerLoginScreen } from '@/features/auth/PassengerLoginScreen';
import { loginStatusFromParam } from '@/features/auth/login-model';
import { useAuth } from '@/features/auth/session-store';
import { PassengerLaunchScreen } from '@/features/launch/PassengerLaunchScreen';

export default function LoginRoute() {
  const { state, returnTo, bookingId } = useLocalSearchParams<{ state?: string; returnTo?: string; bookingId?: string }>();
  const status = useAuth(auth => auth.status);
  if (status === 'restoring') return <PassengerLaunchScreen restoringOnly />;
  if (status === 'authenticated') return <Redirect href={{ pathname: '/loading', params: { returnTo, bookingId } }} />;
  return <PassengerLoginScreen key={String(state)} initialStatus={loginStatusFromParam(state)} />;
}
