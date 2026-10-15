import { AUTH_ROLES, type AuthSession, type Role } from '../model/auth-types'

export type LoginResponse = {
  accessToken: string; tokenType: string; expiresIn: number; userId: string
  username: string; email?: string | null; roles: Role[]
}

export function toSession(dto: LoginResponse, requestedAt: number): AuthSession {
  if (!dto || typeof dto.accessToken !== 'string' || !dto.accessToken || dto.tokenType?.toLowerCase() !== 'bearer'
    || !Number.isFinite(dto.expiresIn) || dto.expiresIn <= 0 || typeof dto.userId !== 'string'
    || typeof dto.username !== 'string' || !Array.isArray(dto.roles)
    || !dto.roles.every((role) => AUTH_ROLES.includes(role))) throw new Error('Phản hồi đăng nhập không hợp lệ.')
  const lifetime = dto.expiresIn * 1000
  const expiresAt = requestedAt + lifetime
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) throw new Error('Phiên đăng nhập đã hết hạn.')
  return {
    accessToken: dto.accessToken, expiresAt, refreshAt: expiresAt - Math.min(60000, (expiresAt - Date.now()) * 0.2),
    user: { id: dto.userId, username: dto.username, email: dto.email ?? null, roles: dto.roles },
  }
}
