export type LoginDto = { accessToken: string; tokenType: string; expiresIn: number; userId: string; username: string; email?: string | null; roles: string[]; effectivePermissions?: string[] };
export type Session = { accessToken: string; expiresAt: number; signedInAt: number; user: { id: string; username: string; email: string | null; roles: string[]; effectivePermissions?: string[] | null } };
const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
export function readPermissions(value: unknown): string[] | null {
  if (value === undefined || value === null) return null;
  if (!Array.isArray(value) || !value.every(item => typeof item === 'string')) throw new Error('Danh sách quyền không hợp lệ.');
  return [...new Set(value)];
}
export function toSession(dto: LoginDto, requestedAt = Date.now(), signedInAt = requestedAt): Session {
  if (!dto || typeof dto.accessToken !== 'string' || !dto.accessToken || typeof dto.tokenType !== 'string' || dto.tokenType.toLowerCase() !== 'bearer'
    || !Number.isFinite(dto.expiresIn) || dto.expiresIn <= 0 || typeof dto.userId !== 'string' || !uuid.test(dto.userId)
    || typeof dto.username !== 'string' || (dto.email != null && typeof dto.email !== 'string')
    || !Array.isArray(dto.roles) || !dto.roles.every(role => typeof role === 'string')) throw new Error('Phản hồi đăng nhập không hợp lệ.');
  const expiresAt = requestedAt + dto.expiresIn * 1000;
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) throw new Error('Phiên đăng nhập đã hết hạn.');
  return { accessToken: dto.accessToken, expiresAt, signedInAt, user: { id: dto.userId, username: dto.username, email: dto.email ?? null, roles: dto.roles, effectivePermissions: readPermissions(dto.effectivePermissions) } };
}
export function readSession(raw: string | null, includeExpired = false): Session | null {
  if (!raw) return null;
  const value = JSON.parse(raw) as Session;
  if (!value || typeof value.accessToken !== 'string' || !value.accessToken || !Number.isFinite(value.expiresAt)
    || typeof value.user?.id !== 'string' || !uuid.test(value.user.id) || typeof value.user?.username !== 'string'
    || (value.user.email != null && typeof value.user.email !== 'string') || !Array.isArray(value.user.roles)
    || !value.user.roles.every(role => typeof role === 'string')) return null;
  value.user.effectivePermissions = readPermissions(value.user.effectivePermissions);
  // Older installations can keep their current sign-in through JWT refresh.
  if (!Number.isFinite(value.signedInAt)) value.signedInAt = value.expiresAt;
  return includeExpired || value.expiresAt > Date.now() ? value : null;
}
