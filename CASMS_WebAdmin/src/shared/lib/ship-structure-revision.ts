let revision = 0
const listeners = new Set<() => void>()

export function refreshShipStructure() {
  revision += 1
  listeners.forEach(listener => listener())
}

export function subscribeToShipStructure(listener: () => void) {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

export const getShipStructureRevision = () => revision
