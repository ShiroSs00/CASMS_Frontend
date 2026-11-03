import {ShipVenueDeckField,ShipVenueCabinField,readShipVenueOptions,readShipVenueCabins} from '@/domain/ship-venue'
import {zonedInput,SHIP_TIME_ZONE} from '@/shared/lib/journey-time'
import { EditorLayout,useUnsavedFormGuard } from '@/shared/ui'
import { FormErrorSummary } from '@/shared/ui'
import { useCallback,useEffect, useRef, useState, type FormEvent } from 'react'
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
const blank: ActivityDraft = { activityCode: '', activityName: '', cruiseId: '', description: '', startTime: '', endTime: '', location: '', capacity: NaN, price: null, currencyCode: 'USD' }
function localTime(value:string){return zonedInput(value,SHIP_TIME_ZONE)}
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
  const canReadVenue=access.has('CRUISE_READ')&&access.has('DECK_READ')
  const venue=useReadQuery(`activity-venue:${access.userId}:${draft.cruiseId}:${canReadVenue}`,useCallback(signal=>draft.cruiseId&&canReadVenue?readShipVenueOptions(draft.cruiseId,signal):Promise.resolve(null),[draft.cruiseId,canReadVenue]))
  const shipId=venue.data?.ship.id,deckId=draft.deckId
  const cabins=useReadQuery(`activity-venue-cabins:${access.userId}:${shipId??''}:${deckId??''}:${canReadVenue}`,useCallback(signal=>canReadVenue&&shipId&&deckId&&venue.data?.decks.some(deck=>deck.id===deckId)?readShipVenueCabins(shipId,deckId,signal):Promise.resolve(null),[canReadVenue,shipId,deckId,venue.data]))
  const [baseline,setBaseline]=useState<ActivityDraft>(()=>({...blank,cruiseId:validCruiseContextId(requestedCruise)?requestedCruise:''}))
  const [savedCabin,setSavedCabin]=useState<{id:string;name:string|null}|null>(null)
  const dirty=(Object.keys({...baseline,...draft}) as (keyof ActivityDraft)[]).some(key=>!Object.is(draft[key],baseline[key])),guard=useUnsavedFormGuard(dirty,busy)

  useEffect(() => {
    if (!activityId) return
    const controller = new AbortController()
    void activityApi.get(activityId, controller.signal).then(item => {
      if (controller.signal.aborted) return
      setDraft({ activityCode: item.code, activityName: item.name, cruiseId: item.cruiseId ?? '', description: item.description ?? '', startTime: localTime(item.startTime), endTime: localTime(item.endTime), location: item.location ?? '', capacity: item.capacity, price: item.currencyCode==='USD'?item.price:null, currencyCode: 'USD',deckId:item.deckId??null,cabinId:item.cabinId??null })
      setBaseline({activityCode:item.code,activityName:item.name,cruiseId:item.cruiseId??'',description:item.description??'',startTime:localTime(item.startTime),endTime:localTime(item.endTime),location:item.location??'',capacity:item.capacity,price:item.currencyCode==='USD'?item.price:null,currencyCode:'USD',deckId:item.deckId??null,cabinId:item.cabinId??null})
      setSavedCabin(item.cabinId?{id:item.cabinId,name:item.cabinNumber??null}:null)
      setEditable(item.status === 'PLANNED' && item.cruiseId !== null); setLoadedId(item.id); setError('')
    }).catch((reason: unknown) => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Không tải được hoạt động.') })
    return () => controller.abort()
  }, [activityId, attempt])
  function update<K extends keyof ActivityDraft>(key: K, value: ActivityDraft[K]) { setDraft(current => ({ ...current, [key]: value })) }
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!permitted || lock.current || uncertain || (activityId && (loadedId !== activityId || !editable))) return
    if(params.has('cruiseId')&&(!validCruiseContextId(requestedCruise)||draft.cruiseId!==requestedCruise)){setError('Chuyến khởi hành trong đường dẫn không khớp hoạt động. Mở lại từ hồ sơ cần xử lý.');return}
    const invalid = validateActivity(draft, cruises.data)
    const changedVenue=draft.cruiseId!==baseline.cruiseId||draft.deckId!==baseline.deckId||draft.cabinId!==baseline.cabinId
    if(changedVenue&&(draft.deckId||draft.cabinId)&&(venue.loading||venue.error||!venue.data||!venue.data.decks.some(deck=>deck.id===draft.deckId)))invalid.deckId='Chọn boong thuộc tàu đang gán cho chuyến.'
    if(changedVenue&&draft.cabinId&&(cabins.loading||cabins.error||!cabins.data?.some(c=>c.id===draft.cabinId)))invalid.cabinId='Chọn cabin/phòng thuộc boong và tàu hiện tại.'
    setErrors(invalid); setError('')
    if (Object.keys(invalid).length) { form.current?.querySelector<HTMLElement>(`[name="${Object.keys(invalid)[0]}"]`)?.focus(); return }
    lock.current = true; setBusy(true)
    try { const saved = await activityApi.save(draft, activityId); if(saved.cruiseId!==draft.cruiseId||activityId&&saved.id!==activityId||(saved.deckId??null)!==(draft.deckId??null)||(saved.cabinId??null)!==(draft.cabinId??null))throw new ApiError('Phản hồi chưa xác nhận đúng hoạt động và chuyến khởi hành. Đối chiếu dữ liệu đã lưu trước khi gửi tiếp.',502); if(mounted.current){guard.allowLeave();navigate(returnTo??('/admin/activities/' + saved.id))} }
    catch (reason) { if(mutationOutcomeUnknown(reason))setUncertain(true); setError(mutationOutcomeUnknown(reason) ? 'Chưa xác định kết quả lưu hoạt động. Thông tin đã nhập được giữ lại; đối chiếu danh sách trước khi tạo yêu cầu mới.' : reason instanceof ApiError && reason.message.includes('evaluate expression') ? 'Hệ thống đang gặp lỗi kiểm tra quyền hoạt động. Vui lòng liên hệ quản trị viên.' : reason instanceof Error ? reason.message : 'Chưa lưu được hoạt động.') }
    finally { lock.current = false; setBusy(false) }
  }
  const input = (name: keyof ActivityDraft) => ({ id: 'activity-' + name, name, 'aria-invalid': Boolean(errors[name]), 'aria-describedby': errors[name] ? `activity-${name}-hint` : undefined })
  return <ActivityFrame><PageHeader breadcrumb="DỊCH VỤ TÀU / HOẠT ĐỘNG" title={activityId ? 'Chỉnh sửa hoạt động' : 'Tạo hoạt động trên tàu'} description="Nhập giờ theo giờ tàu Việt Nam. Hoạt động phải nằm trong thời gian chuyến và giới hạn sức chứa." /><ActivityState {...cruises} />
    {!permitted && <Notice title="Không có quyền lưu hoạt động" tone="warning">Liên hệ quản trị viên để được cấp quyền phù hợp.</Notice>}{activityId && loadedId === activityId && !editable && <Notice title={draft.cruiseId?"Chỉ sửa hoạt động đã lên kế hoạch":"Hoạt động nguồn"} tone="warning">{draft.cruiseId?"Hoạt động đang ở trạng thái không cho phép chỉnh sửa.":"Hoạt động này chưa gắn chuyến khởi hành. Biểu mẫu hiện tại chỉ chỉnh sửa hoạt động của chuyến khởi hành."}</Notice>}{error && <Notice title="Chưa thể thực hiện" tone="error"><p>{error}</p>{activityId && loadedId !== activityId && <Button onClick={() => setAttempt(value => value + 1)}>Tải lại hoạt động</Button>}</Notice>}
    {cruises.data && !cruises.data.length && <Notice title="Chưa có chuyến du lịch"><p>Tạo chuyến trước khi lập hoạt động trên tàu.</p><ButtonLink to="/admin/cruises/new">Tạo chuyến</ButtonLink></Notice>}
    <EditorLayout ><form ref={form} onSubmit={submit} noValidate><Panel title="Thông tin hoạt động">
          <FormErrorSummary errors={errors} /><div className={styles.form}>
      <FormSection title="01 · Thông tin hoạt động" >
      <Field htmlFor="activity-cruiseId" label="Chuyến khởi hành *" error={errors.cruiseId}><select disabled={Boolean(activityId||requestedCruise)} {...input('cruiseId')} value={draft.cruiseId} onChange={event=>setDraft(current=>({...current,cruiseId:event.target.value,deckId:null,cabinId:null}))} required><option value="">Chọn chuyến khởi hành</option>{cruises.data?.map(item => <option key={item.cruiseId} value={item.cruiseId}>{item.cruiseCode} · {item.cruiseName}</option>)}</select></Field>
      {(['activityName', 'location'] as const).map(key => <Field key={key} htmlFor={'activity-' + key} label={{ activityName: 'Tên hoạt động *', location: 'Địa điểm', currencyCode: 'Mã tiền tệ' }[key]} error={errors[key]}><input {...input(key)} maxLength={{ activityName: 200, location: 250, currencyCode: 3 }[key]} value={draft[key]} onChange={event => update(key, event.target.value)} /></Field>)}
      {venue.loading&&<p role="status">Đang đối chiếu vị trí trên tàu…</p>}{venue.error&&<Notice title="Chưa đối chiếu được boong" tone="warning">{venue.error.message}<Button tone="secondary" onClick={venue.retry}>Tải lại boong</Button></Notice>}
      {venue.data&&<ShipVenueDeckField id="activity-deck" error={errors.deckId} options={venue.data} value={draft.deckId??null} disabled={!permitted||busy||uncertain||Boolean(activityId&&!editable)} onChange={deckId=>setDraft(old=>({...old,deckId,cabinId:old.deckId===deckId?old.cabinId:null}))}/>}
      {!canReadVenue&&savedCabin&&<p>Cabin/phòng đã lưu: {savedCabin.name??'Chưa có số phòng trong phản hồi'}.</p>}
      {!canReadVenue&&<Notice title="Chưa có quyền chọn địa điểm trên tàu">Cần quyền đọc chuyến khởi hành và boong. Địa điểm đã lưu được giữ nguyên khi sửa thông tin khác.</Notice>}
      {venue.data&&!venue.data.ship.id&&<Notice title="Chuyến chưa được phân công tàu">Phân công tàu trước khi chọn boong hoặc cabin/phòng cho hoạt động.</Notice>}
      {draft.deckId&&canReadVenue&&<>
        {cabins.loading&&<p role="status">Đang tải cabin/phòng của boong…</p>}{cabins.error&&<Notice title="Chưa tải được cabin/phòng" tone="error">{cabins.error.message}<Button tone="secondary" onClick={cabins.retry}>Tải lại cabin/phòng</Button></Notice>}
        <ShipVenueCabinField id="activity-cabin" error={errors.cabinId} value={draft.cabinId??null} cabins={cabins.data??[]} savedName={savedCabin&&savedCabin.id===draft.cabinId?savedCabin.name:null} disabled={!permitted||busy||uncertain||Boolean(activityId&&!editable)||cabins.loading||Boolean(cabins.error)||!cabins.data} onChange={cabinId=>update('cabinId',cabinId)}/>
        {!cabins.loading&&!cabins.error&&cabins.data?.length===0&&<p>Boong này chưa có cabin/phòng trong cấu trúc tàu.</p>}
      </>}

      </FormSection><FormSection title="02 · Thời gian & sức chứa" ><p>Giờ tàu: Việt Nam (Asia/Ho_Chi_Minh).</p>
      {(['startTime', 'endTime'] as const).map(key => <Field key={key} htmlFor={'activity-' + key} label={key === 'startTime' ? 'Bắt đầu *' : 'Kết thúc *'} error={errors[key]}><input {...input(key)} type="datetime-local" value={draft[key]} onChange={event => update(key, event.target.value)} /></Field>)}
      {(['capacity', 'price'] as const).map(key => <Field key={key} htmlFor={'activity-' + key} label={key === 'capacity' ? 'Sức chứa *' : businessCopy('program.field.priceUsd')} error={errors[key]}><input {...input(key)} type="number" min={key === 'capacity' ? 1 : 0} step={key === 'capacity' ? 1 : '0.01'} value={draft[key] === null || Number.isNaN(draft[key]) ? '' : draft[key]} onChange={event => update(key, event.target.value === '' ? key === 'price' ? null : NaN : Number(event.target.value))} /></Field>)}
      </FormSection><FormSection title="03 · Nội dung giới thiệu" >
      <Field htmlFor="activity-description" label="Mô tả" error={errors.description}><textarea {...input('description')} maxLength={1000} value={draft.description} onChange={event => update('description', event.target.value)} /></Field>
      </FormSection>
    </div><div className={styles.actions}><Button tone="secondary" disabled={busy} onClick={() => navigate(activityId ? '/admin/activities/' + activityId : '/admin/activities')}>Hủy</Button><Button type="submit" disabled={!permitted || uncertain || Boolean(activityId && !editable) || busy || !cruises.data?.length || Boolean(activityId && loadedId !== activityId)}>{busy ? 'Đang lưu…' : 'Lưu hoạt động'}</Button></div></Panel></form></EditorLayout>
  {guard.prompt}</ActivityFrame>
}




