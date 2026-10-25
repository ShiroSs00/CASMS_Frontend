import { FormErrorSummary } from '@/shared/ui'
import { useCallback, useRef, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router'
import { useReadQuery } from '@/shared/api'
import { useSessionAccess } from '@/shared/auth'
import { Button, ButtonLink, Field, Notice, PageHeader, Panel } from '@/shared/ui'
import { servicePackageApi } from '../api/service-package-api'
import { CatalogFrame, CatalogState } from '../components/CatalogUI'
import { catalogConfig, type CatalogItem, type CatalogKind } from '../model/catalog'
import { catalogDraft, packageTypes, serviceTypes, productTypes, catalogPermission, emptyCatalogDraft, validateCatalogDraft, type CatalogDraft } from '../model/catalog-editor'
import styles from '../components/Catalog.module.css'

function CatalogFormPage({ kind }: { kind: CatalogKind }) {
  const { id } = useParams()
  const load = useCallback((signal: AbortSignal) => id ? servicePackageApi.get(kind, id, signal) : Promise.resolve(null), [kind, id])
  const query = useReadQuery(`catalog-form:${kind}:${id}`, load)
  return <CatalogFrame><PageHeader breadcrumb="DỊCH VỤ TÀU / DANH MỤC" title={`${id ? 'Chỉnh sửa' : 'Tạo'} ${catalogConfig[kind].label.toLocaleLowerCase('vi')}`} description="Thông tin cung cấp và giá được lưu theo danh mục riêng; không tự tạo đặt chỗ hoặc bán hàng." actions={<ButtonLink tone="secondary" to={id ? `${catalogConfig[kind].route}/${id}` : catalogConfig[kind].route}>Quay lại</ButtonLink>} />
    {id && <CatalogState {...query} />}
    {(!id || query.data) && (kind === 'packages' && query.data && query.data.status !== 'DRAFT' ? <Notice title="Không thể sửa gói này">Chỉ gói nháp chưa được phân bổ mới được chỉnh sửa.</Notice> : <CatalogEditor key={`${kind}:${id}`} kind={kind} initial={query.data ?? undefined} />)}
  </CatalogFrame>
}
function CatalogEditor({ kind, initial }: { kind: CatalogKind; initial?: CatalogItem }) {
  const access = useSessionAccess(), navigate = useNavigate()
  const [draft, setDraft] = useState<CatalogDraft>(() => initial ? catalogDraft(initial) : { ...emptyCatalogDraft })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [error, setError] = useState(''), [busy, setBusy] = useState(false)
  const lock = useRef(false), form = useRef<HTMLFormElement>(null)
  const allowed = access.canDo(catalogPermission(kind, initial ? 'update' : 'create'))
  const canReadTypes = kind === 'services' ? access.canDo('SERVICE_READ') : kind === 'products' && access.canDo('PRODUCT_MANAGE')
  const knownTypes = useReadQuery(`catalog-types:${access.userId}:${kind}:${canReadTypes}`, useCallback(signal => canReadTypes ? servicePackageApi.list(kind, signal) : Promise.resolve([]), [kind, canReadTypes]))
  const typeOptions = new Map(Object.entries(kind === 'packages' ? packageTypes : kind === 'services' ? serviceTypes : productTypes))
  for (const row of knownTypes.data ?? []) if (row.type.trim() && row.type.length <= 50 && !typeOptions.has(row.type)) typeOptions.set(row.type, row.type)
  if (initial?.type && !typeOptions.has(initial.type)) typeOptions.set(initial.type, initial.type)
  const fields: { key: keyof CatalogDraft; label: string; type?: string; maxLength?: number }[] = [{ key: 'name', label: 'Tên *', maxLength: 200 }, { key: 'type', label: 'Loại *', maxLength: 50 }, { key: 'price', label: kind === 'services' ? 'Giá (không bắt buộc)' : 'Giá *', type: 'number' }, { key: 'currency', label: 'Mã tiền tệ (mặc định USD)', maxLength: 3 }, ...(kind === 'services' ? [{ key: 'capacity' as const, label: 'Sức chứa cấu hình', type: 'number' }] : []), ...(kind === 'packages' ? [{ key: 'startDate' as const, label: 'Có hiệu lực từ', type: 'date' }, { key: 'endDate' as const, label: 'Đến hết ngày', type: 'date' }] : [])]
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (lock.current || !allowed) return
    const invalid = validateCatalogDraft(kind, draft); setErrors(invalid); setError('')
    if (Object.keys(invalid).length) { form.current?.querySelector<HTMLElement>(`[name="${Object.keys(invalid)[0]}"]`)?.focus(); return }
    lock.current = true; setBusy(true)
    try { const saved = await servicePackageApi.save(kind, draft, initial?.id); navigate(`${catalogConfig[kind].route}/${saved.id}`) }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Chưa lưu được danh mục. Dữ liệu đã nhập được giữ lại.') }
    finally { lock.current = false; setBusy(false) }
  }
  return <Panel title="Thông tin danh mục"><form ref={form} onSubmit={submit} noValidate className={styles.editor}>
    <FormErrorSummary errors={errors} />
    {kind === 'packages' && <p className={styles.fullRow}>Đặt tên gói tùy chỉnh, chọn mức gói rồi thêm dịch vụ và quyền lợi trong trang chi tiết. Chọn Bổ sung (Extra) cho gói mua thêm.</p>}
    {knownTypes.error && <Notice title="Chưa cập nhật được các loại đang dùng" tone="warning">Bạn vẫn có thể chọn các loại có sẵn.<Button tone="secondary" onClick={knownTypes.retry}>Tải lại loại</Button></Notice>}
    {!allowed && <Notice title="Chưa có quyền lưu" tone="warning">{access.error || 'Đang tải quyền hoặc tài khoản chưa được cấp quyền thao tác này.'}</Notice>}
    {fields.map(field => <Field key={field.key} htmlFor={`catalog-${field.key}`} label={field.label} error={errors[field.key]}>
      {field.key === 'type' ? <select id={`catalog-${field.key}`} name={field.key} required aria-invalid={Boolean(errors.type)} value={draft.type} disabled={busy} onChange={event => setDraft({ ...draft, type: event.target.value })}><option value="">Chọn loại {catalogConfig[kind].label.toLocaleLowerCase('vi')}</option>{[...typeOptions].map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
        : <input id={`catalog-${field.key}`} name={field.key} type={field.type ?? 'text'} maxLength={field.maxLength} min={field.type === 'number' ? 0 : undefined} step={field.key === 'capacity' ? 1 : field.type === 'number' ? 'any' : undefined} disabled={busy} value={draft[field.key]} aria-invalid={Boolean(errors[field.key])} onChange={event => setDraft({ ...draft, [field.key]: field.key === 'currency' ? event.target.value.toUpperCase() : event.target.value })} />}
    </Field>)}
    <div className={styles.fullRow}><Field htmlFor="catalog-description" label="Mô tả" error={errors.description}><textarea id="catalog-description" name="description" maxLength={1000} disabled={busy} value={draft.description} onChange={event => setDraft({ ...draft, description: event.target.value })} /></Field></div>
    {error && <Notice title="Không lưu được danh mục" tone="error">{error}</Notice>}
    <div className={styles.editorActions}><ButtonLink tone="secondary" to={catalogConfig[kind].route}>Hủy</ButtonLink><Button type="submit" disabled={busy || !allowed}>{busy ? 'Đang lưu…' : 'Lưu danh mục'}</Button></div>
  </form></Panel>
}
export function ServiceFormPage() { return <CatalogFormPage kind="services" /> }
export function ProductFormPage() { return <CatalogFormPage kind="products" /> }
export function PackageFormPage() { return <CatalogFormPage kind="packages" /> }
