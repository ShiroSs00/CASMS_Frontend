import { useRef, useState } from 'react'
import { useSessionAccess } from '@/shared/auth'
import { Button, Empty, Notice } from '@/shared/ui'
import { itineraryApi } from '../api/itinerary-api'
import type { ItineraryDay } from '../model/itinerary'

export function DayRegistry({ itineraryId }: { itineraryId: string }) {
  const access = useSessionAccess()
  const [days, setDays] = useState<ItineraryDay[] | null>(null)
  const [error, setError] = useState(''), [busy, setBusy] = useState(false)
  const lock = useRef(false)
  async function load() {
    if (lock.current || !access.has('ITINERARY_DAY_READ')) return
    lock.current = true; setBusy(true); setError(''); setDays(null)
    try { setDays(await itineraryApi.listDaysByItinerary(itineraryId)) }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Không tải được cấu hình ngày.') }
    finally { lock.current = false; setBusy(false) }
  }
  return <div>{access.has('ITINERARY_DAY_READ') && <Button tone="secondary" disabled={busy || !access.has('ITINERARY_DAY_READ')} onClick={() => void load()}>{busy ? 'Đang đối chiếu…' : 'Xem cấu hình ngày mới nhất'}</Button>}
    {error && <Notice title="Không tải được cấu hình ngày" tone="error">{error}</Notice>}
    {days && !days.length && <Empty title="Chưa cấu hình ngày nào" />}
    {days && days.length > 0 && <ol aria-label="Cấu hình ngày mới nhất">{days.map(day => <li key={day.itineraryDayId}>Ngày {day.dayNumber} · {day.date} · {day.dayType === 'SEA_DAY' ? 'Trên biển' : 'Ghé cảng'} · {day.shipTimeZoneId || 'Chưa đặt múi giờ'}</li>)}</ol>}
  </div>
}
