import { useCallback, useRef, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router'

import { useReadQuery } from '@/shared/api'
import { useSessionAccess } from '@/shared/auth'
import { Button, ButtonLink, Empty, Field, Loading, Modal, Notice, PageHeader, Panel } from '@/shared/ui'

import { itineraryApi, itineraryHistoryApi, type ItineraryHistoryEntry } from '../api/itinerary-api'
import { ItineraryFrame } from '../components/ItineraryUI'
import styles from '../components/Itineraries.module.css'

const types = { TIME_CHANGE: 'Đổi thời gian', PORT_OMITTED: 'Bỏ cảng', PORT_SUBSTITUTED: 'Thay cảng', STOP_REORDERED: 'Đổi thứ tự', EXCURSION_IMPACT: 'Ảnh hưởng tham quan', OTHER: 'Khác' } as const
export function ItineraryHistoryPage() {
  const access = useSessionAccess()
  const [params] = useSearchParams()
  const [itineraryId, setItineraryId] = useState(params.get('itineraryId') ?? '')
  const [changeType, setChangeType] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  const [recording, setRecording] = useState(false)
  const [stopId, setStopId] = useState('')
  const [summary, setSummary] = useState(''), [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [success, setSuccess] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const lock = useRef(false)
  const plans = useReadQuery('history-itinerary-options', itineraryApi.allItineraries)
  const load = useCallback((signal: AbortSignal) => itineraryHistoryApi.search({ itineraryId: itineraryId || undefined, changeType: changeType || undefined }, signal), [itineraryId, changeType])
  const history = useReadQuery(`history:${itineraryId}:${changeType}`, load)
  const loadStops = useCallback((signal: AbortSignal) => itineraryId ? itineraryApi.listStops(itineraryId, signal) : Promise.resolve([]), [itineraryId])
  const stops = useReadQuery(`history-stops:${itineraryId}`, loadStops)
  const loadDetail = useCallback((signal: AbortSignal) => selected ? itineraryHistoryApi.get(selected, signal) : Promise.resolve(null), [selected])
  const detail = useReadQuery(`history-entry:${selected}`, loadDetail)
  const plan = plans.data?.find(item => item.itineraryId === itineraryId)
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (lock.current || !access.has('ITINERARY_CHANGE_RECORD') || !access.userId) return
    if (!plan || stops.loading || stops.error || !changeType || !(changeType in types) || (stopId && !stops.data?.some(stop => stop.cruiseStopId === stopId)) || !summary.trim() || !reason.trim() || summary.trim().length > 1000 || reason.trim().length > 1000) { setError('Chọn lịch trình, loại thay đổi, mô tả và lý do hợp lệ (tối đa 1000 ký tự). Dữ liệu liên quan phải được tải đầy đủ.'); return }
    if (!confirmed) { setConfirmed(true); return }
    lock.current = true; setBusy(true); setError(''); setSuccess('')
    try {
      await itineraryHistoryApi.append({ itineraryId, cruiseStopId: stopId || undefined, changedEntityType: stopId ? 'CruiseStop' : 'Itinerary', changedEntityId: stopId || itineraryId, changeType: changeType as keyof typeof types, changeSummary: summary, reason, changedByUserId: access.userId })
      setRecording(false); setConfirmed(false); setSummary(''); setReason(''); setSuccess('Đã ghi vào nhật ký. Thao tác này không sửa dữ liệu lịch trình.'); history.retry()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Không ghi được nhật ký.'); setConfirmed(false) }
    finally { lock.current = false; setBusy(false) }
  }
  return <ItineraryFrame>
    <PageHeader breadcrumb="LẬP CHUYẾN / NHẬT KÝ" title="Nhật ký thay đổi hải trình" description="Tra cứu điều chỉnh, lý do và thời điểm; phân biệt nhật ký với thao tác sửa lịch trình." actions={<ButtonLink tone="secondary" to="/admin/itineraries">Danh sách hải trình</ButtonLink>} />
    <Panel title="Tra cứu"><div className={styles.formGrid}>
      <Field htmlFor="history-itinerary" label="Lịch trình"><select id="history-itinerary" value={itineraryId} disabled={busy || plans.loading || Boolean(plans.error)} onChange={event => { setItineraryId(event.target.value); setStopId(''); setSelected(null); setConfirmed(false) }}><option value="">Tất cả lịch trình</option>{plans.data?.map(item => <option key={item.itineraryId} value={item.itineraryId}>{item.itineraryName} · {item.startDate}</option>)}</select></Field>
      <Field htmlFor="history-type" label="Loại thay đổi"><select id="history-type" value={changeType} disabled={busy} onChange={event => { setChangeType(event.target.value); setConfirmed(false) }}><option value="">Tất cả loại thay đổi</option>{Object.entries(types).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></Field>
    </div><Button tone="secondary" disabled={busy} onClick={() => { setItineraryId(''); setChangeType(''); setStopId(''); setSelected(null); setConfirmed(false) }}>Xóa bộ lọc</Button></Panel>
    {plans.error && <Notice title="Không tải được danh sách lịch trình" tone="error">{plans.error.message}<Button onClick={plans.retry}>Thử lại</Button></Notice>}
    {success && <Notice title="Đã ghi nhật ký" tone="success">{success}</Notice>}
    <Panel title="Các thay đổi đã ghi nhận">
      {history.loading && <Loading label="Đang tải nhật ký…" />}
      {history.error && <Notice title="Không tải được nhật ký" tone="error">{history.error.message}<Button onClick={history.retry}>Thử lại</Button></Notice>}
      {history.data && !history.data.length && <Empty title="Chưa có nhật ký phù hợp" />}
      {history.data?.map(entry => <article key={entry.changeHistoryId}><h3>{entry.changeSummary || 'Thay đổi hải trình'}</h3><p>{entry.changeType ? types[entry.changeType] : 'Chưa phân loại'} · {entry.changedAt ? new Date(entry.changedAt).toLocaleString('vi-VN') : 'Chưa có thời gian'}</p><p>{entry.reason || 'Chưa có lý do'}</p><Button tone="text" onClick={() => setSelected(entry.changeHistoryId)}>Xem chi tiết bản ghi</Button><ButtonLink tone="secondary" to={`/admin/itineraries/${entry.itineraryId}`}>Mở lịch trình</ButtonLink></article>)}
      <Button disabled={!plan || !access.has('ITINERARY_CHANGE_RECORD')} onClick={() => { setRecording(true); setConfirmed(false); setError('') }}>Ghi nhận điều chỉnh</Button>
      {!plan && <p>Chọn một lịch trình có thật để ghi nhận điều chỉnh.</p>}
    </Panel>
    {selected && <Modal title="Chi tiết nhật ký" onClose={() => setSelected(null)}>
      {detail.loading && <Loading label="Đang tải bản ghi…" />}
      {detail.error && <Notice tone="error" title="Không tải được bản ghi">{detail.error.message}<Button onClick={detail.retry}>Thử lại</Button></Notice>}
      {detail.data && <HistoryDetails entry={detail.data} />}
    </Modal>}
    {recording && <Modal title="Ghi nhận điều chỉnh" busy={busy} onClose={() => setRecording(false)}><form className={styles.stopForm} onSubmit={submit}>
      <p>{plan?.itineraryName}. Người ghi nhận lấy từ tài khoản đang đăng nhập. Nhật ký không tự thay đổi thời gian, trạng thái hoặc quyền lợi hành khách.</p>
      {stops.error && <Notice tone="error" title="Không tải được điểm dừng">{stops.error.message}<Button type="button" onClick={stops.retry}>Thử lại</Button></Notice>}
      <Field htmlFor="history-stop" label="Phạm vi thay đổi"><select id="history-stop" value={stopId} disabled={busy || stops.loading || Boolean(stops.error)} onChange={event => { setStopId(event.target.value); setConfirmed(false) }}><option value="">Toàn lịch trình</option>{stops.data?.map(stop => <option key={stop.cruiseStopId} value={stop.cruiseStopId}>Điểm {stop.stopOrder} · {stop.portName || 'Cảng ghé'}</option>)}</select></Field>
      <Field htmlFor="history-record-type" label="Loại điều chỉnh"><select id="history-record-type" required value={changeType} disabled={busy} onChange={event => { setChangeType(event.target.value); setConfirmed(false) }}><option value="">Chọn loại điều chỉnh</option>{Object.entries(types).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></Field>
      <Field htmlFor="history-summary" label="Nội dung thay đổi"><textarea id="history-summary" required maxLength={1000} disabled={busy} value={summary} onChange={event => { setSummary(event.target.value); setConfirmed(false) }} /></Field>
      <Field htmlFor="history-reason" label="Lý do"><textarea id="history-reason" required maxLength={1000} disabled={busy} value={reason} onChange={event => { setReason(event.target.value); setConfirmed(false) }} /></Field>
      {error && <Notice title="Không ghi được nhật ký" tone="error">{error}</Notice>}
      {confirmed && <Notice tone="warning" title="Xác nhận ghi nhật ký">{summary} · {reason}</Notice>}
      <Button type="submit" disabled={busy || !access.userId || !access.has('ITINERARY_CHANGE_RECORD') || stops.loading || Boolean(stops.error)}>{busy ? 'Đang ghi…' : confirmed ? 'Xác nhận ghi nhật ký' : 'Kiểm tra và tiếp tục'}</Button>
    </form></Modal>}
  </ItineraryFrame>
}

function HistoryDetails({ entry }: { entry: ItineraryHistoryEntry }) {
  return <dl><dt>Nội dung</dt><dd>{entry.changeSummary || 'Chưa có'}</dd><dt>Lý do</dt><dd>{entry.reason || 'Chưa có'}</dd><dt>Đối tượng</dt><dd>{entry.changedEntityType === 'CruiseStop' ? 'Điểm dừng' : entry.changedEntityType === 'Itinerary' ? 'Lịch trình' : 'Đối tượng khác'}</dd><dt>Thời điểm</dt><dd>{entry.changedAt ? new Date(entry.changedAt).toLocaleString('vi-VN') : 'Chưa có'}</dd><dt>Dữ liệu trước/sau</dt><dd>{entry.beforeData || entry.afterData ? 'Có dữ liệu đối chiếu trong bản ghi.' : 'Bản ghi chưa kèm dữ liệu đối chiếu.'}</dd></dl>
}
