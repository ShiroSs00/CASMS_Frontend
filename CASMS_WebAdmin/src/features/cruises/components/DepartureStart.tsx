import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError, useReadQuery } from '@/shared/api'
import { useSessionAccess } from '@/shared/auth'
import { journeyTime } from '@/shared/lib/journey-time'
import { Button, Loading, Modal, Notice, Panel } from '@/shared/ui'
import { departureApi } from '../api/departure-api'
import type { CruiseRecord } from '../model/cruise-record'
import type { DepartureSection } from '../model/preparation'
import { readinessMessage } from '../model/readiness-copy'

const preparationSteps = [
  { section: 'preparation', label: 'Xác nhận bốn nhóm hồ sơ', codes: ['PREPARATION_CONFIRMATION_REQUIRED', 'PREPARATION_SECTIONS_NOT_CONFIRMED'] },
  { section: 'staff', label: 'Phân công nhân sự trên tàu', codes: ['ONBOARD_STAFF_REQUIRED', 'MISSING_ONBOARD_STAFF'] },
  { section: 'guidance', label: 'Công bố hướng dẫn an toàn', codes: ['GUIDANCE_PUBLICATION_REQUIRED'] },
] as const

export function DepartureStart({ cruise, refreshKey, sections, onSection, onChanged }: {
  cruise: CruiseRecord
  refreshKey: number
  sections: readonly DepartureSection[]
  onSection: (section: DepartureSection) => void
  onChanged: () => void
}) {
  const access = useSessionAccess()
  const id = cruise.cruiseId
  const published = cruise.status === 'PUBLISHED'
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [uncertain, setUncertain] = useState(false)
  const [actual, setActual] = useState<string | null>(null)
  const lock = useRef(false)
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => { heading.current?.focus() }, [])
  const gate = useReadQuery(JSON.stringify([access.userId, id, cruise.revision, refreshKey, published]),
    useCallback(signal => published ? departureApi.departureReadiness(id, signal) : Promise.resolve(null), [id, published]))
  const recorded = useReadQuery(JSON.stringify([access.userId, id, refreshKey, published]),
    useCallback(signal => published ? Promise.resolve(null) : departureApi.departureState(id, signal), [id, published]))

  const opensAt = Date.parse(cruise.departureDatetime) - 2 * 60 * 60 * 1000
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    if (!published || !Number.isFinite(opensAt) || now >= opensAt) return
    const timer = window.setTimeout(() => setNow(Date.now()), Math.max(0, Math.min(opensAt - Date.now(), 60_000)))
    return () => window.clearTimeout(timer)
  }, [now, opensAt, published])

  const canStart = access.canDo('CRUISE_START')
  const ready = gate.data?.ready === true && gate.data.status !== 'INDETERMINATE'
  const eligible = published && canStart && ready && now >= opensAt && !actual && !uncertain
  const blockers = gate.data?.blockers ?? []
  const actualTime = actual ?? recorded.data?.actualDepartureDatetime

  async function confirm() {
    if (!eligible || Date.now() < opensAt || lock.current) return
    lock.current = true
    setBusy(true)
    setError('')
    try {
      const saved = await departureApi.start(id)
      setActual(saved.actualDepartureDatetime)
      onChanged()
    } catch (reason) {
      const unknown = !(reason instanceof ApiError) || reason.status === 0 || reason.status >= 500
      setUncertain(unknown)
      setError(unknown ? 'Kiểm tra lại trạng thái chuyến trước khi gửi lại.' : 'Hệ thống chưa xác nhận xuất bến. Xem lại kết quả kiểm tra và thông tin chuyến.')
      gate.retry()
      onChanged()
    } finally {
      setOpen(false)
      lock.current = false
      setBusy(false)
    }
  }

  async function reconcile() {
    if (lock.current) return
    lock.current = true
    setBusy(true)
    try {
      const state = await departureApi.departureState(id)
      if (state.status === 'IN_PROGRESS' && state.actualDepartureDatetime) {
        setActual(state.actualDepartureDatetime)
      } else if (state.status !== 'PUBLISHED') {
        setError('Trạng thái chuyến đã thay đổi. Xem lại thông tin chuyến.')
        onChanged()
        return
      }
      setUncertain(false)
      setError('')
      gate.retry()
      onChanged()
    } catch {
      setError('Chưa tải được trạng thái chuyến. Hãy thử kiểm tra lại.')
    } finally {
      lock.current = false
      setBusy(false)
    }
  }

  return <Panel>
    <h2 ref={heading} tabIndex={-1}>Chuẩn bị xuất bến</h2>
    <Button tone="text" onClick={() => onSection('overview')}>Về tổng quan chuyến</Button>
    {actualTime ? <Notice title="Đã ghi nhận xuất bến" tone="success">
      <p>Giờ khởi hành thực tế · {journeyTime(actualTime)} (giờ Việt Nam)</p>
    </Notice> : !published ? <>
      {recorded.loading && <Loading label="Đang tải giờ khởi hành thực tế…" />}
      {recorded.error && <Notice title="Chưa tải được giờ khởi hành thực tế" tone="error">
        <Button tone="secondary" onClick={recorded.retry}>Thử lại</Button>
      </Notice>}
      {recorded.data && <p>Chưa có giờ khởi hành thực tế.</p>}
    </> : <>
      <p>Quản lý lịch trình tổng hợp hồ sơ. Quản lý vận hành kiểm tra và xác nhận từng nhóm.</p>
      {gate.loading && <Loading label="Đang kiểm tra điều kiện xuất bến…" />}
      {gate.error && <Notice title="Chưa tải được điều kiện xuất bến" tone="error">
        <Button tone="secondary" onClick={gate.retry}>Thử lại</Button>
      </Notice>}
      {gate.data && <>
        <Notice title={ready ? 'Đủ điều kiện xuất bến' : gate.data.status === 'INDETERMINATE' ? 'Chưa xác định được điều kiện xuất bến' : 'Còn việc cần xử lý trước khi xuất bến'} tone={ready ? 'success' : 'warning'}>{ready ? 'Các mục kiểm tra đã đạt.' : 'Xem kết quả từng mục bên dưới.'}</Notice>
        <ul>{preparationSteps.map(({ section, label, codes }) => {
          const blocked = codes.some(code => blockers.includes(code))
          const status = blocked ? 'Chưa đạt' : ready || (section === 'preparation' && gate.data?.preparationSectionsConfirmed === true) ? 'Đạt' : 'Chưa xác định'
          return <li key={section}>
            <strong>{label}</strong> · {status}
            {section === 'guidance' && <p>Buổi hướng dẫn đã công bố cần có nội dung và người phụ trách.</p>}
            {sections.includes(section) && <Button tone="text" onClick={() => onSection(section)}>Mở mục {label.toLocaleLowerCase('vi-VN')}</Button>}
          </li>
        })}</ul>
        {!ready && <ul>{[...new Set(gate.data.details?.filter(item => item.severity === 'BLOCKER' && item.code !== 'MISSING_ONBOARD_STAFF')
          .map(item => item.code === 'PREPARATION_SECTION_UNCONFIRMED' && item.message ? item.message : readinessMessage(item.code, item.message))
          ?? gate.data.issues ?? [])].map(message => <li key={message}>{message}</li>)}</ul>}
        <Button tone="secondary" disabled={busy} onClick={gate.retry}>Kiểm tra lại điều kiện</Button>
      </>}
      {error && <Notice title={uncertain ? 'Chưa rõ kết quả xác nhận' : 'Chưa thể xác nhận xuất bến'} tone="warning">
        <p>{error}</p>
        {uncertain && <Button tone="secondary" busy={busy} onClick={() => void reconcile()}>Kiểm tra trạng thái chuyến</Button>}
      </Notice>}
      {canStart && <>
        {now < opensAt && <p>Có thể xác nhận từ {journeyTime(new Date(opensAt).toISOString())} (giờ Việt Nam).</p>}
        <Button disabled={!eligible || busy} onClick={() => setOpen(true)}>Xác nhận xuất bến</Button>
      </>}
    </>}
    {open && <Modal title="Xác nhận xuất bến" busy={busy} onClose={() => setOpen(false)} footer={<>
      <Button tone="secondary" disabled={busy} data-overlay-dismiss onClick={() => setOpen(false)}>Quay lại</Button>
      <Button busy={busy} disabled={!eligible} onClick={() => void confirm()}>Xác nhận xuất bến</Button>
    </>}>
      <p>Hệ thống sẽ ghi giờ xuất bến thực tế và chuyển chuyến {cruise.cruiseCode} sang trạng thái đang diễn ra.</p>
    </Modal>}
  </Panel>
}
