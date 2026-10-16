import { useEffect, useState } from 'react'
import type { ShipListRepository, ShipListState } from './ship-list-types'

type LoadState = { status: 'loading' } | { status: 'error'; message: string } | { status: 'data'; data: ShipListState }
export function useShipList(repository: ShipListRepository) {
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    repository.load(controller.signal).then(
      data => { if (!controller.signal.aborted) setState({ status: 'data', data }) },
      () => { if (!controller.signal.aborted) setState({ status: 'error', message: 'Không thể tải danh sách tàu. Vui lòng thử lại.' }) },
    )
    return () => controller.abort()
  }, [repository, attempt])
  const retry = () => { setState({ status: 'loading' }); setAttempt(value => value + 1) }
  return { state, retry }
}
