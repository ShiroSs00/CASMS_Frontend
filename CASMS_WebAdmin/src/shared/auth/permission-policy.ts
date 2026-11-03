import apiRules from './api-permissions.json'

export type PermissionRequirement = { mode: 'ANY' | 'ALL'; permissions: readonly string[]; roles?: readonly string[]; allOf?: readonly PermissionRequirement[]; anyOf?: readonly PermissionRequirement[] }
export type PermissionAccess = { status: string; permissions: readonly string[]; roles?: readonly string[] }

export function hasPermissions(access: PermissionAccess, requirement: PermissionRequirement): boolean {
  if (access.status !== 'ready') return false
  if (requirement.roles?.length && !requirement.roles.some(role => access.roles?.includes(role))) return false
  if (requirement.allOf && !requirement.allOf.every(item => hasPermissions(access, item))) return false
  if (requirement.anyOf && !requirement.anyOf.some(item => hasPermissions(access, item))) return false
  if (!requirement.permissions.length) return Boolean(requirement.roles?.length || requirement.allOf?.length || requirement.anyOf?.length)
  return requirement.mode === 'ALL'
    ? requirement.permissions.every(permission => access.permissions.includes(permission))
    : requirement.permissions.some(permission => access.permissions.includes(permission))
}

// Snapshot of actual BE controller annotations. Static paths precede UUID paths.
const rules = apiRules.map(rule => ({ ...rule, pattern: new RegExp('^' + rule.path.split('/').map(part => part.startsWith('{*') && part.endsWith('}') ? '.+' : part.startsWith('{') && part.endsWith('}') ? '[^/]+' : part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('/') + '/?$') }))
export function apiPermissionRequirement(path: string, method = 'GET'): PermissionRequirement | null {
  const rule = rules.find(item => item.method === method && item.pattern.test(path.split('?')[0]))
  if (!rule || rule.mode === 'PUBLIC') return null
  return { ...rule, mode: rule.mode === 'ALL' ? 'ALL' : 'ANY' } as PermissionRequirement
}
