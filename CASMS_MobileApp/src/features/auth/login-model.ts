export type LoginStatus = 'default' | 'loading' | 'error' | 'offline' | 'expired';
export type LoginCredentials = { username: string; password: string };

// Match LoginRequest's codePointCount and StandardCharsets.UTF_8 byte limit.
export function utf8ByteLength(value: string) {
  let bytes = 0;
  for (const char of value) {
    const point = char.codePointAt(0)!;
    bytes += point <= 0x7f || (point >= 0xd800 && point <= 0xdfff) ? 1
      : point <= 0x7ff ? 2 : point <= 0xffff ? 3 : 4;
  }
  return bytes;
}

export function validateLogin({ username, password }: LoginCredentials) {
  return {
    username: !username.trim() ? 'Vui lòng nhập tên đăng nhập.'
      : [...username.trim()].length > 100 ? 'Tên đăng nhập tối đa 100 ký tự.' : undefined,
    password: !password.trim() ? 'Vui lòng nhập mật khẩu.'
      : utf8ByteLength(password) > 72 ? 'Mật khẩu tối đa 72 byte UTF-8.' : undefined,
  };
}

export function loginStatusFromParam(value: string | string[] | undefined): LoginStatus {
  const state = Array.isArray(value) ? value[0] : value;
  return state === 'expired' ? 'expired' : 'default';
}
