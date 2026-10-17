import { useEffect, useState, useSyncExternalStore } from 'react'
import { shipDeckCabinApi } from '../api/ship-deck-cabin-api'
import type { ShipListRepository, ShipListState } from './ship-list-types'

type LoadState = { status: 'loading' } | { status: 'error'; message: string } | { status: 'data'; data: ShipListState }

export function useShipList(repository: ShipListRepository) {
  const revision = useSyncExternalStore(shipDeckCabinApi.subscribe, shipDeckCabinApi.getRevision)
  const [attempt, setAttempt] = useState(0)
  const requestKey = `${revision}:${attempt}`
  const [result, setResult] = useState<{ key: string; data: ShipListState | null; error: string }>({ key: '', data: null, error: '' })

  useEffect(() => {
    const controller = new AbortController()
    let active = true
    void repository.load(controller.signal).then(
      data => { if (active) setResult({ key: requestKey, data, error: '' }) },
      (error: unknown) => {
        if (active && !controller.signal.aborted) {
          setResult({ key: requestKey, data: null, error: error instanceof Error ? error.message : 'Không thể tải danh sách tàu. Vui lòng thử lại.' })
        }
      },
    )
    return () => { active = false; controller.abort() }
  }, [repository, requestKey])

  const state: LoadState = result.key !== requestKey
    ? { status: 'loading' }
    : result.error
      ? { status: 'error', message: result.error }
      : result.data
        ? { status: 'data', data: result.data }
        : { status: 'loading' }

  return { state, retry: () => setAttempt(value => value + 1) }
}
