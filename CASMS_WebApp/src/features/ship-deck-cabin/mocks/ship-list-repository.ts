import type { ShipListRepository } from '../model/ship-list-types'
import { shipListFixture } from './ship-list-fixtures'

export type ShipListScenario = 'data' | 'empty' | 'error' | 'loading'

export function createShipListRepository(scenario: ShipListScenario = 'data'): ShipListRepository {
  let failNext = scenario === 'error'
  return {
    async load(signal) {
      await new Promise<void>((resolve, reject) => {
        if (signal.aborted) { reject(new DOMException('Aborted', 'AbortError')); return }
        const abort = () => { clearTimeout(timer); reject(new DOMException('Aborted', 'AbortError')) }
        const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve() }, scenario === 'loading' ? 10000 : 350)
        signal.addEventListener('abort', abort, { once: true })
      })
      if (signal.aborted) throw new DOMException('Aborted', 'AbortError')
      if (failNext) { failNext = false; throw new Error('Không thể tải danh sách tàu. Vui lòng thử lại.') }
      return scenario === 'empty'
        ? { metrics: { activeCount: 0, maintenanceCount: 0, configuredCabinCount: 0, attentionCount: 0 }, items: [] }
        : structuredClone(shipListFixture)
    },
  }
}
