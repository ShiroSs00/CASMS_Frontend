import { apiRequest } from '@/shared/api'
import { toSession, type LoginResponse } from './dto'

export const authApi = {
  async login(username: string, password: string) {
    const requestedAt = Date.now()
    return toSession(await apiRequest<LoginResponse>('/auth/login', {
      method: 'POST', body: { username, password }, authenticated: false,
    }), requestedAt)
  },
  async refresh() {
    const requestedAt = Date.now()
    return toSession(await apiRequest<LoginResponse>('/auth/refresh', { method: 'POST' }), requestedAt)
  },
  logout: () => apiRequest<void>('/auth/logout', { method: 'POST' }),
}
