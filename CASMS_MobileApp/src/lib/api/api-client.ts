export class ApiError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status: number, code?: string) { super(message); this.name = 'ApiError'; this.status = status; this.code = code; }
}
/** Keep denied sections distinct from empty results; propagate every other failure. */
export function readErrorMessage(error: unknown, label: string) {
  if (error instanceof ApiError && error.status === 403) return `Tài khoản chưa được cấp quyền xem ${label}.`;
  return error instanceof Error ? error.message : `Không tải được ${label}. Vui lòng thử lại.`;
}
export async function readSection<T>(request: Promise<T>, label: string) {
  try { return { data: await request, error: null as string | null }; }
  catch (error) {
    if (!(error instanceof ApiError) || error.status !== 403) throw error;
    return { data: null, error: readErrorMessage(error, label) };
  }
}
export type RequestOptions = { method?: 'GET' | 'POST' | 'PUT' | 'DELETE'; body?: unknown; query?: Record<string, string | number | undefined>; signal?: AbortSignal; authenticated?: boolean };
export function resolveApiUrl(configured: string | undefined, host: string | undefined, development: boolean) {
  if (configured?.trim()) {
    const url = new URL(configured.trim());
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error('EXPO_PUBLIC_API_URL không hợp lệ.');
    return url.toString().replace(/\/$/, '');
  }
  if (!development) throw new Error('Chưa cấu hình EXPO_PUBLIC_API_URL.');
  const hostname = new URL(`http://${host || 'localhost'}`).hostname;
  return `http://${hostname}:8080/api`;
}
export function createApiClient(config: { baseUrl: () => string; fetch?: typeof fetch; timeoutMs?: number }) {
  let accessToken: string | null = null;
  let unauthorized: (() => void) | undefined;
  return {
    setToken(token: string | null) { accessToken = token; },
    onUnauthorized(listener: () => void) { unauthorized = listener; },
    async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
      const token = options.authenticated === false ? null : accessToken;
      const controller = new AbortController();
      const abort = () => controller.abort();
      options.signal?.addEventListener('abort', abort, { once: true });
      if (options.signal?.aborted) abort();
      const timer = setTimeout(abort, config.timeoutMs ?? 20000);
      try {
        const query = new URLSearchParams();
        Object.entries(options.query ?? {}).forEach(([key, value]) => { if (value !== undefined) query.set(key, String(value)); });
        const headers: Record<string, string> = { Accept: 'application/json' };
        if (options.body !== undefined) headers['Content-Type'] = 'application/json';
        if (token) headers.Authorization = `Bearer ${token}`;
        const response = await (config.fetch ?? fetch)(`${config.baseUrl()}${path}${query.size ? `?${query}` : ''}`, { method: options.method ?? 'GET', headers, body: options.body === undefined ? undefined : JSON.stringify(options.body), signal: controller.signal });
        if (response.status === 204 && response.ok) return undefined as T;
        let payload: unknown;
        try { payload = await response.json(); } catch { payload = undefined; }
        const envelope = payload && typeof payload === 'object' && !Array.isArray(payload) ? payload as Record<string, unknown> : null;
        const code = typeof envelope?.code === 'string' ? envelope.code : typeof envelope?.error === 'string' ? envelope.error : undefined;
        if (!response.ok || envelope?.success === false) {
          if (response.status === 401 && token && token === accessToken) unauthorized?.();
          const message = code === 'INVALID_CREDENTIALS' ? 'Tên đăng nhập hoặc mật khẩu không đúng.'
            : code === 'ACCOUNT_DISABLED' ? 'Tài khoản đã bị khóa hoặc ngừng hoạt động.'
              : response.status === 401 ? 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'
                : response.status === 403 ? 'Tài khoản chưa có quyền đọc dữ liệu này (403).'
                  : typeof envelope?.message === 'string' ? envelope.message : `Yêu cầu thất bại (HTTP ${response.status}).`;
          throw new ApiError(message, response.status, code);
        }
        // Ship/auth controllers wrap ApiResponse; activity/history controllers return raw JSON.
        if (typeof envelope?.success === 'boolean') return envelope.data as T;
        if (!response.ok || payload === null || payload === undefined) throw new ApiError('Không tải được dữ liệu. Vui lòng thử lại.', response.status);
        return payload as T;
      } catch (error) {
        if (error instanceof ApiError || options.signal?.aborted) throw error;
        throw new ApiError(controller.signal.aborted ? 'Yêu cầu quá thời gian. Vui lòng thử lại.' : 'Không thể kết nối. Kiểm tra mạng và thử lại.', 0);
      } finally { clearTimeout(timer); options.signal?.removeEventListener('abort', abort); }
    },
  };
}
