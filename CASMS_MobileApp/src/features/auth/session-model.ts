export type LoginDto = { accessToken: string; tokenType: string; expiresIn: number; userId: string; username: string; email?: string | null; roles: string[] };
export type Session = { accessToken: string; expiresAt: number; user: { id: string; username: string; email: string | null; roles: string[] } };
export function toSession(dto: LoginDto, requestedAt = Date.now()): Session {
  if (!dto || typeof dto.accessToken !== 'string' || !dto.accessToken || dto.tokenType?.toLowerCase() !== 'bearer'
    || !Number.isFinite(dto.expiresIn) || dto.expiresIn <= 0 || typeof dto.userId !== 'string' || !dto.userId
    || typeof dto.username !== 'string' || !Array.isArray(dto.roles) || !dto.roles.every(role => typeof role === 'string')) throw new Error('Phản hồi đăng nhập không hợp lệ.');
  const expiresAt = requestedAt + dto.expiresIn * 1000;
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) throw new Error('Phiên đăng nhập đã hết hạn.');
  return { accessToken: dto.accessToken, expiresAt, user: { id: dto.userId, username: dto.username, email: dto.email ?? null, roles: dto.roles } };
}
export function readSession(raw: string | null): Session | null {
  if (!raw) return null;
  const value = JSON.parse(raw) as Session;
  if (!value || typeof value.accessToken !== 'string' || !value.accessToken || !Number.isFinite(value.expiresAt)
    || typeof value.user?.id !== 'string' || typeof value.user?.username !== 'string' || !Array.isArray(value.user.roles)
    || !value.user.roles.every(role => typeof role === 'string')) return null;
  return value.expiresAt > Date.now() ? value : null;
}
