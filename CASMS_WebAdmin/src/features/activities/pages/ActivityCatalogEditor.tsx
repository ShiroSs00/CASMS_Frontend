import { useRef, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { ApiError } from '@/shared/api'
import { useSessionAccess } from '@/shared/auth'
import { mutationOutcomeUnknown } from '@/shared/lib/mutation-outcome'
import { Button, ButtonLink, EditorLayout, Field, FormErrorSummary, FormSection, Notice, PageHeader, Panel, useUnsavedFormGuard } from '@/shared/ui'
import { activityApi, type ActivityCatalogEntry } from '../api/activity-api'
import { ActivityFrame } from '../components/ActivityUI'
import { isActivityCurrency } from '../model/activity'
import styles from '../components/Activities.module.css'

const categories = {
  ENTERTAINMENT: 'Giải trí & nghệ thuật',
  SPORTS_WELLNESS: 'Thể thao & sức khỏe',
  FAMILY_KIDS: 'Gia đình & trẻ em',
  SPECIAL_EVENTS: 'Sự kiện đặc biệt',
}

export function ActivityCatalogEditor({ initial }: { initial?: ActivityCatalogEntry }) {
  const access = useSessionAccess(), navigate = useNavigate()
  const [draft, setDraft] = useState({
    activityName: initial?.name ?? '', description: initial?.description ?? '', category: initial?.category ?? '',
    capacity: initial?.capacity?.toString() ?? '', price: initial?.price?.toString() ?? '', currencyCode: initial?.currencyCode ?? 'VND',
  })
  const [baseline] = useState(draft)
  const lock = useRef(false)
  const form = useRef<HTMLFormElement>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false), [uncertain, setUncertain] = useState(false), [error, setError] = useState('')
  const guard = useUnsavedFormGuard(JSON.stringify(draft) !== JSON.stringify(baseline), busy)
  const allowed = access.canDo(initial ? 'ACTIVITY_UPDATE' : 'ACTIVITY_CREATE')
  const back = initial ? `/admin/activities/${initial.id}` : '/admin/activities'

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (lock.current || !allowed || uncertain) return
    const capacity = Number(draft.capacity), price = draft.price === '' ? null : Number(draft.price)
    const invalid: Record<string, string> = {}
    if (!draft.activityName.trim()) invalid.activityName = 'Nhập tên hoạt động.'
    if (!Number.isSafeInteger(capacity) || capacity < 1 || capacity > 2147483647) invalid.capacity = 'Nhập sức chứa là số nguyên dương hợp lệ.'
    if (price != null && (!Number.isFinite(price) || price < 0)) invalid.price = 'Nhập giá là số không âm.'
    const currency = draft.currencyCode
    if (!isActivityCurrency(currency)) invalid.currencyCode = 'Chọn VND hoặc USD.'
    setErrors(invalid)
    setError('')
    if (Object.keys(invalid).length || !isActivityCurrency(currency)) {
      requestAnimationFrame(() => form.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus())
      return
    }
    lock.current = true
    setBusy(true)
    setError('')
    let savedId: string | undefined
    try {
      const saved = await activityApi.saveCatalog({
        activityName: draft.activityName.trim(), description: draft.description.trim() || null,
        category: draft.category || null, capacity, price, currencyCode: currency,
      }, initial?.id)
      savedId = saved.id
      const actual = await activityApi.read(savedId)
      if (actual.catalogEntry !== true || (initial && actual.id !== initial.id)
          || actual.name !== draft.activityName.trim() || actual.capacity !== capacity
          || (actual.description ?? '') !== draft.description.trim() || (actual.category ?? '') !== draft.category
          || actual.price !== (price ?? 0) || actual.currencyCode !== currency) {
        throw new ApiError('Phản hồi chưa xác nhận đúng hoạt động đã lưu.', 502)
      }
      guard.allowLeave()
      navigate(`/admin/activities/${saved.id}`)
    } catch (reason) {
      setUncertain(Boolean(savedId) || mutationOutcomeUnknown(reason))
      setError(reason instanceof Error ? reason.message : 'Chưa lưu được hoạt động.')
    } finally {
      lock.current = false
      setBusy(false)
    }
  }

  const update = (field: keyof typeof draft, value: string) => setDraft(current => ({ ...current, [field]: value }))
  return <ActivityFrame>
    <PageHeader breadcrumb="QUẢN LÝ HOẠT ĐỘNG / KHO MẪU" title={initial ? 'Chỉnh sửa hoạt động mẫu' : 'Tạo hoạt động mẫu (dùng chung)'}
      description="Lưu thông tin chuẩn (tên, nhóm, sức chứa mặc định, giá tham chiếu) vào kho để dùng lại cho nhiều chuyến. Giờ tổ chức và boong cụ thể sẽ được chọn trong Chương trình của từng chuyến." />
    <EditorLayout><Panel title="Thông tin hoạt động"><form ref={form} onSubmit={submit} noValidate>
      <FormErrorSummary errors={errors} />
      <fieldset className={styles.form} disabled={busy || uncertain || !allowed}>
        <FormSection title="Thông tin hoạt động">
        <Field htmlFor="catalog-activity-name" label="Tên hoạt động *" error={errors.activityName}><input id="catalog-activity-name" required maxLength={200} value={draft.activityName} onChange={e => update('activityName', e.target.value)} /></Field>
        <Field htmlFor="catalog-activity-category" label="Nhóm hoạt động"><select id="catalog-activity-category" value={draft.category} onChange={e => update('category', e.target.value)}>
          <option value="">Chưa phân nhóm</option>{Object.entries(categories).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select></Field>
        </FormSection>
        <FormSection title="Giá và sức chứa">
        <Field htmlFor="catalog-activity-capacity" label="Sức chứa *" error={errors.capacity}><input id="catalog-activity-capacity" type="number" min={1} max={2147483647} step={1} required value={draft.capacity} onChange={e => update('capacity', e.target.value)} /></Field>
        <Field htmlFor="catalog-activity-price" label="Giá tham chiếu" error={errors.price}><input id="catalog-activity-price" type="number" min={0} step="any" value={draft.price} onChange={e => update('price', e.target.value)} /></Field>
        <Field htmlFor="catalog-activity-currency" label="Đơn vị tiền tệ" error={errors.currencyCode}>
          <select value={draft.currencyCode} onChange={e => update('currencyCode', e.target.value)}>
            {!isActivityCurrency(draft.currencyCode) && <option value={draft.currencyCode}>{draft.currencyCode}</option>}
            <option value="VND">VND · Đồng Việt Nam</option><option value="USD">USD · Đô la Mỹ</option>
          </select>
        </Field>
        </FormSection>
        <FormSection title="Nội dung giới thiệu">
        <Field htmlFor="catalog-activity-description" label="Mô tả"><textarea id="catalog-activity-description" maxLength={1000} value={draft.description} onChange={e => update('description', e.target.value)} /></Field>
        </FormSection>
      </fieldset>
      {!allowed && <Notice title="Chưa có quyền lưu hoạt động" tone="warning">Tài khoản cần quyền chỉnh sửa danh mục hoạt động.</Notice>}
      {error && <Notice title={uncertain ? 'Cần đối chiếu hoạt động đã lưu' : 'Chưa lưu được hoạt động'} tone="error">{error}{uncertain && <p>Kiểm tra danh mục trước khi gửi thêm yêu cầu.</p>}</Notice>}
      <div className={styles.actions}><ButtonLink tone="secondary" to={back}>Quay lại</ButtonLink>
        <Button type="submit" busy={busy} disabled={!allowed || uncertain}>{busy ? 'Đang lưu…' : 'Lưu hoạt động'}</Button>
      </div>
    </form></Panel></EditorLayout>
    {guard.prompt}
  </ActivityFrame>
}
