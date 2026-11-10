import {CruisePackageAddons} from './Addons'
import {CruisePackageMappingEvidence} from './cabin-mapping'
import {DeparturePackageManager} from '@/features/cruises/components/DeparturePackageManager'
import { useCallback,  useState } from 'react'
import { useReadQuery } from '@/shared/api'
import { useSessionAccess } from '@/shared/auth'
import { cabinTypeLabel } from '@/shared/i18n/business-copy'
import { Button, ButtonLink, Empty, Field, Notice, Panel,UnsavedForms,useFormChanges,useWorkspaceChange } from '@/shared/ui'
import { cruisePackageApi, type Benefit, type CruisePackageContext, type CruisePackageOffer, type OfferInput } from './api'
import {QueryState,ResourceSelect} from './Workspace'
import {inclusionLabels,lifecycle} from './labels'
import {useCruisePackageMutation} from './useCruisePackageMutation'
import styles from './Workspace.module.css'
import {benefitQuantity} from './benefit-copy'

type Run=(action:()=>Promise<unknown>,message:string)=>Promise<boolean>
function OfferForm({cruiseId,disabled,run,existing}:{cruiseId:string;disabled:boolean;run:Run;existing?:CruisePackageOffer}) {
  const [templateId,setTemplateId]=useState(existing?.template.version.templateId??''),[versionId,setVersionId]=useState(''),[logical,setLogical]=useState(''),[actual,setActual]=useState('')
  const [start,setStart]=useState(''),[end,setEnd]=useState(''),[validation,setValidation]=useState('')
  const templates=useReadQuery(`fare-offer-templates:${cruiseId}`,cruisePackageApi.templates)
  const versions=useReadQuery(`fare-offer-versions:${templateId}`,useCallback(signal=>templateId?cruisePackageApi.versions(templateId,signal):Promise.resolve([]),[templateId]))
  const cabins=useReadQuery(`fare-cabins:${cruiseId}`,useCallback(signal=>cruisePackageApi.cabinOptions(cruiseId,signal),[cruiseId]))
  const choices=versions.data?.filter(v=>v.version.status==='PUBLISHED'&&v.version.id!==existing?.offer.templateVersionId)??[]
  const selected=choices.find(v=>v.version.id===versionId),prefix=existing?.offer.id??'new'
  useFormChanges(Boolean(versionId||logical||actual||start||end||!existing&&templateId))
  const unavailable=disabled||templates.loading||versions.loading||cabins.loading||Boolean(templates.error||versions.error||cabins.error)
  return <form className={styles.form} onSubmit={async e=>{e.preventDefault();if(unavailable||!selected)return;setValidation('');if(!selected.logicalCategoryReferences.some(c=>c.id===logical)||!actual||!start||!end||Date.parse(start)>=Date.parse(end)){setValidation('Chọn hạng phòng và thời gian bán hợp lệ; thời điểm bắt đầu phải trước kết thúc.');return}const input:OfferInput={templateVersionId:versionId,logicalCategory:selected.logicalCategoryReferences.find(c=>c.id===logical)!.name,logicalCategoryId:logical,proposedCabinType:actual,salesStart:new Date(start).toISOString(),salesEnd:new Date(end).toISOString()};const ok=await run(()=>existing?cruisePackageApi.upgradeOffer(cruiseId,existing.offer.id,existing.offer.revision,input):cruisePackageApi.createOffer(cruiseId,input),existing?'Đã lưu cấu hình nâng phiên bản. Cần liên kết lại quyền lợi và tạo phiên bản giá mới.':'Đã lưu gói du thuyền nháp của chuyến. Chưa phát hành hoặc mở bán.');if(ok){if(!existing)setTemplateId('');setVersionId('');setLogical('');setActual('');setStart('');setEnd('')}}}>
    <h3>{existing?'Nâng phiên bản mẫu của gói du thuyền':'Tạo gói du thuyền của chuyến khởi hành'}</h3>
    <QueryState loading={templates.loading||versions.loading||cabins.loading} error={templates.error??versions.error??cabins.error}/>
    {!versions.loading&&!versions.error&&templateId&&!choices.length&&<Notice title="Chưa có phiên bản nguồn phù hợp">Cần phát hành phiên bản mẫu trước khi tạo Gói du thuyền của chuyến. Phiên bản đang dùng không xuất hiện trong lựa chọn nâng phiên bản.</Notice>}
    {validation&&<p role="alert">{validation}</p>}
    <Field htmlFor={`fare-template-${prefix}`} label="Mẫu gói du thuyền"><select id={`fare-template-${prefix}`} required value={templateId} disabled={unavailable||Boolean(existing)} onChange={e=>{setTemplateId(e.target.value);setVersionId('');setLogical('')}}><option value="">Chọn mẫu</option>{templates.data?.map(t=><option key={t.id} value={t.id}>{t.code}</option>)}</select></Field>
    <Field htmlFor={`fare-version-${prefix}`} label="Phiên bản đang phát hành"><select id={`fare-version-${prefix}`} required value={versionId} disabled={unavailable||!templateId} onChange={e=>{setVersionId(e.target.value);setLogical('')}}><option value="">Chọn phiên bản</option>{choices.map(v=><option key={v.version.id} value={v.version.id}>{v.version.name} · Phiên bản {v.version.versionNumber}</option>)}</select></Field>
    <Field htmlFor={`fare-logical-${prefix}`} label="Hạng phòng logic"><select id={`fare-logical-${prefix}`} required value={logical} disabled={unavailable||!selected} onChange={e=>setLogical(e.target.value)}><option value="">Chọn một hạng phòng</option>{selected?.logicalCategoryReferences.map(c=><option key={c.id} value={c.id}>{c.name} · {c.id}</option>)}</select></Field>
    <Field htmlFor={`fare-actual-${prefix}`} label="Hạng phòng dự kiến trên tàu"><select id={`fare-actual-${prefix}`} required value={actual} disabled={unavailable} onChange={e=>setActual(e.target.value)}><option value="">Chọn hạng phòng hiện có trên tàu</option>{cabins.data?.map(c=><option key={c} value={c}>{cabinTypeLabel(c)}</option>)}</select><p>Lựa chọn này chưa phải xác nhận tương thích. Hệ thống yêu cầu căn cứ phù hợp trước khi phát hành và bán.</p></Field>
    <Field htmlFor={`fare-start-${prefix}`} label="Bắt đầu bán"><input id={`fare-start-${prefix}`} required type="datetime-local" value={start} disabled={unavailable} onChange={e=>setStart(e.target.value)}/></Field>
    <Field htmlFor={`fare-end-${prefix}`} label="Kết thúc bán"><input id={`fare-end-${prefix}`} required type="datetime-local" value={end} disabled={unavailable} onChange={e=>setEnd(e.target.value)}/></Field>
    <p>Múi giờ nhập: {Intl.DateTimeFormat().resolvedOptions().timeZone}.</p>
    <Button type="submit" disabled={unavailable||!selected}>{existing?'Lưu cấu hình nâng phiên bản':'Lưu gói du thuyền nháp'}</Button>
  </form>
}
function BenefitBinding({item,benefit,cruiseId,disabled,run}:{item:CruisePackageOffer;benefit:Benefit;cruiseId:string;disabled:boolean;run:Run}) {
  const [occurrence,setOccurrence]=useState('')
  const type=benefit.onboardActivityId?'ACTIVITY':benefit.shoreExcursionId?'EXCURSION':'SERVICE'
  useFormChanges(Boolean(occurrence&&!bindingsForOccurrence()))
  function bindingsForOccurrence(){return item.bindings.some(b=>b.benefitId===benefit.id&&[b.onboardActivityId,b.shoreExcursionId,b.serviceId].includes(occurrence))}
  const name=item.template.resourceNames[benefit.id]??'Chưa đọc được tên quyền lợi'
  const bindings=item.bindings.filter(b=>b.benefitId===benefit.id)
  return <div className={styles.card}><strong>{name}</strong><p>{inclusionLabels[benefit.inclusion]}{benefit.quantityLimit!=null&&` · ${benefitQuantity(benefit.quantityLimit,benefit)}`} · {benefit.eligibility}</p>
    <ul>{bindings.map(b=><li key={b.id}>{item.bindingNames[b.id]??'Chưa đọc được tên lần phục vụ'}</li>)}</ul>
    {!bindings.length&&benefit.inclusion!=='NOT_INCLUDED'&&<p>Chưa liên kết lần phục vụ trên chuyến.</p>}
    {!disabled&&benefit.inclusion!=='NOT_INCLUDED'&&<div className={styles.form}>
      <ResourceSelect type={type} cruiseId={cruiseId} id={`fare-binding-${item.offer.id}-${benefit.id}`} value={occurrence} onChange={setOccurrence}/>
      <Button disabled={!occurrence||bindings.some(b=>[b.onboardActivityId,b.shoreExcursionId,b.serviceId].includes(occurrence))} onClick={()=>void run(()=>cruisePackageApi.bind(cruiseId,item.offer.id,item.offer.revision,benefit.id,occurrence),'Đã liên kết lần phục vụ. Nội dung thương mại đã đổi và cần phiên bản giá mới.')}>Liên kết lần phục vụ</Button>
    </div>}
  </div>
}
function OfferCard({item,context,disabled,run,shipName}:{shipName?:string|null;item:CruisePackageOffer;context:CruisePackageContext;disabled:boolean;run:Run}) {
  const access=useSessionAccess(),[amount,setAmount]=useState(''),[upgrade,setUpgrade]=useState(false),[reasons,setReasons]=useState<Record<string,string>>({})
  useFormChanges(Boolean(amount||item.prices.some(price=>price.status==='SUBMITTED'&&reasons[price.id]?.trim())))
  const switchWorkspace=useWorkspaceChange()
  const configure=context.canConfigure,checker=context.canReviewPrice,cruiseId=context.cruiseId,unified=context.unifiedPackageReview
  return <article className={styles.card}><fieldset className={styles.controls} disabled={disabled} aria-label={`Gói du thuyền ${item.template.version.name}, ${item.offer.logicalCategory}`}><h3>{item.template.version.name} · {item.offer.logicalCategory}</h3>
    <p>Phiên bản mẫu {item.template.version.versionNumber} · {lifecycle[item.template.version.status]} · Gói du thuyền: {lifecycle[item.offer.status]}</p>
    <CruisePackageMappingEvidence shipId={item.offer.shipId} shipName={context.shipId===item.offer.shipId?shipName:null} categoryId={item.offer.logicalCategoryId} categoryName={item.offer.logicalCategory} mapping={item.cabinMapping}/><p>Hạng dự kiến trên tàu: {cabinTypeLabel(item.offer.proposedCabinType)}.</p>
    <p>Thời gian bán: {new Date(item.offer.salesStart).toLocaleString('vi-VN')} – {new Date(item.offer.salesEnd).toLocaleString('vi-VN')} (giờ thiết bị).</p>
    {!item.eligibility.eligible&&<Notice title="Gói du thuyền chưa đủ điều kiện bán" tone="warning"><ul>{item.eligibility.blockers.map((b,i)=><li key={`${b.code}:${b.dependencyId}:${i}`}>{b.message}</li>)}</ul></Notice>}
    <p>Quyền lợi phụ thuộc chỗ phục vụ còn trống. Mua gói du thuyền không tự giữ chỗ; chỗ chỉ được xác nhận khi đăng ký thành công.</p>
    <h4>Liên kết các lần phục vụ trên chuyến</h4>
    {item.template.benefits.map(benefit=><BenefitBinding key={benefit.id} item={item} benefit={benefit} cruiseId={cruiseId} disabled={!configure||item.offer.status!=='DRAFT'} run={run}/>)}
    <h4>Phiên bản giá của Gói du thuyền (USD/người)</h4><p>Liên kết các lần phục vụ trước khi lập và gửi giá. {unified?'CRM chọn gói và đúng phiên bản giá để gửi cùng hồ sơ. OPS duyệt hồ sơ, giá và thuế/phí trong một lần.':'Giá được xét duyệt theo quy trình của chuyến.'}</p>
    {!item.prices.length&&<p>Chưa có phiên bản giá.</p>}
    {item.prices.map(price=><div key={price.id} className={styles.card}><strong>Phiên bản giá {price.revisionNumber}: {price.amount} USD/người</strong><p>{lifecycle[price.status]}{price.id===item.currentApprovedPriceRevisionId?' · Giá hiện hành đã duyệt':''}{price.templateVersionId!==item.offer.templateVersionId||price.offerCommercialRevision!==item.offer.commercialRevision?' · Thuộc cấu hình thương mại trước':''}</p>{price.reviewReason&&<p>Lý do xét duyệt: {price.reviewReason}</p>}
      {context.canCreatePrice&&price.status==='DRAFT'&&price.templateVersionId===item.offer.templateVersionId&&price.offerCommercialRevision===item.offer.commercialRevision&&<Button onClick={()=>void run(()=>cruisePackageApi.reviewPrice(cruiseId,item.offer.id,price.id,price.revision,'submit'),unified?'Đã gửi phiên bản giá để CRM chọn vào hồ sơ chuyến.':'Đã gửi phiên bản giá để Quản lý vận hành xét duyệt.')}>{unified?'Gửi giá vào hồ sơ':'Gửi duyệt phiên bản giá'} {price.revisionNumber}</Button>}
      {checker&&price.createdBy!==access.userId&&price.submittedBy!==access.userId&&price.status==='SUBMITTED'&&price.templateVersionId===item.offer.templateVersionId&&price.offerCommercialRevision===item.offer.commercialRevision&&<div className={styles.form}>
        <Field htmlFor={`fare-review-${price.id}`} label="Lý do xét duyệt (bắt buộc khi trả lại)"><textarea id={`fare-review-${price.id}`} maxLength={4000} value={reasons[price.id]??''} onChange={e=>setReasons(v=>({...v,[price.id]:e.target.value}))}/></Field>
        <div className={styles.actions}><Button onClick={()=>void run(()=>cruisePackageApi.reviewPrice(cruiseId,item.offer.id,price.id,price.revision,'approve',reasons[price.id]),'Đã phê duyệt phiên bản giá Gói du thuyền. Chưa phê duyệt thanh toán, hủy, phí hoặc mở bán.')}>Phê duyệt phiên bản giá {price.revisionNumber}</Button><Button tone="secondary" disabled={!reasons[price.id]?.trim()} onClick={()=>void run(()=>cruisePackageApi.reviewPrice(cruiseId,item.offer.id,price.id,price.revision,'return',reasons[price.id]),'Đã trả phiên bản giá kèm lý do.')}>Trả lại phiên bản giá {price.revisionNumber}</Button></div>
      </div>}
    </div>)}
    {context.canCreatePrice&&<form className={styles.form} onSubmit={async e=>{e.preventDefault();if(!/^\d{1,15}(\.\d{1,4})?$/.test(amount))return;const ok=await run(()=>cruisePackageApi.createPrice(cruiseId,item.offer.id,item.offer.revision,amount),'Đã tạo phiên bản giá nháp mới; lịch sử giá được giữ nguyên.');if(ok)setAmount('')}}>
      <Field htmlFor={`fare-price-${item.offer.id}`} label="Giá phiên bản mới (USD/người)"><input id={`fare-price-${item.offer.id}`} required inputMode="decimal" pattern="\d{1,15}(\.\d{1,4})?" value={amount} onChange={e=>setAmount(e.target.value)}/></Field><Button type="submit" disabled={!/^\d{1,15}(\.\d{1,4})?$/.test(amount)}>Tạo phiên bản giá</Button>
    </form>}
    <h4>{unified?'Hoàn thiện gói để trình duyệt':'Phát hành gói du thuyền của chuyến'}</h4><p>{unified?'Sau khi hoàn thiện quyền lợi và mapping, gửi giá để CRM chọn vào hồ sơ. OPS quyết định mở bán ở bước riêng.':'Hoàn thiện liên kết quyền lợi, giá được duyệt và ánh xạ cabin trước khi phát hành.'}</p>
    {configure&&<div className={styles.actions}>
      <Button tone="secondary" disabled={disabled} onClick={()=>upgrade?switchWorkspace(()=>setUpgrade(false)):setUpgrade(true)}>Nâng phiên bản mẫu</Button>
      {!unified&&item.offer.status==='DRAFT'&&<Button disabled={disabled||!(item.publicationEligible ?? item.eligibility.blockers.every(b=>b.code==='OFFER_NOT_PUBLISHED'))} onClick={()=>void run(()=>cruisePackageApi.publishOffer(cruiseId,item.offer.id,item.offer.revision),'Đã phát hành gói du thuyền của chuyến; chưa mở bán.')}>Phát hành gói du thuyền</Button>}
    </div>}
    {configure&&upgrade&&<OfferForm cruiseId={cruiseId} existing={item} disabled={disabled} run={run}/>}
  </fieldset></article>
}
function DepartureOffersWorkspace({cruiseId,onChanged,shipName}:{cruiseId:string;onChanged:()=>void;shipName?:string|null}) {
  const access=useSessionAccess(),[epoch,setEpoch]=useState(0)
  const [saved,setSaved]=useState<{userId:string|null;offers:CruisePackageOffer[];context:CruisePackageContext}|null>(null)
  const query=useReadQuery(`departure-fares:${access.userId}:${access.permissions.join(',')}:${cruiseId}:${epoch}`,useCallback(async signal=>{
    const [offers,context]=await Promise.all([cruisePackageApi.offers(cruiseId,signal),cruisePackageApi.context(cruiseId,signal)]);if(!signal.aborted)setSaved({offers,context,userId:access.userId});return {offers,context}
  },[cruiseId,access.userId]))
  const refresh=()=>setEpoch(v=>v+1),mutation=useCruisePackageMutation(refresh,onChanged)
  useFormChanges(false,mutation.busy)
  const disabled=mutation.busy||mutation.needsReview||query.loading||Boolean(query.error)||!query.data
  const data=query.data??(saved?.userId===access.userId?saved:null)
  return <Panel title="Gói du thuyền của chuyến khởi hành">
    <QueryState loading={query.loading} error={query.error}/>{mutation.feedback}
    {access.roles.includes('ACTIVITY_SERVICE_MANAGER')&&access.canDo('TOUR_PACKAGE_MANAGE')&&<ButtonLink tone="secondary" to="/admin/cruise-package-templates">Mở mẫu gói du thuyền</ButtonLink>}
    {data&&!data.context.shipId&&<Notice title="Chưa được phân công tàu" tone="warning"><p>Cần có tàu trước khi cấu hình gói du thuyền của chuyến.</p></Notice>}
    {access.canDo('TOUR_PACKAGE_ASSIGN')&&<DeparturePackageManager cruiseId={cruiseId} onChanged={()=>{refresh();onChanged()}}/>}
    {data?.offers.length===0&&!access.canDo('TOUR_PACKAGE_ASSIGN')&&<Empty title="Chưa có gói du thuyền của chuyến"/>}
    {data?.offers.map(item=><OfferCard key={item.offer.id} item={item} context={data.context} shipName={shipName} disabled={disabled} run={mutation.run}/>)}
    {data?.context.canConfigure&&<OfferForm cruiseId={cruiseId} disabled={disabled} run={mutation.run}/>}
    <CruisePackageAddons cruiseId={cruiseId} onChanged={onChanged}/>
  </Panel>
}


export function DepartureCruisePackages(props:{cruiseId:string;onChanged:()=>void;shipName?:string|null}){return <UnsavedForms><DepartureOffersWorkspace {...props}/></UnsavedForms>}




