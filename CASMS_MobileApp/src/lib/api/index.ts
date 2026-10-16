import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { createApiClient, resolveApiUrl } from './api-client';

export const getApiUrl = () => resolveApiUrl(process.env.EXPO_PUBLIC_API_URL,
  Constants.expoConfig?.hostUri ?? (Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.hostname : undefined), __DEV__);
export const api = createApiClient({ baseUrl: getApiUrl });
export { ApiError, readSection, readErrorMessage } from './api-client';
