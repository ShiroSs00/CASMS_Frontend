import {CruisePackageAddons} from './Addons'
import {CruisePackageMappingEvidence} from './cabin-mapping'
import { useCallback, useState, type ReactNode } from 'react'
import { useReadQuery } from '@/shared/api'
import { useSessionAccess } from '@/shared/auth'
import { cabinTypeLabel } from '@/shared/i18n/business-copy'
import { Badge, Button, ButtonLink, Empty, Field, Modal, Notice, Panel, UnsavedForms, useFormChanges } from '@/shared/ui'
import { cruisePackageApi, type Benefit, type CruisePackageContext, type CruisePackageOffer, type OfferInput } from './api'
import {QueryState} from './Workspace'
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

function OfferForm({
  cruiseId,
  disabled,
  run,
  existing,
  onClose,
  busy,
  feedback,
  context,
  shipName
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
}) {
  const [templateId, setTemplateId] = useState(existing?.template.version.templateId ?? '')
  const [versionId, setVersionId] = useState('')
  const [logical, setLogical] = useState('')
  const [actual, setActual] = useState('')
  const [editedStart, setStart] = useState<string | null>(null)
  const [editedEnd, setEnd] = useState<string | null>(null)
  const [validation, setValidation] = useState('')

  const templates = useReadQuery(`fare-offer-templates:${cruiseId}`, cruisePackageApi.templates)
  const versions = useReadQuery(`fare-offer-versions:${templateId}`, useCallback(signal => templateId ? cruisePackageApi.versions(templateId, signal) : Promise.resolve([]), [templateId]))
  const cabins = useReadQuery(`fare-cabins:${cruiseId}`, useCallback(signal => cruisePackageApi.cabinOptions(cruiseId, signal), [cruiseId]))

  const choices = versions.data?.filter(v => v.version.status === 'PUBLISHED' && v.version.id !== existing?.offer.templateVersionId) ?? []
  const selected = choices.find(v => v.version.id === versionId)
  const prefix = existing?.offer.id ?? 'new'

  const minSalesStart = toInputDateTime(context?.bookingOpensAt)
  const maxSalesEnd = toInputDateTime(context?.bookingClosesAt ?? context?.departureDatetime)
  const start = editedStart ?? (existing ? toInputDateTime(existing.offer.salesStart) : minSalesStart)
  const end = editedEnd ?? (existing ? toInputDateTime(existing.offer.salesEnd) : maxSalesEnd)
  useFormChanges(Boolean(versionId || logical || actual || (!existing && templateId)) || editedStart !== null || editedEnd !== null)

  const applyCruiseBookingWindow = () => {
    if (minSalesStart) setStart(minSalesStart)
    if (maxSalesEnd) setEnd(maxSalesEnd)
    setValidation('')
  }


  const unavailable = disabled || templates.loading || versions.loading || cabins.loading || Boolean(templates.error || versions.error || cabins.error)
  const formId = 'departure-offer-' + prefix
  const submit = (
    <Button
      type="submit"
      form={formId}
      disabled={unavailable || !selected || !logical || !actual || !start || !end}
    >
      {existing ? 'Lưu cấu hình nâng phiên bản' : 'Lưu gói nháp'}
    </Button>
  )

  const form = (
    <form
      id={formId}
      className={styles.form}
      onSubmit={async e => {
        e.preventDefault()
        if (unavailable || !selected) return
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
        if (!selected.logicalCategoryReferences.some(c => c.id === logical) || !actual || !start || !end || isNaN(parsedStart) || isNaN(parsedEnd) || parsedStart >= parsedEnd) {
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
          templateVersionId: versionId,
          logicalCategory: selected.logicalCategoryReferences.find(c => c.id === logical)!.name,
          logicalCategoryId: logical,
          proposedCabinType: actual,
          salesStart,
          salesEnd
        }
        const ok = await run(
          () => existing ? cruisePackageApi.upgradeOffer(cruiseId, existing.offer.id, existing.offer.revision, input) : cruisePackageApi.createOffer(cruiseId, input),
          existing ? 'Đã lưu cấu hình nâng phiên bản. Cần liên kết lại quyền lợi và tạo phiên bản giá mới.' : 'Đã lưu gói du thuyền nháp của chuyến. Chưa phát hành hoặc mở bán.'
        )
        if (ok) {
          onClose?.()
          if (!existing) setTemplateId('')
          setVersionId('')
          setLogical('')
          setActual('')
          setStart(null)
          setEnd(null)
        }
      }}
    >
      {existing && <Notice tone="warning" title="Gói sẽ trở về bản nháp">
        Kiểm tra lại quyền lợi và tạo giá cho phiên bản mới.
      </Notice>}
      <QueryState loading={templates.loading || versions.loading || cabins.loading} error={templates.error ?? versions.error ?? cabins.error} />
      {(templates.error || versions.error || cabins.error) && (
        <Button type="button" tone="secondary" onClick={() => { templates.retry(); versions.retry(); cabins.retry() }}>
          Tải lại lựa chọn
        </Button>
      )}

      {!existing && (
        <div className={styles.guidanceBanner}>
          <div>
            <strong>Hướng dẫn thiết lập gói du thuyền</strong>
            <p style={{ margin: '4px 0 0', fontSize: '13px' }}>
              Mỗi gói du thuyền trên chuyến được khởi tạo từ một <strong>Mẫu gói đã phát hành</strong> (chứa các quyền lợi như hoạt động trên tàu, tour bờ, dịch vụ) và ánh xạ với hạng phòng trên tàu {shipName ? `(${shipName})` : ''}.
            </p>
          </div>
          <ButtonLink tone="secondary" to="/admin/cruise-package-templates">
            Quản lý mẫu gói du thuyền
          </ButtonLink>
        </div>
      )}

      {!existing && templates.data?.length === 0 && (
        <Notice title="Chưa có mẫu gói du thuyền" tone="warning">
          <p>Cần tạo ít nhất một mẫu gói và phát hành phiên bản trước khi gán gói vào chuyến khởi hành.</p>
          <ButtonLink tone="secondary" to="/admin/cruise-package-templates">Mở Quản lý mẫu gói du thuyền</ButtonLink>
        </Notice>
      )}

      {cabins.data?.length === 0 && (
        <Notice title="Tàu chưa có hạng phòng để chọn" tone="warning">
          Cần cấu hình phòng của tàu trước khi tạo gói.
        </Notice>
      )}

      {validation && <Notice tone="error" title="Dữ liệu chưa hợp lệ">{validation}</Notice>}

      {/* Bước 1: Mẫu gói & Phiên bản */}
      <div className={styles.stepGroup}>
        <div className={styles.stepHeader}>
          <h4 className={styles.stepTitle}>
            <span className={styles.stepBadge}>1</span>
            Mẫu gói du thuyền & Phiên bản
          </h4>
          {selected && (
            <Badge label={`${selected.version.name} · v${selected.version.versionNumber}`} tone="success" />
          )}
        </div>
        <p className={styles.stepDesc}>
          Chọn mẫu gói du thuyền và phiên bản đã được phát hành (PUBLISHED). Các quyền lợi trong phiên bản sẽ được dùng để liên kết trên chuyến.
        </p>

        <div className={styles.fieldGrid2}>
          <Field htmlFor={`fare-template-${prefix}`} label="Mẫu gói du thuyền">
            <select
              id={`fare-template-${prefix}`}
              required
              value={templateId}
              disabled={unavailable || Boolean(existing)}
              onChange={e => {
                setTemplateId(e.target.value)
                setVersionId('')
                setLogical('')
              }}
            >
              <option value="">-- Chọn mẫu gói --</option>
              {templates.data?.map(t => (
                <option key={t.id} value={t.id}>{t.code}</option>
              ))}
            </select>
          </Field>

          <Field htmlFor={`fare-version-${prefix}`} label="Phiên bản đang phát hành">
            <select
              id={`fare-version-${prefix}`}
              required
              value={versionId}
              disabled={unavailable || !templateId}
              onChange={e => {
                setVersionId(e.target.value)
                setLogical('')
              }}
            >
              <option value="">{templateId ? '-- Chọn phiên bản --' : 'Vui lòng chọn mẫu trước'}</option>
              {choices.map(v => (
                <option key={v.version.id} value={v.version.id}>
                  {v.version.name} · Phiên bản {v.version.versionNumber}
                </option>
              ))}
            </select>
          </Field>
        </div>

        {!versions.loading && !versions.error && templateId && !choices.length && (
          <Notice title="Chưa có phiên bản nguồn phù hợp" tone="warning">
            <p>Mẫu gói này chưa có phiên bản nào ở trạng thái &quot;Đã phát hành&quot; (PUBLISHED). Phiên bản đang dùng không xuất hiện trong lựa chọn nâng phiên bản.</p>
            <ButtonLink tone="secondary" to="/admin/cruise-package-templates">
              Mở trang quản lý để phát hành phiên bản
            </ButtonLink>
          </Notice>
        )}

        {selected && (
          <div className={styles.selectedSummary}>
            <Badge label={`${selected.logicalCategoryReferences.length} hạng phòng trong mẫu`} tone="neutral" />
            <Badge label={`${selected.benefits.length} quyền lợi dịch vụ`} tone="neutral" />
          </div>
        )}
      </div>

      {/* Bước 2: Ghép hạng phòng (Cabin Mapping) */}
      <div className={styles.stepGroup}>
        <div className={styles.stepHeader}>
          <h4 className={styles.stepTitle}>
            <span className={styles.stepBadge}>2</span>
            Ghép hạng phòng (Cabin Mapping)
          </h4>
        </div>
        <p className={styles.stepDesc}>
          Ánh xạ hạng phòng thương mại trong mẫu sang loại cabin vật lý có sẵn trên tàu của chuyến này.
        </p>

        <div className={styles.fieldGrid2}>
          <Field htmlFor={`fare-logical-${prefix}`} label="Hạng phòng trong mẫu">
            <select
              id={`fare-logical-${prefix}`}
              required
              value={logical}
              disabled={unavailable || !selected}
              onChange={e => setLogical(e.target.value)}
            >
              <option value="">{selected ? '-- Chọn hạng phòng thương mại --' : 'Chọn phiên bản ở Bước 1'}</option>
              {selected?.logicalCategoryReferences.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </Field>

          <Field htmlFor={`fare-actual-${prefix}`} label="Hạng phòng dự kiến trên tàu">
            <select
              id={`fare-actual-${prefix}`}
              required
              value={actual}
              disabled={unavailable}
              onChange={e => setActual(e.target.value)}
            >
              <option value="">-- Chọn hạng phòng hiện có trên tàu --</option>
              {cabins.data?.map(c => (
                <option key={c} value={c}>{cabinTypeLabel(c)}</option>
              ))}
            </select>
          </Field>
        </div>

        <p className={styles.templateHint}>
          Lựa chọn này là đề xuất cấu hình của ASM. Hệ thống đối chiếu dữ liệu cabin thực tế của tàu trước khi Quản lý tàu xác nhận tương thích để mở bán.
        </p>
      </div>

      {/* Bước 3: Thời gian mở bán (Booking Window) */}
      <div className={styles.stepGroup}>
        <div className={styles.stepHeader}>
          <h4 className={styles.stepTitle}>
            <span className={styles.stepBadge}>3</span>
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
          Múi giờ chuẩn: Giờ Việt Nam (Asia/Ho_Chi_Minh).
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
function OfferCard({item,context,disabled,run,shipName,feedback}:{shipName?:string|null;item:CruisePackageOffer;context:CruisePackageContext;disabled:boolean;run:Run;feedback:ReactNode}) {
  const access=useSessionAccess(),[amount,setAmount]=useState(''),[upgrade,setUpgrade]=useState(false),[addingPrice,setAddingPrice]=useState(false),[reasons,setReasons]=useState<Record<string,string>>({})
  useFormChanges(Boolean(amount||item.prices.some(price=>price.status==='SUBMITTED'&&reasons[price.id]?.trim())))
  const configure=context.canConfigure,checker=context.canReviewPrice,cruiseId=context.cruiseId,unified=context.unifiedPackageReview
  const templateId=item.template.version.templateId
  const versions=useReadQuery(`offer-template-options:${templateId}:${configure}`,
    useCallback(signal=>configure?cruisePackageApi.versions(templateId,signal):Promise.resolve([]),[templateId,configure]))
  const canUpgrade=configure&&Boolean(versions.data?.some(version=>
    version.version.status==='PUBLISHED'&&version.version.id!==item.offer.templateVersionId))
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
        <strong>{price?`${new Intl.NumberFormat('vi-VN',{maximumFractionDigits:4}).format(Number(price.amount))} USD/người`:'Chưa có giá'}</strong>
        {price&&<span className={styles.offerMeta}>{lifecycle[price.status]}</span>}
      </div>
    </header>
    <fieldset className={styles.controls} disabled={disabled} aria-label={`Gói du thuyền ${item.template.version.name}, ${item.offer.logicalCategory}`}>
      <details className={styles.offerSection}>
        <summary><span>Thông tin gói</span></summary>
        <div className={styles.offerBody}>
          <p className={styles.offerMeta}>{cabinTypeLabel(item.offer.proposedCabinType)} · {journeyTime(item.offer.salesStart)} – {journeyTime(item.offer.salesEnd)} (giờ Việt Nam)</p>
          <CruisePackageMappingEvidence shipName={context.shipId===item.offer.shipId?shipName:null} mapping={item.cabinMapping}/>
          {canUpgrade&&<Button autoWidth tone="secondary" onClick={()=>setUpgrade(true)}>Áp dụng phiên bản mẫu khác</Button>}
          {versions.error&&<Button autoWidth tone="secondary" onClick={versions.retry}>Kiểm tra phiên bản mẫu</Button>}
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
    {item.prices.map(price=><div key={price.id} className={styles.card}><strong>Phiên bản giá {price.revisionNumber}: {price.amount} USD/người</strong><p>{lifecycle[price.status]}{price.id===item.currentApprovedPriceRevisionId?' · Giá hiện hành đã duyệt':''}{price.templateVersionId!==item.offer.templateVersionId||price.offerCommercialRevision!==item.offer.commercialRevision?' · Thuộc cấu hình thương mại trước':''}</p>{price.reviewReason&&<p>Lý do xét duyệt: {price.reviewReason}</p>}
      {context.canCreatePrice&&price.status==='DRAFT'&&price.templateVersionId===item.offer.templateVersionId&&price.offerCommercialRevision===item.offer.commercialRevision&&<Button onClick={()=>void run(()=>cruisePackageApi.reviewPrice(cruiseId,item.offer.id,price.id,price.revision,'submit'),unified?'Đã gửi phiên bản giá để CRM chọn vào hồ sơ chuyến.':'Đã gửi phiên bản giá để Quản lý vận hành xét duyệt.')}>{unified?'Gửi giá vào hồ sơ':'Gửi duyệt phiên bản giá'} {price.revisionNumber}</Button>}
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
        <Field htmlFor={`fare-price-${item.offer.id}`} label="Giá mới (USD/người)">
          <input id={`fare-price-${item.offer.id}`} required inputMode="decimal" value={amount}
            onChange={event=>setAmount(event.target.value)}/>
        </Field>
      </form>
    </Modal>}
    {configure&&upgrade&&<OfferForm cruiseId={cruiseId} context={context} shipName={shipName} existing={item}
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
  return <Panel title="Gói du thuyền của chuyến khởi hành">
    <QueryState loading={query.loading} error={query.error}/>{!creatingOffer&&mutation.feedback}
    {query.error&&<Button tone="secondary" onClick={query.retry}>Tải lại gói du thuyền</Button>}
    {canManageTemplates&&<div className={styles.listActions}>
      {data?.context.canConfigure&&<Button disabled={disabled} onClick={()=>setCreatingOffer(true)}>Thêm gói du thuyền</Button>}
      <ButtonLink tone="secondary" to="/admin/cruise-package-templates">Mở mẫu gói du thuyền</ButtonLink>
    </div>}
    {canManageTemplates&&data?.context.shipId&&!data.context.canConfigure&&<Notice title="Chưa thể thêm gói cho chuyến" tone="warning">Cấu hình gói chỉ khả dụng khi chuyến và hồ sơ đang cho phép chỉnh sửa.</Notice>}
    {data&&!data.context.shipId&&<Notice title="Chưa được phân công tàu" tone="warning"><p>Cần có tàu trước khi cấu hình gói du thuyền của chuyến.</p></Notice>}
    {access.canDo('TOUR_PACKAGE_ASSIGN')&&renderAssignment?.(()=>{refresh();onChanged()})}
    {!creatingOffer&&data?.offers.length===0&&!access.canDo('TOUR_PACKAGE_ASSIGN')&&<Empty title="Chưa có gói du thuyền được gán"><p>{canManageTemplates ? 'Chọn Thêm gói du thuyền để dùng một phiên bản mẫu đã phát hành.' : 'Quản lý hoạt động và dịch vụ tạo gói cho chuyến từ phiên bản mẫu đã phát hành.'}</p></Empty>}
    {data?.offers.map(item=><OfferCard key={item.offer.id} item={item} context={data.context} shipName={shipName} disabled={disabled} run={mutation.run} feedback={mutation.feedback}/>)}
    {creatingOffer&&<OfferForm cruiseId={cruiseId} context={data?.context} shipName={shipName} disabled={disabled||!data?.context.canConfigure} run={mutation.run} busy={mutation.busy} feedback={mutation.feedback} onClose={()=>setCreatingOffer(false)}/>}
    <CruisePackageAddons cruiseId={cruiseId} onChanged={onChanged}/>
  </Panel>
}


export function DepartureCruisePackages(props:DepartureCruisePackagesProps){return <UnsavedForms><DepartureOffersWorkspace {...props}/></UnsavedForms>}




