import { useCallback } from 'react'
import { apiRequest, useReadQuery } from '@/shared/api'

export type DisplayRate = { effectiveOn: string; vndPerUsd: number; source: string }

export function formatVndRate(vndPerUsd: number) {
  return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(vndPerUsd)
}

export function useUsdReference(enabled: boolean) {
  const query = useReadQuery('usd-reference:' + enabled, useCallback(signal =>
    enabled ? apiRequest<DisplayRate | null>('/usd-display-rate', { signal }) : Promise.resolve(null),
  [enabled]))
  const rate = enabled && query.data && Number.isFinite(query.data.vndPerUsd) && query.data.vndPerUsd > 0
    ? query.data : null
  return { rate, loading: query.loading }
}
