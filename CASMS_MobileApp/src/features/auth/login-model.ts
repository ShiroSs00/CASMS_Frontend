export type LoginStatus = 'default' | 'loading' | 'error' | 'offline' | 'expired';
export type LoginResult = 'success' | 'incorrect-credentials' | 'offline';
export type LoginCredentials = { email: string; password: string };

export function validateLogin({ email, password }: LoginCredentials) {
  return {
    email: !email.trim() ? 'Vui lòng nhập email.'
      : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ? 'Email chưa đúng định dạng.' : undefined,
    password: !password.length ? 'Vui lòng nhập mật khẩu.' : undefined,
  };
}

/** UI prototype only: validates navigation, never authenticates or stores credentials. */
export async function prototypeSignIn(): Promise<LoginResult> {
  return 'success';
}

export function loginStatusFromParam(value: string | string[] | undefined): LoginStatus {
  const state = Array.isArray(value) ? value[0] : value;
  return state === 'loading' || state === 'error' || state === 'offline' || state === 'expired'
    ? state : 'default';
}
