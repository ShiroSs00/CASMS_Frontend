import { useCallback, useState } from 'react'
import { useReadQuery } from '@/shared/api'
import { useSessionAccess } from '@/shared/auth'
import { Button, Field, Modal, Notice, Panel, RecordFacts } from '@/shared/ui'
import { departureApi } from '../api/departure-api'
import { delayFieldErrors, type DelayPreview } from '../model/departure-delay-contract'
import { useDepartureDelay } from '../model/useDepartureDelay'
import { ReadState, ScheduleContents } from './DepartureData'

const reasons: Record<string, string> = {
  CRUISE_NOT_PUBLISHED: 'Chuyến chưa được phát hành.',
  ACTUAL_DEPARTURE_RECORDED: 'Chuyến đã ghi nhận giờ khởi hành thực tế.',
  DEPARTURE_TIME_REACHED: 'Đã đến giờ khởi hành dự kiến.',
  SHIP_NOT_ASSIGNED: 'Chưa phân tàu cho chuyến.',
  DEPARTURE_PORT_REQUIRED: 'Chưa có cảng khởi hành.',
  OPERATIONAL_SCHEDULE_REQUIRED: 'Chưa có lịch vận hành hợp lệ.',
  CRUISE_NOT_DEPARTURE_READY: 'Chuyến chưa đạt điều kiện khởi hành.',
  UNRESOLVED_OPERATIONAL_ISSUES: 'Còn sự cố vận hành cần xử lý.',
  FIXED_SERVICE_SCHEDULE: 'Chuyến có khung phục vụ cố định.',
  FIXED_GUIDANCE_SESSION: 'Chuyến có phiên hướng dẫn đã lên lịch.',
  SHIP_SCHEDULE_CONFLICT: 'Giờ mới trùng lịch tàu.',
  STAFF_SCHEDULE_CONFLICT: 'Giờ mới trùng lịch nhân sự.',
  PORT_WINDOW_BLOCKED: 'Giờ mới không phù hợp với cửa sổ cảng.',
  SCHEDULE_DAY_BOUNDARY_CHANGED: 'Giờ mới cần phân bổ lại ngày trong lịch trình.',
}
const needsScheduleChange = ['SCHEDULE_DAY_BOUNDARY_CHANGED', 'FIXED_SERVICE_SCHEDULE', 'FIXED_GUIDANCE_SESSION']
type Checks = Pick<DelayPreview, 'blockers' | 'portWindowChecks'>

function DelayChecks({ checks, onScheduleChange }: { checks: Checks; onScheduleChange?: () => void }) {
  const blockers = [...new Set(checks.blockers)]
  return <>
    {blockers.length > 0 && <Notice title="Chưa thể dời giờ" tone="warning">
      <ul>{blockers.map(code => <li key={code}>{Object.hasOwn(reasons, code) ? reasons[code] : `Điều kiện khởi hành chưa đạt (${code}).`}</li>)}</ul>
      {onScheduleChange && blockers.some(code => needsScheduleChange.includes(code)) &&
        <Button tone="text" onClick={onScheduleChange}>Mở phần thay đổi lịch</Button>}
    </Notice>}
    {checks.portWindowChecks.length > 0 && <details>
      <summary>Kiểm tra cửa sổ cảng</summary>
      <ul>{checks.portWindowChecks.map((check, index) =>
        <li key={index}>{check.status === 'PASS' ? 'Đạt' : 'Cần kiểm tra'} · {check.message ?? (check.status === 'PASS' ? 'Giờ dự kiến phù hợp với cửa sổ cảng.' : 'Cần kiểm tra lại giờ tại cảng.')}</li>)}</ul>
    </details>}
  </>
}

export function DepartureDelay({ id, userId, revision, eligible, refreshKey, onChanged, onScheduleChange }: {
  id: string; userId: string; revision?: number | null; eligible: boolean; refreshKey: number
  onChanged: () => void; onScheduleChange: () => void
}) {
  const access = useSessionAccess()
  const canRead = access.has('CRUISE_READ')
  const canReadGate = canRead || access.has('CRUISE_VALIDATE')
  const gate = useReadQuery(`departure-delay-gate:${userId}:${id}:${refreshKey}:${revision}:${canReadGate}`,
    useCallback(signal => canReadGate ? departureApi.departureReadiness(id, signal) : Promise.resolve(null), [id, canReadGate]))
  const delay = useDepartureDelay(id, userId, revision, eligible, onChanged)
  const [open, setOpen] = useState(false)
  const { draft, pending, preview, busy, error } = delay
  const errors = delayFieldErrors(Number(draft.minutes), draft.reason.trim(), draft.category)
  function fieldError(field: keyof typeof errors, value: string) {
    if (error?.status === 400 && error.details && typeof error.details === 'object' && Object.hasOwn(error.details, field)) {
      return errors[field] ?? 'Kiểm tra lại giá trị của trường này.'
    }
    return value ? errors[field] : undefined
  }
  function close() {
    setOpen(false)
    if (!pending.request && !delay.success) delay.reset()
  }
  const stale = preview && (preview.data.revision !== revision || delay.seconds === 0 || !eligible)

  return <Panel title="Dời giờ khởi hành" subtitle="Xem ảnh hưởng đến lịch chuyến trước khi xác nhận giờ mới.">
    {canReadGate && <><ReadState {...gate} />{gate.data && <p>Điều kiện khởi hành · {gate.data.ready ? 'Đạt' : 'Chưa đạt'}</p>}</>}
    {delay.success && <Notice title="Đã xác nhận dời giờ" tone="success">Giờ mới được tải lại từ hệ thống.</Notice>}
    {!eligible && !pending.request && !delay.success && <p>Chỉ có thể dời giờ cho chuyến đã phát hành và còn trước giờ khởi hành.</p>}
    {pending.unavailable && <Notice title="Chưa thể lưu yêu cầu trong tab này" tone="error">Kiểm tra cài đặt lưu trữ của trình duyệt rồi tải lại trang.</Notice>}
    <Button tone="secondary" disabled={(!eligible && !pending.request) || pending.unavailable} onClick={() => { if (delay.success) delay.reset(); setOpen(true) }}>
      {pending.request ? 'Mở yêu cầu chưa rõ kết quả' : 'Dời giờ khởi hành'}
    </Button>
    {open && <Modal wide title="Dời giờ khởi hành" busy={busy} protectChanges={!pending.request && !delay.success} onClose={close}
      footer={<>
        <Button tone="secondary" disabled={busy} data-overlay-dismiss onClick={close}>Đóng</Button>
        {pending.request ? <Button busy={busy} onClick={delay.confirm}>Kiểm tra lại yêu cầu</Button> : !delay.success && <>
          <Button tone={delay.canConfirm ? 'secondary' : 'primary'} busy={busy}
            disabled={!eligible || !revision || pending.unavailable || Object.values(errors).some(Boolean)} onClick={delay.requestPreview}>Xem trước lịch mới</Button>
          {preview && <Button busy={busy} disabled={!delay.canConfirm} onClick={delay.confirm}>Xác nhận dời giờ</Button>}
        </>}
      </>}>
      {pending.unavailable && <Notice title="Chưa thể lưu yêu cầu trong tab này" tone="error">Tải lại trang sau khi kiểm tra cài đặt lưu trữ.</Notice>}
      {pending.request ? <Notice title={busy ? 'Đang kiểm tra yêu cầu' : 'Chưa xác nhận được kết quả'} tone="warning">
        <p>Yêu cầu dời {pending.request.delayMinutes} phút đã được giữ trong tab này. Kiểm tra lại yêu cầu trước khi tạo yêu cầu mới.</p>
        {canRead && <Button tone="text" disabled={busy} onClick={delay.checkHistory}>Đối soát trong lịch sử</Button>}
      </Notice> : delay.success ? <Notice title="Đã xác nhận dời giờ" tone="success">Bạn có thể đóng hộp thoại để xem lịch mới.</Notice> : <>
        <Field htmlFor="delay-minutes" label="Số phút dời giờ" error={fieldError('delayMinutes', draft.minutes)}>
          <input type="number" min={1} step={1} required value={draft.minutes} disabled={busy} onChange={event => delay.change('minutes', event.target.value)} />
        </Field>
        <Field htmlFor="delay-category" label="Mã nhóm lý do" hint="Ví dụ WEATHER_CONDITION hoặc PORT_OPERATION." error={fieldError('category', draft.category)}>
          <input required maxLength={50} value={draft.category} disabled={busy} onChange={event => delay.change('category', event.target.value)} />
        </Field>
        <Field htmlFor="delay-reason" label="Lý do dời giờ" error={fieldError('reason', draft.reason)}>
          <textarea required rows={3} maxLength={1000} value={draft.reason} disabled={busy} onChange={event => delay.change('reason', event.target.value)} />
        </Field>
        {preview && <>
          {stale ? <Notice title="Bản xem trước đã hết hiệu lực" tone="warning">Xem trước lại nếu chuyến vẫn còn đủ điều kiện dời giờ.</Notice>
            : <RecordFacts entries={[[ 'Còn trước giờ khởi hành', `${Math.floor(delay.seconds / 60)} phút ${delay.seconds % 60} giây` ], [ 'Phiên bản lịch', preview.data.revision ]]} />}
          <DelayChecks checks={preview.data} onScheduleChange={canRead ? onScheduleChange : undefined} />
          <details><summary>Lịch hiện tại</summary><ScheduleContents schedule={preview.data.before} allowActions={false} /></details>
          <details open><summary>Lịch dự kiến sau khi dời giờ</summary><ScheduleContents schedule={preview.data.after} allowActions={false} /></details>
        </>}
      </>}
      {error && <Notice title="Chưa hoàn tất thao tác" tone="error">{error.message}</Notice>}
      {delay.rejection && <DelayChecks checks={delay.rejection} onScheduleChange={canRead ? onScheduleChange : undefined} />}
    </Modal>}
  </Panel>
}
