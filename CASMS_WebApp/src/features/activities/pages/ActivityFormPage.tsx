import { EditorLayout } from '@/shared/ui'
import { FormErrorSummary } from '@/shared/ui'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import { cruiseContextReturn, validCruiseContextId } from '@/shared/lib/cruise-context'
import { mutationOutcomeUnknown } from '@/shared/lib/mutation-outcome'
import { ApiError, useReadQuery } from '@/shared/api'
import { Button, ButtonLink, Field, FormSection, Notice, PageHeader, Panel } from '@/shared/ui'
import { useSessionAccess } from '@/shared/auth'
import {businessCopy} from '@/shared/i18n/business-copy'
import { activityApi } from '../api/activity-api'
import { ActivityFrame, ActivityState } from '../components/ActivityUI'
import { validateActivity, type ActivityDraft } from '../model/activity'
import styles from '../components/Activities.module.css'
const blank: ActivityDraft = { activityCode: '', activityName: '', cruiseId: '', description: '', startTime: '', endTime: '', location: '', capacity: 1, price: 0, currencyCode: 'USD' }
function localTime(value: string) { const date = new Date(value); return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16) }
export function ActivityFormPage() {
  const { activityId } = useParams(), [params] = useSearchParams()
  return <ActivityEditor key={JSON.stringify([activityId, params.get('cruiseId'), params.get('returnTo')])} />
}
function ActivityEditor() {
  const { activityId } = useParams(), navigate = useNavigate(), lock = useRef(false), form = useRef<HTMLFormElement>(null)
  const access = useSessionAccess()
  const mounted=useRef(true)
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false}},[])
  const [params]=useSearchParams(),requestedCruise=params.get('cruiseId')
  const returnTo=cruiseContextReturn(params.get('returnTo'),requestedCruise)
  const [editable, setEditable] = useState(false)
  const [uncertain,setUncertain]=useState(false)
  const permitted = access.canDo(activityId ? 'ACTIVITY_UPDATE' : 'ACTIVITY_CREATE')
  const cruises = useReadQuery('activity-cruises', activityApi.cruises)
  const [draft, setDraft] = useState<ActivityDraft>(()=>({...blank,cruiseId:validCruiseContextId(requestedCruise)?requestedCruise:''})), [errors, setErrors] = useState<Record<string, string>>({})
  const [error, setError] = useState(''), [busy, setBusy] = useState(false), [loadedId, setLoadedId] = useState<string | null>(null), [attempt, setAttempt] = useState(0)
  useEffect(() => {
    if (!activityId) return
    const controller = new AbortController()
    void activityApi.get(activityId, controller.signal).then(item => {
      if (controller.signal.aborted) return
      setDraft({ activityCode: item.code, activityName: item.name, cruiseId: item.cruiseId ?? '', description: item.description ?? '', startTime: localTime(item.startTime), endTime: localTime(item.endTime), location: item.location ?? '', capacity: item.capacity, price: item.currencyCode==='USD'?item.price:null, currencyCode: 'USD' })
      setEditable(item.status === 'PLANNED' && item.cruiseId !== null); setLoadedId(item.id); setError('')
    }).catch((reason: unknown) => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Không tải được hoạt động.') })
    return () => controller.abort()
  }, [activityId, attempt])
  function update<K extends keyof ActivityDraft>(key: K, value: ActivityDraft[K]) { setDraft(current => ({ ...current, [key]: value })) }
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!permitted || lock.current || uncertain || (activityId && (loadedId !== activityId || !editable))) return
    if(params.has('cruiseId')&&(!validCruiseContextId(requestedCruise)||draft.cruiseId!==requestedCruise)){setError('Lần khởi hành trong đường dẫn không khớp hoạt động. Mở lại từ hồ sơ cần xử lý.');return}
    const invalid = validateActivity(draft, cruises.data)
    setErrors(invalid); setError('')
    if (Object.keys(invalid).length) { form.current?.querySelector<HTMLElement>(`[name="${Object.keys(invalid)[0]}"]`)?.focus(); return }
    lock.current = true; setBusy(true)
    try { const saved = await activityApi.save(draft, activityId); if(saved.cruiseId!==draft.cruiseId||activityId&&saved.id!==activityId)throw new ApiError('Phản hồi chưa xác nhận đúng hoạt động và lần khởi hành. Đối chiếu dữ liệu đã lưu trước khi gửi tiếp.',502); if(mounted.current)navigate(returnTo??('/admin/activities/' + saved.id)) }
    catch (reason) { if(mutationOutcomeUnknown(reason))setUncertain(true); setError(mutationOutcomeUnknown(reason) ? 'Chưa xác định kết quả lưu hoạt động. Thông tin đã nhập được giữ lại; đối chiếu danh sách trước khi tạo yêu cầu mới.' : reason instanceof ApiError && reason.message.includes('evaluate expression') ? 'Hệ thống đang gặp lỗi kiểm tra quyền hoạt động. Vui lòng liên hệ quản trị viên.' : reason instanceof Error ? reason.message : 'Chưa lưu được hoạt động.') }
    finally { lock.current = false; setBusy(false) }
  }
  const input = (name: keyof ActivityDraft) => ({ id: 'activity-' + name, name, 'aria-invalid': Boolean(errors[name]), 'aria-describedby': errors[name] ? `activity-${name}-hint` : undefined })
  return <ActivityFrame><PageHeader breadcrumb="DỊCH VỤ TÀU / HOẠT ĐỘNG" title={activityId ? 'Chỉnh sửa hoạt động' : 'Tạo hoạt động trên tàu'} description={`Nhập giờ theo ${Intl.DateTimeFormat().resolvedOptions().timeZone}. Hoạt động phải nằm trong thời gian chuyến và giới hạn sức chứa.`} /><ActivityState {...cruises} />
    {!permitted && <Notice title="Không có quyền lưu hoạt động" tone="warning">Liên hệ quản trị viên để được cấp quyền phù hợp.</Notice>}{activityId && loadedId === activityId && !editable && <Notice title={draft.cruiseId?"Chỉ sửa hoạt động đã lên kế hoạch":"Hoạt động nguồn"} tone="warning">{draft.cruiseId?"Hoạt động đang ở trạng thái không cho phép chỉnh sửa.":"Hoạt động này chưa gắn lần khởi hành. Biểu mẫu hiện tại chỉ chỉnh sửa hoạt động của lần khởi hành."}</Notice>}{error && <Notice title="Chưa thể thực hiện" tone="error"><p>{error}</p>{activityId && loadedId !== activityId && <Button onClick={() => setAttempt(value => value + 1)}>Tải lại hoạt động</Button>}</Notice>}
    {cruises.data && !cruises.data.length && <Notice title="Chưa có chuyến du lịch"><p>Tạo chuyến trước khi lập hoạt động trên tàu.</p><ButtonLink to="/admin/cruises/new">Tạo chuyến</ButtonLink></Notice>}
    <EditorLayout ><form ref={form} onSubmit={submit} noValidate><Panel title="Thông tin hoạt động">
          <FormErrorSummary errors={errors} /><div className={styles.form}>
      <FormSection title="01 · Thông tin hoạt động" >
      <Field htmlFor="activity-cruiseId" label="Lần khởi hành *" error={errors.cruiseId}><select disabled={Boolean(activityId||requestedCruise)} {...input('cruiseId')} value={draft.cruiseId} onChange={event => update('cruiseId', event.target.value)} required><option value="">Chọn lần khởi hành</option>{cruises.data?.map(item => <option key={item.cruiseId} value={item.cruiseId}>{item.cruiseCode} · {item.cruiseName}</option>)}</select></Field>
      {(['activityName', 'location'] as const).map(key => <Field key={key} htmlFor={'activity-' + key} label={{ activityName: 'Tên hoạt động *', location: 'Địa điểm', currencyCode: 'Mã tiền tệ' }[key]} error={errors[key]}><input {...input(key)} maxLength={{ activityName: 200, location: 250, currencyCode: 3 }[key]} value={draft[key]} onChange={event => update(key, event.target.value)} /></Field>)}
      </FormSection><FormSection title="02 · Thời gian & sức chứa" >
      {(['startTime', 'endTime'] as const).map(key => <Field key={key} htmlFor={'activity-' + key} label={key === 'startTime' ? 'Bắt đầu *' : 'Kết thúc *'} error={errors[key]}><input {...input(key)} type="datetime-local" value={draft[key]} onChange={event => update(key, event.target.value)} /></Field>)}
      {(['capacity', 'price'] as const).map(key => <Field key={key} htmlFor={'activity-' + key} label={key === 'capacity' ? 'Sức chứa *' : businessCopy('program.field.priceUsd')} error={errors[key]}><input {...input(key)} type="number" min={key === 'capacity' ? 1 : 0} step={key === 'capacity' ? 1 : '0.01'} value={draft[key] === null || Number.isNaN(draft[key]) ? '' : draft[key]} onChange={event => update(key, event.target.value === '' ? key === 'price' ? null : NaN : Number(event.target.value))} /></Field>)}
      </FormSection><FormSection title="03 · Nội dung giới thiệu" >
      <Field htmlFor="activity-description" label="Mô tả" error={errors.description}><textarea {...input('description')} maxLength={1000} value={draft.description} onChange={event => update('description', event.target.value)} /></Field>
      </FormSection>
    </div><div className={styles.actions}><Button tone="secondary" disabled={busy} onClick={() => navigate(activityId ? '/admin/activities/' + activityId : '/admin/activities')}>Hủy</Button><Button type="submit" disabled={!permitted || uncertain || Boolean(activityId && !editable) || busy || !cruises.data?.length || Boolean(activityId && loadedId !== activityId)}>{busy ? 'Đang lưu…' : 'Lưu hoạt động'}</Button></div></Panel></form></EditorLayout>
  </ActivityFrame>
}
