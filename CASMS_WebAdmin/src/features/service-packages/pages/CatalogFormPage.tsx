import {apiRequest} from '@/shared/api'
import {businessCopy} from '@/shared/i18n/business-copy'
import {mutationOutcomeUnknown} from '@/shared/lib/mutation-outcome'
import { EditorLayout,useUnsavedFormGuard } from '@/shared/ui'
import { FormErrorSummary } from '@/shared/ui'
import { useCallback, useRef, useState, type FormEvent } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import {readinessContextReturn} from '@/shared/lib/cruise-context'
import { useReadQuery } from '@/shared/api'
import { useSessionAccess } from '@/shared/auth'
import { Button, ButtonLink, Field, FormSection, Notice, PageHeader, Panel } from '@/shared/ui'
import { servicePackageApi } from '../api/service-package-api'
import { CatalogFrame, CatalogState } from '../components/CatalogUI'
import { catalogConfig, servicePurchaseFlags, serviceUsagePolicyLabels, type CatalogItem, type CatalogKind } from '../model/catalog'
import { catalogDraft, packageTypes, serviceTypes, productTypes, catalogPermission, emptyCatalogDraft, validateCatalogDraft, catalogMatchesDraft, type CatalogDraft } from '../model/catalog-editor'
import styles from '../components/Catalog.module.css'

function CatalogFormPage({ kind }: { kind: CatalogKind }) {
  const { id } = useParams()
  const access=useSessionAccess()
  const [params]=useSearchParams(),returnTo=readinessContextReturn(params,kind==='packages'?'PACKAGE':kind.toUpperCase(),id)
  const load = useCallback((signal: AbortSignal) => id ? servicePackageApi.get(kind, id, signal) : Promise.resolve(null), [kind, id])
  const query = useReadQuery(`catalog-form:${access.userId}:${kind}:${id}`, load)
  return <CatalogFrame><PageHeader breadcrumb="DỊCH VỤ TÀU / DANH MỤC" title={`${id ? 'Chỉnh sửa' : 'Tạo'} ${catalogConfig[kind].label.toLocaleLowerCase('vi')}`}  actions={<ButtonLink tone="secondary" to={returnTo??(id ? `${catalogConfig[kind].route}/${id}` : catalogConfig[kind].route)}>Quay lại</ButtonLink>} />
    {id && <CatalogState {...query} />}
    {(!id || query.data) && (kind === 'packages' && query.data && query.data.status !== 'DRAFT' ? <Notice title="Không thể sửa gói này">Chỉ gói nháp chưa được phân bổ mới được chỉnh sửa.</Notice> : <CatalogEditor key={`${kind}:${id}`} kind={kind} initial={query.data ?? undefined} />)}
  </CatalogFrame>
}
function CatalogEditor({ kind, initial }: { kind: CatalogKind; initial?: CatalogItem }) {
  const access = useSessionAccess(), navigate = useNavigate()
  const [params]=useSearchParams(),returnTo=readinessContextReturn(params,kind==='packages'?'PACKAGE':kind.toUpperCase(),initial?.id)
  const [draft, setDraft] = useState<CatalogDraft>(() => initial ? {...catalogDraft(initial),currency:'USD',price:initial.currency==='USD'?catalogDraft(initial).price:''} : { ...emptyCatalogDraft,currency:'USD' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [error, setError] = useState(''), [busy, setBusy] = useState(false),[uncertain,setUncertain]=useState(false)
  const [baseline] = useState(draft)
  const beforeIds=useRef<string[]|null>(null)
  const dirty=JSON.stringify(draft)!==JSON.stringify(baseline),guard=useUnsavedFormGuard(dirty,busy)
  const lock = useRef(false), form = useRef<HTMLFormElement>(null)
  const allowed = access.canDo(catalogPermission(kind, initial ? 'update' : 'create'))
  const canReadTypes = kind === 'services' ? access.canDo('SERVICE_READ') : kind === 'products' && access.canDo('PRODUCT_MANAGE')
  const knownTypes = useReadQuery(`catalog-types:${access.userId}:${kind}:${canReadTypes}`, useCallback(signal => canReadTypes ? servicePackageApi.list(kind, signal) : Promise.resolve([]), [kind, canReadTypes]))
  const categories=useReadQuery(`service-category-options:${access.userId}:${kind}`,useCallback(signal=>kind==='services'?apiRequest<{id:string;name:string}[]>('/servicepackage/service-categories',{signal}):Promise.resolve([]),[kind]))
  const typeOptions = new Map(Object.entries(kind === 'packages' ? packageTypes : kind === 'services' ? serviceTypes : productTypes))
  for (const row of knownTypes.data ?? []) if (row.type.trim() && row.type.length <= 50 && !typeOptions.has(row.type)) typeOptions.set(row.type, row.type)
  if (initial?.type && !typeOptions.has(initial.type)) typeOptions.set(initial.type, initial.type)
  const fields: { key: keyof CatalogDraft; label: string; type?: string; maxLength?: number }[] = [{ key: 'name', label: 'Tên *', maxLength: 200 }, { key: 'type', label: 'Loại *', maxLength: 50 }, { key: 'price', label: businessCopy('program.field.priceUsd'), type: 'number' }, ...(kind === 'services' ? [{ key: 'capacity' as const, label: 'Sức chứa cấu hình', type: 'number' }] : []), ...(kind === 'packages' ? [{ key: 'startDate' as const, label: 'Có hiệu lực từ', type: 'date' }, { key: 'endDate' as const, label: 'Đến hết ngày', type: 'date' }] : [])]
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (lock.current || !allowed || uncertain) return
    const invalid = validateCatalogDraft(kind, draft); setErrors(invalid); setError('')
    if (Object.keys(invalid).length) { form.current?.querySelector<HTMLElement>(`[name="${Object.keys(invalid)[0]}"]`)?.focus(); return }
    beforeIds.current=knownTypes.data?.map(row=>row.id)??null
    lock.current = true; setBusy(true)
    try { const saved = await servicePackageApi.save(kind, draft, initial?.id);if(initial&&saved.id!==initial.id||!catalogMatchesDraft(kind,saved,draft))throw new Error('Phản hồi chưa xác nhận đúng nội dung đã lưu.');const persisted=await servicePackageApi.get(kind,saved.id);if(persisted.id!==saved.id||!catalogMatchesDraft(kind,persisted,draft))throw new Error('Chưa đối chiếu được nội dung danh mục đã lưu.');guard.allowLeave();navigate(returnTo??`${catalogConfig[kind].route}/${saved.id}`) }
    catch (reason) { setUncertain(mutationOutcomeUnknown(reason));setError(reason instanceof Error ? reason.message : 'Chưa lưu được danh mục. Dữ liệu đã nhập được giữ lại.') }
    finally { lock.current = false; setBusy(false) }
  }
  async function reconcile(){
    if(lock.current)return
    lock.current=true;setBusy(true)
    try {
      const rows=initial?[await servicePackageApi.get(kind,initial.id)]:await servicePackageApi.list(kind)
      const matches=rows.filter(row=>(initial?row.id===initial.id:beforeIds.current!==null&&!beforeIds.current.includes(row.id))&&catalogMatchesDraft(kind,row,draft))
      if(matches.length!==1){setError('Chưa xác định được đúng bản ghi đã lưu. Không tự gửi lại thao tác.');return}
      setUncertain(false);guard.allowLeave();navigate(returnTo??`${catalogConfig[kind].route}/${matches[0].id}`)
    }catch(reason){setError(reason instanceof Error?reason.message:'Chưa đối chiếu được dữ liệu.')}
    finally{lock.current=false;setBusy(false)}
  }
  return <EditorLayout ><Panel title="Thông tin danh mục"><form ref={form} onSubmit={submit} noValidate className={styles.editor}><fieldset disabled={busy||uncertain} className={styles.catalogFields}>
    <FormErrorSummary errors={errors} />
    {kind === 'packages' && <Notice title="Danh mục gói dịch vụ">Dữ liệu cấu hình gói dịch vụ dùng chung. Gói bán chi tiết theo từng chuyến khởi hành được quản lý tại Gói du thuyền.</Notice>}
    {knownTypes.error && <Notice title="Chưa cập nhật được các loại đang dùng" tone="warning">Bạn vẫn có thể chọn các loại có sẵn.<Button tone="secondary" onClick={knownTypes.retry}>Tải lại loại</Button></Notice>}
    {!allowed && <Notice title="Chưa có quyền lưu" tone="warning">{access.error || 'Đang tải quyền hoặc tài khoản chưa được cấp quyền thao tác này.'}</Notice>}
    {[
      { title: 'Thông tin danh mục', description: 'Tên và loại giúp nhân sự tìm đúng thông tin.', keys: ['name', 'type'] },
      { title: 'Giá và sức chứa', description: 'Kiểm tra số tiền, mã tiền tệ và các thông tin cấu hình.', keys: ['price', 'currency', 'capacity'] },
      { title: 'Thời gian hiệu lực', description: 'Khoảng thời gian áp dụng cho gói dịch vụ.', keys: ['startDate', 'endDate'] },
    ].filter(group => fields.some(field => group.keys.includes(field.key))).map(group => <FormSection key={group.title} title={group.title} >
    {fields.filter(field => group.keys.includes(field.key)).map(field => <Field key={field.key} htmlFor={`catalog-${field.key}`} label={field.label} error={errors[field.key]}>
      {field.key === 'type' ? <select id={`catalog-${field.key}`} name={field.key} required aria-invalid={Boolean(errors.type)} value={draft.type} disabled={busy} onChange={event => setDraft({ ...draft, type: event.target.value })}><option value="">Chọn loại {catalogConfig[kind].label.toLocaleLowerCase('vi')}</option>{[...typeOptions].map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
        : <input id={`catalog-${field.key}`} name={field.key} type={field.type ?? 'text'} maxLength={field.maxLength} min={field.type === 'number' ? 0 : undefined} step={field.key === 'capacity' ? 1 : field.type === 'number' ? 'any' : undefined} disabled={busy} value={draft[field.key]} aria-invalid={Boolean(errors[field.key])} onChange={event => setDraft({ ...draft, [field.key]: field.key === 'currency' ? event.target.value.toUpperCase() : event.target.value })} />}
    </Field>)}
    </FormSection>)}
    {kind==='services'&&<FormSection title="Cách phục vụ">
      <Field htmlFor="catalog-schedule" label="Đặt dịch vụ theo lịch" error={errors.requiresSchedule}><select id="catalog-schedule" name="requiresSchedule" disabled={busy} value={draft.requiresSchedule} onChange={e=>setDraft({...draft,requiresSchedule:e.target.value})}><option value="">Chưa thay đổi cấu hình nguồn</option><option value="true">Cần lịch đặt trước</option><option value="false">Không bắt buộc lịch đặt trước</option></select></Field>
      <Field htmlFor="catalog-category" label="Nhóm dịch vụ"><select id="catalog-category" disabled={busy||categories.loading||Boolean(categories.error)} value={draft.categoryId} onChange={e=>setDraft({...draft,categoryId:e.target.value})}><option value="">Chưa chọn nhóm</option>{categories.data?.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select>{categories.error&&<Button tone="text" onClick={categories.retry}>Tải lại nhóm dịch vụ</Button>}</Field>
      <Field htmlFor="catalog-unit" label="Đơn vị phục vụ" error={errors.unitCode}><input id="catalog-unit" name="unitCode" maxLength={30} disabled={busy} value={draft.unitCode} onChange={e=>setDraft({...draft,unitCode:e.target.value})}/></Field>
    </FormSection>}
    {kind === 'services' && <FormSection title="Giai đoạn phục vụ và định mức">
      {(Object.keys(servicePurchaseFlags) as (keyof typeof servicePurchaseFlags)[]).map(key =>
        <Field key={key} htmlFor={`catalog-${key}`} label={servicePurchaseFlags[key]} error={errors[key]}>
          <select id={`catalog-${key}`} name={key} value={draft[key]} onChange={e => setDraft({...draft,[key]:e.target.value})}>
            <option value="">{initial ? 'Giữ cấu hình hiện tại' : 'Theo cấu hình hệ thống'}</option><option value="true">Có</option><option value="false">Không</option>
          </select>
        </Field>)}
      <Field htmlFor="catalog-usage-policy" label="Định mức trước chuyến">
        <select id="catalog-usage-policy" value={draft.preCruiseUsagePolicy} onChange={e => setDraft({...draft,preCruiseUsagePolicy:e.target.value as CatalogDraft['preCruiseUsagePolicy']})}>
          <option value="">{initial ? 'Giữ cấu hình hiện tại' : 'Theo cấu hình hệ thống'}</option>
          {Object.entries(serviceUsagePolicyLabels).map(([value,label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </Field>
      {draft.preCruiseUsagePolicy && draft.preCruiseUsagePolicy !== 'UNLIMITED' && <Field htmlFor="catalog-usage-limit" label="Định mức tối đa" error={errors.preCruiseUsageLimit}>
        <input id="catalog-usage-limit" name="preCruiseUsageLimit" type="number" min={1} step={1} value={draft.preCruiseUsageLimit} onChange={e=>setDraft({...draft,preCruiseUsageLimit:e.target.value})} />
      </Field>}
      <Field htmlFor="catalog-usage-zone" label="Múi giờ tính định mức" error={errors.usageTimeZone}>
        <input id="catalog-usage-zone" name="usageTimeZone" maxLength={100} value={draft.usageTimeZone} onChange={e=>setDraft({...draft,usageTimeZone:e.target.value})} />
      </Field>
    </FormSection>}
    <div className={styles.fullRow}><Field htmlFor="catalog-description" label="Mô tả" error={errors.description}><textarea id="catalog-description" name="description" maxLength={1000} disabled={busy} value={draft.description} onChange={event => setDraft({ ...draft, description: event.target.value })} /></Field></div>
    </fieldset>{error && <Notice title="Chưa lưu được danh mục" tone="error">{error}{uncertain&&<Button tone="secondary" disabled={busy} onClick={()=>void reconcile()}>Kiểm tra lại trạng thái vừa gửi</Button>}</Notice>}
    <div className={styles.editorActions}><ButtonLink tone="secondary" to={catalogConfig[kind].route}>Hủy</ButtonLink><Button type="submit" busy={busy} disabled={uncertain || !allowed}>{busy ? 'Đang lưu…' : 'Lưu danh mục'}</Button></div>
  </form></Panel>{guard.prompt}</EditorLayout>
}
export function ServiceFormPage() { return <CatalogFormPage kind="services" /> }
export function ProductFormPage() { return <CatalogFormPage kind="products" /> }
export function PackageFormPage() { return <CatalogFormPage kind="packages" /> }
