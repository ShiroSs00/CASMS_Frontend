import apiRules from './api-permissions.json'

export type PermissionRequirement = { mode: 'ANY' | 'ALL'; permissions: readonly string[] }
export type PermissionAccess = { status: string; permissions: readonly string[] }

export function hasPermissions(access: PermissionAccess, requirement: PermissionRequirement): boolean {
  if (access.status !== 'ready' || !requirement.permissions.length) return false
  return requirement.mode === 'ALL'
    ? requirement.permissions.every(permission => access.permissions.includes(permission))
    : requirement.permissions.some(permission => access.permissions.includes(permission))
}

// Snapshot of actual BE controller annotations. Static paths precede UUID paths.
const rules = apiRules.map(rule => ({ ...rule, pattern: new RegExp('^' + rule.path.split('/').map(part => part.startsWith('{') && part.endsWith('}') ? '[^/]+' : part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('/') + '/?$') }))
export function apiPermissionRequirement(path: string, method = 'GET'): PermissionRequirement | null {
  const rule = rules.find(item => item.method === method && item.pattern.test(path.split('?')[0]))
  if (!rule || rule.mode === 'PUBLIC') return null
  return { mode: rule.mode === 'ALL' ? 'ALL' : 'ANY', permissions: rule.permissions }
}
