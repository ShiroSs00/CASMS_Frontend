import { useCallback, useState } from 'react'
import { useReadQuery } from '@/shared/api'
import { useSessionAccess } from '@/shared/auth'
import { Button, Empty, Field, Loading, Notice, PageHeader, Panel,UnsavedForms,useFormChanges,useWorkspaceChange } from '@/shared/ui'
import { AdminShell } from '@/shared/ui/admin-v3'
import { cruisePackageApi, type BenefitInput, type CruisePackageTemplate, type CruisePackageVersion, type Inclusion, type ResourceType } from './api'
import styles from './Workspace.module.css'
import {benefitQuantity} from './benefit-copy'

import {lifecycle,resourceLabels,inclusionLabels} from './labels'
import {useCruisePackageMutation} from './useCruisePackageMutation'

export function QueryState({loading,error}:{loading:boolean;error:Error|null}) {
  return loading?<Loading label="Đang tải gói du thuyền…"/>:error?<Notice title="Không tải được gói du thuyền" tone="error"><p>{error.message}</p></Notice>:null
}
export function ResourceSelect({type,cruiseId,value,onChange,id,disabled=false,required=true}:{type:ResourceType;cruiseId?:string;value:string;onChange:(value:string,name?:string,unitCode?:string|null)=>void;id:string;disabled?:boolean;required?:boolean}) {
  const query=useReadQuery(`fare-resources:${type}:${cruiseId??'shared'}`,useCallback(signal=>cruisePackageApi.resources(type,cruiseId,signal),[type,cruiseId]))
  return <Field htmlFor={id} label={cruiseId?'Lần phục vụ trên chuyến':'Tham chiếu dùng chung'}>
    <select id={id} required={required} value={value} disabled={disabled||query.loading||Boolean(query.error)} onChange={e=>{const item=query.data?.find(item=>item.id===e.target.value);onChange(e.target.value,item?.name,item?.unitCode)}}><option value="">Chọn {resourceLabels[type].toLocaleLowerCase('vi')}</option>{query.data?.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select>
    {query.loading&&<p>Đang tải danh mục…</p>}{query.error&&<p role="alert">{query.error.message}</p>}{query.data?.length===0&&<p>Chưa có tham chiếu phù hợp. Cần cấu hình danh mục thật trước khi liên kết.</p>}
  </Field>
}
function BenefitEditor({onAdd,disabled}:{onAdd:(benefit:BenefitInput & {resourceName:string})=>boolean;disabled:boolean}) {
  const [type,setType]=useState<ResourceType>('ACTIVITY'),[resourceId,setResourceId]=useState(''),[resourceName,setResourceName]=useState('')
  const [inclusion,setInclusion]=useState<Inclusion>('INCLUDED'),[limit,setLimit]=useState(''),[eligibility,setEligibility]=useState('')
  const [usagePolicy,setUsagePolicy]=useState<BenefitInput['usagePolicy']>(null),[usageUnit,setUsageUnit]=useState<BenefitInput['usageUnit']>(null),[serviceUnitCode,setServiceUnitCode]=useState<string|null>(null)
  const [reservation,setReservation]=useState(''),[start,setStart]=useState(''),[end,setEnd]=useState('')
  useFormChanges(Boolean(resourceId||eligibility||limit||start||end||usagePolicy||usageUnit||reservation))
  const options=useReadQuery('fare-benefit-usage-options',cruisePackageApi.usageOptions)
  const included=inclusion==='INCLUDED'||inclusion==='LIMITED_INCLUDED'
  const validWindow=(!start&&!end)||Boolean(start&&end&&Date.parse(start)<Date.parse(end))
  const validPolicy=!included||usagePolicy===(inclusion==='INCLUDED'?'UNLIMITED':'LIMITED')&&Boolean(usageUnit)&&usageUnit===(type==='SERVICE'?'SERVICE_UNIT':'PARTICIPATION')&&(type!=='SERVICE'||Boolean(serviceUnitCode))
  return <fieldset disabled={disabled} className={styles.form}><legend>Thêm định nghĩa quyền lợi</legend>
    <Field htmlFor="fare-benefit-type" label="Loại quyền lợi"><select id="fare-benefit-type" value={type} onChange={e=>{setType(e.target.value as ResourceType);setResourceId('');setUsageUnit(null);setServiceUnitCode(null)}}>{Object.entries(resourceLabels).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></Field>
    <ResourceSelect type={type} value={resourceId} onChange={(id,name,unit)=>{setResourceId(id);setResourceName(name??'');setServiceUnitCode(unit??null)}} id="fare-benefit-resource" required={false}/>
    <Field htmlFor="fare-inclusion" label="Cách bao gồm quyền lợi"><select id="fare-inclusion" value={inclusion} onChange={e=>{setInclusion(e.target.value as Inclusion);setUsagePolicy(null);setLimit('')}}>{Object.entries(inclusionLabels).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></Field>
    <QueryState loading={options.loading} error={options.error}/>
    {included&&<><Field htmlFor="fare-usage-policy" label="Chính sách số lần sử dụng"><select id="fare-usage-policy" value={usagePolicy??''} onChange={e=>setUsagePolicy(e.target.value?e.target.value as BenefitInput['usagePolicy']:null)}><option value="">Chọn chính sách</option>{options.data?.usagePolicies.filter(p=>p===(inclusion==='INCLUDED'?'UNLIMITED':'LIMITED')).map(p=><option key={p} value={p}>{p==='UNLIMITED'?'Không giới hạn, có ghi nhận sử dụng':'Có giới hạn theo số lượng được cấp'}</option>)}</select></Field>
    <Field htmlFor="fare-usage-unit" label="Đơn vị ghi nhận sử dụng"><select id="fare-usage-unit" value={usageUnit??''} onChange={e=>setUsageUnit(e.target.value?e.target.value as BenefitInput['usageUnit']:null)}><option value="">Chọn đơn vị</option>{options.data?.usageUnits.filter(u=>u===(type==='SERVICE'?'SERVICE_UNIT':'PARTICIPATION')).map(u=><option key={u} value={u}>{u==='PARTICIPATION'?'Một hành khách hoàn thành một session':'Số lượng phục vụ thực tế theo đơn vị dịch vụ'}</option>)}</select></Field>{type==='SERVICE'&&<p>Đơn vị nguồn dịch vụ: {serviceUnitCode||'Chưa có đơn vị cấu trúc; không thể phát hành quyền lợi này.'}</p>}</>}
    {inclusion==='LIMITED_INCLUDED'&&<Field htmlFor="fare-benefit-limit" label={type==='SERVICE'?'Số đơn vị dịch vụ được cấp':'Số lượt tham gia được cấp'}><input id="fare-benefit-limit" type="number" min="1" step="1" value={limit} onChange={e=>setLimit(e.target.value)}/></Field>}
    <Field htmlFor="fare-requires-reservation" label="Yêu cầu đăng ký"><select id="fare-requires-reservation" value={reservation} onChange={e=>setReservation(e.target.value)}><option value="">Chọn yêu cầu</option><option value="true">Phải đăng ký hoạt động/tour hoặc gửi yêu cầu dịch vụ</option><option value="false">Không yêu cầu đăng ký (chưa có luồng nguồn hỗ trợ)</option></select></Field>
    <Field htmlFor="fare-usage-start" label="Bắt đầu khoảng sử dụng (tùy chọn)"><input id="fare-usage-start" type="datetime-local" value={start} onChange={e=>setStart(e.target.value)}/></Field>
    <Field htmlFor="fare-usage-end" label="Kết thúc khoảng sử dụng (tùy chọn)"><input id="fare-usage-end" type="datetime-local" value={end} onChange={e=>setEnd(e.target.value)}/></Field><p>Giờ nhập theo {Intl.DateTimeFormat().resolvedOptions().timeZone}. Không nhập khoảng riêng thì dùng lịch vận hành nguồn hiện có.</p>
    <Field htmlFor="fare-benefit-eligibility" label="Điều kiện sử dụng"><textarea id="fare-benefit-eligibility" maxLength={4000} value={eligibility} onChange={e=>setEligibility(e.target.value)}/></Field>
    <p>Mô tả chỉ dùng để hiển thị. Không xác minh tuổi hoặc sức khỏe trong luồng này.</p>
    <Button type="button" disabled={options.loading||Boolean(options.error)||!validPolicy||!validWindow||!reservation||included&&reservation!=='true'||!resourceId||!eligibility.trim()||inclusion==='LIMITED_INCLUDED'&&(!Number.isSafeInteger(Number(limit))||Number(limit)<1)} onClick={()=>{const added=onAdd({resourceType:type,resourceId,resourceName,inclusion,quantityLimit:inclusion==='LIMITED_INCLUDED'?Number(limit):null,eligibility:eligibility.trim(),usagePolicy:included?usagePolicy:null,usageUnit:included?usageUnit:null,serviceUnitCode:type==='SERVICE'?serviceUnitCode:null,requiresReservation:reservation==='true',usageStartsAt:start?new Date(start).toISOString():null,usageEndsAt:end?new Date(end).toISOString():null});if(added){setResourceId('');setEligibility('');setLimit('');setUsagePolicy(null);setUsageUnit(null);setServiceUnitCode(null);setReservation('');setStart('');setEnd('')}}}>Thêm vào bản soạn</Button>
  </fieldset>
}
function TemplateVersions({template,onChanged,readOnly}:{template:CruisePackageTemplate;onChanged:()=>void;readOnly:boolean}) {
  const access=useSessionAccess(),canWrite=access.roles.includes('ACTIVITY_SERVICE_MANAGER')&&access.canDo('TOUR_PACKAGE_MANAGE')
  const [epoch,setEpoch]=useState(0),[name,setName]=useState(''),[description,setDescription]=useState(''),[categories,setCategories]=useState('')
  const [benefits,setBenefits]=useState<(BenefitInput & {resourceName:string})[]>([]),[localError,setLocalError]=useState('')
  const [reusedCategories,setReusedCategories]=useState<string[]>([])
  const categoryCatalog=useReadQuery(`cruise-package-category-catalog:${template.id}:${epoch}`,cruisePackageApi.logicalCategories)
  const query=useReadQuery(`fare-versions:${template.id}:${epoch}`,useCallback(signal=>cruisePackageApi.versions(template.id,signal),[template.id]))
  const refresh=()=>{setEpoch(v=>v+1);onChanged()}
  const mutation=useCruisePackageMutation(refresh),disabled=readOnly||mutation.busy||mutation.needsReview||query.loading||Boolean(query.error)||!query.data
  useFormChanges(Boolean(name||description||categories||benefits.length||reusedCategories.length),mutation.busy)
  const knownCategories=Array.from(new Map([...(categoryCatalog.data??[]),...(query.data??[]).flatMap(v=>v.logicalCategoryReferences)].map(c=>[c.id,c])).values())
  return <Panel title={`Phiên bản của ${template.code}`}>
    <QueryState loading={query.loading} error={query.error}/>{mutation.feedback}{localError&&<Notice title="Kiểm tra bản soạn" tone="error"><p>{localError}</p></Notice>}
    {query.data?.length===0&&<Empty title="Chưa có phiên bản mẫu"/>}{categoryCatalog.error&&<Notice title="Chưa tải được hạng thương mại dùng chung" tone="warning">Không tự nối các hạng trùng tên.<Button onClick={categoryCatalog.retry}>Tải lại danh mục hạng</Button></Notice>}
    {query.data?.map(item=><VersionCard key={item.version.id} item={item} canPublish={canWrite&&!disabled} onPublish={()=>void mutation.run(()=>cruisePackageApi.publishVersion(item.version.id,item.version.revision),`Đã phát hành phiên bản ${item.version.versionNumber}. Các gói du thuyền đang dùng phiên bản cũ được giữ nguyên.`)}/>)}
    {canWrite&&<form className={styles.form} onSubmit={async e=>{e.preventDefault();if(disabled)return;setLocalError('');const logicalCategories=categories.split('\n').map(v=>v.trim()).filter(Boolean);if(!logicalCategories.length||new Set(logicalCategories).size!==logicalCategories.length){setLocalError('Nhập ít nhất một hạng phòng logic, mỗi dòng một hạng và không trùng nhau.');return}const ok=await mutation.run(()=>cruisePackageApi.createVersion(template.id,{expectedTemplateRevision:template.revision,name:name.trim(),description,logicalCategories,reusedLogicalCategoryIds:reusedCategories,benefits:benefits.map(b=>({resourceType:b.resourceType,resourceId:b.resourceId,inclusion:b.inclusion,quantityLimit:b.quantityLimit,eligibility:b.eligibility,usagePolicy:b.usagePolicy,usageUnit:b.usageUnit,serviceUnitCode:b.serviceUnitCode,requiresReservation:b.requiresReservation,usageStartsAt:b.usageStartsAt,usageEndsAt:b.usageEndsAt}))}),'Đã lưu phiên bản nháp. Chưa phát hành mẫu hoặc mở bán.');if(ok){setName('');setDescription('');setCategories('');setBenefits([]);setReusedCategories([])}}}>
      <h3>Tạo phiên bản mới</h3>
      <Field htmlFor="fare-version-name" label="Tên gói du thuyền"><input id="fare-version-name" required maxLength={200} value={name} disabled={disabled} onChange={e=>setName(e.target.value)}/></Field>
      <Field htmlFor="fare-version-description" label="Mô tả"><textarea id="fare-version-description" maxLength={10000} value={description} disabled={disabled} onChange={e=>setDescription(e.target.value)}/></Field>
      <Field htmlFor="fare-logical-categories" label="Hạng phòng logic (mỗi dòng một hạng)"><textarea id="fare-logical-categories" required value={categories} disabled={disabled} onChange={e=>setCategories(e.target.value)}/></Field>
      {knownCategories.length>0&&<fieldset disabled={disabled}><legend>Tái sử dụng ID hạng thương mại đã có (tùy chọn)</legend>{knownCategories.map(c=><label key={c.id}><input type="checkbox" checked={reusedCategories.includes(c.id)} onChange={e=>{setReusedCategories(old=>e.target.checked?[...old,c.id]:old.filter(id=>id!==c.id));if(e.target.checked&&!categories.split('\n').map(v=>v.trim()).includes(c.name))setCategories(old=>old.trim()?old+'\n'+c.name:c.name)}}/>{c.name} · {c.id}</label>)}<p>Chỉ ID được chọn tường minh mới được dùng lại. Nhập trùng tên không tự nối category hoặc chuyển mapping từ phiên bản cũ.</p></fieldset>}
      <BenefitEditor disabled={disabled} onAdd={benefit=>{if(benefits.some(b=>b.resourceType===benefit.resourceType&&b.resourceId===benefit.resourceId)){setLocalError('Quyền lợi đã có trong bản soạn.');return false}setBenefits(v=>[...v,benefit]);return true}}/>
      <ul>{benefits.map((benefit,index)=><li key={`${benefit.resourceType}:${benefit.resourceId}`}>{benefit.resourceName} · {inclusionLabels[benefit.inclusion]} · {benefit.eligibility} {benefit.quantityLimit!=null&&`· ${benefitQuantity(benefit.quantityLimit,benefit)}`} <Button type="button" tone="text" disabled={disabled} onClick={()=>setBenefits(v=>v.filter((_,i)=>i!==index))}>Bỏ khỏi bản soạn</Button></li>)}</ul>
      <Button type="submit" disabled={disabled||!name.trim()}>Lưu phiên bản nháp</Button>
    </form>}
  </Panel>
}
function VersionCard({item,canPublish,onPublish}:{item:CruisePackageVersion;canPublish:boolean;onPublish:()=>void}) {
  return <article className={styles.card}><h3>{item.version.name} · Phiên bản {item.version.versionNumber}</h3><p>{lifecycle[item.version.status]} · Hạng phòng logic: {item.version.logicalCategories.join(', ')}</p>{item.version.description&&<p>{item.version.description}</p>}
    <ul>{item.benefits.map(b=><li key={b.id}>{item.resourceNames[b.id]??'Chưa đọc được tên quyền lợi'} · {inclusionLabels[b.inclusion]}{b.quantityLimit!=null&&` · ${benefitQuantity(b.quantityLimit,b)}`} · {b.eligibility} · {b.usagePolicy==='UNLIMITED'?'Đã cấu hình không giới hạn':b.usagePolicy==='LIMITED'?'Có giới hạn':'Chưa có chính sách sử dụng'} · {b.usageUnit==='PARTICIPATION'?'Mỗi hành khách hoàn thành một buổi':b.serviceUnitCode??'Chưa có đơn vị hỗ trợ'} · {b.requiresReservation===true?'Phải đăng ký/yêu cầu phục vụ':'Cần đối chiếu yêu cầu đăng ký'}</li>)}</ul>
    {item.version.status==='DRAFT'&&canPublish&&<Button onClick={onPublish}>Phát hành phiên bản {item.version.versionNumber}</Button>}
  </article>
}
export function CruisePackageTemplatePage(){return <UnsavedForms><TemplateWorkspace/></UnsavedForms>}
function TemplateWorkspace() {
  const access=useSessionAccess(),canWrite=access.roles.includes('ACTIVITY_SERVICE_MANAGER')&&access.canDo('TOUR_PACKAGE_MANAGE')
  const [epoch,setEpoch]=useState(0),[selected,setSelected]=useState(''),[code,setCode]=useState('')
  const [saved,setSaved]=useState<CruisePackageTemplate[]>([])
  const switchWorkspace=useWorkspaceChange()
  const loadTemplates=useCallback(async(signal:AbortSignal)=>{const rows=await cruisePackageApi.templates(signal);if(!signal.aborted)setSaved(rows);return rows},[])
  const query=useReadQuery(`fare-templates:${epoch}`,loadTemplates),refresh=()=>setEpoch(v=>v+1),mutation=useCruisePackageMutation(refresh)
  useFormChanges(Boolean(code),mutation.busy)
  const template=(query.data??saved).find(item=>item.id===selected),disabled=mutation.busy||mutation.needsReview||query.loading||Boolean(query.error)||!query.data
  return <AdminShell><div className={styles.workspace}><PageHeader title="Mẫu gói du thuyền" description="Phát hành phiên bản mẫu trước khi tạo Gói du thuyền cho chuyến khởi hành." breadcrumb="HOẠT ĐỘNG VÀ DỊCH VỤ" actions={<Button tone="secondary" disabled={mutation.busy} onClick={refresh}>Tải lại</Button>}/>
    <QueryState loading={query.loading} error={query.error}/>{mutation.feedback}
    <Panel title="Mẫu dùng chung">
      {query.data?.length===0&&<Empty title="Chưa có mẫu gói du thuyền"/>}
      <Field htmlFor="fare-template-select" label="Mẫu gói du thuyền"><select id="fare-template-select" value={selected} disabled={disabled} onChange={e=>{const id=e.target.value;switchWorkspace(()=>setSelected(id))}}><option value="">Chọn mẫu</option>{query.data?.map(item=><option key={item.id} value={item.id}>{item.code}</option>)}</select></Field>
      {canWrite&&<form className={styles.form} onSubmit={async e=>{e.preventDefault();if(disabled)return;await mutation.run(async()=>{const created=await cruisePackageApi.createTemplate(code.trim());if(!selected)setSelected(created.id);setCode('')},'Đã tạo mẫu gói du thuyền. Cần thêm và phát hành phiên bản.')}}><Field htmlFor="fare-template-code" label="Mã mẫu mới"><input id="fare-template-code" required maxLength={50} value={code} disabled={disabled} onChange={e=>setCode(e.target.value)}/></Field><Button type="submit" disabled={disabled||!code.trim()}>Tạo mẫu</Button></form>}
    </Panel>
    {template&&<TemplateVersions key={template.id} template={template} readOnly={disabled} onChanged={refresh}/>}
  </div></AdminShell>
}


