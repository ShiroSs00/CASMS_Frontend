import {SourceDefinitionEditor} from './SourceDefinitionEditor'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useReadQuery } from '@/shared/api'
import { useSessionAccess } from '@/shared/auth'
import { Badge, Button, DataTable, Empty, Field, FormSection, Loading, Modal, Notice, PageHeader, Panel,UnsavedForms,useFormChanges,useWorkspaceChange } from '@/shared/ui'
import { AdminShell } from '@/shared/ui/admin-v3'
import { cruisePackageApi, type BenefitInput, type CruisePackageTemplate, type CruisePackageVersion, type Inclusion, type ResourceType } from './api'
import styles from './TemplateWorkspace.module.css'
import {benefitQuantity} from './benefit-copy'

import {lifecycle,resourceLabels,inclusionLabels} from './labels'
import {useCruisePackageMutation} from './useCruisePackageMutation'

export function QueryState({loading,error}:{loading:boolean;error:Error|null}) {
  return loading?<Loading label="Đang tải gói du thuyền…"/>:error?<Notice title="Không tải được gói du thuyền" tone="error"><p>{error.message}</p></Notice>:null
}
export function ResourceSelect({type,cruiseId,value,onChange,id,disabled=false,required=true,label,allowCreate=false,onSourcePending,onSourceOpen}:{type:ResourceType;cruiseId?:string;value:string;onChange:(value:string,name?:string,unitCode?:string|null)=>void;id:string;disabled?:boolean;required?:boolean;label?:string;allowCreate?:boolean;onSourcePending?:(pending:boolean)=>void;onSourceOpen?:(open:boolean)=>void}) {
  const actor=useSessionAccess()
  const query=useReadQuery(`fare-resources:${actor.userId}:${type}:${cruiseId??'shared'}`,useCallback(signal=>cruisePackageApi.resources(type,cruiseId,signal),[type,cruiseId]))
  return <><Field htmlFor={id} label={label??(cruiseId?'Lần phục vụ trên chuyến':'Tham chiếu dùng chung')}>
    <select id={id} required={required} value={value} disabled={disabled||query.loading||Boolean(query.error)||query.data?.length===0} onChange={e=>{const item=query.data?.find(item=>item.id===e.target.value);onChange(e.target.value,item?.name,item?.unitCode)}}><option value="">Chọn {resourceLabels[type].toLocaleLowerCase('vi')}</option>{query.data?.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select>
    {query.loading&&<p>Đang tải danh mục…</p>}{query.error&&<><p role="alert">{query.error.message}</p><Button tone="text" onClick={query.retry}>Tải lại danh mục</Button></>}{query.data?.length===0&&<p>{cruiseId?'Chưa có lần phục vụ khả dụng trên chuyến.':'Danh mục chưa có nội dung phù hợp.'}</p>}
    </Field>
    {allowCreate&&!cruiseId&&<div className={styles.fullWidth}>
      <SourceDefinitionEditor key={type} type={type} onPendingChange={onSourcePending} onOpenChange={onSourceOpen}
        onCreated={(id,name)=>{query.retry();onChange(id,name,null)}}/>
    </div>}
  </>
}
function BenefitEditor({onAdd,disabled,onPendingChange}:{onAdd:(benefit:BenefitInput & {resourceName:string})=>boolean;disabled:boolean;onPendingChange:(pending:boolean)=>void}) {
  const [type,setType]=useState<ResourceType>('ACTIVITY'),[resourceId,setResourceId]=useState(''),[resourceName,setResourceName]=useState('')
  const [inclusion,setInclusion]=useState<Inclusion|''>(''),[limit,setLimit]=useState(''),[eligibility,setEligibility]=useState('')
  const [usagePolicy,setUsagePolicy]=useState<BenefitInput['usagePolicy']>(null),[usageUnit,setUsageUnit]=useState<BenefitInput['usageUnit']>(null),[serviceUnitCode,setServiceUnitCode]=useState<string|null>(null)
  const [sourcePending,setSourcePending]=useState(false)
  const [sourceOpen,setSourceOpen]=useState(false)
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
    <ResourceSelect type={type} value={resourceId} onChange={(id,name,unit)=>{setResourceId(id);setResourceName(name??'');setServiceUnitCode(unit??null)}} id="fare-benefit-resource" required={false} allowCreate onSourcePending={setSourcePending} onSourceOpen={setSourceOpen} label="Nội dung từ danh mục *"/>
    </div>{resourceId&&!sourceOpen&&<><div className={styles.fieldGrid}><Field htmlFor="fare-inclusion" label="Cách sử dụng quyền lợi *"><select id="fare-inclusion" value={inclusion} onChange={e=>{const next=e.target.value as Inclusion;setInclusion(next);setReservation(next==='INCLUDED'||next==='LIMITED_INCLUDED'?'true':'');setUsagePolicy(null);setUsageUnit(null);setLimit('')}}><option value="">Chọn cách sử dụng</option>{Object.entries(inclusionLabels).map(([key,label])=><option key={key} value={key}>{key==='INCLUDED'?'Đã bao gồm · không giới hạn số lượt':key==='LIMITED_INCLUDED'?'Đã bao gồm · theo số lượng được cấp':label}</option>)}</select></Field>
    </div><QueryState loading={options.loading} error={options.error}/>{options.error&&<div className={styles.actions}><Button tone="secondary" onClick={options.retry}>Tải lại cấu hình sử dụng</Button></div>}<div className={styles.fieldGrid}>
    {included&&<div className={styles.fullWidth}><p>Đơn vị ghi nhận: {type==='SERVICE'?serviceUnitCode||'Dịch vụ chưa cấu hình đơn vị nguồn.':'Một lượt tham gia của từng hành khách.'}</p><label className={styles.usageConfirmation}><input type="checkbox" checked={Boolean(usagePolicy&&usageUnit)} disabled={options.loading||Boolean(options.error)||type==='SERVICE'&&!serviceUnitCode} onChange={e=>{const policy=inclusion==='INCLUDED'?'UNLIMITED':'LIMITED',unit=type==='SERVICE'?'SERVICE_UNIT':'PARTICIPATION';setUsagePolicy(e.target.checked&&options.data?.usagePolicies.includes(policy)?policy:null);setUsageUnit(e.target.checked&&options.data?.usageUnits.includes(unit)?unit:null)}}/>Xác nhận {inclusion==='INCLUDED'?'quyền lợi không giới hạn số lượt, có ghi nhận sử dụng':'quyền lợi có giới hạn theo số lượng bên dưới'}, dùng đúng đơn vị nguồn.</label></div>}
    {inclusion==='LIMITED_INCLUDED'&&<Field htmlFor="fare-benefit-limit" label={type==='SERVICE'?'Số đơn vị dịch vụ được cấp':'Số lượt tham gia được cấp'}><input id="fare-benefit-limit" type="number" min="1" step="1" value={limit} onChange={e=>setLimit(e.target.value)}/></Field>}
    {included?<p>Khách cần đăng ký hoạt động, tour hoặc gửi yêu cầu dịch vụ để sử dụng quyền lợi.</p>:<Field htmlFor="fare-requires-reservation" label="Yêu cầu đăng ký"><select id="fare-requires-reservation" value={reservation} onChange={e=>setReservation(e.target.value)}><option value="">Chọn yêu cầu</option><option value="true">Phải đăng ký hoạt động/tour hoặc gửi yêu cầu dịch vụ</option><option value="false">Không yêu cầu đăng ký</option></select></Field>}
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
  const [publishId, setPublishId] = useState<string | null>(null)
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
  const reusedRooms = knownCategories.filter(category => reusedCategories.includes(category.id))
  const newRoomNames = categories.split('\n').map(value => value.trim()).filter(Boolean)
  const logicalCategories = [...reusedRooms.map(category => category.name), ...newRoomNames]
  const hasDuplicateRooms = new Set(logicalCategories).size !== logicalCategories.length
  const versions = query.data ?? []
  const current = versions.find(item => item.version.status === 'PUBLISHED')
  const drafts = versions.filter(item => item.version.status === 'DRAFT')
    .sort((left, right) => right.version.versionNumber - left.version.versionNumber)
  const history = versions.filter(item => item.version.status === 'SUPERSEDED')
    .sort((left, right) => right.version.versionNumber - left.version.versionNumber)
  const candidate = drafts.find(item => item.version.id === publishId)?.version
  const canPublish = canWrite && !disabled
    && Boolean(candidate && (!current || candidate.versionNumber > current.version.versionNumber))
  const publishVersion = () => {
    if (!candidate || !canPublish) return
    pendingVersion.current = { kind: 'publish', id: candidate.id }
    setPublishId(null)
    void mutation.run(
      () => cruisePackageApi.publishVersion(candidate.id, candidate.revision),
      `Phiên bản ${candidate.versionNumber} đã sẵn sàng để tạo gói cho chuyến.`,
    )
  }
  return <>{!creating&&<Panel className={styles.panel}>
    <div className={styles.sectionHeader}><div><h2>Phiên bản của mẫu</h2></div>{canWrite&&<Button id="fare-new-version" disabled={disabled||creating} aria-expanded={creating} aria-controls="fare-version-editor" onClick={()=>setCreating(true)}>Soạn phiên bản mới</Button>}</div>
    <QueryState loading={query.loading} error={query.error}/>{mutation.feedback}
    {query.error&&<div className={styles.actions}><Button tone="secondary" onClick={query.retry}>Tải lại phiên bản</Button></div>}{query.data?.length===0&&<Empty title="Chưa có phiên bản mẫu"><p>Tạo phiên bản để cấu hình hạng cabin và quyền lợi.</p></Empty>}{categoryCatalog.error&&<Notice title="Chưa tải được hạng thương mại dùng chung" tone="warning">Không tự nối các hạng trùng tên.<Button onClick={categoryCatalog.retry}>Tải lại danh mục hạng</Button></Notice>}
    {current && <section aria-label="Phiên bản hiện hành">
      <h3>Phiên bản hiện hành</h3>
      <VersionCard item={current} />
    </section>}
    {drafts.length > 0 && <section aria-label="Bản nháp">
      <h3>Bản nháp</h3>
      {drafts.map(item => <VersionCard key={item.version.id} item={item}
        onPublish={canWrite && (!current || item.version.versionNumber > current.version.versionNumber)
          ? () => setPublishId(item.version.id) : undefined} disabled={disabled}
        supersededDraft={Boolean(current && item.version.versionNumber <= current.version.versionNumber)} />)}
    </section>}
    {history.length > 0 && <section aria-label="Lịch sử phiên bản">
      <h3>Lịch sử phiên bản</h3>
      {history.map(item => <VersionCard key={item.version.id} item={item} />)}
    </section>}
    {candidate && <Modal title={`Phát hành phiên bản ${candidate.versionNumber}`} onClose={() => setPublishId(null)}
      footer={<>
        <Button tone="secondary" onClick={() => setPublishId(null)}>Quay lại</Button>
        <Button disabled={!canPublish} onClick={publishVersion}>Phát hành phiên bản</Button>
      </>}>
      <p>Phiên bản {candidate.versionNumber} sẽ dùng để tạo gói cho chuyến mới.</p>
      {current && <p>Các gói đã dùng phiên bản {current.version.versionNumber} tiếp tục dùng phiên bản đó.</p>}
    </Modal>}
  </Panel>}{canWrite&&creating&&<Panel className={styles.panel} id="fare-version-editor"><header className={styles.editorHeading}><h2 ref={editorHeading} tabIndex={-1}>Soạn phiên bản mới</h2></header>{mutation.feedback}<form aria-busy={mutation.busy} className={styles.versionForm} onSubmit={async e=>{e.preventDefault();if(disabled||benefitPending)return;setLocalError('');if(!logicalCategories.length||hasDuplicateRooms){setLocalError('Nhập ít nhất một hạng cabin, mỗi dòng một hạng và không trùng nhau.');document.getElementById('fare-logical-categories')?.focus();return}pendingVersion.current={kind:'create',ids:query.data?.map(v=>v.version.id)??[],content:versionContent(name.trim(),description,logicalCategories,benefits)};const ok=await mutation.run(()=>cruisePackageApi.createVersion(template.id,{expectedTemplateRevision:template.revision,name:name.trim(),description,logicalCategories,reusedLogicalCategoryIds:reusedRooms.map(category=>category.id),benefits:benefits.map(b=>({resourceType:b.resourceType,resourceId:b.resourceId,inclusion:b.inclusion,quantityLimit:b.quantityLimit,eligibility:b.eligibility,usagePolicy:b.usagePolicy,usageUnit:b.usageUnit,serviceUnitCode:b.serviceUnitCode,requiresReservation:b.requiresReservation,usageStartsAt:b.usageStartsAt,usageEndsAt:b.usageEndsAt}))}),'Đã lưu phiên bản nháp. Chưa phát hành mẫu hoặc mở bán.');if(ok){setName('');setDescription('');setCategories('');setBenefits([]);setReusedCategories([]);setCreating(false);document.getElementById('fare-new-version')?.focus()}}}>
      {localError&&<Notice title="Kiểm tra bản soạn" tone="error"><p>{localError}</p></Notice>}<FormSection title="Thông tin gói">
      <div className={styles.fullWidth}><Field htmlFor="fare-version-name" label="Tên gói du thuyền *"><input id="fare-version-name" required maxLength={200} value={name} disabled={disabled} onChange={e=>setName(e.target.value)}/></Field></div>
      <div className={styles.fullWidth}><Field htmlFor="fare-version-description" label="Mô tả"><textarea rows={3} id="fare-version-description" maxLength={10000} value={description} disabled={disabled} onChange={e=>setDescription(e.target.value)}/></Field></div>
      </FormSection><FormSection title="Hạng phòng">
        <div className={styles.fullWidth}>
        {knownCategories.length>0&&<details className={styles.disclosure}>
          <summary>Chọn hạng phòng đã có{reusedRooms.length>0&&` · ${reusedRooms.length} đã chọn`}</summary>
          <div className={styles.disclosureBody}>
            <fieldset className={styles.categoryOptions} disabled={disabled}>
              <legend className={styles.srOnly}>Hạng phòng dùng chung</legend>
              {knownCategories.map(category => {
                const checked = reusedCategories.includes(category.id)
                const duplicateName = !checked && reusedRooms.some(room => room.name === category.name)
                return <label key={category.id}>
                  <input type="checkbox" checked={checked} disabled={duplicateName}
                    onChange={event=>setReusedCategories(ids=>event.target.checked ? [...ids,category.id] : ids.filter(id=>id!==category.id))}/>
                  <span><strong>{category.name}</strong><span>{category.packageName}</span></span>
                </label>
              })}
            </fieldset>
          </div>
        </details>}
        <Field htmlFor="fare-logical-categories" label="Thêm hạng phòng mới"
          hint="Mỗi dòng một tên, ví dụ Phòng hướng biển."
          error={hasDuplicateRooms ? 'Tên hạng phòng bị trùng với hạng đã chọn hoặc đã nhập.' : undefined}>
          <textarea rows={2} id="fare-logical-categories" value={categories} disabled={disabled}
            onChange={event=>setCategories(event.target.value)}/>
        </Field>
        </div>
      </FormSection><FormSection title="Quyền lợi đi kèm"><div className={styles.fullWidth}>
      {benefits.length===0&&<p className={styles.emptyCopy}>Chưa thêm quyền lợi.</p>}
      <ul className={styles.benefitList}>{benefits.map((benefit,index)=><li key={`${benefit.resourceType}:${benefit.resourceId}`}><div><strong>{benefit.resourceName}</strong><p>{resourceLabels[benefit.resourceType]} · {inclusionLabels[benefit.inclusion]}{benefit.quantityLimit!=null&&` · ${benefitQuantity(benefit.quantityLimit,benefit)}`}</p><p className={styles.helper}>{benefit.eligibility}</p></div><Button tone="text" disabled={disabled} aria-label={`Bỏ quyền lợi ${benefit.resourceName}`} onClick={()=>setBenefits(v=>v.filter((_,i)=>i!==index))}>Bỏ quyền lợi</Button></li>)}</ul>
      <BenefitEditor disabled={disabled} onPendingChange={setBenefitPending} onAdd={benefit=>{if(benefits.some(b=>b.resourceType===benefit.resourceType&&b.resourceId===benefit.resourceId)){setLocalError('Quyền lợi đã có trong bản soạn.');return false}setLocalError('');setBenefits(v=>[...v,benefit]);return true}}/>
      </div></FormSection><footer className={styles.formFooter}><Button autoWidth tone="secondary" disabled={mutation.busy||mutation.needsReview} onClick={()=>changeWorkspace(clearDraft)}>Quay lại</Button>{benefitPending&&<p className={styles.helper}>Thêm quyền lợi đang nhập trước khi lưu.</p>}<Button autoWidth type="submit" disabled={disabled||!name.trim()||!logicalCategories.length||hasDuplicateRooms||benefitPending}>{mutation.busy?'Đang lưu…':'Lưu phiên bản nháp'}</Button></footer>
    </form></Panel>}</>
}
function VersionCard({ item, onPublish, disabled, supersededDraft }: { item: CruisePackageVersion; onPublish?: () => void; disabled?: boolean; supersededDraft?: boolean }) {
  const version=item.version
  return <details className={styles.version} open={version.status === 'PUBLISHED'}>
    <summary><span className={styles.versionIdentity}><strong>{version.name}</strong><span>Phiên bản {version.versionNumber} · {item.benefits.length} quyền lợi</span></span><Badge label={lifecycle[version.status]} tone={version.status==='PUBLISHED'?'success':version.status==='DRAFT'?'warning':'neutral'}/><span className={styles.versionAction}>Xem chi tiết</span></summary>
    <div className={styles.versionBody}><div className={styles.versionFacts}><div><h3>Hạng cabin</h3><p>{version.logicalCategories.join(', ')||'Chưa khai báo hạng cabin'}</p></div>{version.description&&<div><h3>Mô tả gói</h3><p>{version.description}</p></div>}</div><h3>Quyền lợi</h3>
    {item.benefits.length===0&&<p className={styles.helper}>Phiên bản này chưa có quyền lợi.</p>}
    <ul className={styles.benefitList}>{item.benefits.map(b=><li key={b.id}><div><strong>{item.resourceNames[b.id]??'Chưa đọc được tên quyền lợi'}</strong><p>{inclusionLabels[b.inclusion]}{b.quantityLimit!=null&&` · ${benefitQuantity(b.quantityLimit,b)}`}</p><p className={styles.helper}>{b.eligibility}</p>{(b.inclusion==='INCLUDED'||b.inclusion==='LIMITED_INCLUDED')&&<dl className={styles.benefitFacts}><div><dt>Chính sách sử dụng</dt><dd>{b.usagePolicy==='UNLIMITED'?'Không giới hạn':b.usagePolicy==='LIMITED'?'Có giới hạn':'Chưa cấu hình'}</dd></div><div><dt>Đơn vị ghi nhận</dt><dd>{b.usageUnit==='PARTICIPATION'?'Lượt tham gia / hành khách':b.serviceUnitCode??'Chưa có đơn vị hỗ trợ'}</dd></div><div><dt>Đăng ký sử dụng</dt><dd>{b.requiresReservation===true?'Phải đăng ký / yêu cầu phục vụ':b.requiresReservation===false?'Không cần đăng ký':'Chưa cấu hình'}</dd></div>{(b.usageStartsAt||b.usageEndsAt)&&<div><dt>Khoảng sử dụng</dt><dd>{b.usageStartsAt?new Date(b.usageStartsAt).toLocaleString('vi-VN'):'Chưa có mốc bắt đầu'} — {b.usageEndsAt?new Date(b.usageEndsAt).toLocaleString('vi-VN'):'Chưa có mốc kết thúc'}</dd></div>}</dl>}{(b.inclusion==='OPTIONAL'||b.inclusion==='NOT_INCLUDED')&&<p className={styles.helper}>Không cấp quyền sử dụng miễn phí. Mua thêm theo Add-on Offer hợp lệ.</p>}</div></li>)}</ul>
    {onPublish && <div className={styles.publishRow}>
      <Button autoWidth disabled={disabled} onClick={onPublish}>Phát hành phiên bản</Button>
    </div>}
    {supersededDraft && <p className={styles.helper}>Bản nháp này cũ hơn phiên bản hiện hành.</p>}
    </div></details>
}
export function CruisePackageTemplatePage(){return <UnsavedForms><TemplateWorkspace/></UnsavedForms>}
function TemplateWorkspace() {
  const access=useSessionAccess(),canWrite=access.roles.includes('ACTIVITY_SERVICE_MANAGER')&&access.canDo('TOUR_PACKAGE_MANAGE')
  const [epoch,setEpoch]=useState(0),[selected,setSelected]=useState(''),[code,setCode]=useState(''),[creatingTemplate,setCreatingTemplate]=useState(false),[newTemplateId,setNewTemplateId]=useState('')
  const [search, setSearch] = useState('')
  const codeInput=useRef<HTMLInputElement>(null)
  const pageHeading = useRef<HTMLDivElement>(null)
  useEffect(() => {
    pageHeading.current?.focus()
  }, [selected, creatingTemplate])
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
  const templates = query.data
  const showCatalog = !selected && !creatingTemplate
  const catalog = useReadQuery(`template-catalog:${access.userId}:${epoch}:${showCatalog}:${Boolean(templates)}`, useCallback(async signal => {
    const rows: Array<{
      item: CruisePackageTemplate
      versions: Awaited<ReturnType<typeof cruisePackageApi.versions>> | null
    }> = []
    if (!showCatalog || !templates) return rows
    for (let index = 0; index < templates.length && !signal.aborted; index += 6) {
      const batch = templates.slice(index, index + 6)
      const versions = await Promise.allSettled(batch.map(item => cruisePackageApi.versions(item.id, signal)))
      rows.push(...batch.map((item, offset) => {
        const result = versions[offset]
        return { item, versions: result.status === 'fulfilled' ? result.value : null }
      }))
    }
    return rows
  }, [showCatalog, templates]))
  const term = search.trim().toLocaleLowerCase('vi')
  const rows = catalog.data?.filter(({ item, versions }) => item.code.toLocaleLowerCase('vi').includes(term)
    || versions?.some(({ version }) => version.name.toLocaleLowerCase('vi').includes(term))) ?? []

  return <AdminShell><div className={styles.workspace}>
    <div ref={pageHeading} tabIndex={-1}>
      <PageHeader title={template?.code ?? 'Mẫu gói du thuyền'} breadcrumb="Hoạt động và dịch vụ"
        actions={selected || creatingTemplate
          ? <Button tone="secondary" disabled={mutation.busy || mutation.needsReview}
            onClick={() => switchWorkspace(() => { setSelected(''); setCreatingTemplate(false); setCode('') })}>Về danh mục mẫu</Button>
          : canWrite && <Button disabled={disabled} aria-controls="fare-template-create"
            onClick={() => setCreatingTemplate(true)}>Tạo mẫu mới</Button>} />
    </div>
    <QueryState loading={query.loading} error={query.error}/>{mutation.feedback}
    {query.error && <Button tone="secondary" onClick={query.retry}>Tải lại danh sách mẫu</Button>}
    {showCatalog && !query.loading && !query.error && <Panel className={styles.panel}>
      <div className={styles.catalogSearch}>
        <Field htmlFor="fare-template-search" label="Tìm mẫu">
          <input type="search" id="fare-template-search" value={search} onChange={event => setSearch(event.target.value)}
            placeholder="Nhập tên hoặc mã mẫu" />
        </Field>
      </div>
      {catalog.loading && <Loading label="Đang tải phiên bản của các mẫu…" />}
      {catalog.data?.some(row => row.versions === null) && <Notice tone="warning" title="Một số phiên bản chưa tải được">
        <Button tone="secondary" onClick={catalog.retry}>Tải lại phiên bản</Button>
      </Notice>}
      {catalog.data && !rows.length && <Empty title={term ? 'Không tìm thấy mẫu phù hợp' : 'Chưa có mẫu gói'}><p>{term ? 'Thử tìm bằng tên hoặc mã khác.' : 'Tạo mẫu và phát hành phiên bản để dùng khi cấu hình gói theo chuyến.'}</p></Empty>}
      {rows.length > 0 && <DataTable label="Danh mục mẫu gói du thuyền"
        headers={['Mẫu gói', 'Dùng cho chuyến mới', 'Bản nháp', '']}>
        {rows.map(({ item, versions }) => {
          const published = versions?.find(entry => entry.version.status === 'PUBLISHED')?.version
          const drafts = versions?.filter(entry => entry.version.status === 'DRAFT') ?? []
          const name = published?.name ?? drafts[0]?.version.name
          return <tr key={item.id}>
            <td><strong>{name || item.code}</strong>{name && <div className={styles.helper}>{item.code}</div>}</td>
            <td>{published ? <Badge label={`Phiên bản ${published.versionNumber}`} tone="success" />
              : versions ? 'Chưa phát hành' : 'Chưa tải được'}</td>
            <td>{drafts.length === 1 ? `Phiên bản ${drafts[0].version.versionNumber}`
              : drafts.length > 1 ? `${drafts.length} bản nháp` : '—'}</td>
            <td><Button tone="secondary" autoWidth aria-label={`Mở mẫu ${item.code}`}
              onClick={() => setSelected(item.id)}>Mở mẫu</Button></td>
          </tr>
        })}
      </DataTable>}
    </Panel>}
    {creatingTemplate && <Panel className={styles.panel} title="Tạo mẫu mới">
      {canWrite&&creatingTemplate&&<form id="fare-template-create" className={styles.templateCreate} onSubmit={async e=>{e.preventDefault();if(disabled)return;pendingTemplate.current={code:code.trim(),ids:query.data?.map(row=>row.id)??[]};await mutation.run(async()=>{const created=await cruisePackageApi.createTemplate(code.trim());if(created.code!==code.trim())throw new Error('Chưa xác nhận đúng mẫu vừa tạo.');setSelected(created.id);setNewTemplateId(created.id);setCode('');setCreatingTemplate(false)},'Đã tạo mẫu. Tiếp tục tạo phiên bản để cấu hình nội dung.')}}>
        <Field htmlFor="fare-template-code" label="Mã mẫu mới *" hint="Ví dụ ROYAL. Tên hành khách nhìn thấy được nhập khi soạn phiên bản."><input ref={codeInput} id="fare-template-code" required maxLength={50} value={code} disabled={disabled} onChange={e=>setCode(e.target.value)}/></Field><Button type="submit" disabled={disabled||!code.trim()}>{mutation.busy?'Đang tạo…':'Tạo mẫu'}</Button>
      </form>}
    </Panel>}
    {template&&<TemplateVersions key={template.id} template={template} startNew={template.id===newTemplateId} readOnly={disabled} onChanged={refresh}/>}
  </div></AdminShell>
}
