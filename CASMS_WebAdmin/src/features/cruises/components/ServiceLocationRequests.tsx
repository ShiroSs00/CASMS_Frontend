import { useCallback, useId, useRef, useState } from 'react'
import { ApiError, apiRequest, useReadQuery } from '@/shared/api'
import { useSessionAccess } from '@/shared/auth'
import { Badge, Button, Empty, Field, Loading, Notice, Panel } from '@/shared/ui'
import { formatOperatingBudget } from '../api/preparation-api'
import styles from '../staffing/Staffing.module.css'

type Option = { id: string; name: string }
type Request = {
  serviceId: string; serviceName: string; deckName: string; status: 'PENDING' | 'CONFIRMED' | 'RETURNED'
  note: string; reviewNote: string | null; revision: number
}
type View = {
  canPropose: boolean; canReview: boolean; services: Option[]; decks: Option[]; requests: Request[]
  operatingBudgetVnd?: string | null
  shipAssigned?: boolean
}
const status = { PENDING: 'Chờ Quản lý tàu', CONFIRMED: 'Đã xác nhận', RETURNED: 'Cần bổ sung' }

export function ServiceLocationRequests({ cruiseId, onChanged }: { cruiseId: string; onChanged?: () => void }) {
  const access = useSessionAccess()
  const root = `/cruise/${encodeURIComponent(cruiseId)}/service-locations`
  const query = useReadQuery(`${root}:${access.userId}`, useCallback(signal => apiRequest<View>(root, { signal }), [root]))
  const id = useId()
  const [serviceId, setServiceId] = useState('')
  const [deckId, setDeckId] = useState('')
  const [note, setNote] = useState('')
  const [returnId, setReturnId] = useState('')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const lock = useRef(false)
  const view = query.data
  const services = view?.services.filter(service => !view.requests.some(request =>
    request.serviceId === service.id && request.status !== 'RETURNED')) ?? []

  async function submit(url: string, body: object, done: () => void) {
    if (lock.current) return
    lock.current = true
    setBusy(true)
    setError('')
    try {
      await apiRequest<View>(url, { method: 'POST', body })
      done()
      query.retry()
      onChanged?.()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Chưa lưu được. Vui lòng thử lại.')
    } finally {
      lock.current = false
      setBusy(false)
    }
  }
  function review(request: Request, confirm: boolean) {
    void submit(`${root}/${encodeURIComponent(request.serviceId)}/review`,
      { revision: request.revision, confirm, note: confirm ? undefined : reason.trim() },
      () => { setReturnId(''); setReason('') })
  }
  if (query.error instanceof ApiError && query.error.status === 403) return null
  return <Panel title="Bố trí dịch vụ trên tàu">
    {query.loading && <Loading label="Đang tải đề nghị bố trí…" />}
    {query.error && <Notice tone="error" title="Chưa xem được đề nghị bố trí">
      <Button tone="secondary" onClick={query.retry}>Thử lại</Button>
    </Notice>}
    {view && <>
      {view.operatingBudgetVnd && <p>Ngân sách vận hành dự kiến <strong>{formatOperatingBudget(view.operatingBudgetVnd)}</strong></p>}
      {access.roles.includes('ACTIVITY_SERVICE_MANAGER') && (view.canPropose || view.requests.some(request => request.status === 'PENDING')) && (
        view.shipAssigned === false
          ? <Notice tone="warning" title="Chuyến chưa có Quản lý tàu">
              Đề nghị sẽ xuất hiện trong mục Bố trí dịch vụ sau khi Quản lý tàu được phân công cho chuyến.
            </Notice>
          : <p>Quản lý tàu nhận đề nghị trong mục Bố trí dịch vụ.</p>
      )}
      {!view.requests.length && <Empty title="Chưa có đề nghị bố trí dịch vụ" />}
      <ul className={styles.rows}>{view.requests.map(request => <li key={request.serviceId} className={styles.row}>
        <div className={styles.section}>
          <strong>{request.serviceName} · {request.deckName}</strong>
          <p>{request.note}</p>
          {request.reviewNote && <p><strong>Phản hồi của Quản lý tàu</strong> {request.reviewNote}</p>}
          {view.canReview && request.status === 'PENDING' && <div className={styles.actions}>
            {returnId === request.serviceId ? <>
              <Field htmlFor={id+'-reason'} label="Lý do cần bổ sung"><textarea id={id+'-reason'} rows={2}
                maxLength={500} value={reason} onChange={event => setReason(event.target.value)} /></Field>
              <Button disabled={busy || !reason.trim()} onClick={() => review(request, false)}>Gửi phản hồi</Button>
              <Button tone="text" disabled={busy} onClick={() => setReturnId('')}>Hủy</Button>
            </> : <>
              <Button disabled={busy} onClick={() => review(request, true)}>Xác nhận bố trí</Button>
              <Button tone="secondary" disabled={busy} onClick={() => { setReturnId(request.serviceId); setReason('') }}>Yêu cầu bổ sung</Button>
            </>}
          </div>}
        </div>
        <Badge label={request.status === 'PENDING' && view.shipAssigned === false ? 'Chờ phân công Quản lý tàu' : status[request.status]} />
      </li>)}</ul>
      {view.canPropose && !view.decks.length && <p>Tàu này chưa có boong để đề nghị bố trí.</p>}
      {view.canPropose && view.decks.length > 0 && services.length > 0 && <form className={styles.form}
        onSubmit={event => {
          event.preventDefault()
          if (!services.some(service => service.id === serviceId) || !view.decks.some(deck => deck.id === deckId) || !note.trim()) return
          void submit(root, { serviceId, deckId, note: note.trim() }, () => { setServiceId(''); setDeckId(''); setNote('') })
        }}>
        <div className={styles.fields}>
          <Field htmlFor={id+'-service'} label="Dịch vụ"><select id={id+'-service'} value={serviceId} required disabled={busy}
            onChange={event => setServiceId(event.target.value)}>
            <option value="">Chọn dịch vụ</option>{services.map(service => <option key={service.id} value={service.id}>{service.name}</option>)}
          </select></Field>
          <Field htmlFor={id+'-deck'} label="Boong dự kiến phục vụ"><select id={id+'-deck'} value={deckId} required disabled={busy}
            onChange={event => setDeckId(event.target.value)}>
            <option value="">Chọn boong</option>{view.decks.map(deck => <option key={deck.id} value={deck.id}>{deck.name}</option>)}
          </select></Field>
        </div>
        <Field htmlFor={id+'-note'} label="Nhu cầu bố trí" hint="Ghi khu vực mong muốn, số khách và thời gian phục vụ."><textarea
          id={id+'-note'} rows={3} maxLength={500} value={note} required disabled={busy}
          onChange={event => setNote(event.target.value)}/></Field>
        <Button type="submit" busy={busy} disabled={!serviceId || !deckId || !note.trim()}>Gửi đề nghị bố trí</Button>
      </form>}
    </>}
    {error && <Notice tone="error" title="Chưa hoàn tất thao tác">{error}</Notice>}
  </Panel>
}
