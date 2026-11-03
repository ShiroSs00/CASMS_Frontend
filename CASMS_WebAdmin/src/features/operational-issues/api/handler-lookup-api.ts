import { apiRequest } from '@/shared/api'

type UserLookupResponse = {
  id: string
  displayName?: string | null
  username: string
  status: 'ACTIVE' | 'LOCKED' | 'DISABLED'
  capabilityLabel?: string | null
}

export type HandlerOption = { id: string; label: string; capability: string | null }

export async function listAssignableHandlers(signal: AbortSignal): Promise<HandlerOption[]> {
  const users = await apiRequest<UserLookupResponse[]>('/identity/users', {
    query: { status: 'ACTIVE', assignableFor: 'OPERATIONAL_ISSUE' }, signal,
  })
  if (!Array.isArray(users) || users.some((user) => !user || typeof user.id !== 'string' || !user.id
    || typeof user.username !== 'string' || !['ACTIVE', 'LOCKED', 'DISABLED'].includes(user.status)
    || (user.displayName != null && typeof user.displayName !== 'string')
    || (user.capabilityLabel != null && typeof user.capabilityLabel !== 'string'))) {
    throw new Error('Danh sách người xử lý không đúng định dạng.')
  }
  return users.filter((user) => user.status === 'ACTIVE').map((user) => ({
    id: user.id,
    label: user.displayName?.trim() || user.username,
    capability: user.capabilityLabel?.trim() || null,
  }))
}
