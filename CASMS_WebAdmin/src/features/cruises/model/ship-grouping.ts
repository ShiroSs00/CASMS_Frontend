export const UNASSIGNED_SHIP_KEY = '__UNASSIGNED__'
export const UNASSIGNED_SHIP_LABEL = 'Chưa gán tàu'

export function shipGroupKey(shipName?: string | null): string {
  const trimmed = shipName?.trim()
  return trimmed ? trimmed : UNASSIGNED_SHIP_KEY
}

export function shipDisplayName(shipName?: string | null): string {
  const trimmed = shipName?.trim()
  return trimmed ? trimmed : UNASSIGNED_SHIP_LABEL
}

export function collectShipOptions<T extends { shipName?: string | null }>(items: T[]) {
  const counts = new Map<string, { key: string; label: string; count: number }>()
  for (const item of items) {
    const key = shipGroupKey(item.shipName)
    const label = shipDisplayName(item.shipName)
    const current = counts.get(key)
    if (current) {
      current.count += 1
    } else {
      counts.set(key, { key, label, count: 1 })
    }
  }
  return Array.from(counts.values()).sort((a, b) => {
    if (a.key === UNASSIGNED_SHIP_KEY) return 1
    if (b.key === UNASSIGNED_SHIP_KEY) return -1
    return a.label.localeCompare(b.label, 'vi')
  })
}

export function groupItemsByShip<T extends { shipName?: string | null }>(items: T[]) {
  const groups = new Map<string, { key: string; label: string; items: T[] }>()
  for (const item of items) {
    const key = shipGroupKey(item.shipName)
    const label = shipDisplayName(item.shipName)
    const bucket = groups.get(key)
    if (bucket) {
      bucket.items.push(item)
    } else {
      groups.set(key, { key, label, items: [item] })
    }
  }
  return Array.from(groups.values())
}
