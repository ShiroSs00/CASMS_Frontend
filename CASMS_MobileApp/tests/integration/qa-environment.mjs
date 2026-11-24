import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createApiClient, resolveApiUrl } from '../../src/lib/api/api-client.ts';

export function readQaConfig(env = process.env) {
  let url;
  try {
    url = resolveApiUrl(env.CASMS_MOBILE_QA_API_URL);
    assert.equal(resolveApiUrl(env.CASMS_MOBILE_QA_CONFIRMED_URL), url);
  } catch {
    throw new Error('BLOCKED_BY_ENVIRONMENT: Cần API URL QA đã được đội Backend xác nhận cho phép chạy test ghi dữ liệu.');
  }
  return url;
}

export function qaTransport(url) {
  return createApiClient({ baseUrl: () => url, fetch: (input, init) => fetch(input, { ...init, redirect: 'error' }) });
}

export async function verifyQaReadiness(url, probe = fetch) {
  try {
    const response = await probe(`${url}/auth/me`, {
      headers: { Accept: 'application/json' }, redirect: 'error', signal: AbortSignal.timeout(5000),
    });
    const payload = await response.json();
    assert.equal(response.status, 401);
    assert.equal(payload.success, false);
    assert.equal(payload.code, 'AUTH_REQUIRED');
  } catch {
    throw new Error('BLOCKED_BY_ENVIRONMENT: Không kết nối được hoặc endpoint xác minh QA không trả contract 401 mong đợi.');
  }
}

export async function loginQa(client, role, env = process.env) {
  const username = env[`CASMS_MOBILE_QA_${role}_USERNAME`]?.trim();
  const password = env[`CASMS_MOBILE_QA_${role}_PASSWORD`];
  if (!username || !password) throw new Error(`BLOCKED_BY_ENVIRONMENT: Thiếu thông tin đăng nhập QA cho ${role}.`);
  try {
    const session = await client.request('/auth/login', { method: 'POST', authenticated: false, body: { username, password } });
    assert.ok(typeof session?.accessToken === 'string' && session.accessToken);
    client.setToken(session.accessToken);
    return await client.request('/auth/me');
  } catch (error) {
    if (error.status === 0) throw new Error(`BLOCKED_BY_ENVIRONMENT: Mất kết nối API QA khi đăng nhập ${role}.`);
    throw new Error(`BLOCKED_BY_BACKEND: QA không xác thực được ${role}. Kiểm tra tài khoản, trạng thái và contract đăng nhập.`);
  }
}

export async function verifyQaFixture(check) {
  try { await check(); } catch (error) {
    if (error.status === 0) throw new Error('BLOCKED_BY_ENVIRONMENT: Mất kết nối trong lúc kiểm tra fixture QA.');
    if (error.status === 401 || error.status === 403 || error.status >= 500) {
      throw new Error('BLOCKED_BY_BACKEND: API QA không cho phép đọc fixture hoặc chưa khả dụng.');
    }
    throw new Error('BLOCKED_BY_DATABASE: Fixture QA không khớp các ID, vai trò hoặc trạng thái mà suite yêu cầu.');
  }
}

export function qaReadOnlyDatabase(env = process.env) {
  const service = env.CASMS_MOBILE_QA_PG_SERVICE;
  const expectedDb = env.CASMS_MOBILE_QA_DATABASE;
  if (!service || !/^[\w.-]+$/.test(service) || !expectedDb) {
    throw new Error('BLOCKED_BY_DATABASE: Cần PostgreSQL service chỉ đọc và tên DB QA đã xác nhận để kiểm tra lưu dữ liệu.');
  }
  const run = input => {
    try {
      return execFileSync('psql', ['-X', '-w', '-A', '-t', '-q', '-v', 'ON_ERROR_STOP=1',
        '-d', `service=${service} connect_timeout=5 options='-c default_transaction_read_only=on'`],
      { input, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], timeout: 10000 }).trim();
    } catch {
      throw new Error('BLOCKED_BY_DATABASE: Không đọc được PostgreSQL QA qua service chỉ đọc đã cấu hình.');
    }
  };
  if (run("select current_database() || '|' || current_setting('transaction_read_only');") !== `${expectedDb}|on`) {
    throw new Error('BLOCKED_BY_DATABASE: Tên database hoặc chế độ chỉ đọc không khớp cấu hình QA.');
  }
  return {
    requestStatus(id) {
      assert.match(id, /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i);
      return run(`select status from "ServiceRequest" where service_request_id = '${id}';`);
    },
  };
}
