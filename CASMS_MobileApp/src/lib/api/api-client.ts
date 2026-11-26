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
export type RequestOptions = { method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'; body?: unknown; query?: Record<string, string | number | undefined>; signal?: AbortSignal; authenticated?: boolean; posSession?: string; idempotencyKey?: string };
export function resolveApiUrl(configured: string | undefined) {
  const value = configured?.trim();
  if (!value) throw new ApiError('Chưa cấu hình địa chỉ máy chủ (EXPO_PUBLIC_API_URL).', 0, 'API_CONFIGURATION');
  const invalid = () => new ApiError('Địa chỉ máy chủ (EXPO_PUBLIC_API_URL) phải là URL HTTP hoặc HTTPS hợp lệ.', 0, 'API_CONFIGURATION');
  if (!/^https?:\/\/[^/]/i.test(value) || /[\s\\?#]/.test(value)) throw invalid();
  let url: URL;
  try { url = new URL(value); } catch { throw invalid(); }
  if (url.username || url.password) throw invalid();
  const prefix = url.pathname.replace(/\/+$/, '').replace(/(?:\/api)+$/i, '');
  return `${url.origin}${prefix}/api`;
}

function responseError(status: number, code: string | undefined, authenticated: boolean) {
  if (code === 'INVALID_CREDENTIALS' || (status === 401 && !authenticated)) return 'Tên đăng nhập hoặc mật khẩu không đúng.';
  if (code === 'ACCOUNT_DISABLED') return 'Tài khoản đã bị khóa hoặc ngừng hoạt động.';
  switch (status) {
    case 400: return 'Thông tin gửi đi không hợp lệ. Vui lòng kiểm tra lại.';
    case 401: return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';
    case 403: return 'Tài khoản chưa có quyền thực hiện thao tác này.';
    case 404: return 'Không tìm thấy thông tin yêu cầu.';
    case 409: return 'Thông tin đã thay đổi hoặc thao tác chưa được hỗ trợ ở trạng thái hiện tại.';
    case 422: return 'Yêu cầu chưa đáp ứng điều kiện xử lý. Vui lòng kiểm tra lại.';
    case 429: return 'Có quá nhiều yêu cầu. Vui lòng đợi rồi thử lại.';
    default: return status >= 500 ? 'Máy chủ chưa khả dụng. Vui lòng thử lại sau.' : 'Không xử lý được yêu cầu. Vui lòng kiểm tra lại.';
  }
}
function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw signal.reason ?? Object.assign(new Error('Yêu cầu đã được hủy.'), { name: 'AbortError' });
}

export function createApiClient(config: { baseUrl: () => string; fetch?: typeof fetch; timeoutMs?: number }) {
  let accessToken: string | null = null;
  let tokenGeneration = 0;
  let unauthorized: (() => void) | undefined;
  return {
    setToken(token: string | null) { accessToken = token; tokenGeneration++; },
    onUnauthorized(listener: () => void) { unauthorized = listener; },
    async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
      throwIfAborted(options.signal);
      const token = options.authenticated === false ? null : accessToken;
      const generation = tokenGeneration;
      const posPath = path.startsWith('/pos/');
      if (options.posSession && (!posPath || !token)) {
        throw new ApiError('Cần xác thực nhân viên cho phiên POS.', 401);
      }
      const controller = new AbortController();
      const abort = () => controller.abort();
      options.signal?.addEventListener('abort', abort, { once: true });
      const timer = setTimeout(abort, config.timeoutMs ?? 20000);
      try {
        const query = new URLSearchParams();
        Object.entries(options.query ?? {}).forEach(([key, value]) => { if (value !== undefined) query.set(key, String(value)); });
        const headers: Record<string, string> = { Accept: 'application/json' };
        if (options.body !== undefined) headers['Content-Type'] = 'application/json';
        if (token) headers.Authorization = `Bearer ${token}`;
        if (options.posSession) headers['X-POS-Session'] = options.posSession;
        if (options.idempotencyKey) {
          if (!/^[A-Za-z0-9._:-]{1,100}$/.test(options.idempotencyKey)) throw new ApiError('Mã thao tác không hợp lệ.', 422);
          headers['Idempotency-Key'] = options.idempotencyKey;
        }
        const response = await (config.fetch ?? fetch)(`${config.baseUrl()}${path}${query.size ? `?${query}` : ''}`, { method: options.method ?? 'GET', headers, body: options.body === undefined ? undefined : JSON.stringify(options.body), signal: controller.signal });
        throwIfAborted(options.signal);
        if (response.status === 204 || response.status === 205) return undefined as T;
        let payload: unknown;
        try { payload = await response.json(); } catch (error) {
          if (controller.signal.aborted && (response.ok || posPath || path.startsWith('/pos-terminals/'))) throw error;
          payload = undefined;
        }
        throwIfAborted(options.signal);
        const envelope = payload && typeof payload === 'object' && !Array.isArray(payload) ? payload as Record<string, unknown> : null;
        const code = typeof envelope?.code === 'string' ? envelope.code : typeof envelope?.error === 'string' ? envelope.error : undefined;
        if (!response.ok || envelope?.success === false) {
          if (response.status === 401 && token && token === accessToken && generation === tokenGeneration) unauthorized?.();
          throw new ApiError(responseError(response.status, code, options.authenticated !== false), response.status, code);
        }
        // Ship/auth controllers wrap ApiResponse; activity/history controllers return raw JSON.
        if (typeof envelope?.success === 'boolean') return envelope.data as T;
        if (payload === null || payload === undefined) throw new ApiError('Phản hồi từ máy chủ không hợp lệ. Vui lòng thử lại.', 502, 'INVALID_RESPONSE');
        return payload as T;
      } catch (error) {
        throwIfAborted(options.signal);
        if (error instanceof ApiError) throw error;
        throw new ApiError(controller.signal.aborted ? 'Yêu cầu quá thời gian. Vui lòng thử lại.' : 'Không thể kết nối. Kiểm tra mạng và thử lại.', 0,
          posPath || path.startsWith('/pos-terminals/') ? controller.signal.aborted ? 'POS_TIMEOUT' : 'POS_NETWORK' : undefined);
      } finally { clearTimeout(timer); options.signal?.removeEventListener('abort', abort); }
    },
  };
}
