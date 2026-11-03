import { useEffect, useState } from 'react'

export function useReadQuery<T>(key: string, load: (signal: AbortSignal) => Promise<T>) {
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState<{ key: string; attempt: number; data: T | null; error: Error | null } | null>(null)
  useEffect(() => {
    const controller = new AbortController()
    void load(controller.signal).then(data => {
      if (!controller.signal.aborted) setResult({ key, attempt, data, error: null })
    }).catch((error: unknown) => {
      if (!controller.signal.aborted) setResult({ key, attempt, data: null, error: error instanceof Error ? error : new Error('Không tải được dữ liệu.') })
    })
    return () => controller.abort()
  }, [key, load, attempt])
  const current = result?.key === key && result.attempt === attempt ? result : null
  return { data: current?.data ?? null, error: current?.error ?? null, loading: !current, retry: () => setAttempt(value => value + 1) }
}
