import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router'
import { ApiError } from '@/shared/api'

import { regulationAdapter } from '../api/regulation-adapter'
import { mapRegulationFieldErrors } from '../api/contract'
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
  effectiveFrom: '2026-11-20T08:00',
  effectiveTo: null,
}

function validate(draft: RegulationDraft) {
  const errors: FormErrors = {}
  if (!draft.code.trim()) errors.code = 'Vui lòng nhập mã quy định.'
  if (!draft.name.trim()) errors.name = 'Vui lòng nhập tên quy định.'
  if (!draft.value.trim()) errors.value = 'Vui lòng nhập giá trị.'
  if (!draft.effectiveFrom) errors.effectiveFrom = 'Vui lòng chọn thời điểm bắt đầu.'
  if (
    draft.effectiveTo &&
    new Date(draft.effectiveTo).getTime() <= new Date(draft.effectiveFrom).getTime()
  ) {
    errors.effectiveTo = 'Thời điểm kết thúc phải sau thời điểm bắt đầu.'
  }
  return errors
}

function toDraft(regulation: MockRegulation): RegulationDraft {
  return {
    code: regulation.code,
    name: regulation.name,
    description: regulation.description,
    type: regulation.type,
    scope: regulation.scope,
    value: regulation.value,
    unit: regulation.unit,
    effectiveFrom: regulation.effectiveFrom,
    effectiveTo: regulation.effectiveTo,
  }
}

export function RegulationFormPage() {
  const { regulationId } = useParams()
  const isEdit = Boolean(regulationId)
  const navigate = useNavigate()
  const [draft, setDraft] = useState<RegulationDraft>(initialDraft)
  const [source, setSource] = useState<MockRegulation | null>(null)
  const [errors, setErrors] = useState<FormErrors>({})
  const [loading, setLoading] = useState(isEdit)
  const [notFound, setNotFound] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')

  useEffect(() => {
    if (!regulationId) return
    let active = true
    void regulationAdapter.get(regulationId)
      .then((result) => {
        if (!active) return
        if (!result) {
          setNotFound(true)
        } else {
          setSource(result.regulation)
          setDraft(toDraft(result.regulation))
        }
      })
      .catch((error: unknown) => {
        if (!active) return
        setLoadError(error instanceof Error ? error.message : 'Không thể tải dữ liệu quy định.')
      })
      .finally(() => {
        if (active) setLoading(false)
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
    if (submitting) return
    const nextErrors = validate(draft)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) {
      document.querySelector<HTMLElement>('[data-form-error="true"]')?.focus()
      return
    }
    setSubmitting(true)
    setSubmitError('')
    try {
      let saved: MockRegulation
      if (source) {
        const update: RegulationUpdate = { ...draft, version: source.version }
        if (source.hasBeenActive) delete update.value
        saved = await regulationAdapter.update(source.id, update)
      } else {
        saved = await regulationAdapter.create(draft)
      }
      navigate(`/admin/regulations/${saved.id}`)
    } catch (error) {
      if (error instanceof ApiError && error.code === 'DUPLICATE_CODE') {
        setErrors((current) => ({ ...current, code: 'Mã quy định đã tồn tại.' }))
      } else {
        if (error instanceof ApiError) setErrors(mapRegulationFieldErrors(error.details))
        setSubmitError(
          error instanceof ApiError && error.code === 'STALE_DATA'
            ? 'Dữ liệu đã thay đổi. Hãy tải lại bản mới và đối chiếu trước khi lưu.'
            : error instanceof Error ? error.message : 'Không thể lưu quy định. Dữ liệu bạn nhập vẫn được giữ nguyên.',
        )
      }
    } finally {
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

  if (loadError) {
    return (
      <AdminFrame>
        <PageHeader title="Không tải được biểu mẫu" description="Backend đã từ chối hoặc không trả được dữ liệu." />
        <Notice title="Không thể tải dữ liệu" tone="error" role="alert">
          {loadError}
          <div className={styles.formActions}>
            <Button onClick={() => navigate(0)}>Thử lại</Button>
            <Button onClick={() => navigate('/admin/regulations')} tone="secondary">Về danh sách</Button>
          </div>
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
            ? `${source?.code} · Chỉ các trường được phép mới có thể cập nhật.`
            : 'Quy định mới được lưu ở trạng thái DRAFT.'
        }
      />
      {!isEdit ? (
        <Notice title="Lưu dưới dạng bản nháp" tone="info">
          Sau khi lưu, kiểm tra lại nội dung và xung đột trước khi kích hoạt.
        </Notice>
      ) : null}
      {source?.hasBeenActive ? (
        <Notice title="Giá trị đã được bảo vệ" tone="warning">
          <span id="protected-value-note">
            FE giữ nguyên giá trị theo chính sách giao diện hiện tại. API PUT vẫn nhận đầy đủ bản ghi; BE chưa trả lịch sử ACTIVE hoặc quyền sửa từng trường.
          </span>
        </Notice>
      ) : null}
      {submitError ? <Notice title="Không lưu được dữ liệu" tone="error" role="alert">{submitError}</Notice> : null}

      <form noValidate onSubmit={(event) => void submit(event)}>
        <Panel title="Thông tin quy định">
          <div className={styles.formGrid}>
            <Field error={errors.code} htmlFor="code" label="Mã quy định">
              <input
                aria-invalid={Boolean(errors.code)}
                data-form-error={Boolean(errors.code)}
                id="code"
                onChange={(event) => setValue('code', event.target.value.toUpperCase())}
                placeholder="VD: REG-SPD-010"
                value={draft.code}
              />
            </Field>
            <Field error={errors.name} htmlFor="name" label="Tên quy định">
              <input
                aria-invalid={Boolean(errors.name)}
                data-form-error={Boolean(errors.name)}
                id="name"
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
            <Button disabled={submitting} type="submit">
              {submitting ? 'Đang lưu…' : 'Lưu quy định'}
            </Button>
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
