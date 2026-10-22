import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import { ApiError } from '@/shared/api'
import { useSessionAccess } from '@/shared/auth'
import { Button, ButtonLink, Field, Loading, Notice, PageHeader, Panel } from '@/shared/ui'
import { itineraryApi } from '../api/itinerary-api'
import { ItineraryFrame } from '../components/ItineraryUI'
import { validateItineraryDraft, type ItineraryDraft, type ItineraryType } from '../model/itinerary'
import styles from '../components/Itineraries.module.css'

type Context = Awaited<ReturnType<typeof itineraryApi.formContext>>
const cruiseClock = new Intl.DateTimeFormat('vi-VN', {
  timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
})
function cruiseTime(value: string) {
  const date = new Date(value)
  return Number.isFinite(date.getTime()) ? cruiseClock.format(date) : 'Chưa có thời gian hợp lệ'
}
export function ItineraryFormPage() {
  const access = useSessionAccess()
  const { itineraryId } = useParams()
  const [params] = useSearchParams()
  const editing = Boolean(itineraryId), navigate = useNavigate(), lock = useRef(false), form = useRef<HTMLFormElement>(null)
  const [draft, setDraft] = useState<ItineraryDraft>({ cruiseId: params.get('cruiseId') ?? '', itineraryName: '', startDate: '', endDate: '', itineraryType: '' })
  const [editableId, setEditableId] = useState<string | null>(null)
  const recordReady = !editing || editableId === itineraryId
  const [context, setContext] = useState<Context | null>(null)
  const [contextError, setContextError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [search, setSearch] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [error, setError] = useState(''), [busy, setBusy] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    void itineraryApi.formContext(controller.signal).then(value => {
      if (!controller.signal.aborted) { setContext(value); setContextError('') }
    }).catch((reason: unknown) => {
      if (!controller.signal.aborted) setContextError(reason instanceof Error ? reason.message : 'Không tải được danh sách chuyến.')
    })
    return () => controller.abort()
  }, [attempt])
  useEffect(() => {
    if (!itineraryId) return
    const controller = new AbortController()
    void itineraryApi.get(itineraryId, controller.signal).then(item => {
      if (controller.signal.aborted) return
      setDraft({ cruiseId: item.cruiseId, itineraryName: item.itineraryName, startDate: item.startDate, endDate: item.endDate, itineraryType: item.itineraryType })
      if (item.status === 'DRAFT') setEditableId(item.itineraryId)
      else setError('Chỉ lịch trình ở trạng thái Nháp mới được chỉnh sửa.')
    }).catch((reason: unknown) => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Không tải được lịch trình.') })
    return () => controller.abort()
  }, [itineraryId])

  const cruise = context?.cruises.find(item => item.cruiseId === draft.cruiseId)
  const eligible = context?.cruises.filter(item => !context.itineraries.some(itinerary => itinerary.cruiseId === item.cruiseId && itinerary.itineraryId !== itineraryId)) ?? []
  const options = eligible.filter(item => item.cruiseId === draft.cruiseId || `${item.cruiseCode} ${item.cruiseName}`.toLocaleLowerCase('vi').includes(search.toLocaleLowerCase('vi')))
  function update<K extends keyof ItineraryDraft>(key: K, value: ItineraryDraft[K]) { setDraft(current => ({ ...current, [key]: value })) }
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (lock.current || !recordReady || !access.has(editing ? 'ITINERARY_UPDATE_DRAFT' : 'ITINERARY_CREATE')) return
    const invalid = validateItineraryDraft(draft, context && !contextError ? { ...context, editingId: itineraryId } : null)
    setErrors(invalid); setError('')
    if (Object.keys(invalid).length) { form.current?.querySelector<HTMLElement>(`[name="${Object.keys(invalid)[0]}"]`)?.focus(); return }
    lock.current = true; setBusy(true)
    try {
      const saved = itineraryId ? await itineraryApi.update(itineraryId, draft) : await itineraryApi.create(draft)
      navigate(`/admin/itineraries/${saved.itineraryId}`)
    } catch (reason) { setError(reason instanceof ApiError && reason.status >= 500 ? 'Máy chủ chưa lưu được lịch trình. Dữ liệu đã nhập được giữ lại; vui lòng thử lại sau.' : reason instanceof Error ? reason.message : 'Không lưu được lịch trình. Dữ liệu đã nhập được giữ lại.') }
    finally { lock.current = false; setBusy(false) }
  }
  const field = (name: string) => ({ id: `itinerary-${name}`, name, 'aria-invalid': Boolean(errors[name]), 'aria-describedby': errors[name] ? `itinerary-${name}-hint` : undefined })
  return <ItineraryFrame>
    <PageHeader breadcrumb="THIẾT KẾ CHUYẾN / HẢI TRÌNH" title={editing ? 'Chỉnh sửa lịch trình' : 'Tạo lịch trình'} description="Chọn chuyến du lịch trước, sau đó cấu hình ngày và các cảng ghé. Người tạo được xác định từ tài khoản đang đăng nhập." />
    {!access.has(editing ? 'ITINERARY_UPDATE_DRAFT' : 'ITINERARY_CREATE') && <Notice title="Chưa có quyền lưu lịch trình" tone="warning">{access.status === 'loading' ? 'Đang tải quyền tài khoản…' : access.error || 'Tài khoản chưa có quyền tạo hoặc sửa lịch trình.'}</Notice>}
    {editing && !recordReady && !error && <Loading label="Đang tải lịch trình…" />}
    {!context && !contextError && <Loading label="Đang tải chuyến và lịch trình…" />}
    {contextError && <Notice title="Chưa tải đủ thông tin chuyến" tone="error"><p>{contextError}</p><Button onClick={() => setAttempt(value => value + 1)}>Thử lại</Button></Notice>}
    {context && !editing && !eligible.length && <Notice title="Chưa có chuyến để tạo lịch trình"><p>Chưa có chuyến du lịch hoặc các chuyến hiện có đã có lịch trình.</p><ButtonLink to="/admin/cruises/new">Tạo chuyến du lịch</ButtonLink><ButtonLink to="/admin/itineraries" tone="secondary">Xem lịch trình hiện có</ButtonLink></Notice>}
    <form ref={form} onSubmit={submit} noValidate><Panel title="Thông tin lịch trình"><div className={styles.formGrid}>
      {!editing && <Field htmlFor="cruise-search" label="Tìm chuyến theo tên hoặc mã"><input id="cruise-search" type="search" value={search} onChange={event => setSearch(event.target.value)} /></Field>}
      <Field htmlFor="itinerary-cruiseId" label="Chuyến du lịch *" error={errors.cruiseId}>
        {editing ? <input id="itinerary-cruiseId" name="cruiseId" readOnly value={cruise ? `${cruise.cruiseCode} · ${cruise.cruiseName}` : 'Chưa tải được chuyến liên kết'} />
          : <select {...field('cruiseId')} value={draft.cruiseId} disabled={!context || Boolean(contextError)} onChange={event => update('cruiseId', event.target.value)} required><option value="">Chọn chuyến du lịch</option>{options.map(item => <option key={item.cruiseId} value={item.cruiseId}>{item.cruiseCode} · {item.cruiseName}</option>)}</select>}
      </Field>
      {cruise && <p>Khoảng ngày chuyến (UTC): {cruise.departureDatetime.slice(0, 10)} → {cruise.returnDatetime.slice(0, 10)}. <ButtonLink to={`/admin/cruises/${cruise.cruiseId}`} tone="secondary">Xem chuyến</ButtonLink></p>}
      <Field htmlFor="itinerary-itineraryName" label="Tên lịch trình" hint={editing ? undefined : "Để trống để tạo tên theo chuyến du lịch."} error={errors.itineraryName}><input {...field('itineraryName')} maxLength={200} value={draft.itineraryName} onChange={event => update('itineraryName', event.target.value)} required={editing} /></Field>
      <Field htmlFor="itinerary-startDate" label="Ngày bắt đầu" hint={[
        !editing ? 'Để trống để lấy ngày khởi hành của chuyến.' : '',
        cruise ? `Khởi hành theo Cruise: ${cruiseTime(cruise.departureDatetime)} (giờ Việt Nam). Giờ tham chiếu, không lưu riêng trong lịch trình.` : '',
      ].filter(Boolean).join(' ') || undefined} error={errors.startDate}><input {...field('startDate')} type="date" value={draft.startDate} onChange={event => update('startDate', event.target.value)} required={editing} /></Field>
      <Field htmlFor="itinerary-endDate" label="Ngày kết thúc" hint={[
        !editing ? 'Để trống để lấy ngày kết thúc của chuyến.' : '',
        cruise ? `Kết thúc theo Cruise: ${cruiseTime(cruise.returnDatetime)} (giờ Việt Nam). Giờ tham chiếu, không lưu riêng trong lịch trình.` : '',
      ].filter(Boolean).join(' ') || undefined} error={errors.endDate}><input {...field('endDate')} type="date" value={draft.endDate} onChange={event => update('endDate', event.target.value)} required={editing} /></Field>
      <Field htmlFor="itinerary-itineraryType" label="Loại hành trình" error={errors.itineraryType}><select {...field('itineraryType')} value={draft.itineraryType} onChange={event => update('itineraryType', event.target.value as ItineraryType)}>{!editing && <option value="">Tự xác định theo cảng đi và về</option>}<option value="ROUND_TRIP">Khứ hồi</option><option value="ONE_WAY">Một chiều</option></select></Field>
    </div>{error && <Notice title="Chưa thể lưu" tone="error"><p>{error}</p></Notice>}<div className={styles.actions}><Button tone="secondary" disabled={busy} onClick={() => navigate(editing && itineraryId ? `/admin/itineraries/${itineraryId}` : '/admin/itineraries')}>Hủy</Button><Button type="submit" disabled={busy || !access.has(editing ? 'ITINERARY_UPDATE_DRAFT' : 'ITINERARY_CREATE') || !recordReady || !context || Boolean(contextError) || (!editing && !eligible.length)}>{busy ? 'Đang lưu…' : 'Lưu lịch trình'}</Button></div></Panel></form>
  </ItineraryFrame>
}
