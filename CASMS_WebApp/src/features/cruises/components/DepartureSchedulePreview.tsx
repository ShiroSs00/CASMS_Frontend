import {ItineraryDayBrowser} from '@/domain/itinerary-day'
import { SHIP_TIME_ZONE } from '@/shared/lib/journey-time'
import { useCallback, useState } from 'react'
import { ApiError, useReadQuery } from '@/shared/api'
import { Button, Modal, Notice, Panel } from '@/shared/ui'
import { departureApi } from '../api/departure-api'
import type { DepartureSchedule } from '../model/departure-contract'
import { scheduleInstant } from '../model/cruise-validation'
import { ReadState, ScheduleContents } from './DepartureData'
import styles from './DepartureSchedulePreview.module.css'

export function DepartureSchedulePreview({ sourceVersionId, departure, contextKey, disabled, onApply, sourceEntries=[] }: { sourceEntries?:readonly {entryId?:string;clientKey:string;title:string}[];sourceVersionId: string; departure: string; contextKey: string; disabled: boolean; onApply: (schedule: DepartureSchedule) => void }) {
  const entryTitles=Object.fromEntries(sourceEntries.flatMap(entry=>[[entry.clientKey,entry.title],...(entry.entryId?[[entry.entryId,entry.title]]:[])]))
  const [request, setRequest] = useState<{ key: string; sourceVersionId: string; instant: string } | null>(null)
  const [error, setError] = useState('')
  const [openKey, setOpenKey] = useState<string | null>(null)
  const [appliedKey, setAppliedKey] = useState<string | null>(null)
  const key = JSON.stringify([sourceVersionId, departure, contextKey])
  const current = request?.key === key ? request : null
  const query = useReadQuery('departure-preview:' + key + ':' + Boolean(current), useCallback(signal => current ? departureApi.preview(current.sourceVersionId, current.instant, signal) : Promise.resolve(null), [current]))
  const sourceError=query.error instanceof ApiError&&['SOURCE_PROGRAM_SCHEDULE_REQUIRED','SOURCE_PROGRAM_OUTSIDE_CRUISE','SOURCE_EXCURSION_OUTSIDE_PORT_CALL'].includes(query.error.code??'')?query.error:null
  const sourceName=sourceError?.details&&typeof sourceError.details==='object'&&'name' in sourceError.details&&typeof sourceError.details.name==='string'?sourceError.details.name:null
  const validBasis = Boolean(query.data && query.data.sourceVersionRevision != null && query.data.days.length && query.data.days.every(day => day.shipTimeZoneId === SHIP_TIME_ZONE))
  const startsAtSea = query.data?.days.find(day => day.dayNumber === 1)?.dayType === 'SEA_DAY'
  const canApply = Boolean(current && !disabled && !query.loading && !query.error && validBasis && query.data?.returnDatetime && (query.data.departurePortId || startsAtSea) && query.data.returnPortId)

  function preview() {
    try {
      const instant = scheduleInstant(departure).toISOString()
      setError('')
      setRequest({ key, sourceVersionId, instant })
      setOpenKey(key)
    } catch { setError('Nhập ngày giờ bắt đầu hợp lệ để xem trước.') }
  }
  function apply() {
    if (!canApply || !query.data) return
    onApply(query.data)
    setAppliedKey(key)
    setOpenKey(null)
  }

  return <Panel title="Xem trước lịch theo ngày thực tế" >
    <Button tone="secondary" disabled={disabled || Boolean(current && query.loading)} onClick={preview}>Xem trước lịch</Button>
    {error && <Notice title="Chưa xem trước được" tone="error">{error}</Notice>}
    {appliedKey === key && <p className={styles.applied} role="status">Đã áp dụng ngày kết thúc và cảng khởi hành từ lịch xem trước.</p>}
    {current && openKey === key && <Modal large protectChanges={false} title="Xem trước lịch trình" description="Ngày thực tế được tính từ lịch trình đã chốt. Giờ cảng theo múi giờ địa phương." onClose={() => setOpenKey(null)} footer={<>
      <Button tone="secondary" onClick={() => setOpenKey(null)}>Đóng</Button>
      <Button disabled={!canApply} onClick={apply}>Áp dụng lịch này</Button>
    </>}>
      {sourceError?<Notice title="Lịch trình nguồn chưa hợp lệ" tone="error"><p>{sourceError.message}</p>{sourceName&&<p>Chương trình: <strong>{sourceName}</strong></p>}</Notice>:<ReadState {...query} />}
      {!query.loading && !query.error && query.data && <div className={styles.content}>
        {!validBasis && <Notice title="Chưa thể áp dụng lịch xem trước" tone="warning">Cơ sở giờ tàu hoặc phiên dữ liệu nguồn chưa đầy đủ. Cần hệ thống xác nhận lại lịch trước khi tạo chuyến khởi hành.</Notice>}
        <ItineraryDayBrowser days={query.data.days}>{day=><ScheduleContents schedule={query.data!} preview selectedDay={day} entryTitles={entryTitles}/>}</ItineraryDayBrowser>
      </div>}
    </Modal>}
  </Panel>
}
