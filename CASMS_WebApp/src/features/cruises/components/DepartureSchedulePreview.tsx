import { SHIP_TIME_ZONE } from '@/shared/lib/journey-time'
import { useCallback, useState } from 'react'
import { useReadQuery } from '@/shared/api'
import { Button, Modal, Notice, Panel } from '@/shared/ui'
import { departureApi } from '../api/departure-api'
import type { DepartureSchedule } from '../model/departure-contract'
import { scheduleInstant } from '../model/cruise-validation'
import { ReadState, ScheduleContents } from './DepartureData'
import styles from './DepartureSchedulePreview.module.css'

export function DepartureSchedulePreview({ sourceVersionId, departure, contextKey, disabled, onApply }: { sourceVersionId: string; departure: string; contextKey: string; disabled: boolean; onApply: (schedule: DepartureSchedule) => void }) {
  const [request, setRequest] = useState<{ key: string; sourceVersionId: string; instant: string } | null>(null)
  const [error, setError] = useState('')
  const [openKey, setOpenKey] = useState<string | null>(null)
  const [appliedKey, setAppliedKey] = useState<string | null>(null)
  const key = JSON.stringify([sourceVersionId, departure, contextKey])
  const current = request?.key === key ? request : null
  const query = useReadQuery('departure-preview:' + key + ':' + Boolean(current), useCallback(signal => current ? departureApi.preview(current.sourceVersionId, current.instant, signal) : Promise.resolve(null), [current]))
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

  return <Panel title="Xem trước lịch theo ngày thực tế" subtitle="Ngày kết thúc và các lần ghé do hệ thống tính từ phiên bản nguồn; xem trước chưa lưu dữ liệu.">
    <Button tone="secondary" disabled={disabled || Boolean(current && query.loading)} onClick={preview}>Xem trước lịch</Button>
    {error && <Notice title="Chưa xem trước được" tone="error">{error}</Notice>}
    {appliedKey === key && <p className={styles.applied} role="status">Đã áp dụng ngày kết thúc và cảng khởi hành từ lịch xem trước.</p>}
    {current && openKey === key && <Modal wide protectChanges={false} title="Xem trước lịch trình" description="Lịch theo ngày thực tế, các lần ghé cảng và chương trình từ phiên bản nguồn. Giờ tàu dùng múi giờ Việt Nam; giờ ghé dùng múi giờ của cảng." onClose={() => setOpenKey(null)} footer={<>
      <Button tone="secondary" onClick={() => setOpenKey(null)}>Đóng</Button>
      <Button disabled={!canApply} onClick={apply}>Áp dụng lịch này</Button>
    </>}>
      <ReadState {...query} />
      {!query.loading && !query.error && query.data && <div className={styles.content}>
        {!validBasis && <Notice title="Chưa thể áp dụng lịch xem trước" tone="warning">Cơ sở giờ tàu hoặc phiên dữ liệu nguồn chưa đầy đủ. Cần hệ thống xác nhận lại lịch trước khi tạo lần khởi hành.</Notice>}
        <ScheduleContents schedule={query.data} preview />
      </div>}
    </Modal>}
  </Panel>
}
