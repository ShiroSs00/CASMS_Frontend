import {CruisePackageAddons} from './Addons'
import {CruisePackageMappingEvidence} from './cabin-mapping'
import { useCallback, useState, type FormEvent, type ReactNode } from 'react'
import { useReadQuery } from '@/shared/api'
import { useSessionAccess } from '@/shared/auth'
import { cabinTypeLabel } from '@/shared/i18n/business-copy'
import { Badge, Button, ButtonLink, Empty, Field, Modal, Notice, Panel, UnsavedForms, useFormChanges } from '@/shared/ui'
import { cruisePackageApi, type Benefit, type CruisePackageContext, type CruisePackageOffer, type OfferInput } from './api'
import {QueryState} from './Workspace'
import {useShipPackageTemplates} from './ship-template-options'
import {inclusionLabels,lifecycle} from './labels'
import {useCruisePackageMutation} from './useCruisePackageMutation'
import styles from './Workspace.module.css'
import {benefitQuantity} from './benefit-copy'
import { journeyTime, wallTimeToInstant, zonedInput, SHIP_TIME_ZONE } from '@/shared/lib/journey-time'

type Run=(action:()=>Promise<unknown>,message:string)=>Promise<boolean>

const offerConditionCopy: Record<string,string> = {
  OFFER_NOT_PUBLISHED:'Gói chưa được phát hành.',
  TEMPLATE_NOT_PUBLISHED:'Cần dùng phiên bản mẫu đã phát hành.',
  SHIP_CHANGED:'Cần kiểm tra lại gói sau khi đổi tàu.',
  PRICE_NOT_APPROVED:'Giá cần được Quản lý vận hành duyệt.',
  OUTSIDE_SALES_WINDOW:'Chưa ở trong thời gian bán của gói.',
  CABIN_MAPPING_INVENTORY_UNAVAILABLE:'Hạng phòng chưa có cabin khả dụng.',
  BENEFIT_OCCURRENCE_UNBOUND:'Cần chọn lần phục vụ cho quyền lợi còn thiếu.',
  SERVICE_NOT_AVAILABLE_ON_SHIP:'Cần bố trí dịch vụ đang hoạt động trên tàu.',
  BENEFIT_OCCURRENCE_WRONG_CRUISE:'Cần chọn lần phục vụ thuộc chuyến này.',
  INCLUDED_BENEFIT_UNAVAILABLE:'Quyền lợi đi kèm chưa có suất phục vụ khả dụng.',
}

function toInputDateTime(iso?: string | null): string {
  if (!iso) return ''
  try {
    return zonedInput(iso, SHIP_TIME_ZONE).slice(0, 16)
  } catch {
    const d = new Date(iso)
    if (isNaN(d.getTime())) return ''
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  }
}

function useOfferTemplateVersions(shipId: string | null | undefined, templateId: string | undefined, versionId: string) {
  return useReadQuery(
    `fare-offer-versions:${shipId ?? ''}:${templateId ?? ''}:${versionId}`,
    useCallback(signal => templateId ? cruisePackageApi.versions(templateId, signal) : Promise.resolve([]), [templateId]),
  )
}

function OfferForm({
  cruiseId,
  disabled,
  run,
  existing,
  onClose,
  busy,
  feedback,
  context,
  shipName,
  templates
}: {
  cruiseId: string
  disabled: boolean
  run: Run
  existing?: CruisePackageOffer
  onClose?: () => void
  busy?: boolean
  feedback?: ReactNode
  context?: CruisePackageContext | null
  shipName?: string | null
  templates: ReturnType<typeof useShipPackageTemplates>
}) {
  const [versionId, setVersionId] = useState('')
  const [logical, setLogical] = useState('')
  const [editedStart, setStart] = useState<string | null>(null)
  const [editedEnd, setEnd] = useState<string | null>(null)
  const [validation, setValidation] = useState('')

  const choices = templates.data?.filter(template => !existing ||
    template.templateId === existing.template.version.templateId && template.templateVersionId !== existing.offer.templateVersionId) ?? []
  const source = choices.find(choice => choice.templateVersionId === versionId)
  const versions = useOfferTemplateVersions(context?.shipId, source?.templateId, versionId)
  const selected = versions.data?.find(version => version.version.id === source?.templateVersionId &&
    version.version.status === 'PUBLISHED' && version.version.sourceShipId === context?.shipId)
  const references = selected?.logicalCategoryReferences.filter(reference =>
    reference.cabinType && source?.cabinTypes.includes(reference.cabinType)) ?? []
  const category = references.find(reference => reference.id === logical)
  const prefix = existing?.offer.id ?? 'new'

  const minSalesStart = toInputDateTime(context?.bookingOpensAt)
  const maxSalesEnd = toInputDateTime(context?.bookingClosesAt ?? context?.departureDatetime)
  const todayStart = toInputDateTime(new Date().toISOString())
  const start = editedStart ?? (existing ? toInputDateTime(existing.offer.salesStart) : (minSalesStart || todayStart))
  const end = editedEnd ?? (existing ? toInputDateTime(existing.offer.salesEnd) : maxSalesEnd)
  useFormChanges(Boolean(versionId || logical) || editedStart !== null || editedEnd !== null)

  const applyCruiseBookingWindow = () => {
    if (minSalesStart) setStart(minSalesStart)
    if (maxSalesEnd) setEnd(maxSalesEnd)
    setValidation('')
  }


  const unavailable = disabled || templates.loading || versions.loading || Boolean(templates.error || versions.error)
  const formId = 'departure-offer-' + prefix
  const submit = (
    <Button
      type="submit"
      form={formId}
      disabled={unavailable || !selected || !category?.cabinType || !start || !end}
    >
      {existing ? 'Lưu cấu hình nâng phiên bản' : 'Lưu gói nháp'}
    </Button>
  )

  const form = (
    <form
      id={formId}
      className={styles.form}
      noValidate
      onSubmit={async e => {
        e.preventDefault()
        if (unavailable || !selected || !category?.cabinType) return
        setValidation('')
        let salesStart: string, salesEnd: string
        try {
          salesStart = wallTimeToInstant(start, SHIP_TIME_ZONE)
          salesEnd = wallTimeToInstant(end, SHIP_TIME_ZONE)
        } catch {
          setValidation('Nhập thời gian bán hợp lệ theo giờ Việt Nam.')
          return
        }
        const parsedStart = Date.parse(salesStart)
        const parsedEnd = Date.parse(salesEnd)
        if (!start || !end || isNaN(parsedStart) || isNaN(parsedEnd) || parsedStart >= parsedEnd) {
          setValidation('Chọn hạng phòng và thời gian bán hợp lệ; thời điểm bắt đầu phải trước kết thúc.')
          return
        }
        if (context?.bookingOpensAt && parsedStart < Date.parse(context.bookingOpensAt)) {
          setValidation('Thời gian bắt đầu bán không được trước thời gian mở nhận đặt chỗ của chuyến (' + journeyTime(context.bookingOpensAt) + ').')
          return
        }
        if (context?.bookingClosesAt && parsedEnd > Date.parse(context.bookingClosesAt)) {
          setValidation('Thời gian kết thúc bán không được sau thời gian đóng nhận đặt chỗ của chuyến (' + journeyTime(context.bookingClosesAt) + ').')
          return
        }
        const input: OfferInput = {
          templateVersionId: selected.version.id,
          logicalCategory: category.name,
          logicalCategoryId: category.id,
          proposedCabinType: category.cabinType,
          salesStart,
          salesEnd
        }
        const ok = await run(
          () => existing ? cruisePackageApi.upgradeOffer(cruiseId, existing.offer.id, existing.offer.revision, input) : cruisePackageApi.createOffer(cruiseId, input),
          existing ? 'Đã lưu cấu hình nâng phiên bản. Cần liên kết lại quyền lợi và tạo phiên bản giá mới.' : 'Đã lưu gói du thuyền nháp của chuyến. Chưa phát hành hoặc mở bán.'
        )
        if (ok) {
          onClose?.()
          setVersionId('')
          setLogical('')
          setStart(null)
          setEnd(null)
        }
      }}
    >
      {existing && <Notice tone="warning" title="Gói sẽ trở về bản nháp">
        Kiểm tra lại quyền lợi và tạo giá cho phiên bản mới.
      </Notice>}
      <QueryState loading={templates.loading || versions.loading} error={templates.error ?? versions.error} />
      {(templates.error || versions.error) && (
        <Button tone="secondary" onClick={() => { templates.retry(); versions.retry() }}>
          Tải lại lựa chọn
        </Button>
      )}

      {!existing && templates.data?.length === 0 && (
        <Notice title="Tàu chưa có mẫu gói đã phát hành" tone="warning">
          <p>Chọn tàu này khi tạo mẫu rồi phát hành để dùng cho chuyến.</p>
          <ButtonLink tone="secondary" to="/admin/cruise-package-templates">Mở danh sách mẫu gói</ButtonLink>
        </Notice>
      )}

      {validation && <Notice tone="error" title="Cần kiểm tra thông tin gói">{validation}</Notice>}

      <section className={styles.offerSourceFields} aria-labelledby={`fare-source-${prefix}`}>
        <h4 id={`fare-source-${prefix}`}>Mẫu gói và hạng cabin</h4>
        {shipName && <p>Tàu áp dụng <strong>{shipName}</strong></p>}
        <Field htmlFor={`fare-version-${prefix}`} label="Mẫu gói đã phát hành">
          <select
            id={`fare-version-${prefix}`}
            required
            value={source?.templateVersionId ?? ''}
            disabled={disabled || templates.loading || Boolean(templates.error) || !choices.length}
            onChange={event => {
              setVersionId(event.target.value)
              setLogical('')
              setValidation('')
            }}
          >
            <option value="">Chọn mẫu gói</option>
            {choices.map(choice => (
              <option key={choice.templateVersionId} value={choice.templateVersionId}>{choice.name}</option>
            ))}
          </select>
        </Field>
        {source && !versions.loading && !versions.error && !references.length && (
          <Notice title="Mẫu gói chưa dùng được trên tàu này" tone="warning">
            Kiểm tra hạng cabin trong mẫu hoặc chọn mẫu khác.
          </Notice>
        )}
        {selected && references.length > 0 && (
          <Field htmlFor={`fare-logical-${prefix}`} label="Hạng cabin trên tàu"
            hint="Quản lý tàu xác nhận các cabin cụ thể trước khi mở bán.">
            <select
              id={`fare-logical-${prefix}`}
              required
              value={category?.id ?? ''}
              disabled={unavailable}
              onChange={event => {
                setLogical(event.target.value)
                setValidation('')
              }}
            >
              <option value="">Chọn hạng cabin</option>
              {references.map(reference => (
                <option key={reference.id} value={reference.id}>{cabinTypeLabel(reference.cabinType ?? '')}</option>
              ))}
            </select>
          </Field>
        )}
      </section>

      <div className={styles.stepGroup}>
        <div className={styles.stepHeader}>
          <h4 className={styles.stepTitle}>
            Thời gian mở bán gói du thuyền
          </h4>
          {context && (context.bookingOpensAt || context.bookingClosesAt) && (
            <Button
              type="button"
              tone="secondary"
              onClick={applyCruiseBookingWindow}
              disabled={unavailable}
            >
              Đặt theo khung nhận đặt chỗ của chuyến
            </Button>
          )}
        </div>

        {context && (context.bookingOpensAt || context.bookingClosesAt || context.departureDatetime) && (
          <div className={styles.windowCard}>
            <div className={styles.windowHeader}>
              <span className={styles.windowTitle}>
                Khung nhận đặt chỗ của chuyến khởi hành
              </span>
            </div>
            <div className={styles.windowFacts}>
              <div className={styles.windowFactItem}>
                <span className={styles.windowFactLabel}>Mở nhận đặt chỗ</span>
                <span className={styles.windowFactValue}>
                  {context.bookingOpensAt ? journeyTime(context.bookingOpensAt) : 'Chưa thiết lập'}
                </span>
              </div>
              <div className={styles.windowFactItem}>
                <span className={styles.windowFactLabel}>Đóng nhận đặt chỗ</span>
                <span className={styles.windowFactValue}>
                  {context.bookingClosesAt ? journeyTime(context.bookingClosesAt) : 'Chưa thiết lập'}
                </span>
              </div>
              <div className={styles.windowFactItem}>
                <span className={styles.windowFactLabel}>Giờ khởi hành chuyến</span>
                <span className={styles.windowFactValue}>
                  {context.departureDatetime ? journeyTime(context.departureDatetime) : 'Chưa thiết lập'}
                </span>
              </div>
            </div>
          </div>
        )}

        <p className={styles.stepDesc}>
          Thời gian khách hàng có thể đặt mua gói du thuyền này. Khoảng thời gian bán cần nằm trong khung nhận đặt chỗ của chuyến khởi hành.
        </p>

        <div className={styles.fieldGrid2}>
          <Field
            htmlFor={`fare-start-${prefix}`}
            label="Bắt đầu bán"
            hint={context?.bookingOpensAt ? `Khung mở từ: ${journeyTime(context.bookingOpensAt)}` : 'Thời điểm mở nhận đặt chỗ cho gói'}
          >
            <input
              id={`fare-start-${prefix}`}
              required
              type="datetime-local"
              value={start}
              min={minSalesStart || undefined}
              max={maxSalesEnd || undefined}
              disabled={unavailable}
              onChange={e => {
                setStart(e.target.value)
                setValidation('')
              }}
            />
          </Field>

          <Field
            htmlFor={`fare-end-${prefix}`}
            label="Kết thúc bán"
            hint={context?.bookingClosesAt ? `Khung đóng lúc: ${journeyTime(context.bookingClosesAt)}` : 'Thời điểm đóng nhận đặt chỗ cho gói'}
          >
            <input
              id={`fare-end-${prefix}`}
              required
              type="datetime-local"
              value={end}
              min={minSalesStart || undefined}
              max={maxSalesEnd || undefined}
              disabled={unavailable}
              onChange={e => {
                setEnd(e.target.value)
                setValidation('')
              }}
            />
          </Field>
        </div>

        <p className={styles.templateHint}>
          Hiển thị theo giờ Việt Nam (UTC+7).
        </p>
      </div>

      {!onClose && submit}
    </form>
  )

  if (!onClose) return form
  return (
    <Modal
      variant="drawer"
      large
      title={existing ? 'Áp dụng phiên bản mẫu khác' : 'Thêm gói du thuyền'}
      busy={busy}
      onClose={onClose}
      footer={
        <>
          <Button tone="secondary" disabled={busy} data-overlay-dismiss onClick={onClose}>Hủy</Button>
          {submit}
        </>
      }
    >
      {feedback}
      {form}
    </Modal>
  )
}
function BenefitBinding({item,benefit,cruiseId,disabled,run}:{item:CruisePackageOffer;benefit:Benefit;cruiseId:string;disabled:boolean;run:Run}) {
  const [occurrence,setOccurrence]=useState('')
  const type=benefit.onboardActivityId?'ACTIVITY':benefit.shoreExcursionId?'EXCURSION':'SERVICE'
  const bindings=item.bindings.filter(binding=>binding.benefitId===benefit.id)
  const usedIds=item.bindings.flatMap(binding=>[binding.onboardActivityId,binding.shoreExcursionId,binding.serviceId].filter((id):id is string=>Boolean(id)))
  const serviceId=benefit.serviceId
  const canLink=!disabled&&benefit.inclusion!=='NOT_INCLUDED'
  const canPick=canLink&&(!serviceId||!usedIds.includes(serviceId))
  const resources=useReadQuery(`fare-binding-options:${cruiseId}:${type}:${canPick}`,
    useCallback(signal=>canPick?cruisePackageApi.resources(type,cruiseId,signal):Promise.resolve([]),[canPick,cruiseId,type]))
  const options=resources.data?.filter(resource=>!usedIds.includes(resource.id)&&(!serviceId||resource.id===serviceId))??[]
  useFormChanges(Boolean(occurrence&&!usedIds.includes(occurrence)))
  const name=item.template.resourceNames[benefit.id]??'Chưa đọc được tên quyền lợi'
  const link=(id:string)=>run(()=>cruisePackageApi.bind(cruiseId,item.offer.id,item.offer.revision,benefit.id,id),'Đã liên kết quyền lợi.')
  return <div className={styles.offerRow}>
    <div>
      <strong>{name}</strong>
      <p className={styles.offerMeta}>{inclusionLabels[benefit.inclusion]}{benefit.quantityLimit!=null&&` · ${benefitQuantity(benefit.quantityLimit,benefit)}`}</p>
      {bindings.length>0&&<ul>{bindings.map(binding=><li key={binding.id}>{item.bindingNames[binding.id]??'Đã liên kết'}</li>)}</ul>}
    </div>
    {canPick&&<div className={styles.bindingAction}>
      {resources.loading&&<p className={styles.offerMeta} role="status">Đang tải lần phục vụ…</p>}
      {resources.error&&<Button tone="secondary" autoWidth onClick={resources.retry}>Thử tải lại</Button>}
      {resources.data&&options.length===0&&<p className={styles.offerMeta}>
        {serviceId?'Cần bố trí dịch vụ trên tàu.':bindings.length===0?'Cần thêm lần phục vụ vào chương trình chuyến.':''}
      </p>}
      {serviceId&&options.length>0&&<Button tone="secondary" autoWidth onClick={()=>void link(serviceId)}>Liên kết dịch vụ</Button>}
      {!serviceId&&options.length>0&&<div className={styles.bindingControls}>
        <Field htmlFor={`fare-binding-${item.offer.id}-${benefit.id}`} label="Lần phục vụ">
          <select id={`fare-binding-${item.offer.id}-${benefit.id}`} value={occurrence} onChange={event=>setOccurrence(event.target.value)}>
            <option value="">Chọn lần phục vụ</option>
            {options.map(option=><option key={option.id} value={option.id}>{option.name}</option>)}
          </select>
        </Field>
        <Button autoWidth tone="secondary" disabled={!options.some(option=>option.id===occurrence)} onClick={()=>void link(occurrence)}>Liên kết</Button>
      </div>}
    </div>}
  </div>
}
function OfferCard({item,context,disabled,run,shipName,feedback,templates}:{shipName?:string|null;item:CruisePackageOffer;context:CruisePackageContext;disabled:boolean;run:Run;feedback:ReactNode;templates:ReturnType<typeof useShipPackageTemplates>}) {
  const access=useSessionAccess(),[amount,setAmount]=useState(''),[upgrade,setUpgrade]=useState(false),[editingWindow,setEditingWindow]=useState(false),[winStart,setWinStart]=useState(''),[winEnd,setWinEnd]=useState(''),[winError,setWinError]=useState(''),[addingPrice,setAddingPrice]=useState(false),[reasons,setReasons]=useState<Record<string,string>>({})
  useFormChanges(Boolean(amount||editingWindow||item.prices.some(price=>price.status==='SUBMITTED'&&reasons[price.id]?.trim())))
  const configure=context.canConfigure,checker=context.canReviewPrice,cruiseId=context.cruiseId,unified=context.unifiedPackageReview
  const canEditWindow=(configure||access.canDo('CRUISE_UPDATE_DRAFT'))&&!item.offer.saleEnabled&&context.planStatus!=='SUBMITTED'&&context.planStatus!=='APPROVED'
  function openWindowEditor(){
    setWinStart(toInputDateTime(item.offer.salesStart))
    setWinEnd(toInputDateTime(item.offer.salesEnd))
    setWinError('')
    setEditingWindow(true)
  }
  async function saveSalesWindow(e:FormEvent){
    e.preventDefault()
    setWinError('')
    let s:string,endIso:string
    try{
      s=wallTimeToInstant(winStart,SHIP_TIME_ZONE)
      endIso=wallTimeToInstant(winEnd,SHIP_TIME_ZONE)
    }catch{
      setWinError('Nhập thời gian bán hợp lệ theo giờ Việt Nam.')
      return
    }
    if(Date.parse(s)>=Date.parse(endIso)){
      setWinError('Thời điểm bắt đầu bán phải trước thời điểm kết thúc.')
      return
    }
    const ok=await run(()=>cruisePackageApi.updateSalesWindow(cruiseId,item.offer.id,item.offer.revision,s,endIso),'Đã cập nhật thời gian mở bán của gói du thuyền.')
    if(ok) setEditingWindow(false)
  }
  const templateId=item.template.version.templateId
  const canUpgrade=configure&&Boolean(templates.data?.some(template =>
    template.templateId === templateId && template.templateVersionId !== item.offer.templateVersionId))
  const price=item.prices.filter(entry=>entry.templateVersionId===item.offer.templateVersionId
    &&entry.offerCommercialRevision===item.offer.commercialRevision)
    .reduce<typeof item.prices[number]|null>((latest,entry)=>!latest||entry.revisionNumber>latest.revisionNumber?entry:latest,null)
  const blockers=[...new Set(item.eligibility.blockers.map(blocker=>offerConditionCopy[blocker.code]
    ??(blocker.code.startsWith('CABIN_MAPPING_')?'Quản lý tàu cần xác nhận cabin cho hạng phòng này.':blocker.message)))]
  const needsBenefits=item.eligibility.blockers.some(({code})=>[
    'BENEFIT_OCCURRENCE_UNBOUND','SERVICE_NOT_AVAILABLE_ON_SHIP','BENEFIT_OCCURRENCE_WRONG_CRUISE',
  ].includes(code))
  const canStartPrice=context.canCreatePrice&&(!price||price.status==='RETURNED'||price.status==='APPROVED')
  const closePrice=()=>{setAmount('');setAddingPrice(false)}
  const validAmount=/^\d{1,15}(\.\d{1,4})?$/.test(amount)
  const benefits=item.template.benefits
  const linkedCount=benefits.filter(benefit=>item.bindings.some(binding=>binding.benefitId===benefit.id)).length
  return <article className={styles.offerCard}>
    <header className={styles.offerHeader}>
      <div>
        <h3>{item.template.version.name}</h3>
        <p className={styles.offerMeta}>{item.offer.logicalCategory} · Mẫu phiên bản {item.template.version.versionNumber}</p>
      </div>
      <div className={styles.offerPriceSummary}>
        <strong>{price?`${new Intl.NumberFormat('vi-VN',{maximumFractionDigits:4}).format(Number(price.amount))} ${price.currencyCode}/người`:'Chưa có giá'}</strong>
        {price&&<Badge label={lifecycle[price.status]} tone={price.status==='APPROVED'?'success':price.status==='RETURNED'?'error':'warning'}/>}
      </div>
    </header>
    <fieldset className={styles.controls} disabled={disabled} aria-label={`Gói du thuyền ${item.template.version.name}, ${item.offer.logicalCategory}`}>
      <details className={styles.offerSection} open>
        <summary><span>Thông tin gói</span></summary>
        <div className={styles.offerBody}>
          <p className={styles.offerMeta}>{cabinTypeLabel(item.offer.proposedCabinType)} · {journeyTime(item.offer.salesStart)} – {journeyTime(item.offer.salesEnd)} (giờ Việt Nam)</p>
          <CruisePackageMappingEvidence shipName={context.shipId===item.offer.shipId?shipName:null} mapping={item.cabinMapping}/>
          <div className={styles.listActions}>
            {canEditWindow&&!editingWindow&&<Button autoWidth tone="secondary" onClick={openWindowEditor}>Chỉnh sửa thời gian bán</Button>}
            {canUpgrade&&<Button autoWidth tone="secondary" onClick={()=>setUpgrade(true)}>Áp dụng phiên bản mẫu khác</Button>}
          </div>
          {editingWindow&&<form className={styles.form} noValidate onSubmit={e=>void saveSalesWindow(e)}>
            <div className={styles.listActions}>
              <Button type="button" autoWidth size="compact" tone="secondary" onClick={()=>setWinStart(toInputDateTime(new Date().toISOString()))}>Bắt đầu từ hôm nay</Button>
              {context.bookingOpensAt&&<Button type="button" autoWidth size="compact" tone="secondary" onClick={()=>{setWinStart(toInputDateTime(context.bookingOpensAt));if(context.bookingClosesAt)setWinEnd(toInputDateTime(context.bookingClosesAt))}}>Theo lịch đặt chỗ chuyến</Button>}
            </div>
            <Field htmlFor={`win-start-${item.offer.id}`} label="Bắt đầu bán (giờ Việt Nam) *"><input id={`win-start-${item.offer.id}`} type="datetime-local" step={60} min={context.bookingOpensAt?toInputDateTime(context.bookingOpensAt):undefined} max={context.bookingClosesAt?toInputDateTime(context.bookingClosesAt):undefined} required value={winStart} onChange={e=>setWinStart(e.target.value)}/></Field>
            <Field htmlFor={`win-end-${item.offer.id}`} label="Kết thúc bán (giờ Việt Nam) *"><input id={`win-end-${item.offer.id}`} type="datetime-local" step={60} min={winStart||(context.bookingOpensAt?toInputDateTime(context.bookingOpensAt):undefined)} max={context.bookingClosesAt?toInputDateTime(context.bookingClosesAt):undefined} required value={winEnd} onChange={e=>setWinEnd(e.target.value)}/></Field>
            {winError&&<Notice title="Kiểm tra thời gian bán" tone="warning">{winError}</Notice>}
            <div className={styles.actions}>
              <Button type="submit" autoWidth>Lưu thời gian bán</Button>
              <Button type="button" autoWidth tone="secondary" onClick={()=>setEditingWindow(false)}>Hủy</Button>
            </div>
          </form>}
        </div>
      </details>
      <details className={styles.offerSection}>
        <summary><span>Quyền lợi và lần phục vụ</span><span className={styles.offerMeta}>{needsBenefits?'Cần liên kết':linkedCount>0?`${linkedCount} đã liên kết`:''}</span></summary>
        <div className={styles.offerBody}>
          {benefits.length===0&&<p>Gói chưa có quyền lợi.</p>}
          {benefits.map(benefit=><BenefitBinding key={benefit.id} item={item} benefit={benefit} cruiseId={cruiseId} disabled={!configure||item.offer.status!=='DRAFT'} run={run}/>)}
        </div>
      </details>
      <details className={styles.offerSection}>
        <summary><span>Phiên bản giá</span><span className={styles.offerMeta}>{item.prices.length} phiên bản</span></summary>
        <div className={styles.offerBody}>
    {canStartPrice&&<div className={styles.listActions}>
      <Button autoWidth tone="secondary" onClick={()=>setAddingPrice(true)}>{price?'Tạo giá thay thế':'Tạo giá nháp'}</Button>
    </div>}
    {!item.prices.length&&!context.canCreatePrice&&<p>Chưa có phiên bản giá.</p>}
    {item.prices.map(price=><div key={price.id} className={styles.card}><strong>Phiên bản giá {price.revisionNumber}: {new Intl.NumberFormat('vi-VN',{maximumFractionDigits:4}).format(Number(price.amount))} {price.currencyCode}/người</strong><p>{lifecycle[price.status]}{price.id===item.currentApprovedPriceRevisionId?' · Giá hiện hành đã duyệt':''}{price.templateVersionId!==item.offer.templateVersionId||price.offerCommercialRevision!==item.offer.commercialRevision?' · Thuộc cấu hình thương mại trước':''}</p>{price.reviewReason&&<p>Lý do xét duyệt: {price.reviewReason}</p>}
      {context.canCreatePrice&&price.status==='DRAFT'&&price.templateVersionId===item.offer.templateVersionId&&price.offerCommercialRevision===item.offer.commercialRevision&&<Button onClick={()=>void run(()=>cruisePackageApi.reviewPrice(cruiseId,item.offer.id,price.id,price.revision,'submit'),unified?'Đã gửi phiên bản giá để Quản lý lịch trình chọn vào hồ sơ chuyến.':'Đã gửi phiên bản giá để Quản lý vận hành xét duyệt.')}>{unified?`Gửi giá vào hồ sơ (bản ${price.revisionNumber})`:`Gửi duyệt phiên bản giá ${price.revisionNumber}`}</Button>}
      {checker&&price.createdBy!==access.userId&&price.submittedBy!==access.userId&&price.status==='SUBMITTED'&&price.templateVersionId===item.offer.templateVersionId&&price.offerCommercialRevision===item.offer.commercialRevision&&<div className={styles.form}>
        <Field htmlFor={`fare-review-${price.id}`} label="Lý do xét duyệt (bắt buộc khi trả lại)"><textarea id={`fare-review-${price.id}`} maxLength={4000} value={reasons[price.id]??''} onChange={e=>setReasons(v=>({...v,[price.id]:e.target.value}))}/></Field>
        <div className={styles.actions}><Button onClick={()=>void run(()=>cruisePackageApi.reviewPrice(cruiseId,item.offer.id,price.id,price.revision,'approve',reasons[price.id]),'Đã phê duyệt phiên bản giá Gói du thuyền. Chưa phê duyệt thanh toán, hủy, phí hoặc mở bán.')}>Phê duyệt phiên bản giá {price.revisionNumber}</Button><Button tone="secondary" disabled={!reasons[price.id]?.trim()} onClick={()=>void run(()=>cruisePackageApi.reviewPrice(cruiseId,item.offer.id,price.id,price.revision,'return',reasons[price.id]),'Đã trả phiên bản giá kèm lý do.')}>Trả lại phiên bản giá {price.revisionNumber}</Button></div>
      </div>}
    </div>)}
        </div>
      </details>
      {blockers.length>0&&<details className={styles.offerSection}>
        <summary><span>Điều kiện mở bán</span><span className={styles.offerMeta}>Chưa đủ điều kiện</span></summary>
        <div className={styles.offerBody}><ul>{blockers.map(message=><li key={message}>{message}</li>)}</ul></div>
      </details>}
    {configure&&!unified&&item.offer.status==='DRAFT'&&<div className={styles.offerActions}>
      <Button disabled={disabled||!(item.publicationEligible ?? item.eligibility.blockers.every(b=>b.code==='OFFER_NOT_PUBLISHED'))} onClick={()=>void run(()=>cruisePackageApi.publishOffer(cruiseId,item.offer.id,item.offer.revision),'Đã phát hành gói du thuyền của chuyến; chưa mở bán.')}>Phát hành gói du thuyền</Button>
    </div>}
    </fieldset>
    {addingPrice&&<Modal variant="drawer" title={price?'Tạo giá thay thế':'Tạo giá nháp'} description={item.template.version.name}
      busy={disabled} onClose={closePrice} footer={<>
        <Button tone="secondary" disabled={disabled} data-overlay-dismiss onClick={closePrice}>Hủy</Button>
        <Button type="submit" form={`new-fare-price-${item.offer.id}`} disabled={disabled||!canStartPrice||!validAmount}>Lưu giá nháp</Button>
      </>}>
      {feedback}
      <form id={`new-fare-price-${item.offer.id}`} onSubmit={async event=>{
        event.preventDefault()
        if(disabled||!canStartPrice||!validAmount)return
        const ok=await run(()=>cruisePackageApi.createPrice(cruiseId,item.offer.id,item.offer.revision,amount),'Đã lưu giá nháp.')
        if(ok)closePrice()
      }}>
        <Field htmlFor={`fare-price-${item.offer.id}`} label={`Giá mới (${context.currency}/người)`}>
          <input id={`fare-price-${item.offer.id}`} required inputMode="decimal" value={amount}
            onChange={event=>setAmount(event.target.value)}/>
        </Field>
      </form>
    </Modal>}
    {configure&&upgrade&&<OfferForm key={context.shipId} cruiseId={cruiseId} context={context} shipName={shipName} existing={item} templates={templates}
      disabled={disabled} busy={disabled} run={run} feedback={feedback} onClose={()=>setUpgrade(false)}/>}
  </article>
}
type DepartureCruisePackagesProps = {cruiseId:string;onChanged:()=>void;shipName?:string|null;renderAssignment?:(onChanged:()=>void)=>ReactNode}
function DepartureOffersWorkspace({cruiseId,onChanged,shipName,renderAssignment}:DepartureCruisePackagesProps) {
  const access=useSessionAccess(),[epoch,setEpoch]=useState(0)
  const [creatingOffer,setCreatingOffer]=useState(false)
  const [saved,setSaved]=useState<{userId:string|null;offers:CruisePackageOffer[];context:CruisePackageContext}|null>(null)
  const query=useReadQuery(`departure-fares:${access.userId}:${access.permissions.join(',')}:${cruiseId}:${epoch}`,useCallback(async signal=>{
    const [offers,context]=await Promise.all([cruisePackageApi.offers(cruiseId,signal),cruisePackageApi.context(cruiseId,signal)]);if(!signal.aborted)setSaved({offers,context,userId:access.userId});return {offers,context}
  },[cruiseId,access.userId]))
  const refresh=()=>setEpoch(v=>v+1),mutation=useCruisePackageMutation(refresh,onChanged)
  useFormChanges(false,mutation.busy)
  const disabled=mutation.busy||mutation.needsReview||query.loading||Boolean(query.error)||!query.data
  const data=query.data??(saved?.userId===access.userId?saved:null)
  const canManageTemplates=access.roles.includes('ACTIVITY_SERVICE_MANAGER')&&access.canDo('TOUR_PACKAGE_MANAGE')
  const templates = useShipPackageTemplates(canManageTemplates && data?.context.canConfigure ? data.context.shipId : null, epoch)
  return <Panel title="Gói du thuyền của chuyến khởi hành">
    <QueryState loading={query.loading} error={query.error}/>{!creatingOffer&&mutation.feedback}
    {query.error&&<Button tone="secondary" onClick={query.retry}>Tải lại gói du thuyền</Button>}
    {canManageTemplates&&<div className={styles.listActions}>
      {data?.context.canConfigure&&<Button disabled={disabled} onClick={()=>setCreatingOffer(true)}>Thêm gói du thuyền</Button>}
      <ButtonLink tone="secondary" to="/admin/cruise-package-templates">Mở mẫu gói du thuyền</ButtonLink>
    </div>}
    {canManageTemplates && data?.context.canConfigure && !creatingOffer && templates.error && (
      <Notice title="Chưa tải được mẫu gói của tàu" tone="warning">
        <Button tone="secondary" size="compact" onClick={templates.retry}>Tải lại mẫu gói</Button>
      </Notice>
    )}
    {canManageTemplates&&data?.context.shipId&&!data.context.canConfigure&&<Notice title="Chưa thể thêm gói cho chuyến" tone="warning">Cấu hình gói chỉ khả dụng khi chuyến và hồ sơ đang cho phép chỉnh sửa.</Notice>}
    {data&&!data.context.shipId&&<Notice title="Chưa được phân công tàu" tone="warning"><p>Cần có tàu trước khi cấu hình gói du thuyền của chuyến.</p></Notice>}
    {access.canDo('TOUR_PACKAGE_ASSIGN')&&renderAssignment?.(()=>{refresh();onChanged()})}
    {!creatingOffer&&data?.offers.length===0&&!access.canDo('TOUR_PACKAGE_ASSIGN')&&<Empty title="Chưa có gói du thuyền được gán"><p>{canManageTemplates ? 'Chọn phiên bản mẫu đã phát hành để thêm gói cho chuyến này.' : 'Đang chờ Quản lý hoạt động và dịch vụ cấu hình gói và gửi phiên bản giá.'}</p></Empty>}
    {data?.offers.map(item=><OfferCard key={item.offer.id} item={item} context={data.context} shipName={shipName} disabled={disabled} run={mutation.run} feedback={mutation.feedback} templates={templates}/>)}
    {creatingOffer&&<OfferForm key={data?.context.shipId} templates={templates} cruiseId={cruiseId} context={data?.context} shipName={shipName} disabled={disabled||!data?.context.canConfigure} run={mutation.run} busy={mutation.busy} feedback={mutation.feedback} onClose={()=>setCreatingOffer(false)}/>}
    <CruisePackageAddons cruiseId={cruiseId} locked={Boolean(data && !data.context.canConfigure)} onChanged={onChanged}/>
  </Panel>
}


export function DepartureCruisePackages(props:DepartureCruisePackagesProps){return <UnsavedForms><DepartureOffersWorkspace {...props}/></UnsavedForms>}




