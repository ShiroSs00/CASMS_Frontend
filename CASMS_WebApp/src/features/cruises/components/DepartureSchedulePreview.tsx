import { journeyTime, SHIP_TIME_ZONE } from '@/shared/lib/journey-time'
import { useCallback, useState } from 'react'
import { useReadQuery } from '@/shared/api'
import { Button, Notice, Panel, RecordFacts } from '@/shared/ui'
import { departureApi } from '../api/departure-api'
import type { DepartureSchedule } from '../model/departure-contract'
import { scheduleInstant } from '../model/cruise-validation'
import { ReadState, ScheduleContents } from './DepartureData'

export function DepartureSchedulePreview({ sourceVersionId, departure, contextKey, disabled, onApply }: { sourceVersionId: string; departure: string; contextKey: string; disabled: boolean; onApply: (schedule: DepartureSchedule) => void }) {
  const [request, setRequest] = useState<{ key: string; sourceVersionId: string; instant: string } | null>(null)
  const [error, setError] = useState('')
  const key = JSON.stringify([sourceVersionId, departure, contextKey])
  const current = request?.key === key ? request : null
  const query = useReadQuery('departure-preview:' + key + ':' + Boolean(current), useCallback(signal => current ? departureApi.preview(current.sourceVersionId, current.instant, signal) : Promise.resolve(null), [current]))
  const validBasis=Boolean(query.data&&query.data.sourceVersionRevision!=null&&query.data.days.length&&query.data.days.every(day=>day.shipTimeZoneId===SHIP_TIME_ZONE))
  function preview() {
    try { const instant = scheduleInstant(departure).toISOString(); setError(''); setRequest({ key, sourceVersionId, instant }) } catch { setError('Nhập ngày giờ bắt đầu hợp lệ để xem trước.') }
  }
  return <Panel title="Xem trước lịch theo ngày thực tế" subtitle="Ngày kết thúc và các lần ghé do hệ thống tính từ phiên bản nguồn; xem trước chưa lưu dữ liệu.">
    <Button tone="secondary" disabled={disabled || Boolean(current && query.loading)} onClick={preview}>Xem trước lịch</Button>
    {error && <Notice title="Chưa xem trước được" tone="error">{error}</Notice>}
    {current && <><ReadState {...query} />{query.data && <><RecordFacts entries={[['Bắt đầu dự kiến · Giờ tàu (Việt Nam)',query.data.departureDatetime?journeyTime(query.data.departureDatetime):'Chưa xác định'],['Kết thúc dự kiến · Giờ tàu (Việt Nam)',query.data.returnDatetime?journeyTime(query.data.returnDatetime):'Chưa xác định']]}/>{!validBasis&&<Notice title="Chưa thể áp dụng lịch xem trước" tone="warning">Cơ sở giờ tàu hoặc phiên dữ liệu nguồn chưa đầy đủ. Cần hệ thống xác nhận lại lịch trước khi tạo lần khởi hành.</Notice>}<details><summary>Xem các ngày, lần ghé cảng và chương trình</summary><ScheduleContents schedule={query.data} preview /></details><Button tone="secondary" disabled={disabled || !validBasis || !query.data.returnDatetime || !query.data.departurePortId || !query.data.returnPortId} onClick={() => { if (!disabled&&validBasis&&query.data?.returnDatetime&&query.data.departurePortId&&query.data.returnPortId) onApply(query.data) }}>Dùng ngày kết thúc và cảng từ bản xem trước</Button></>}</>}
  </Panel>
}
