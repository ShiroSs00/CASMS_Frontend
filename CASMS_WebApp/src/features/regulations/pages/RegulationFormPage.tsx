import { FormErrorSummary } from '@/shared/ui'
import { useSessionAccess } from '@/shared/auth'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router'

import { ApiError } from '@/shared/api'

import { regulationsApi } from '../api/regulations-api'
import type {
  MockRegulation,
  RegulationDraft,
  RegulationScope,
  RegulationType,
  RegulationUnit,
  RegulationUpdate,
} from '../model/regulation'
import {
  AdminFrame,
  Button,
  Field,
  LoadingPanel,
  Notice,
  PageHeader,
  Panel,
} from '../components/RegulationUI'
import styles from '../components/Regulations.module.css'

type FormErrors = Partial<Record<keyof RegulationDraft, string>>

const initialDraft: RegulationDraft = {
  code: '',
  name: '',
  description: '',
  type: 'SPEED',
  scope: 'GLOBAL',
  value: '',
  unit: 'KNOT',
  effectiveFrom: '',
  effectiveTo: null,
}

function validate(draft: RegulationDraft) {
  const errors: FormErrors = {}
  const code = draft.code.trim().toUpperCase()
  if (code && !/^[A-Z0-9_-]{3,30}$/.test(code)) errors.code = 'Mã quy định từ 3 đến 30 ký tự (chữ in hoa, số, gạch nối hoặc gạch dưới, VD: REG-SPD-01).'

  const name = draft.name.trim()
  if (!name) errors.name = 'Vui lòng nhập tên quy định.'
  else if (name.length < 3 || name.length > 150) errors.name = 'Tên quy định phải từ 3 đến 150 ký tự.'

  const val = draft.value.trim()
  if (!val) errors.value = 'Vui lòng nhập giá trị quy định.'
  else if (val.length > 100) errors.value = 'Giá trị quy định không được vượt quá 100 ký tự.'
  else if (draft.type === 'SPEED') {
    const num = Number(val)
    if (isNaN(num) || num <= 0 || num > 100) errors.value = 'Tốc độ phải là số dương hợp lệ từ 0.1 đến 100 hải lý/h.'
  } else if (draft.type === 'CAPACITY') {
    const num = Number(val)
    if (!Number.isSafeInteger(num) || num <= 0 || num > 100000) errors.value = 'Sức chứa phải là số nguyên dương hợp lệ.'
  } else if (draft.unit === 'PERCENT') {
    const num = Number(val)
    if (isNaN(num) || num < 0 || num > 100) errors.value = 'Tỷ lệ phần trăm phải từ 0 đến 100.'
  }

  if (!draft.effectiveFrom) errors.effectiveFrom = 'Vui lòng chọn thời điểm bắt đầu hiệu lực.'
  else if (Number.isNaN(Date.parse(draft.effectiveFrom))) errors.effectiveFrom = 'Thời điểm bắt đầu không hợp lệ.'

  if (draft.effectiveTo) {
    if (Number.isNaN(Date.parse(draft.effectiveTo))) errors.effectiveTo = 'Thời điểm kết thúc không hợp lệ.'
    else if (new Date(draft.effectiveTo).getTime() <= new Date(draft.effectiveFrom).getTime()) {
      errors.effectiveTo = 'Thời điểm kết thúc phải sau thời điểm bắt đầu.'
    }
  }
  return errors
}

function toDraft(regulation: MockRegulation): RegulationDraft {
  const localTime = (value: string) => {
    const date = new Date(value)
    return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
  }
  return {
    code: regulation.code,
    name: regulation.name,
    description: regulation.description,
    type: regulation.type,
    scope: regulation.scope,
    value: regulation.value,
    unit: regulation.unit,
    effectiveFrom: localTime(regulation.effectiveFrom),
    effectiveTo: regulation.effectiveTo ? localTime(regulation.effectiveTo) : null,
  }
}

export function RegulationFormPage() {
  const access = useSessionAccess()
  const { regulationId } = useParams()
  const isEdit = Boolean(regulationId)
  const navigate = useNavigate()
  const [draft, setDraft] = useState<RegulationDraft>(initialDraft)
  const [source, setSource] = useState<MockRegulation | null>(null)
  const [errors, setErrors] = useState<FormErrors>({})
  const [loading, setLoading] = useState(isEdit)
  const [notFound, setNotFound] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const submitLock = useRef(false)

  useEffect(() => {
    if (!regulationId) return
    let active = true
    void regulationsApi.get(regulationId).then((result) => {
      if (!active) return
      if (!result) {
        setNotFound(true)
      } else {
        setSource(result.regulation)
        setDraft(toDraft(result.regulation))
      }
      setLoading(false)
    }).catch((error: unknown) => {
      if (!active) return
      setSubmitError(error instanceof Error ? error.message : 'Không tải được quy định.')
      setLoading(false)
    })
    return () => {
      active = false
    }
  }, [regulationId])

  const setValue = <K extends keyof RegulationDraft>(
    key: K,
    value: RegulationDraft[K],
  ) => {
    setDraft((current) => ({ ...current, [key]: value }))
    setErrors((current) => ({ ...current, [key]: undefined }))
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (submitLock.current || (isEdit && !source)) return
    if (!access.canDo(isEdit ? 'REGULATION_UPDATE' : 'REGULATION_CREATE')) { setSubmitError('Tài khoản chưa có quyền lưu quy định.'); return }
    const nextErrors = validate(draft)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) {
      document.querySelector<HTMLElement>('[data-form-error="true"]')?.focus()
      return
    }
    submitLock.current = true
    setSubmitting(true)
    setSubmitError('')
    try {
      let saved: MockRegulation
      if (source) {
        const update: RegulationUpdate = { ...draft, version: source.version }
        if (source.hasBeenActive) delete update.value
        saved = await regulationsApi.update(source.id, update)
      } else {
        saved = await regulationsApi.create(draft)
      }
      navigate(`/admin/regulations/${saved.id}`)
    } catch (error) {
      if (error instanceof ApiError && error.code === 'DUPLICATE_CODE') {
        setErrors((current) => ({ ...current, code: 'Mã quy định đã tồn tại.' }))
      } else {
        setSubmitError(
          error instanceof ApiError && error.code === 'STALE_DATA'
            ? 'Dữ liệu đã thay đổi. Hãy tải lại bản mới và đối chiếu trước khi lưu.'
            : `${error instanceof ApiError ? error.message : 'Không thể lưu quy định.'} Dữ liệu bạn nhập vẫn được giữ nguyên.`,
        )
      }
    } finally {
      submitLock.current = false
      setSubmitting(false)
    }
  }

  if (loading) {
    return <AdminFrame><LoadingPanel label="Đang tải biểu mẫu…" /></AdminFrame>
  }

  if (notFound) {
    return (
      <AdminFrame>
        <PageHeader title="Không tìm thấy quy định" description="Không thể mở biểu mẫu chỉnh sửa." />
        <Notice title="Dữ liệu không tồn tại" tone="error">
          <Button onClick={() => navigate('/admin/regulations')} tone="secondary">Về danh sách</Button>
        </Notice>
      </AdminFrame>
    )
  }

  return (
    <AdminFrame>
      <PageHeader
        title={isEdit ? 'Chỉnh sửa quy định' : 'Tạo quy định'}
        description={
          isEdit
            ? `${source?.code ?? 'Chưa tải được quy định'} · Chỉ các trường được phép mới có thể cập nhật.`
            : 'Quy định mới được lưu ở trạng thái DRAFT.'
        }
      />
      {source?.hasBeenActive ? (
        <Notice title="Giá trị đã được bảo vệ" tone="warning">
          <span id="protected-value-note">
            Quy định từng ACTIVE nên giá trị được giữ nguyên khi cập nhật.
          </span>
        </Notice>
      ) : null}
      {submitError ? <Notice title="Không lưu được dữ liệu" tone="error" role="alert">{submitError}</Notice> : null}

      <form noValidate onSubmit={(event) => void submit(event)}>
        <Panel title="Thông tin quy định">
          <FormErrorSummary errors={errors} />
          <div className={styles.formGrid}>
            <Field error={errors.name} htmlFor="name" label="Tên quy định">
              <input
                aria-invalid={Boolean(errors.name)}
                data-form-error={Boolean(errors.name)}
                id="name"
                maxLength={150}
                onChange={(event) => setValue('name', event.target.value)}
                value={draft.name}
              />
            </Field>
            <Field htmlFor="type" label="Loại quy định">
              <select
                id="type"
                onChange={(event) => setValue('type', event.target.value as RegulationType)}
                value={draft.type}
              >
                <option value="SPEED">Tốc độ</option>
                <option value="CAPACITY">Sức chứa</option>
                <option value="SAFETY">An toàn</option>
                <option value="WEATHER">Thời tiết</option>
                <option value="ENVIRONMENT">Môi trường</option>
                <option value="HEALTH">Sức khỏe</option>
              </select>
            </Field>
            <Field htmlFor="scope" label="Phạm vi">
              <select
                id="scope"
                onChange={(event) => setValue('scope', event.target.value as RegulationScope)}
                value={draft.scope}
              >
                <option value="GLOBAL">GLOBAL · Toàn hệ thống</option>
                <option value="SHIP">SHIP · Theo tàu</option>
                <option value="CRUISE">CRUISE · Theo chuyến</option>
              </select>
            </Field>
            <Field error={errors.value} htmlFor="value" label="Giá trị">
              {source?.hasBeenActive ? (
                <input
                  aria-describedby="protected-value-note"
                  id="value"
                  readOnly
                  value={source.value}
                />
              ) : (
                <input
                  aria-invalid={Boolean(errors.value)}
                  data-form-error={Boolean(errors.value)}
                  id="value"
                  onChange={(event) => setValue('value', event.target.value)}
                  maxLength={100}
                  value={draft.value}
                />
              )}
            </Field>
            <Field htmlFor="unit" label="Đơn vị">
              <select
                id="unit"
                onChange={(event) =>
                  setValue('unit', (event.target.value || null) as RegulationUnit | null)
                }
                value={draft.unit ?? ''}
              >
                <option value="">Không áp dụng</option>
                <option value="KNOT">KNOT</option>
                <option value="KM">KM</option>
                <option value="METER">METER</option>
                <option value="PERCENT">PERCENT</option>
                <option value="PERSON">PERSON</option>
                <option value="CELSIUS">CELSIUS</option>
                <option value="NONE">NONE</option>
              </select>
            </Field>
            <Field error={errors.effectiveFrom} htmlFor="effective-from" label="Bắt đầu hiệu lực">
              <input
                aria-invalid={Boolean(errors.effectiveFrom)}
                data-form-error={Boolean(errors.effectiveFrom)}
                id="effective-from"
                onChange={(event) => setValue('effectiveFrom', event.target.value)}
                type="datetime-local"
                value={draft.effectiveFrom}
              />
            </Field>
            <Field error={errors.effectiveTo} htmlFor="effective-to" label="Kết thúc hiệu lực">
              <input
                aria-invalid={Boolean(errors.effectiveTo)}
                data-form-error={Boolean(errors.effectiveTo)}
                id="effective-to"
                onChange={(event) => setValue('effectiveTo', event.target.value || null)}
                type="datetime-local"
                value={draft.effectiveTo ?? ''}
              />
            </Field>
            <div className={styles.fullWidth}>
              <Field htmlFor="description" label="Mô tả">
                <textarea
                  id="description"
                  onChange={(event) => setValue('description', event.target.value)}
                  value={draft.description}
                />
              </Field>
            </div>
          </div>
          <div className={styles.formActions}>
            {access.canDo(isEdit ? 'REGULATION_UPDATE' : 'REGULATION_CREATE') && <Button disabled={submitting || !access.canDo(isEdit ? 'REGULATION_UPDATE' : 'REGULATION_CREATE') || (isEdit && !source)} type="submit">
              {submitting ? 'Đang lưu…' : 'Lưu quy định'}
            </Button>}
            <Button
              disabled={submitting}
              onClick={() => navigate(source ? `/admin/regulations/${source.id}` : '/admin/regulations')}
              tone="secondary"
            >
              Hủy
            </Button>
          </div>
        </Panel>
      </form>
    </AdminFrame>
  )
}
