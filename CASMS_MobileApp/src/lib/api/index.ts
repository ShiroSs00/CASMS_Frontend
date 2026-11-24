import { ApiError, createApiClient, resolveApiUrl } from './api-client';

function readApiConfiguration(): { url: string; error: null } | { url: null; error: ApiError } {
  try {
    return { url: resolveApiUrl(process.env.EXPO_PUBLIC_API_URL), error: null };
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    return { url: null, error };
  }
}

export const apiConfiguration = readApiConfiguration();
export function getApiUrl() {
  if (apiConfiguration.url === null) throw apiConfiguration.error;
  return apiConfiguration.url;
}
export const api = createApiClient({ baseUrl: getApiUrl });
export { ApiError, readSection, readErrorMessage } from './api-client';
