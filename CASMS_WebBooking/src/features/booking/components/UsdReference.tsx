import { useCallback, useState } from 'react'
import { apiRequest, useReadQuery } from '@/shared/api'
import { Button } from '@/shared/ui'

type DisplayRate = { effectiveOn: string; vndPerUsd: number; source: string }

export function useUsdReference(enabled: boolean) {
  const query = useReadQuery('usd-reference:' + enabled, useCallback(signal =>
    enabled ? apiRequest<DisplayRate | null>('/usd-display-rate', { signal }) : Promise.resolve(null),
  [enabled]))
  const rate = enabled && query.data && Number.isFinite(query.data.vndPerUsd) && query.data.vndPerUsd > 0
    ? query.data : null
  return { rate, loading: query.loading }
}

export function UsdReference({ amount, currency }: { amount: number | null; currency: string | null }) {
  const [expanded, setExpanded] = useState(false)
  const applicable = currency === 'VND' && amount != null
  const { rate, loading } = useUsdReference(applicable && expanded)
  if (!applicable) return null
  return <div>
    <Button tone="text" aria-pressed={expanded} onClick={() => setExpanded(value => !value)}>
      {expanded ? 'Ẩn giá USD tham khảo' : 'Xem giá USD tham khảo'}
    </Button>
    {expanded && <p role="status">{loading ? 'Đang tải tỷ giá…' : rate
      ? `Ước tính ${new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'USD' }).format(amount / rate.vndPerUsd)} theo tỷ giá ngày ${rate.effectiveOn.split('-').reverse().join('/')}. Bạn thanh toán bằng VND.`
      : 'Chưa có tỷ giá tham khảo. Số tiền thanh toán hiển thị bằng VND.'}</p>}
  </div>
}
