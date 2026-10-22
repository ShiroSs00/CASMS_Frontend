export type LoginStatus = 'default' | 'loading' | 'error' | 'offline' | 'expired';
export type LoginCredentials = { username: string; password: string };

export function validateLogin({ username, password }: LoginCredentials) {
  return {
    username: !username.trim() ? 'Vui lòng nhập tên đăng nhập.' : undefined,
    password: !password.length ? 'Vui lòng nhập mật khẩu.' : undefined,
  };
}

export function loginStatusFromParam(value: string | string[] | undefined): LoginStatus {
  const state = Array.isArray(value) ? value[0] : value;
  return state === 'expired' ? 'expired' : 'default';
}
