import { useCallback, useId, useRef, useState } from 'react'
import { ApiError, apiRequest, useReadQuery } from '@/shared/api'
import { useSessionAccess } from '@/shared/auth'
import { Badge, Button, ButtonLink, Empty, Field, Loading, Notice, Panel } from '@/shared/ui'
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
const statusLabels = { PENDING: 'Chờ Quản lý tàu duyệt', CONFIRMED: 'Đã xác nhận', RETURNED: 'Cần bổ sung' } as const
const statusTones = { PENDING: 'warning', CONFIRMED: 'success', RETURNED: 'error' } as const

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
  const [busyId, setBusyId] = useState<string | null>(null)
  const [errorState, setErrorState] = useState<{ targetId: string | null; message: string; code?: string } | null>(null)
  const lock = useRef(false)
  const view = query.data
  const services = view?.services.filter(service => !view.requests.some(request =>
    request.serviceId === service.id && request.status !== 'RETURNED')) ?? []

  async function submit(url: string, body: object, targetId: string | null, done: () => void) {
    if (lock.current) return
    lock.current = true
    setBusyId(targetId ?? '__form__')
    setErrorState(null)
    try {
      await apiRequest<View>(url, { method: 'POST', body })
      done()
      query.retry()
      onChanged?.()
    } catch (cause) {
      const code = cause instanceof ApiError ? cause.code : undefined
      const message = cause instanceof Error ? cause.message : 'Chưa lưu được. Vui lòng thử lại.'
      setErrorState({ targetId, message, code })
    } finally {
      lock.current = false
      setBusyId(null)
    }
  }

  function review(request: Request, confirm: boolean) {
    void submit(
      `${root}/${encodeURIComponent(request.serviceId)}/review`,
      { revision: request.revision, confirm, note: confirm ? undefined : reason.trim() },
      request.serviceId,
      () => {
        setReturnId('')
        setReason('')
      },
    )
  }

  if (query.error instanceof ApiError && query.error.status === 403) return null

  const pendingCount = view?.requests.filter(item => item.status === 'PENDING').length ?? 0
  const confirmedCount = view?.requests.filter(item => item.status === 'CONFIRMED').length ?? 0
  const returnedCount = view?.requests.filter(item => item.status === 'RETURNED').length ?? 0
  const busy = busyId !== null

  return (
    <Panel title="Danh sách bố trí dịch vụ trên tàu">
      <div className={styles.section}>
        {query.loading && <Loading label="Đang tải đề nghị bố trí dịch vụ…" />}
        {query.error && (
          <Notice tone="error" title="Chưa xem được đề nghị bố trí">
            <Button tone="secondary" size="compact" autoWidth onClick={query.retry}>Thử lại</Button>
          </Notice>
        )}
        {view && (
          <>
            <div className={styles.serviceSummaryBar}>
              <span>Chờ duyệt: <strong>{pendingCount}</strong></span>
              <span>Đã xác nhận: <strong>{confirmedCount}</strong></span>
              {returnedCount > 0 && <span>Cần bổ sung: <strong>{returnedCount}</strong></span>}
              {view.operatingBudgetVnd && (
                <span>Ngân sách vận hành: <strong>{formatOperatingBudget(view.operatingBudgetVnd)}</strong></span>
              )}
            </div>

            {access.roles.includes('ACTIVITY_SERVICE_MANAGER') && (view.canPropose || pendingCount > 0) && (
              view.shipAssigned === false ? (
                <Notice tone="warning" title="Chuyến chưa có Quản lý tàu">
                  Đề nghị sẽ hiển thị trong mục Bố trí dịch vụ của Quản lý tàu ngay khi Quản lý tàu được phân công cho chuyến.
                </Notice>
              ) : (
                <p className={styles.statusNote}>
                  Các đề nghị gửi tại đây sẽ chuyển sang mục Bố trí dịch vụ để Quản lý tàu kiểm tra sơ đồ boong và xác nhận.
                </p>
              )
            )}

            {!view.requests.length && (
              <Empty title="Chưa có đề nghị bố trí dịch vụ nào cho chuyến này" />
            )}

            {view.requests.length > 0 && (
              <ul className={styles.serviceCardList}>
                {view.requests.map(request => {
                  const cardToneClass =
                    request.status === 'CONFIRMED'
                      ? styles.serviceCardConfirmed
                      : request.status === 'RETURNED'
                        ? styles.serviceCardReturned
                        : styles.serviceCardPending
                  const itemError = errorState?.targetId === request.serviceId ? errorState : null
                  const isReturning = returnId === request.serviceId
                  return (
                    <li key={request.serviceId} className={`${styles.serviceCard} ${cardToneClass}`}>
                      <div className={styles.serviceCardHead}>
                        <div>
                          <h4 className={styles.serviceCardTitle}>{request.serviceName}</h4>
                          <span className={styles.serviceDeckTag}>Boong đề xuất: {request.deckName}</span>
                        </div>
                        <Badge
                          tone={request.status === 'PENDING' && view.shipAssigned === false ? 'neutral' : statusTones[request.status]}
                          label={request.status === 'PENDING' && view.shipAssigned === false ? 'Chờ phân công Quản lý tàu' : statusLabels[request.status]}
                        />
                      </div>

                      <div className={styles.serviceNoteBlock}>
                        <strong>Nhu cầu từ Quản lý dịch vụ</strong>
                        <span>{request.note}</span>
                      </div>

                      {request.reviewNote && (
                        <div className={styles.serviceReviewBlock}>
                          <strong>Phản hồi của Quản lý tàu</strong>
                          <span>{request.reviewNote}</span>
                        </div>
                      )}

                      {itemError && (
                        <Notice tone="error" title="Chưa thể xác nhận bố trí cho dịch vụ này">
                          <p>{itemError.message}</p>
                          {itemError.code === 'SERVICE_LOCATION_NOT_AVAILABLE' && (
                            <div className={styles.inlineActions}>
                              <ButtonLink to="/admin/ships" tone="secondary" size="compact" autoWidth>
                                Mở Danh sách tàu để gắn dịch vụ vào boong →
                              </ButtonLink>
                              <Button
                                tone="secondary"
                                size="compact"
                                autoWidth
                                onClick={() => {
                                  setReturnId(request.serviceId)
                                  setReason('Boong đề xuất hiện chưa hỗ trợ dịch vụ này. Vui lòng chọn boong khác phù hợp.')
                                  setErrorState(null)
                                }}
                              >
                                Chuyển sang Yêu cầu đổi boong
                              </Button>
                            </div>
                          )}
                        </Notice>
                      )}

                      {view.canReview && request.status === 'PENDING' && (
                        <div className={styles.serviceCardActions}>
                          {isReturning ? (
                            <div className={styles.serviceReturnForm}>
                              <Field
                                htmlFor={`${id}-reason-${request.serviceId}`}
                                label="Lý do cần bổ sung / đề nghị đổi boong *"
                              >
                                <textarea
                                  id={`${id}-reason-${request.serviceId}`}
                                  rows={2}
                                  maxLength={500}
                                  placeholder="VD: Boong này dành cho phòng ăn, đề nghị chuyển sang Lotus Wellness & Spa Deck."
                                  value={reason}
                                  disabled={busy}
                                  onChange={event => setReason(event.target.value)}
                                />
                              </Field>
                              <div className={styles.inlineActions}>
                                <Button
                                  size="compact"
                                  autoWidth
                                  busy={busyId === request.serviceId}
                                  disabled={busy || !reason.trim()}
                                  onClick={() => review(request, false)}
                                >
                                  Gửi yêu cầu bổ sung
                                </Button>
                                <Button
                                  tone="secondary"
                                  size="compact"
                                  autoWidth
                                  disabled={busy}
                                  onClick={() => {
                                    setReturnId('')
                                    setReason('')
                                  }}
                                >
                                  Hủy
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <Button
                                size="compact"
                                autoWidth
                                busy={busyId === request.serviceId}
                                disabled={busy}
                                onClick={() => review(request, true)}
                              >
                                Xác nhận bố trí
                              </Button>
                              <Button
                                tone="secondary"
                                size="compact"
                                autoWidth
                                disabled={busy}
                                onClick={() => {
                                  setReturnId(request.serviceId)
                                  setReason('')
                                  setErrorState(null)
                                }}
                              >
                                Yêu cầu bổ sung
                              </Button>
                            </>
                          )}
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}

            {view.canPropose && !view.decks.length && (
              <p className={styles.statusNote}>Tàu phân công cho chuyến chưa có danh sách boong để đề nghị bố trí dịch vụ.</p>
            )}

            {view.canPropose && view.decks.length > 0 && services.length > 0 && (
              <form
                className={styles.stepBox}
                onSubmit={event => {
                  event.preventDefault()
                  if (!services.some(service => service.id === serviceId) || !view.decks.some(deck => deck.id === deckId) || !note.trim()) return
                  void submit(root, { serviceId, deckId, note: note.trim() }, '__form__', () => {
                    setServiceId('')
                    setDeckId('')
                    setNote('')
                  })
                }}
              >
                <h4 className={styles.stepTitle}>Gửi đề nghị bố trí dịch vụ mới</h4>
                <div className={styles.fields}>
                  <Field htmlFor={id + '-service'} label="Dịch vụ *">
                    <select
                      id={id + '-service'}
                      value={serviceId}
                      required
                      disabled={busy}
                      onChange={event => setServiceId(event.target.value)}
                    >
                      <option value="">Chọn dịch vụ cần bố trí</option>
                      {services.map(service => (
                        <option key={service.id} value={service.id}>{service.name}</option>
                      ))}
                    </select>
                  </Field>
                  <Field htmlFor={id + '-deck'} label="Boong dự kiến phục vụ *">
                    <select
                      id={id + '-deck'}
                      value={deckId}
                      required
                      disabled={busy}
                      onChange={event => setDeckId(event.target.value)}
                    >
                      <option value="">Chọn boong trên tàu</option>
                      {view.decks.map(deck => (
                        <option key={deck.id} value={deck.id}>{deck.name}</option>
                      ))}
                    </select>
                  </Field>
                </div>
                <Field
                  htmlFor={id + '-note'}
                  label="Nhu cầu bố trí *"
                  hint="Ghi rõ khu vực mong muốn, số khách dự kiến và khung giờ phục vụ để Quản lý tàu đối chiếu."
                >
                  <textarea
                    id={id + '-note'}
                    rows={3}
                    maxLength={500}
                    placeholder="VD: Bố trí khu vực massage thư giãn phục vụ khoảng 20 khách/ca vào khung giờ 14:00–20:00."
                    value={note}
                    required
                    disabled={busy}
                    onChange={event => setNote(event.target.value)}
                  />
                </Field>
                {errorState?.targetId === '__form__' && (
                  <Notice tone="error" title="Chưa gửi được đề nghị">{errorState.message}</Notice>
                )}
                <div className={styles.inlineActions}>
                  <Button type="submit" autoWidth busy={busyId === '__form__'} disabled={busy || !serviceId || !deckId || !note.trim()}>
                    Gửi đề nghị bố trí
                  </Button>
                </div>
              </form>
            )}
          </>
        )}
      </div>
    </Panel>
  )
}
