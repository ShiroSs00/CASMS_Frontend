import { QueryClient } from '@tanstack/react-query';
import { ApiError } from './api/api-client';
export const queryClient = new QueryClient({ defaultOptions: { queries: {
  staleTime: 30000,
  retry: (count, error) => count < 1 && !(error instanceof ApiError && (error.code === 'API_CONFIGURATION' || (error.status >= 400 && error.status < 500))),
} } });
