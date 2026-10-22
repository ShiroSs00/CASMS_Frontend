import type { EntityKind } from './types'
export function entityPermission(kind: EntityKind, action: 'CREATE' | 'READ' | 'UPDATE' | 'DELETE' | 'VALIDATE') { return `${({ ships: 'SHIP', decks: 'DECK', cabins: 'CABIN' })[kind]}_${action}` }
export function operationPermission(kind: EntityKind, operation: string) {
  if (operation === 'validate') return entityPermission(kind, 'VALIDATE')
  if (operation === 'status') return kind === 'ships' ? 'SHIP_STATUS_CHANGE' : 'CABIN_STATUS_CHANGE'
  return ({ block: 'CABIN_BLOCK', release: 'CABIN_RELEASE', schedule: 'SHIP_SCHEDULE_CHECK', ready: 'SHIP_READINESS', availability: 'CABIN_AVAILABILITY', affected: 'SHIP_AFFECTED_CRUISES', ownership: 'DECK_READ' } as Record<string, string>)[operation] ?? ''
}
