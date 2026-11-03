import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { ApiError } from '@/shared/api'
import { shipDeckCabinApi } from '../api/ship-deck-cabin-api'
import { shipListState, type ShipListRepository, type ShipListState, type Supplement, type SupplementField, type ShipSupplements } from './ship-list-types'

type LoadState = { status: 'loading' } | { status: 'error'; message: string } | { status: 'data'; data: ShipListState }

export function useShipList(repository: ShipListRepository) {
  const revision = useSyncExternalStore(shipDeckCabinApi.subscribe, shipDeckCabinApi.getRevision)
  const [attempt, setAttempt] = useState(0)
  const requestKey = `${revision}:${attempt}`
  const [result, setResult] = useState<{ key: string; data: ShipListState | null; error: string }>({ key: '', data: null, error: '' })
  const retryField = useRef<((id: string, field: SupplementField) => void) | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    let active = true
    const attempts = new Map<string, number>()
    function update<K extends SupplementField>(id: string, field: K, value: Supplement<ShipSupplements[K]>) {
      if (!active) return
      setResult(previous => previous.key !== requestKey || !previous.data ? previous : {
        ...previous, data: shipListState(previous.data.items.map(item => item.id === id ? { ...item, [field]: value } : item)),
      })
    }
    async function loadField<K extends SupplementField>(id: string, field: K) {
      if (!repository.loadField || !active) return
      const key = `${id}:${field}`
      const attempt = (attempts.get(key) ?? 0) + 1
      attempts.set(key, attempt)
      update(id, field, { status: 'loading' })
      try {
        const data = await repository.loadField(id, field, controller.signal)
        if (attempts.get(key) === attempt) update(id, field, { status: 'loaded', data })
      } catch (error) {
        if (!controller.signal.aborted && attempts.get(key) === attempt) update(id, field, {
          status: error instanceof ApiError && error.status === 403 ? 'denied' : 'unavailable',
          message: error instanceof Error ? error.message : 'Không tải được dữ liệu.',
        })
      }
    }
    retryField.current = (id, field) => { void loadField(id, field) }
    void repository.load(controller.signal).then(
      data => {
        if (!active) return
        setResult({ key: requestKey, data, error: '' })
        for (const item of data.items) {
          for (const field of ['capacity', 'readiness', 'currentCruise'] as const) void loadField(item.id, field)
        }
      },
      (error: unknown) => {
        if (active && !controller.signal.aborted) {
          setResult({ key: requestKey, data: null, error: error instanceof Error ? error.message : 'Không thể tải danh sách tàu. Vui lòng thử lại.' })
        }
      },
    )
    return () => { active = false; controller.abort(); retryField.current = null }
  }, [repository, requestKey])

  const state: LoadState = result.key !== requestKey
    ? { status: 'loading' }
    : result.error
      ? { status: 'error', message: result.error }
      : result.data
        ? { status: 'data', data: result.data }
        : { status: 'loading' }

  return { state, retry: () => setAttempt(value => value + 1), retrySupplement: (id: string, field: SupplementField) => retryField.current?.(id, field) }
}
