import { useCallback, useRef, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router'

import { useReadQuery } from '@/shared/api'
import { useSessionAccess } from '@/shared/auth'
import { Button, DataTable, Empty, Field, Loading, Modal, Notice, PageHeader, Panel, TechnicalDetails } from '@/shared/ui'

import { itineraryApi, itineraryHistoryApi, type ItineraryHistoryEntry } from '../api/itinerary-api'
import { ItineraryFrame } from '../components/ItineraryUI'
import styles from '../components/Itineraries.module.css'
import { historyDifferences, historyFieldLabel, historyValue } from '../model/history-diff'

const types = { TIME_CHANGE: 'Đổi thời gian', PORT_OMITTED: 'Bỏ cảng', PORT_SUBSTITUTED: 'Thay cảng', STOP_REORDERED: 'Đổi thứ tự', EXCURSION_IMPACT: 'Ảnh hưởng tham quan', OTHER: 'Khác' } as const
export function ItineraryHistoryPage() {
  const access = useSessionAccess()
  const [params] = useSearchParams()
  const [itineraryId, setItineraryId] = useState(params.get('itineraryId') ?? '')
  const [recordItineraryId, setRecordItineraryId] = useState(params.get('itineraryId') ?? '')
  const [changeType, setChangeType] = useState('')
  const [recordChangeType, setRecordChangeType] = useState('')
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
  const canStops = access.canDo('CRUISE_STOP_READ')
  const activeRecordItineraryId = recording ? recordItineraryId : itineraryId
  const loadStops = useCallback((signal: AbortSignal) => activeRecordItineraryId && canStops ? itineraryApi.listStops(activeRecordItineraryId, signal) : Promise.resolve([]), [activeRecordItineraryId, canStops])
  const stops = useReadQuery(`history-stops:${activeRecordItineraryId}`, loadStops)
  const loadDetail = useCallback((signal: AbortSignal) => selected ? itineraryHistoryApi.get(selected, signal) : Promise.resolve(null), [selected])
  const detail = useReadQuery(`history-entry:${selected}`, loadDetail)
  const recordPlan = plans.data?.find(item => item.itineraryId === recordItineraryId)
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (lock.current || !access.canDo('ITINERARY_CHANGE_RECORD')) return
    if (!recordPlan || stops.loading || stops.error || !recordChangeType || !(recordChangeType in types) || (stopId && !stops.data?.some(stop => stop.cruiseStopId === stopId)) || !summary.trim() || !reason.trim() || summary.trim().length > 1000 || reason.trim().length > 1000) { setError('Chọn lịch trình, loại thay đổi, mô tả và lý do hợp lệ (tối đa 1000 ký tự).'); return }
    if (!confirmed) { setConfirmed(true); return }
    lock.current = true; setBusy(true); setError(''); setSuccess('')
    try {
      await itineraryHistoryApi.append({ itineraryId: recordItineraryId, cruiseStopId: stopId || undefined, changedEntityType: stopId ? 'CruiseStop' : 'Itinerary', changedEntityId: stopId || recordItineraryId, changeType: recordChangeType as keyof typeof types, changeSummary: summary, reason })
      setRecording(false); setConfirmed(false); setRecordChangeType(''); setStopId(''); setSummary(''); setReason(''); setSuccess('Đã ghi nhận điều chỉnh vào nhật ký.'); history.retry()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Không ghi được nhật ký.'); setConfirmed(false) }
    finally { lock.current = false; setBusy(false) }
  }
  const hasFilters = Boolean(itineraryId || changeType)
  return <ItineraryFrame>
    <PageHeader
      breadcrumb="LẬP CHUYẾN / NHẬT KÝ"
      title="Nhật ký thay đổi lịch trình"
      actions={
        access.canDo('ITINERARY_CHANGE_RECORD') && Boolean(plans.data?.length) ? (
          <Button
            autoWidth
            onClick={() => {
              setRecordItineraryId(itineraryId || plans.data?.[0]?.itineraryId || '')
              setRecordChangeType(changeType)
              setStopId('')
              setRecording(true)
              setConfirmed(false)
              setError('')
            }}
          >
            + Ghi nhận điều chỉnh
          </Button>
        ) : undefined
      }
    />
    {plans.error && <Notice title="Không tải được danh sách lịch trình" tone="error">{plans.error.message}<Button onClick={plans.retry}>Thử lại</Button></Notice>}
    {success && <Notice title="Đã ghi nhật ký" tone="success">{success}</Notice>}
    <Panel>
      <div className={styles.historyContent}>
        <div className={styles.historyFilters}>
          <Field htmlFor="history-itinerary" label="Lịch trình"><select id="history-itinerary" value={itineraryId} disabled={busy || plans.loading || Boolean(plans.error)} onChange={event => { setItineraryId(event.target.value); setStopId(''); setSelected(null); setConfirmed(false) }}><option value="">Tất cả lịch trình</option>{plans.data?.map(item => <option key={item.itineraryId} value={item.itineraryId}>{item.itineraryName} · {item.startDate}</option>)}</select></Field>
          <Field htmlFor="history-type" label="Loại thay đổi"><select id="history-type" value={changeType} disabled={busy} onChange={event => { setChangeType(event.target.value); setConfirmed(false) }}><option value="">Tất cả loại thay đổi</option>{Object.entries(types).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></Field>
          {hasFilters && <Button tone="secondary" autoWidth disabled={busy} onClick={() => { setItineraryId(''); setChangeType(''); setStopId(''); setSelected(null); setConfirmed(false) }}>Xóa lọc</Button>}
        </div>
        {history.loading && <Loading label="Đang tải nhật ký…" />}
        {history.error && <Notice title="Không tải được nhật ký" tone="error">{history.error.message}<Button onClick={history.retry}>Thử lại</Button></Notice>}
        {!history.loading && !history.error && history.data && !history.data.length && (
          <Empty title={hasFilters ? 'Không có nhật ký khớp bộ lọc' : 'Chưa có nhật ký thay đổi'}>
            <p>{hasFilters ? 'Thử chọn lịch trình hoặc loại thay đổi khác.' : 'Các điều chỉnh được ghi nhận sẽ xuất hiện tại đây để tra cứu.'}</p>
            {hasFilters && <Button tone="secondary" onClick={() => { setItineraryId(''); setChangeType(''); setStopId(''); setSelected(null); setConfirmed(false) }}>Xóa bộ lọc</Button>}
          </Empty>
        )}
        {history.data && history.data.length > 0 && (
          <DataTable
            label="Nhật ký thay đổi lịch trình"
            headers={['Thời điểm', 'Loại thay đổi', 'Nội dung', 'Lý do', 'Thao tác']}
          >
            {history.data.map(entry => (
              <tr key={entry.changeHistoryId}>
                <td>{entry.changedAt ? new Date(entry.changedAt).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : '—'}</td>
                <td>{entry.changeType ? types[entry.changeType] : 'Khác'}</td>
                <td><strong>{entry.changeSummary || 'Thay đổi lịch trình'}</strong></td>
                <td>{entry.reason || '—'}</td>
                <td>
                  <Button tone="secondary" size="compact" autoWidth onClick={() => setSelected(entry.changeHistoryId)}>
                    Xem chi tiết
                  </Button>
                </td>
              </tr>
            ))}
          </DataTable>
        )}
      </div>
    </Panel>
    {selected && <Modal title="Chi tiết nhật ký" onClose={() => setSelected(null)}>
      {detail.loading && <Loading label="Đang tải bản ghi…" />}
      {detail.error && <Notice tone="error" title="Không tải được bản ghi">{detail.error.message}<Button onClick={detail.retry}>Thử lại</Button></Notice>}
      {detail.data && <HistoryDetails entry={detail.data} />}
    </Modal>}
    {recording && access.canDo('ITINERARY_CHANGE_RECORD') && (
      <Modal
        title="Ghi nhận điều chỉnh"
        busy={busy}
        onClose={() => { if (!busy) setRecording(false) }}
        footer={
          <>
            <Button tone="secondary" disabled={busy} data-overlay-dismiss onClick={() => setRecording(false)}>
              Hủy
            </Button>
            <Button
              type="submit"
              form="itinerary-history-record-form"
              busy={busy}
              disabled={busy || !access.canDo('ITINERARY_CHANGE_RECORD') || stops.loading || Boolean(stops.error)}
            >
              {busy ? 'Đang ghi…' : confirmed ? 'Xác nhận ghi nhật ký' : 'Kiểm tra và tiếp tục'}
            </Button>
          </>
        }
      >
        <form id="itinerary-history-record-form" noValidate className={styles.stopForm} onSubmit={submit}>
          <Field htmlFor="history-record-itinerary" label="Lịch trình *">
            <select id="history-record-itinerary" required value={recordItineraryId} disabled={busy} onChange={event => { setRecordItineraryId(event.target.value); setStopId(''); setConfirmed(false) }}>
              <option value="">Chọn lịch trình</option>
              {plans.data?.map(item => <option key={item.itineraryId} value={item.itineraryId}>{item.itineraryName} · {item.startDate}</option>)}
            </select>
          </Field>
          {stops.error && <Notice tone="error" title="Không tải được điểm dừng">{stops.error.message}<Button type="button" onClick={stops.retry}>Thử lại</Button></Notice>}
          <Field htmlFor="history-stop" label="Phạm vi thay đổi"><select id="history-stop" value={stopId} disabled={busy || stops.loading || Boolean(stops.error)} onChange={event => { setStopId(event.target.value); setConfirmed(false) }}><option value="">Toàn lịch trình</option>{stops.data?.map(stop => <option key={stop.cruiseStopId} value={stop.cruiseStopId}>Điểm {stop.stopOrder} · {stop.portName || 'Cảng ghé'}</option>)}</select></Field>
          <Field htmlFor="history-record-type" label="Loại điều chỉnh *"><select id="history-record-type" required value={recordChangeType} disabled={busy} onChange={event => { setRecordChangeType(event.target.value); setConfirmed(false) }}><option value="">Chọn loại điều chỉnh</option>{Object.entries(types).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></Field>
          <Field htmlFor="history-summary" label="Nội dung thay đổi *"><textarea id="history-summary" required maxLength={1000} disabled={busy} value={summary} onChange={event => { setSummary(event.target.value); setConfirmed(false) }} /></Field>
          <Field htmlFor="history-reason" label="Lý do *"><textarea id="history-reason" required maxLength={1000} disabled={busy} value={reason} onChange={event => { setReason(event.target.value); setConfirmed(false) }} /></Field>
          {error && <Notice title="Không ghi được nhật ký" tone="error">{error}</Notice>}
          {confirmed && <Notice tone="warning" title="Xác nhận ghi nhật ký">{summary} · {reason}</Notice>}
        </form>
      </Modal>
    )}
  </ItineraryFrame>
}

function formatSnapshot(raw: unknown): string {
  if (raw == null) return ''
  if (typeof raw === 'string') {
    return raw
  }
  try { return JSON.stringify(raw, null, 2) } catch { return String(raw) }
}

function HistoryDetails({ entry }: { entry: ItineraryHistoryEntry }) {
  const beforeText = formatSnapshot(entry.beforeData)
  const afterText = formatSnapshot(entry.afterData)
  const differences = historyDifferences(entry.beforeData, entry.afterData)
  return (
    <div style={{ display: 'grid', gap: '12px' }}>
      <dl>
        <dt>Nội dung</dt><dd>{entry.changeSummary || 'Chưa có'}</dd>
        <dt>Lý do</dt><dd>{entry.reason || 'Chưa có'}</dd>
        <dt>Đối tượng</dt><dd>{entry.changedEntityType === 'CruiseStop' ? 'Điểm dừng' : entry.changedEntityType === 'Itinerary' ? 'Lịch trình' : 'Đối tượng khác'}</dd>
        <dt>Thời điểm</dt><dd>{entry.changedAt ? new Date(entry.changedAt).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : 'Chưa có'}</dd>
      </dl>
      {differences.length > 0 && <DataTable label="Nội dung đã thay đổi" headers={['Thông tin', 'Trước thay đổi', 'Sau thay đổi']}>
        {differences.map(row => <tr key={JSON.stringify(row.path)}>
          <th scope="row">{historyFieldLabel(row.path)}</th>
          <td className={styles.historyDiffValue}>{historyValue(row.before, row.hadBefore)}</td>
          <td className={styles.historyDiffValue}>{historyValue(row.after, row.hasAfter)}</td>
        </tr>)}
      </DataTable>}
      {(beforeText || afterText) ? (
        <details className={styles.historyRawEvidence}>
          <summary>Xem dữ liệu gốc để đối chiếu</summary>
          {!differences.length && <p>Bản ghi không có thay đổi giá trị giữa hai phần dữ liệu được cung cấp.</p>}
          <div className={styles.historySnapshots}>
          {beforeText && (
            <div>
              <strong>Dữ liệu trước thay đổi</strong>
              <pre>{beforeText}</pre>
            </div>
          )}
          {afterText && (
            <div>
              <strong>Dữ liệu sau thay đổi</strong>
              <pre>{afterText}</pre>
            </div>
          )}
          </div>
        </details>
      ) : (
        <p>Bản ghi chưa kèm dữ liệu đối chiếu trước/sau.</p>
      )}
      <TechnicalDetails entries={[["Bản ghi thay đổi", entry.changeHistoryId], ["Lịch trình", entry.itineraryId], ["Lần ghé cảng", entry.cruiseStopId], ["Người thay đổi", entry.changedByUserId]]} />
    </div>
  )
}
