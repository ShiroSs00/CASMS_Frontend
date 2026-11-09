import {SourceDefinitionEditor} from './SourceDefinitionEditor'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useReadQuery } from '@/shared/api'
import { useSessionAccess } from '@/shared/auth'
import { Badge, Button, Empty, Field, FormSection, Loading, Notice, PageHeader, Panel, TechnicalDetails,UnsavedForms,useFormChanges,useWorkspaceChange } from '@/shared/ui'
import { AdminShell } from '@/shared/ui/admin-v3'
import { cruisePackageApi, type BenefitInput, type CruisePackageTemplate, type CruisePackageVersion, type Inclusion, type ResourceType } from './api'
import styles from './TemplateWorkspace.module.css'
import {benefitQuantity} from './benefit-copy'

import {lifecycle,resourceLabels,inclusionLabels} from './labels'
import {useCruisePackageMutation} from './useCruisePackageMutation'

export function QueryState({loading,error}:{loading:boolean;error:Error|null}) {
  return loading?<Loading label="Đang tải gói du thuyền…"/>:error?<Notice title="Không tải được gói du thuyền" tone="error"><p>{error.message}</p></Notice>:null
}
export function ResourceSelect({type,cruiseId,value,onChange,id,disabled=false,required=true,label,allowCreate=false,onSourcePending}:{type:ResourceType;cruiseId?:string;value:string;onChange:(value:string,name?:string,unitCode?:string|null)=>void;id:string;disabled?:boolean;required?:boolean;label?:string;allowCreate?:boolean;onSourcePending?:(pending:boolean)=>void}) {
  const actor=useSessionAccess()
  const query=useReadQuery(`fare-resources:${actor.userId}:${type}:${cruiseId??'shared'}`,useCallback(signal=>cruisePackageApi.resources(type,cruiseId,signal),[type,cruiseId]))
  return <Field htmlFor={id} label={label??(cruiseId?'Lần phục vụ trên chuyến':'Tham chiếu dùng chung')}>
    <select id={id} required={required} value={value} disabled={disabled||query.loading||Boolean(query.error)} onChange={e=>{const item=query.data?.find(item=>item.id===e.target.value);onChange(e.target.value,item?.name,item?.unitCode)}}><option value="">Chọn {resourceLabels[type].toLocaleLowerCase('vi')}</option>{query.data?.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select>
    {query.loading&&<p>Đang tải danh mục…</p>}{query.error&&<><p role="alert">{query.error.message}</p><Button tone="text" onClick={query.retry}>Tải lại danh mục</Button></>}{query.data?.length===0&&<p>Chưa có nội dung dùng chung cho loại quyền lợi này.</p>}
    {allowCreate&&!cruiseId&&<SourceDefinitionEditor key={type} type={type} onPendingChange={onSourcePending} onCreated={(id,name)=>{query.retry();onChange(id,name,null)}}/>}
  </Field>
}
function BenefitEditor({onAdd,disabled,onPendingChange}:{onAdd:(benefit:BenefitInput & {resourceName:string})=>boolean;disabled:boolean;onPendingChange:(pending:boolean)=>void}) {
  const [type,setType]=useState<ResourceType>('ACTIVITY'),[resourceId,setResourceId]=useState(''),[resourceName,setResourceName]=useState('')
  const [inclusion,setInclusion]=useState<Inclusion|''>(''),[limit,setLimit]=useState(''),[eligibility,setEligibility]=useState('')
  const [usagePolicy,setUsagePolicy]=useState<BenefitInput['usagePolicy']>(null),[usageUnit,setUsageUnit]=useState<BenefitInput['usageUnit']>(null),[serviceUnitCode,setServiceUnitCode]=useState<string|null>(null)
  const [sourcePending,setSourcePending]=useState(false)
  const [reservation,setReservation]=useState(''),[start,setStart]=useState(''),[end,setEnd]=useState('')
  const pending=Boolean(sourcePending||resourceId||eligibility||limit||start||end||usagePolicy||usageUnit||reservation)
  const editor=useRef<HTMLDetailsElement>(null)
  useFormChanges(pending)
  useEffect(()=>onPendingChange(pending),[pending,onPendingChange])
  const actor=useSessionAccess()
  const options=useReadQuery(`fare-benefit-usage-options:${actor.userId}`,cruisePackageApi.usageOptions)
  const included=inclusion==='INCLUDED'||inclusion==='LIMITED_INCLUDED'
  const validWindow=(!start&&!end)||Boolean(start&&end&&Date.parse(start)<Date.parse(end))
  const validPolicy=!included||usagePolicy===(inclusion==='INCLUDED'?'UNLIMITED':'LIMITED')&&Boolean(usageUnit)&&usageUnit===(type==='SERVICE'?'SERVICE_UNIT':'PARTICIPATION')&&(type!=='SERVICE'||Boolean(serviceUnitCode))
  const missing=[!resourceId?'nội dung từ danh mục':null,!validPolicy?'chính sách và đơn vị sử dụng hợp lệ':null,!reservation||included&&reservation!=='true'?'yêu cầu đăng ký phù hợp':null,!eligibility.trim()?'điều kiện sử dụng':null,inclusion==='LIMITED_INCLUDED'&&(!Number.isSafeInteger(Number(limit))||Number(limit)<1)?'số lượng nguyên lớn hơn 0':null].filter(Boolean)
  function resetBenefit(){setInclusion('');setResourceId('');setResourceName('');setEligibility('');setLimit('');setUsagePolicy(null);setUsageUnit(null);setServiceUnitCode(null);setReservation('');setStart('');setEnd('');if(editor.current){editor.current.open=false;editor.current.querySelector('summary')?.focus()}}
  return <details ref={editor} className={styles.benefitEditor}><summary>Thêm quyền lợi{pending&&<span className={styles.draftLabel}>Đang nhập</span>}</summary><fieldset disabled={disabled} className={styles.benefitFields}><legend className={styles.srOnly}>Cấu hình quyền lợi mới</legend><div className={styles.fieldGrid}>
    <Field htmlFor="fare-benefit-type" label="Loại quyền lợi"><select id="fare-benefit-type" value={type} onChange={e=>{setType(e.target.value as ResourceType);setResourceId('');setResourceName('');setInclusion('');setUsagePolicy(null);setReservation('');setUsageUnit(null);setServiceUnitCode(null)}}>{Object.entries(resourceLabels).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></Field>
    <ResourceSelect type={type} value={resourceId} onChange={(id,name,unit)=>{setResourceId(id);setResourceName(name??'');setServiceUnitCode(unit??null)}} id="fare-benefit-resource" required={false} allowCreate onSourcePending={setSourcePending} label="Nội dung từ danh mục *"/>
    </div>{resourceId&&<><div className={styles.fieldGrid}><Field htmlFor="fare-inclusion" label="Cách sử dụng quyền lợi *"><select id="fare-inclusion" value={inclusion} onChange={e=>{setInclusion(e.target.value as Inclusion);setUsagePolicy(null);setUsageUnit(null);setLimit('')}}><option value="">Chọn cách sử dụng</option>{Object.entries(inclusionLabels).map(([key,label])=><option key={key} value={key}>{key==='INCLUDED'?'Đã bao gồm · không giới hạn số lượt':key==='LIMITED_INCLUDED'?'Đã bao gồm · theo số lượng được cấp':label}</option>)}</select></Field>
    </div><QueryState loading={options.loading} error={options.error}/>{options.error&&<div className={styles.actions}><Button tone="secondary" onClick={options.retry}>Tải lại cấu hình sử dụng</Button></div>}<div className={styles.fieldGrid}>
    {included&&<div className={styles.fullWidth}><p>Đơn vị ghi nhận: {type==='SERVICE'?serviceUnitCode||'Dịch vụ chưa cấu hình đơn vị nguồn.':'Một lượt tham gia của từng hành khách.'}</p><label className={styles.usageConfirmation}><input type="checkbox" checked={Boolean(usagePolicy&&usageUnit)} disabled={options.loading||Boolean(options.error)||type==='SERVICE'&&!serviceUnitCode} onChange={e=>{const policy=inclusion==='INCLUDED'?'UNLIMITED':'LIMITED',unit=type==='SERVICE'?'SERVICE_UNIT':'PARTICIPATION';setUsagePolicy(e.target.checked&&options.data?.usagePolicies.includes(policy)?policy:null);setUsageUnit(e.target.checked&&options.data?.usageUnits.includes(unit)?unit:null)}}/>Xác nhận {inclusion==='INCLUDED'?'quyền lợi không giới hạn số lượt, có ghi nhận sử dụng':'quyền lợi có giới hạn theo số lượng bên dưới'}, dùng đúng đơn vị nguồn.</label></div>}
    {inclusion==='LIMITED_INCLUDED'&&<Field htmlFor="fare-benefit-limit" label={type==='SERVICE'?'Số đơn vị dịch vụ được cấp':'Số lượt tham gia được cấp'}><input id="fare-benefit-limit" type="number" min="1" step="1" value={limit} onChange={e=>setLimit(e.target.value)}/></Field>}
    <Field htmlFor="fare-requires-reservation" label="Yêu cầu đăng ký"><select id="fare-requires-reservation" value={reservation} onChange={e=>setReservation(e.target.value)}><option value="">Chọn yêu cầu</option><option value="true">Phải đăng ký hoạt động/tour hoặc gửi yêu cầu dịch vụ</option>{!included&&<option value="false">Không yêu cầu đăng ký</option>}</select></Field>
    </div><details className={styles.disclosure}><summary>Khoảng thời gian sử dụng (tùy chọn)</summary><div className={styles.disclosureBody}><div className={styles.fieldGrid}><Field htmlFor="fare-usage-start" label="Bắt đầu"><input id="fare-usage-start" type="datetime-local" value={start} onChange={e=>setStart(e.target.value)}/></Field>
    <Field htmlFor="fare-usage-end" label="Kết thúc" error={!validWindow?'Nhập đủ hai mốc; thời điểm kết thúc phải sau bắt đầu.':undefined}><input id="fare-usage-end" type="datetime-local" value={end} onChange={e=>setEnd(e.target.value)}/></Field><p>Giờ nhập theo {Intl.DateTimeFormat().resolvedOptions().timeZone}. Không nhập khoảng riêng thì dùng lịch vận hành nguồn hiện có.</p>
    </div></div></details><Field htmlFor="fare-benefit-eligibility" label="Điều kiện sử dụng"><textarea rows={3} id="fare-benefit-eligibility" maxLength={4000} value={eligibility} onChange={e=>setEligibility(e.target.value)}/></Field>
    <p>Mô tả chỉ dùng để hiển thị. Không xác minh tuổi hoặc sức khỏe trong luồng này.</p>
    {missing.length>0&&<p className={styles.helper}>Cần bổ sung: {missing.join('; ')}.</p>}
    <div className={styles.actions}><Button tone="secondary" type="button" disabled={!inclusion||options.loading||Boolean(options.error)||!validPolicy||!validWindow||!reservation||included&&reservation!=='true'||!resourceId||!eligibility.trim()||inclusion==='LIMITED_INCLUDED'&&(!Number.isSafeInteger(Number(limit))||Number(limit)<1)} onClick={()=>{const added=onAdd({resourceType:type,resourceId,resourceName,inclusion:inclusion as Inclusion,quantityLimit:inclusion==='LIMITED_INCLUDED'?Number(limit):null,eligibility:eligibility.trim(),usagePolicy:included?usagePolicy:null,usageUnit:included?usageUnit:null,serviceUnitCode:type==='SERVICE'?serviceUnitCode:null,requiresReservation:reservation==='true',usageStartsAt:start?new Date(start).toISOString():null,usageEndsAt:end?new Date(end).toISOString():null});if(added)resetBenefit()}}>Thêm vào danh sách quyền lợi</Button>{pending&&<Button tone="text" disabled={disabled} onClick={resetBenefit}>Bỏ nội dung đang nhập</Button>}</div>
    </>}
  </fieldset></details>
}
function versionContent(name:string,description:string,categories:string[],benefits:BenefitInput[]){
  return JSON.stringify({name,description,categories:[...categories].sort(),benefits:benefits.map(b=>({resourceType:b.resourceType,resourceId:b.resourceId,inclusion:b.inclusion,quantityLimit:b.quantityLimit,eligibility:b.eligibility,usagePolicy:b.usagePolicy,usageUnit:b.usageUnit,serviceUnitCode:b.serviceUnitCode,requiresReservation:b.requiresReservation,usageStartsAt:b.usageStartsAt?Date.parse(b.usageStartsAt):null,usageEndsAt:b.usageEndsAt?Date.parse(b.usageEndsAt):null})).sort((a,b)=>(a.resourceType+a.resourceId).localeCompare(b.resourceType+b.resourceId))})
}
function savedVersionContent(item:CruisePackageVersion){
  return versionContent(item.version.name,item.version.description??'',item.version.logicalCategories,item.benefits.map(b=>({resourceType:b.onboardActivityId?'ACTIVITY':b.shoreExcursionId?'EXCURSION':'SERVICE',resourceId:b.onboardActivityId??b.shoreExcursionId??b.serviceId??'',inclusion:b.inclusion,quantityLimit:b.quantityLimit??null,eligibility:b.eligibility,usagePolicy:b.usagePolicy,usageUnit:b.usageUnit,serviceUnitCode:b.serviceUnitCode,requiresReservation:b.requiresReservation,usageStartsAt:b.usageStartsAt,usageEndsAt:b.usageEndsAt})))
}
function TemplateVersions({template,onChanged,readOnly,startNew=false}:{template:CruisePackageTemplate;onChanged:()=>void;readOnly:boolean;startNew?:boolean}) {
  const access=useSessionAccess(),canWrite=access.roles.includes('ACTIVITY_SERVICE_MANAGER')&&access.canDo('TOUR_PACKAGE_MANAGE')
  const [epoch,setEpoch]=useState(0),[name,setName]=useState(''),[description,setDescription]=useState(''),[categories,setCategories]=useState('')
  const [benefits,setBenefits]=useState<(BenefitInput & {resourceName:string})[]>([]),[localError,setLocalError]=useState('')
  const [reusedCategories,setReusedCategories]=useState<string[]>([]),[creating,setCreating]=useState(startNew),[benefitPending,setBenefitPending]=useState(false)
  const editorHeading=useRef<HTMLHeadingElement>(null)
  const changeWorkspace=useWorkspaceChange()
  const clearDraft=()=>{setName('');setDescription('');setCategories('');setBenefits([]);setReusedCategories([]);setBenefitPending(false);setCreating(false);setLocalError('')}
  useEffect(()=>{if(creating)editorHeading.current?.focus()},[creating])
  const categoryCatalog=useReadQuery(`cruise-package-category-catalog:${access.userId}:${template.id}:${epoch}`,cruisePackageApi.logicalCategories)
  const query=useReadQuery(`fare-versions:${access.userId}:${template.id}:${epoch}`,useCallback(signal=>cruisePackageApi.versions(template.id,signal),[template.id]))
  const refresh=()=>{setEpoch(v=>v+1);onChanged()}
  const pendingVersion=useRef<{kind:'create';ids:string[];content:string}|{kind:'publish';id:string}|null>(null)
  const mutation=useCruisePackageMutation(refresh,undefined,async()=>{
    const operation=pendingVersion.current
    if(!operation)return false
    const versions=await cruisePackageApi.versions(template.id)
    if(operation.kind==='publish')return versions.some(v=>v.version.id===operation.id&&v.version.status==='PUBLISHED')
    const matches=versions.filter(v=>!operation.ids.includes(v.version.id)&&savedVersionContent(v)===operation.content)
    if(matches.length!==1)return false
    clearDraft();return true
  }),disabled=readOnly||mutation.busy||mutation.needsReview||query.loading||Boolean(query.error)||!query.data
  useFormChanges(Boolean(name||description||categories||benefits.length||reusedCategories.length),mutation.busy)
  const knownCategories=Array.from(new Map([...(categoryCatalog.data??[]),...(query.data??[]).flatMap(v=>v.logicalCategoryReferences)].map(c=>[c.id,c])).values())
  return <>{!creating&&<Panel className={styles.panel}>
    <div className={styles.sectionHeader}><div><h2>Phiên bản mẫu</h2><p className={styles.helper}>{template.code} · Xem lại nội dung trước khi phát hành.</p></div>{canWrite&&<Button id="fare-new-version" disabled={disabled||creating} aria-expanded={creating} aria-controls="fare-version-editor" onClick={()=>setCreating(true)}>Tạo phiên bản mới</Button>}</div>
    <QueryState loading={query.loading} error={query.error}/>{mutation.feedback}
    {query.error&&<div className={styles.actions}><Button tone="secondary" onClick={query.retry}>Tải lại phiên bản</Button></div>}{query.data?.length===0&&<Empty title="Chưa có phiên bản mẫu"><p>Tạo phiên bản để cấu hình hạng cabin và quyền lợi.</p></Empty>}{categoryCatalog.error&&<Notice title="Chưa tải được hạng thương mại dùng chung" tone="warning">Không tự nối các hạng trùng tên.<Button onClick={categoryCatalog.retry}>Tải lại danh mục hạng</Button></Notice>}
    {query.data?.map(item=><VersionCard key={item.version.id} item={item} canPublish={canWrite&&!disabled} onPublish={()=>{pendingVersion.current={kind:'publish',id:item.version.id};void mutation.run(()=>cruisePackageApi.publishVersion(item.version.id,item.version.revision),`Đã phát hành phiên bản ${item.version.versionNumber}. Các gói du thuyền đang dùng phiên bản cũ được giữ nguyên.`)}}/>)}
  </Panel>}{canWrite&&creating&&<Panel className={styles.panel} id="fare-version-editor"><Button tone="text" disabled={mutation.busy||mutation.needsReview} onClick={()=>changeWorkspace(clearDraft)}>Quay lại các phiên bản</Button><header className={styles.editorHeading}><h2 ref={editorHeading} tabIndex={-1}>Tạo phiên bản mới</h2><p className={styles.helper}>Cấu hình nội dung rồi lưu bản nháp. Giá bán được tạo riêng cho từng chuyến khởi hành.</p></header>{mutation.feedback}<form aria-busy={mutation.busy} className={styles.versionForm} onSubmit={async e=>{e.preventDefault();if(disabled||benefitPending)return;setLocalError('');const logicalCategories=categories.split('\n').map(v=>v.trim()).filter(Boolean);if(!logicalCategories.length||new Set(logicalCategories).size!==logicalCategories.length){setLocalError('Nhập ít nhất một hạng cabin, mỗi dòng một hạng và không trùng nhau.');document.getElementById('fare-logical-categories')?.focus();return}pendingVersion.current={kind:'create',ids:query.data?.map(v=>v.version.id)??[],content:versionContent(name.trim(),description,logicalCategories,benefits)};const ok=await mutation.run(()=>cruisePackageApi.createVersion(template.id,{expectedTemplateRevision:template.revision,name:name.trim(),description,logicalCategories,reusedLogicalCategoryIds:reusedCategories,benefits:benefits.map(b=>({resourceType:b.resourceType,resourceId:b.resourceId,inclusion:b.inclusion,quantityLimit:b.quantityLimit,eligibility:b.eligibility,usagePolicy:b.usagePolicy,usageUnit:b.usageUnit,serviceUnitCode:b.serviceUnitCode,requiresReservation:b.requiresReservation,usageStartsAt:b.usageStartsAt,usageEndsAt:b.usageEndsAt}))}),'Đã lưu phiên bản nháp. Chưa phát hành mẫu hoặc mở bán.');if(ok){setName('');setDescription('');setCategories('');setBenefits([]);setReusedCategories([]);setCreating(false);document.getElementById('fare-new-version')?.focus()}}}>
      {localError&&<Notice title="Kiểm tra bản soạn" tone="error"><p>{localError}</p></Notice>}<FormSection title="Thông tin gói" description="Tên và mô tả hành khách sẽ đọc khi xem gói du thuyền.">
      <div className={styles.fullWidth}><Field htmlFor="fare-version-name" label="Tên gói du thuyền *"><input id="fare-version-name" required maxLength={200} value={name} disabled={disabled} onChange={e=>setName(e.target.value)}/></Field></div>
      <Field htmlFor="fare-version-description" label="Mô tả"><textarea rows={3} id="fare-version-description" maxLength={10000} value={description} disabled={disabled} onChange={e=>setDescription(e.target.value)}/></Field>
      </FormSection><FormSection title="Hạng cabin" description="Hạng thương mại của gói được đối chiếu với cabin thực tế trên từng tàu."><Field htmlFor="fare-logical-categories" label="Tên các hạng cabin *" hint="Mỗi dòng một hạng cabin."><textarea rows={3} id="fare-logical-categories" required value={categories} disabled={disabled} onChange={e=>setCategories(e.target.value)}/></Field>
      {knownCategories.length>0&&<details className={`${styles.disclosure} ${styles.fullWidth}`}><summary>Dùng lại hạng cabin đã có (tùy chọn){reusedCategories.length>0&&` · ${reusedCategories.length} đã chọn`}</summary><div className={styles.disclosureBody}><fieldset className={styles.categoryOptions} disabled={disabled}><legend className={styles.srOnly}>Hạng cabin dùng chung</legend>{knownCategories.map(c=><label key={c.id}><input type="checkbox" checked={reusedCategories.includes(c.id)} onChange={e=>{setReusedCategories(old=>e.target.checked?[...old,c.id]:old.filter(id=>id!==c.id));if(e.target.checked&&!categories.split('\n').map(v=>v.trim()).includes(c.name))setCategories(old=>old.trim()?old+'\n'+c.name:c.name)}}/><span><strong>{c.name}</strong><span>{c.packageName}</span><small>ID: {c.id}</small></span></label>)}<p>Chỉ hạng được chọn mới được liên kết lại. Trùng tên không tự liên kết hoặc chuyển mapping cabin từ phiên bản cũ.</p></fieldset></div></details>}
      </FormSection><FormSection title="Quyền lợi của gói" description="Thêm hoạt động trên tàu, tour tham quan và dịch vụ từ danh mục."><div className={styles.fullWidth}>
      {benefits.length===0&&<p className={styles.emptyCopy}>Chưa có quyền lợi trong bản soạn. Mở “Thêm quyền lợi” để bắt đầu.</p>}
      <ul className={styles.benefitList}>{benefits.map((benefit,index)=><li key={`${benefit.resourceType}:${benefit.resourceId}`}><div><strong>{benefit.resourceName}</strong><p>{resourceLabels[benefit.resourceType]} · {inclusionLabels[benefit.inclusion]}{benefit.quantityLimit!=null&&` · ${benefitQuantity(benefit.quantityLimit,benefit)}`}</p><p className={styles.helper}>{benefit.eligibility}</p></div><Button tone="text" disabled={disabled} aria-label={`Bỏ quyền lợi ${benefit.resourceName}`} onClick={()=>setBenefits(v=>v.filter((_,i)=>i!==index))}>Bỏ quyền lợi</Button></li>)}</ul>
      <BenefitEditor disabled={disabled} onPendingChange={setBenefitPending} onAdd={benefit=>{if(benefits.some(b=>b.resourceType===benefit.resourceType&&b.resourceId===benefit.resourceId)){setLocalError('Quyền lợi đã có trong bản soạn.');return false}setLocalError('');setBenefits(v=>[...v,benefit]);return true}}/>
      </div></FormSection><footer className={styles.formFooter}><div><strong>Bản nháp chưa phát hành</strong><p className={styles.helper}>{benefitPending?'Quyền lợi đang nhập chưa có trong danh sách. Thêm quyền lợi trước khi lưu phiên bản.':`${benefits.length} quyền lợi trong bản soạn. Lưu nháp không tự phát hành hoặc mở bán.`}</p></div><Button type="submit" disabled={disabled||!name.trim()||benefitPending}>{mutation.busy?'Đang lưu…':'Lưu phiên bản nháp'}</Button></footer>
    </form></Panel>}</>
}
function VersionCard({item,canPublish,onPublish}:{item:CruisePackageVersion;canPublish:boolean;onPublish:()=>void}) {
  const version=item.version
  return <details className={styles.version}>
    <summary><span className={styles.versionIdentity}><strong>{version.name}</strong><span>Phiên bản {version.versionNumber} · {item.benefits.length} quyền lợi</span></span><Badge label={lifecycle[version.status]} tone={version.status==='PUBLISHED'?'success':version.status==='DRAFT'?'warning':'neutral'}/><span className={styles.versionAction}>Xem chi tiết</span></summary>
    <div className={styles.versionBody}><div className={styles.versionFacts}><div><h3>Hạng cabin</h3><p>{version.logicalCategories.join(', ')||'Chưa khai báo hạng cabin'}</p></div>{version.description&&<div><h3>Mô tả gói</h3><p>{version.description}</p></div>}</div><h3>Quyền lợi</h3>
    {item.benefits.length===0&&<p className={styles.helper}>Phiên bản này chưa có quyền lợi.</p>}
    <ul className={styles.benefitList}>{item.benefits.map(b=><li key={b.id}><div><strong>{item.resourceNames[b.id]??'Chưa đọc được tên quyền lợi'}</strong><p>{inclusionLabels[b.inclusion]}{b.quantityLimit!=null&&` · ${benefitQuantity(b.quantityLimit,b)}`}</p><p className={styles.helper}>{b.eligibility}</p>{(b.inclusion==='INCLUDED'||b.inclusion==='LIMITED_INCLUDED')&&<dl className={styles.benefitFacts}><div><dt>Chính sách sử dụng</dt><dd>{b.usagePolicy==='UNLIMITED'?'Không giới hạn':b.usagePolicy==='LIMITED'?'Có giới hạn':'Chưa cấu hình'}</dd></div><div><dt>Đơn vị ghi nhận</dt><dd>{b.usageUnit==='PARTICIPATION'?'Lượt tham gia / hành khách':b.serviceUnitCode??'Chưa có đơn vị hỗ trợ'}</dd></div><div><dt>Đăng ký sử dụng</dt><dd>{b.requiresReservation===true?'Phải đăng ký / yêu cầu phục vụ':b.requiresReservation===false?'Không cần đăng ký':'Chưa cấu hình'}</dd></div>{(b.usageStartsAt||b.usageEndsAt)&&<div><dt>Khoảng sử dụng</dt><dd>{b.usageStartsAt?new Date(b.usageStartsAt).toLocaleString('vi-VN'):'Chưa có mốc bắt đầu'} — {b.usageEndsAt?new Date(b.usageEndsAt).toLocaleString('vi-VN'):'Chưa có mốc kết thúc'}</dd></div>}</dl>}{(b.inclusion==='OPTIONAL'||b.inclusion==='NOT_INCLUDED')&&<p className={styles.helper}>Không cấp quyền sử dụng miễn phí. Mua thêm theo Add-on Offer hợp lệ.</p>}</div></li>)}</ul>
    <TechnicalDetails entries={[["ID phiên bản",version.id],["Lần cập nhật",version.revision]]}/>
    {version.status==='DRAFT'&&<div className={styles.publishRow}><p className={styles.helper}>Phát hành để sử dụng phiên bản này khi tạo gói cho chuyến khởi hành.</p>{canPublish&&<Button onClick={onPublish}>Phát hành phiên bản {version.versionNumber}</Button>}</div>}
    </div></details>
}
export function CruisePackageTemplatePage(){return <UnsavedForms><TemplateWorkspace/></UnsavedForms>}
function TemplateWorkspace() {
  const access=useSessionAccess(),canWrite=access.roles.includes('ACTIVITY_SERVICE_MANAGER')&&access.canDo('TOUR_PACKAGE_MANAGE')
  const [epoch,setEpoch]=useState(0),[selected,setSelected]=useState(''),[code,setCode]=useState(''),[creatingTemplate,setCreatingTemplate]=useState(false),[newTemplateId,setNewTemplateId]=useState('')
  const codeInput=useRef<HTMLInputElement>(null)
  useEffect(()=>{if(creatingTemplate)codeInput.current?.focus()},[creatingTemplate])
  const switchWorkspace=useWorkspaceChange()
  const loadTemplates=useCallback((signal:AbortSignal)=>cruisePackageApi.templates(signal),[])
  const query=useReadQuery(`fare-templates:${access.userId}:${epoch}`,loadTemplates),refresh=()=>setEpoch(v=>v+1)
  const pendingTemplate=useRef<{code:string;ids:string[]}|null>(null)
  const mutation=useCruisePackageMutation(refresh,undefined,async()=>{
    const pending=pendingTemplate.current
    if(!pending)return false
    const rows=await cruisePackageApi.templates()
    const matches=rows.filter(row=>row.code===pending.code&&!pending.ids.includes(row.id))
    if(matches.length!==1)return false
    setSelected(matches[0].id);setNewTemplateId(matches[0].id);setCode('');setCreatingTemplate(false);return true
  })
  useFormChanges(Boolean(code),mutation.busy)
  const template=query.data?.find(item=>item.id===selected),disabled=mutation.busy||mutation.needsReview||query.loading||Boolean(query.error)||!query.data
  return <AdminShell><div className={styles.workspace}>
    <PageHeader title="Mẫu gói du thuyền" description="Quản lý nội dung, hạng cabin và quyền lợi dùng chung. Phát hành phiên bản trước khi cấu hình gói cho chuyến." breadcrumb="HOẠT ĐỘNG VÀ DỊCH VỤ" actions={canWrite && <Button tone="primary" disabled={disabled||creatingTemplate} aria-expanded={creatingTemplate} aria-controls="fare-template-create" onClick={()=>switchWorkspace(()=>{setSelected('');setCreatingTemplate(true)})}>Tạo mẫu mới</Button>}/>
    <QueryState loading={query.loading} error={query.error}/>{mutation.feedback}
    {query.error&&<div className={styles.actions}><Button tone="secondary" onClick={query.retry}>Tải lại danh sách mẫu</Button></div>}
    <Panel title="Chọn mẫu gói" className={styles.panel}>
      <div className={styles.templatePicker}>
        <Field htmlFor="fare-template-select" label="Mẫu gói du thuyền"><select id="fare-template-select" value={selected} disabled={disabled} onChange={e=>{const id=e.target.value;switchWorkspace(()=>{setSelected(id);setCode('');setCreatingTemplate(false)})}}><option value="">Chọn mẫu để xem phiên bản</option>{query.data?.map(item=><option key={item.id} value={item.id}>{item.code}</option>)}</select></Field>
        
      </div>
      {canWrite&&creatingTemplate&&<form id="fare-template-create" className={styles.templateCreate} onSubmit={async e=>{e.preventDefault();if(disabled)return;pendingTemplate.current={code:code.trim(),ids:query.data?.map(row=>row.id)??[]};await mutation.run(async()=>{const created=await cruisePackageApi.createTemplate(code.trim());if(created.code!==code.trim())throw new Error('Chưa xác nhận đúng mẫu vừa tạo.');setSelected(created.id);setNewTemplateId(created.id);setCode('');setCreatingTemplate(false)},'Đã tạo mẫu. Tiếp tục tạo phiên bản để cấu hình nội dung.')}}>
        <Field htmlFor="fare-template-code" label="Mã mẫu mới *" hint="Mã dùng để phân biệt các mẫu gói."><input ref={codeInput} id="fare-template-code" required maxLength={50} value={code} disabled={disabled} onChange={e=>setCode(e.target.value)}/></Field><Button type="submit" disabled={disabled||!code.trim()}>{mutation.busy?'Đang tạo…':'Tạo mẫu'}</Button>
      </form>}
    </Panel>
    {template&&<TemplateVersions key={template.id} template={template} startNew={template.id===newTemplateId} readOnly={disabled} onChanged={refresh}/>}
  </div></AdminShell>
}
