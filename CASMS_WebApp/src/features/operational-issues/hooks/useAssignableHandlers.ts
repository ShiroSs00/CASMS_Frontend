import { useEffect, useState } from 'react'
import { listAssignableHandlers, type HandlerOption } from '../api/handler-lookup-api'

export function useAssignableHandlers() {
  const [state, setState] = useState<{ loading: boolean; options: HandlerOption[]; error: string | null }>({ loading: true, options: [], error: null })
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    void listAssignableHandlers(controller.signal).then(
      (options) => { if (!controller.signal.aborted) setState({ loading: false, options, error: null }) },
      (error: unknown) => { if (!controller.signal.aborted) setState({ loading: false, options: [], error: error instanceof Error ? error.message : 'Không tải được người xử lý.' }) },
    )
    return () => controller.abort()
  }, [attempt])
  return { ...state, retry: () => { setState({ loading: true, options: [], error: null }); setAttempt((value) => value + 1) } }
}
