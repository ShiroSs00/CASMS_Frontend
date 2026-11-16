import { SourceDefinitionEditor } from './SourceDefinitionEditor'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useReadQuery } from '@/shared/api'
import { useSessionAccess } from '@/shared/auth'
import {
  Badge,
  Button,
  DataTable,
  Empty,
  Field,
  Loading,
  Modal,
  Notice,
  PageHeader,
  Panel,
  UnsavedForms,
  useFormChanges,
  useWorkspaceChange,
} from '@/shared/ui'
import { AdminShell } from '@/shared/ui/admin-v3'
import {
  cruisePackageApi,
  type BenefitInput,
  type CruisePackageTemplate,
  type CruisePackageVersion,
  type Inclusion,
  type LogicalCategoryReference,
  type ResourceType,
} from './api'
import styles from './TemplateWorkspace.module.css'
import { benefitQuantity } from './benefit-copy'
import { lifecycle, resourceLabels, inclusionLabels } from './labels'
import { useCruisePackageMutation } from './useCruisePackageMutation'

const CABIN_SUGGESTIONS = [
  'Cabin Tiêu Chuẩn',
  'Phòng Hướng Biển (Ocean View)',
  'Phòng Ban Công (Balcony)',
  'Phòng Suite Hoàng Gia',
]

const ELIGIBILITY_SUGGESTIONS = [
  'Áp dụng cho tất cả hành khách thuộc gói.',
  'Khách đăng ký trước theo lịch phục vụ trên chuyến.',
  'Áp dụng 01 suất tiêu chuẩn cho mỗi hành khách.',
]

function suggestCodeFromName(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32)
}

function StepIcon({ kind }: { kind: 'info' | 'cabin' | 'benefit' | 'plus' | 'check' | 'trash' | 'spark' }) {
  if (kind === 'info') {
    return (
      <svg className={styles.iconSvg} viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <rect x="3" y="3" width="14" height="14" rx="2.5" stroke="currentColor" strokeWidth="1.6" />
        <path d="M6.5 7.5h7M6.5 10.5h7M6.5 13.5h4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    )
  }
  if (kind === 'cabin') {
    return (
      <svg className={styles.iconSvg} viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <path d="M3 14.5V6.5A1.5 1.5 0 0 1 4.5 5h11A1.5 1.5 0 0 1 17 6.5v8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        <path d="M2 14.5h16M5.5 11.5v-2a1 1 0 0 1 1-1h7a1 1 0 0 1 1 1v2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    )
  }
  if (kind === 'benefit') {
    return (
      <svg className={styles.iconSvg} viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <path d="M10 2.75l2.12 4.3 4.74.69-3.43 3.34.81 4.72L10 13.57l-4.24 2.23.81-4.72L3.14 7.74l4.74-.69L10 2.75Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      </svg>
    )
  }
  if (kind === 'plus') {
    return (
      <svg className={styles.iconSvgSm} viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="M8 3.25v9.5M3.25 8h9.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    )
  }
  if (kind === 'check') {
    return (
      <svg className={styles.iconSvgSm} viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="M3.5 8.25l3 3 6-6.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }
  if (kind === 'trash') {
    return (
      <svg className={styles.iconSvgSm} viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="M3.5 4.5h9M6 4.5V3.25a.75.75 0 0 1 .75-.75h2.5a.75.75 0 0 1 .75.75V4.5m-5.25 0v8a1 1 0 0 0 1 1h4.5a1 1 0 0 0 1-1v-8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    )
  }
  return (
    <svg className={styles.iconSvgSm} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 5.5v3l2 1.25" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

export function QueryState({ loading, error }: { loading: boolean; error: Error | null }) {
  return loading ? (
    <Loading label="Đang tải gói du thuyền…" />
  ) : error ? (
    <Notice title="Không tải được gói du thuyền" tone="error">
      <p>{error.message}</p>
    </Notice>
  ) : null
}

export function ResourceSelect({
  type,
  cruiseId,
  value,
  onChange,
  id,
  disabled = false,
  required = true,
  label,
  allowCreate = false,
  onSourcePending,
  onSourceOpen,
}: {
  type: ResourceType
  cruiseId?: string
  value: string
  onChange: (value: string, name?: string, unitCode?: string | null) => void
  id: string
  disabled?: boolean
  required?: boolean
  label?: string
  allowCreate?: boolean
  onSourcePending?: (pending: boolean) => void
  onSourceOpen?: (open: boolean) => void
}) {
  const actor = useSessionAccess()
  const query = useReadQuery(
    `fare-resources:${actor.userId}:${type}:${cruiseId ?? 'shared'}`,
    useCallback(signal => cruisePackageApi.resources(type, cruiseId, signal), [type, cruiseId]),
  )
  return (
    <>
      <Field htmlFor={id} label={label ?? (cruiseId ? 'Lần phục vụ trên chuyến' : 'Tham chiếu dùng chung')}>
        <select
          id={id}
          required={required}
          value={value}
          disabled={disabled || query.loading || Boolean(query.error) || query.data?.length === 0}
          onChange={e => {
            const item = query.data?.find(entry => entry.id === e.target.value)
            onChange(e.target.value, item?.name, item?.unitCode)
          }}
        >
          <option value="">Chọn {resourceLabels[type].toLocaleLowerCase('vi')}</option>
          {query.data?.map(item => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
        {query.loading && <p className={styles.helper}>Đang tải danh mục…</p>}
        {query.error && (
          <>
            <p role="alert">{query.error.message}</p>
            <Button tone="text" onClick={query.retry}>
              Tải lại danh mục
            </Button>
          </>
        )}
        {query.data?.length === 0 && (
          <p className={styles.helper}>
            {cruiseId ? 'Chưa có lần phục vụ khả dụng trên chuyến.' : 'Danh mục chưa có nội dung phù hợp.'}
          </p>
        )}
      </Field>
      {allowCreate && !cruiseId && (
        <div className={styles.fullWidth}>
          <SourceDefinitionEditor
            key={type}
            type={type}
            onPendingChange={onSourcePending}
            onOpenChange={onSourceOpen}
            onCreated={(createdId, createdName) => {
              query.retry()
              onChange(createdId, createdName, null)
            }}
          />
        </div>
      )}
    </>
  )
}

function BenefitEditor({
  onAdd,
  disabled,
  onPendingChange,
}: {
  onAdd: (benefit: BenefitInput & { resourceName: string }) => boolean
  disabled: boolean
  onPendingChange: (pending: boolean) => void
}) {
  const [open, setOpen] = useState(false)
  const [type, setType] = useState<ResourceType>('ACTIVITY')
  const [resourceId, setResourceId] = useState('')
  const [resourceName, setResourceName] = useState('')
  const [inclusion, setInclusion] = useState<Inclusion | ''>('')
  const [limit, setLimit] = useState('')
  const [eligibility, setEligibility] = useState('')
  const [policyConfirmed, setPolicyConfirmed] = useState(true)
  const [serviceUnitCode, setServiceUnitCode] = useState<string | null>(null)
  const [sourcePending, setSourcePending] = useState(false)
  const [sourceOpen, setSourceOpen] = useState(false)
  const [reservation, setReservation] = useState('')
  const [showWindow, setShowWindow] = useState(false)
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')

  const pending = Boolean(
    sourcePending || resourceId || eligibility || limit || start || end || inclusion || reservation,
  )
  useFormChanges(pending)
  useEffect(() => onPendingChange(pending), [pending, onPendingChange])

  const actor = useSessionAccess()
  const options = useReadQuery(`fare-benefit-usage-options:${actor.userId}`, cruisePackageApi.usageOptions)
  const included = inclusion === 'INCLUDED' || inclusion === 'LIMITED_INCLUDED'

  const targetPolicy: BenefitInput['usagePolicy'] =
    inclusion === 'INCLUDED' ? 'UNLIMITED' : inclusion === 'LIMITED_INCLUDED' ? 'LIMITED' : null
  const targetUnit: BenefitInput['usageUnit'] =
    !included ? null : type === 'SERVICE' ? 'SERVICE_UNIT' : 'PARTICIPATION'
  const canConfirmPolicy =
    included &&
    Boolean(
      targetPolicy &&
        targetUnit &&
        options.data?.usagePolicies.includes(targetPolicy) &&
        options.data?.usageUnits.includes(targetUnit) &&
        (type !== 'SERVICE' || Boolean(serviceUnitCode)),
    )
  const usagePolicy: BenefitInput['usagePolicy'] = canConfirmPolicy && policyConfirmed ? targetPolicy : null
  const usageUnit: BenefitInput['usageUnit'] = canConfirmPolicy && policyConfirmed ? targetUnit : null

  const validWindow = (!start && !end) || Boolean(start && end && Date.parse(start) < Date.parse(end))
  const validPolicy =
    !included ||
    (usagePolicy === (inclusion === 'INCLUDED' ? 'UNLIMITED' : 'LIMITED') &&
      Boolean(usageUnit) &&
      usageUnit === (type === 'SERVICE' ? 'SERVICE_UNIT' : 'PARTICIPATION') &&
      (type !== 'SERVICE' || Boolean(serviceUnitCode)))

  const missing = [
    !resourceId ? 'chọn nội dung từ danh mục' : null,
    !inclusion ? 'chọn chính sách áp dụng' : null,
    inclusion === 'LIMITED_INCLUDED' && (!Number.isSafeInteger(Number(limit)) || Number(limit) < 1)
      ? 'nhập số lượng nguyên lớn hơn 0'
      : null,
    !validPolicy ? 'xác nhận đơn vị ghi nhận hợp lệ' : null,
    !reservation || (included && reservation !== 'true') ? 'chọn yêu cầu đăng ký phù hợp' : null,
    !eligibility.trim() ? 'nhập điều kiện sử dụng' : null,
  ].filter(Boolean)

  function resetBenefit() {
    setInclusion('')
    setResourceId('')
    setResourceName('')
    setEligibility('')
    setLimit('')
    setPolicyConfirmed(true)
    setServiceUnitCode(null)
    setReservation('')
    setStart('')
    setEnd('')
    setShowWindow(false)
    setOpen(false)
  }

  if (!open && !pending) {
    return (
      <div className={styles.benefitTriggerBar}>
        <Button type="button" tone="secondary" autoWidth disabled={disabled} onClick={() => setOpen(true)}>
          <StepIcon kind="plus" />
          <span>Thêm quyền lợi đi kèm</span>
        </Button>
        <span className={styles.helper}>
          Thêm hoạt động trên tàu, tour tham quan bờ hoặc dịch vụ ăn uống / tiện ích vào gói.
        </span>
      </div>
    )
  }

  return (
    <div className={styles.benefitBuilderBox}>
      <div className={styles.benefitBuilderHeader}>
        <div>
          <h4>Thiết lập quyền lợi đi kèm mới</h4>
          <p className={styles.helper}>
            Chọn dịch vụ hoặc hoạt động từ danh mục chuẩn, sau đó xác định mức bao gồm trong gói.
          </p>
        </div>
        {pending && <Badge label="Đang nhập quyền lợi" tone="warning" />}
      </div>

      <fieldset disabled={disabled} className={styles.benefitFields}>
        <legend className={styles.srOnly}>Cấu hình quyền lợi mới</legend>

        <div className={styles.fieldGrid}>
          <Field htmlFor="fare-benefit-type" label="1. Nhóm quyền lợi *">
            <select
              id="fare-benefit-type"
              value={type}
              onChange={e => {
                setType(e.target.value as ResourceType)
                setResourceId('')
                setResourceName('')
                setInclusion('')
                setPolicyConfirmed(true)
                setReservation('')
                setServiceUnitCode(null)
              }}
            >
              {Object.entries(resourceLabels).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </Field>

          <ResourceSelect
            type={type}
            value={resourceId}
            onChange={(id, name, unit) => {
              setResourceId(id)
              setResourceName(name ?? '')
              setServiceUnitCode(unit ?? null)
              if (!inclusion) {
                setInclusion('INCLUDED')
                setReservation('true')
                if (!eligibility.trim()) {
                  setEligibility(ELIGIBILITY_SUGGESTIONS[0])
                }
              }
            }}
            id="fare-benefit-resource"
            required={false}
            allowCreate
            onSourcePending={setSourcePending}
            onSourceOpen={setSourceOpen}
            label="2. Nội dung từ danh mục *"
          />
        </div>

        {resourceId && !sourceOpen && (
          <>
            <div className={styles.fieldGrid}>
              <Field htmlFor="fare-inclusion" label="3. Chính sách áp dụng trong gói *">
                <select
                  id="fare-inclusion"
                  value={inclusion}
                  onChange={e => {
                    const next = e.target.value as Inclusion
                    setInclusion(next)
                    setReservation(next === 'INCLUDED' || next === 'LIMITED_INCLUDED' ? 'true' : '')
                    setPolicyConfirmed(true)
                    setLimit('')
                  }}
                >
                  <option value="">Chọn cách áp dụng quyền lợi</option>
                  {Object.entries(inclusionLabels).map(([key, label]) => (
                    <option key={key} value={key}>
                      {key === 'INCLUDED'
                        ? 'Đã bao gồm · Không giới hạn số lượt'
                        : key === 'LIMITED_INCLUDED'
                          ? 'Bao gồm có giới hạn · Theo định mức số lượng'
                          : label}
                    </option>
                  ))}
                </select>
              </Field>

              {inclusion === 'LIMITED_INCLUDED' && (
                <Field
                  htmlFor="fare-benefit-limit"
                  label={type === 'SERVICE' ? 'Số đơn vị dịch vụ được cấp *' : 'Số lượt tham gia được cấp *'}
                  hint="Nhập số nguyên lớn hơn 0 (ví dụ: 1, 2)."
                >
                  <input
                    id="fare-benefit-limit"
                    type="number"
                    min="1"
                    step="1"
                    placeholder="Ví dụ: 1"
                    value={limit}
                    onChange={e => setLimit(e.target.value)}
                  />
                </Field>
              )}

              {!included && inclusion && (
                <Field htmlFor="fare-requires-reservation" label="Yêu cầu đăng ký sử dụng *">
                  <select
                    id="fare-requires-reservation"
                    value={reservation}
                    onChange={e => setReservation(e.target.value)}
                  >
                    <option value="">Chọn yêu cầu đăng ký</option>
                    <option value="true">Phải đăng ký hoạt động/tour hoặc gửi yêu cầu dịch vụ</option>
                    <option value="false">Không yêu cầu đăng ký trước</option>
                  </select>
                </Field>
              )}
            </div>

            <QueryState loading={options.loading} error={options.error} />
            {options.error && (
              <div className={styles.actions}>
                <Button tone="secondary" onClick={options.retry}>
                  Tải lại cấu hình sử dụng
                </Button>
              </div>
            )}

            {included && (
              <div className={styles.policyInfoBar}>
                <div className={styles.policyInfoMeta}>
                  <span>
                    <strong>Đơn vị ghi nhận:</strong>{' '}
                    {type === 'SERVICE'
                      ? serviceUnitCode || 'Dịch vụ chưa cấu hình đơn vị nguồn'
                      : '01 lượt tham gia / hành khách'}
                  </span>
                  <span>
                    <strong>Hình thức phục vụ:</strong> Khách đăng ký hoạt động/tour hoặc gửi yêu cầu dịch vụ trên chuyến
                  </span>
                </div>
                <label className={styles.usageConfirmation}>
                  <input
                    type="checkbox"
                    checked={Boolean(usagePolicy && usageUnit)}
                    disabled={options.loading || Boolean(options.error) || (type === 'SERVICE' && !serviceUnitCode)}
                    onChange={e => setPolicyConfirmed(e.target.checked)}
                  />
                  <span>
                    Xác nhận áp dụng{' '}
                    {inclusion === 'INCLUDED'
                      ? 'quyền lợi không giới hạn số lượt (có ghi nhận sử dụng)'
                      : 'quyền lợi giới hạn theo số lượng đã nhập'}{' '}
                    theo đúng đơn vị nguồn.
                  </span>
                </label>
              </div>
            )}

            <div className={styles.fullWidth}>
              <Field
                htmlFor="fare-benefit-eligibility"
                label="4. Điều kiện sử dụng hiển thị cho khách *"
                hint="Hiển thị trong chi tiết gói để hành khách nắm rõ quy định sử dụng."
              >
                <textarea
                  rows={2}
                  id="fare-benefit-eligibility"
                  maxLength={4000}
                  placeholder="Ví dụ: Áp dụng cho tất cả hành khách thuộc gói..."
                  value={eligibility}
                  onChange={e => setEligibility(e.target.value)}
                />
              </Field>
              <div className={styles.quickChipGroup}>
                <span className={styles.quickChipLabel}>Gợi ý nhanh:</span>
                {ELIGIBILITY_SUGGESTIONS.map(sample => (
                  <button
                    key={sample}
                    type="button"
                    className={styles.quickChip}
                    onClick={() => setEligibility(sample)}
                  >
                    + {sample}
                  </button>
                ))}
              </div>
            </div>

            <div className={styles.fullWidth}>
              <button
                type="button"
                className={styles.windowToggleBtn}
                aria-expanded={showWindow || Boolean(start || end)}
                onClick={() => setShowWindow(v => !v)}
              >
                <StepIcon kind="spark" />
                <span>
                  {showWindow || start || end
                    ? 'Ẩn giới hạn khung giờ sử dụng riêng'
                    : 'Thiết lập khung giờ sử dụng riêng (Tùy chọn — mặc định theo lịch vận hành trên chuyến)'}
                </span>
              </button>

              {(showWindow || Boolean(start || end)) && (
                <div className={styles.windowBox}>
                  <div className={styles.fieldGrid}>
                    <Field htmlFor="fare-usage-start" label="Bắt đầu áp dụng">
                      <input
                        id="fare-usage-start"
                        type="datetime-local"
                        value={start}
                        onChange={e => setStart(e.target.value)}
                      />
                    </Field>
                    <Field
                      htmlFor="fare-usage-end"
                      label="Kết thúc áp dụng"
                      error={!validWindow ? 'Nhập đủ hai mốc; thời điểm kết thúc phải sau bắt đầu.' : undefined}
                    >
                      <input
                        id="fare-usage-end"
                        type="datetime-local"
                        value={end}
                        onChange={e => setEnd(e.target.value)}
                      />
                    </Field>
                  </div>
                  <p className={styles.helper}>
                    Giờ nhập theo múi giờ {Intl.DateTimeFormat().resolvedOptions().timeZone}. Nếu để trống cả hai ô, hệ thống tự động dùng lịch hoạt động thực tế của chuyến.
                  </p>
                </div>
              )}
            </div>

            {missing.length > 0 && (
              <p className={styles.validationHint}>Cần hoàn tất trước khi thêm: {missing.join('; ')}.</p>
            )}

            <div className={styles.builderFooter}>
              <Button
                type="button"
                disabled={
                  !inclusion ||
                  options.loading ||
                  Boolean(options.error) ||
                  !validPolicy ||
                  !validWindow ||
                  !reservation ||
                  (included && reservation !== 'true') ||
                  !resourceId ||
                  !eligibility.trim() ||
                  (inclusion === 'LIMITED_INCLUDED' && (!Number.isSafeInteger(Number(limit)) || Number(limit) < 1))
                }
                onClick={() => {
                  const added = onAdd({
                    resourceType: type,
                    resourceId,
                    resourceName,
                    inclusion: inclusion as Inclusion,
                    quantityLimit: inclusion === 'LIMITED_INCLUDED' ? Number(limit) : null,
                    eligibility: eligibility.trim(),
                    usagePolicy: included ? usagePolicy : null,
                    usageUnit: included ? usageUnit : null,
                    serviceUnitCode: type === 'SERVICE' ? serviceUnitCode : null,
                    requiresReservation: reservation === 'true',
                    usageStartsAt: start ? new Date(start).toISOString() : null,
                    usageEndsAt: end ? new Date(end).toISOString() : null,
                  })
                  if (added) resetBenefit()
                }}
              >
                <StepIcon kind="check" />
                <span>Thêm vào danh sách quyền lợi</span>
              </Button>
              <Button type="button" tone="secondary" disabled={disabled} onClick={resetBenefit}>
                Hủy nhập quyền lợi
              </Button>
            </div>
          </>
        )}

        {!resourceId && (
          <div className={styles.builderFooter}>
            <Button type="button" tone="secondary" disabled={disabled} onClick={resetBenefit}>
              Đóng khung thêm quyền lợi
            </Button>
          </div>
        )}
      </fieldset>
    </div>
  )
}

function versionContent(name: string, description: string, categories: string[], benefits: BenefitInput[]) {
  return JSON.stringify({
    name,
    description,
    categories: [...categories].sort(),
    benefits: benefits
      .map(b => ({
        resourceType: b.resourceType,
        resourceId: b.resourceId,
        inclusion: b.inclusion,
        quantityLimit: b.quantityLimit,
        eligibility: b.eligibility,
        usagePolicy: b.usagePolicy,
        usageUnit: b.usageUnit,
        serviceUnitCode: b.serviceUnitCode,
        requiresReservation: b.requiresReservation,
        usageStartsAt: b.usageStartsAt ? Date.parse(b.usageStartsAt) : null,
        usageEndsAt: b.usageEndsAt ? Date.parse(b.usageEndsAt) : null,
      }))
      .sort((a, b) => (a.resourceType + a.resourceId).localeCompare(b.resourceType + b.resourceId)),
  })
}

function savedVersionContent(item: CruisePackageVersion) {
  return versionContent(
    item.version.name,
    item.version.description ?? '',
    item.version.logicalCategories,
    item.benefits.map(b => ({
      resourceType: b.onboardActivityId ? 'ACTIVITY' : b.shoreExcursionId ? 'EXCURSION' : 'SERVICE',
      resourceId: b.onboardActivityId ?? b.shoreExcursionId ?? b.serviceId ?? '',
      inclusion: b.inclusion,
      quantityLimit: b.quantityLimit ?? null,
      eligibility: b.eligibility,
      usagePolicy: b.usagePolicy,
      usageUnit: b.usageUnit,
      serviceUnitCode: b.serviceUnitCode,
      requiresReservation: b.requiresReservation,
      usageStartsAt: b.usageStartsAt,
      usageEndsAt: b.usageEndsAt,
    })),
  )
}

function CabinCategoryBuilder({
  knownCategories,
  reusedCategories,
  setReusedCategories,
  addedRooms,
  setAddedRooms,
  roomDraft,
  setRoomDraft,
  disabled,
  hasDuplicateRooms,
}: {
  knownCategories: LogicalCategoryReference[]
  reusedCategories: string[]
  setReusedCategories: React.Dispatch<React.SetStateAction<string[]>>
  addedRooms: string[]
  setAddedRooms: React.Dispatch<React.SetStateAction<string[]>>
  roomDraft: string
  setRoomDraft: React.Dispatch<React.SetStateAction<string>>
  disabled: boolean
  hasDuplicateRooms: boolean
}) {
  const reusedRooms = knownCategories.filter(category => reusedCategories.includes(category.id))
  const pendingDraftRooms = roomDraft
    .split('\n')
    .map(v => v.trim())
    .filter(Boolean)

  const addRoomByName = (rawName: string) => {
    const entries = rawName
      .split('\n')
      .map(v => v.trim())
      .filter(Boolean)
    if (!entries.length) return
    setAddedRooms(prev => {
      const next = [...prev]
      for (const entry of entries) {
        const existsInReused = reusedRooms.some(r => r.name.toLocaleLowerCase('vi') === entry.toLocaleLowerCase('vi'))
        const existsInAdded = next.some(r => r.toLocaleLowerCase('vi') === entry.toLocaleLowerCase('vi'))
        if (!existsInReused && !existsInAdded) {
          next.push(entry)
        }
      }
      return next
    })
    setRoomDraft('')
  }

  const totalSelectedCount = reusedRooms.length + addedRooms.length + pendingDraftRooms.length

  return (
    <div className={styles.cabinBuilderLayout}>
      {/* Danh sách các hạng phòng đã chọn / đã thêm */}
      <div className={styles.selectedCabinsBox}>
        <div className={styles.selectedCabinsHeader}>
          <strong>Hạng phòng sẽ áp dụng trong phiên bản này ({totalSelectedCount})</strong>
          {totalSelectedCount === 0 && (
            <Badge label="Cần ít nhất 1 hạng phòng" tone="warning" />
          )}
          {totalSelectedCount > 0 && !hasDuplicateRooms && (
            <Badge label={`Đã cấu hình ${totalSelectedCount} hạng phòng`} tone="success" />
          )}
        </div>

        {totalSelectedCount === 0 ? (
          <p className={styles.helper}>
            Chưa có hạng phòng nào được chọn. Hãy tích chọn từ danh mục có sẵn bên dưới hoặc nhập tên hạng phòng mới.
          </p>
        ) : (
          <ul className={styles.selectedCabinList} aria-label="Hạng phòng đã chọn">
            {reusedRooms.map(room => (
              <li key={`reused-${room.id}`} className={styles.selectedCabinTag}>
                <div className={styles.selectedCabinInfo}>
                  <StepIcon kind="cabin" />
                  <strong>{room.name}</strong>
                  <Badge label={`Kế thừa · ${room.packageName}`} tone="neutral" />
                </div>
                <button
                  type="button"
                  disabled={disabled}
                  className={styles.tagRemoveBtn}
                  aria-label={`Bỏ chọn hạng phòng ${room.name}`}
                  onClick={() => setReusedCategories(ids => ids.filter(id => id !== room.id))}
                >
                  <StepIcon kind="trash" />
                  <span>Gỡ</span>
                </button>
              </li>
            ))}
            {addedRooms.map(roomName => (
              <li key={`added-${roomName}`} className={styles.selectedCabinTag}>
                <div className={styles.selectedCabinInfo}>
                  <StepIcon kind="cabin" />
                  <strong>{roomName}</strong>
                  <Badge label="Hạng phòng mới" tone="info" />
                </div>
                <button
                  type="button"
                  disabled={disabled}
                  className={styles.tagRemoveBtn}
                  aria-label={`Xóa hạng phòng ${roomName}`}
                  onClick={() => setAddedRooms(prev => prev.filter(item => item !== roomName))}
                >
                  <StepIcon kind="trash" />
                  <span>Xóa</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className={styles.cabinColumnsGrid}>
        {/* Cột 1: Thêm hạng phòng mới */}
        <div className={styles.cabinSubPanel}>
          <h4>Thêm hạng phòng thương mại mới</h4>
          <p className={styles.helper}>
            Nhập tên hạng phòng hiển thị cho khách hàng và nhấn <strong>Thêm hạng phòng</strong> (hoặc nhấn phím Enter).
          </p>
          <div className={styles.addRoomInputRow}>
            <Field
              htmlFor="fare-logical-categories"
              label="Tên hạng phòng mới"
              error={hasDuplicateRooms ? 'Tên hạng phòng bị trùng với hạng đã chọn hoặc đã nhập.' : undefined}
            >
              <input
                type="text"
                id="fare-logical-categories"
                value={roomDraft}
                disabled={disabled}
                placeholder="Ví dụ: Phòng Suite Ban Công..."
                onChange={event => setRoomDraft(event.target.value)}
                onKeyDown={event => {
                  if (event.key === 'Enter' && roomDraft.trim()) {
                    event.preventDefault()
                    addRoomByName(roomDraft)
                  }
                }}
              />
            </Field>
            <Button
              type="button"
              tone="secondary"
              autoWidth
              disabled={disabled || !roomDraft.trim()}
              onClick={() => addRoomByName(roomDraft)}
            >
              <StepIcon kind="plus" />
              <span>Thêm hạng phòng</span>
            </Button>
          </div>

          <div className={styles.quickChipGroup}>
            <span className={styles.quickChipLabel}>Gợi ý mẫu:</span>
            {CABIN_SUGGESTIONS.map(sample => {
              const alreadyAdded =
                reusedRooms.some(r => r.name.toLocaleLowerCase('vi') === sample.toLocaleLowerCase('vi')) ||
                addedRooms.some(r => r.toLocaleLowerCase('vi') === sample.toLocaleLowerCase('vi'))
              return (
                <button
                  key={sample}
                  type="button"
                  disabled={disabled || alreadyAdded}
                  className={styles.quickChip}
                  onClick={() => addRoomByName(sample)}
                >
                  + {sample}
                </button>
              )
            })}
          </div>
        </div>

        {/* Cột 2: Chọn từ hạng phòng đã có trong hệ thống */}
        <div className={styles.cabinSubPanel}>
          <div className={styles.cabinSubPanelHeader}>
            <h4>Chọn từ hạng phòng đã có</h4>
            <Badge label={`${reusedRooms.length}/${knownCategories.length} đã chọn`} tone="neutral" />
          </div>
          <p className={styles.helper}>
            Tái sử dụng hạng phòng từ các mẫu gói trước để đồng bộ dữ liệu thương mại giữa các phiên bản.
          </p>
          {knownCategories.length === 0 ? (
            <p className={styles.emptyCopy}>
              Hệ thống chưa có hạng phòng thương mại nào từ các mẫu trước. Hãy thêm hạng phòng mới ở khung bên trái.
            </p>
          ) : (
            <fieldset className={styles.categoryOptionsGrid} disabled={disabled}>
              <legend className={styles.srOnly}>Hạng phòng dùng chung</legend>
              {knownCategories.map(category => {
                const checked = reusedCategories.includes(category.id)
                const duplicateName =
                  !checked &&
                  (reusedRooms.some(room => room.name === category.name) ||
                    addedRooms.some(room => room === category.name))
                return (
                  <label
                    key={category.id}
                    className={`${styles.categoryOptionCard} ${checked ? styles.categoryOptionCardActive : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={duplicateName}
                      onChange={event =>
                        setReusedCategories(ids =>
                          event.target.checked ? [...ids, category.id] : ids.filter(id => id !== category.id),
                        )
                      }
                    />
                    <span className={styles.categoryOptionContent}>
                      <strong>{category.name}</strong>
                      <small>Mẫu gốc: {category.packageName}</small>
                    </span>
                  </label>
                )
              })}
            </fieldset>
          )}
        </div>
      </div>
    </div>
  )
}

function TemplateVersions({
  template,
  onChanged,
  readOnly,
  startNew = false,
}: {
  template: CruisePackageTemplate
  onChanged: () => void
  readOnly: boolean
  startNew?: boolean
}) {
  const access = useSessionAccess()
  const canWrite = access.roles.includes('ACTIVITY_SERVICE_MANAGER') && access.canDo('TOUR_PACKAGE_MANAGE')
  const [epoch, setEpoch] = useState(0)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [addedRooms, setAddedRooms] = useState<string[]>([])
  const [roomDraft, setRoomDraft] = useState('')
  const [benefits, setBenefits] = useState<(BenefitInput & { resourceName: string })[]>([])
  const [localError, setLocalError] = useState('')
  const [reusedCategories, setReusedCategories] = useState<string[]>([])
  const [creating, setCreating] = useState(startNew)
  const [dismissedEmptyComposer, setDismissedEmptyComposer] = useState(false)
  const [benefitPending, setBenefitPending] = useState(false)
  const [publishId, setPublishId] = useState<string | null>(null)
  const editorHeading = useRef<HTMLHeadingElement>(null)
  const changeWorkspace = useWorkspaceChange()

  const clearDraft = () => {
    setName('')
    setDescription('')
    setAddedRooms([])
    setRoomDraft('')
    setBenefits([])
    setReusedCategories([])
    setBenefitPending(false)
    setCreating(false)
    setDismissedEmptyComposer(true)
    setLocalError('')
  }

  const categoryCatalog = useReadQuery(
    `cruise-package-category-catalog:${access.userId}:${template.id}:${epoch}`,
    cruisePackageApi.logicalCategories,
  )
  const query = useReadQuery(
    `fare-versions:${access.userId}:${template.id}:${epoch}`,
    useCallback(signal => cruisePackageApi.versions(template.id, signal), [template.id]),
  )

  const isComposing =
    creating || (canWrite && Boolean(query.data && query.data.length === 0) && !dismissedEmptyComposer)

  useEffect(() => {
    if (isComposing) editorHeading.current?.focus()
  }, [isComposing])

  const refresh = () => {
    setEpoch(v => v + 1)
    onChanged()
  }

  const pendingVersion = useRef<
    { kind: 'create'; ids: string[]; content: string } | { kind: 'publish'; id: string } | null
  >(null)

  const mutation = useCruisePackageMutation(refresh, undefined, async () => {
    const operation = pendingVersion.current
    if (!operation) return false
    const versions = await cruisePackageApi.versions(template.id)
    if (operation.kind === 'publish') {
      return versions.some(v => v.version.id === operation.id && v.version.status === 'PUBLISHED')
    }
    const matches = versions.filter(
      v => !operation.ids.includes(v.version.id) && savedVersionContent(v) === operation.content,
    )
    if (matches.length !== 1) return false
    clearDraft()
    return true
  })

  const disabled =
    readOnly || mutation.busy || mutation.needsReview || query.loading || Boolean(query.error) || !query.data

  useFormChanges(
    Boolean(name || description || addedRooms.length || roomDraft.trim() || benefits.length || reusedCategories.length),
    mutation.busy,
  )

  const knownCategories = Array.from(
    new Map(
      [...(categoryCatalog.data ?? []), ...(query.data ?? []).flatMap(v => v.logicalCategoryReferences)].map(c => [
        c.id,
        c,
      ]),
    ).values(),
  )
  const reusedRooms = knownCategories.filter(category => reusedCategories.includes(category.id))
  const draftPendingNames = roomDraft
    .split('\n')
    .map(value => value.trim())
    .filter(Boolean)
  const newRoomNames = [...addedRooms, ...draftPendingNames]
  const logicalCategories = [...reusedRooms.map(category => category.name), ...newRoomNames]
  const hasDuplicateRooms = new Set(logicalCategories).size !== logicalCategories.length

  const versions = query.data ?? []
  const current = versions.find(item => item.version.status === 'PUBLISHED')
  const drafts = versions
    .filter(item => item.version.status === 'DRAFT')
    .sort((left, right) => right.version.versionNumber - left.version.versionNumber)
  const history = versions
    .filter(item => item.version.status === 'SUPERSEDED')
    .sort((left, right) => right.version.versionNumber - left.version.versionNumber)

  const latestVersion = drafts[0] ?? current ?? history[0]
  const candidate = drafts.find(item => item.version.id === publishId)?.version
  const canPublish =
    canWrite && !disabled && Boolean(candidate && (!current || candidate.versionNumber > current.version.versionNumber))

  const prefillFromLatest = () => {
    if (!latestVersion) return
    setName(latestVersion.version.name)
    setDescription(latestVersion.version.description ?? '')
    const refIds = latestVersion.logicalCategoryReferences.map(ref => ref.id)
    setReusedCategories(refIds)
  }

  const publishVersion = () => {
    if (!candidate || !canPublish) return
    pendingVersion.current = { kind: 'publish', id: candidate.id }
    setPublishId(null)
    void mutation.run(
      () => cruisePackageApi.publishVersion(candidate.id, candidate.revision),
      `Phiên bản ${candidate.versionNumber} đã phát hành chính thức và sẵn sàng để gán vào chuyến khởi hành.`,
    )
  }

  return (
    <>
      {!isComposing && (
        <Panel className={styles.panel}>
          <div className={styles.sectionHeader}>
            <div>
              <h2>Quản lý phiên bản của mẫu ({template.code})</h2>
              <p className={styles.helper}>
                Phiên bản ở trạng thái <strong>Đã phát hành</strong> sẽ được dùng để tạo gói thương mại trên các chuyến khởi hành mới.
              </p>
            </div>
            {canWrite && (
              <Button
                id="fare-new-version"
                disabled={disabled || isComposing}
                aria-expanded={isComposing}
                aria-controls="fare-version-editor"
                onClick={() => {
                  prefillFromLatest()
                  setDismissedEmptyComposer(false)
                  setCreating(true)
                }}
              >
                <StepIcon kind="plus" />
                <span>Soạn phiên bản mới</span>
              </Button>
            )}
          </div>

          <QueryState loading={query.loading} error={query.error} />
          {mutation.feedback}
          {query.error && (
            <div className={styles.actions}>
              <Button tone="secondary" onClick={query.retry}>
                Tải lại phiên bản
              </Button>
            </div>
          )}
          {query.data?.length === 0 && (
            <Empty title="Mẫu gói này chưa có phiên bản nội dung">
              <p>Hãy soạn phiên bản đầu tiên để khai báo tên gói, hạng phòng và quyền lợi đi kèm.</p>
            </Empty>
          )}
          {categoryCatalog.error && (
            <Notice title="Chưa tải được hạng thương mại dùng chung" tone="warning">
              Không tự nối các hạng trùng tên.
              <Button onClick={categoryCatalog.retry}>Tải lại danh mục hạng</Button>
            </Notice>
          )}

          {current && (
            <section className={styles.versionSection} aria-label="Phiên bản hiện hành">
              <div className={styles.versionSectionHeader}>
                <h3>Phiên bản đang phát hành (Áp dụng cho chuyến mới)</h3>
                <Badge label="Đang hiệu lực" tone="success" />
              </div>
              <VersionCard item={current} />
            </section>
          )}

          {drafts.length > 0 && (
            <section className={styles.versionSection} aria-label="Bản nháp">
              <div className={styles.versionSectionHeader}>
                <h3>Bản nháp chờ phát hành ({drafts.length})</h3>
                <span className={styles.helper}>Kiểm tra kỹ hạng phòng và quyền lợi trước khi nhấn Phát hành phiên bản.</span>
              </div>
              {drafts.map(item => (
                <VersionCard
                  key={item.version.id}
                  item={item}
                  onPublish={
                    canWrite && (!current || item.version.versionNumber > current.version.versionNumber)
                      ? () => setPublishId(item.version.id)
                      : undefined
                  }
                  disabled={disabled}
                  supersededDraft={Boolean(current && item.version.versionNumber <= current.version.versionNumber)}
                />
              ))}
            </section>
          )}

          {history.length > 0 && (
            <section className={styles.versionSection} aria-label="Lịch sử phiên bản">
              <div className={styles.versionSectionHeader}>
                <h3>Lịch sử phiên bản trước ({history.length})</h3>
              </div>
              {history.map(item => (
                <VersionCard key={item.version.id} item={item} />
              ))}
            </section>
          )}

          {candidate && (
            <Modal
              title={`Phát hành phiên bản ${candidate.versionNumber}`}
              onClose={() => setPublishId(null)}
              footer={
                <>
                  <Button tone="secondary" onClick={() => setPublishId(null)}>
                    Quay lại
                  </Button>
                  <Button disabled={!canPublish} onClick={publishVersion}>
                    Xác nhận phát hành phiên bản
                  </Button>
                </>
              }
            >
              <p>
                Phiên bản <strong>{candidate.versionNumber} ({candidate.name})</strong> sẽ trở thành phiên bản chính thức để cấu hình gói cho các chuyến khởi hành mới.
              </p>
              {current && (
                <p>
                  Các chuyến khởi hành đã gán phiên bản {current.version.versionNumber} trước đó vẫn tiếp tục giữ nguyên cấu hình cũ.
                </p>
              )}
            </Modal>
          )}
        </Panel>
      )}

      {canWrite && isComposing && (
        <Panel className={styles.panel} id="fare-version-editor">
          <header className={styles.editorHeading}>
            <div className={styles.editorTitleRow}>
              <h2 ref={editorHeading} tabIndex={-1}>
                {versions.length === 0
                  ? `Thiết lập nội dung gói cho mẫu ${template.code}`
                  : `Soạn phiên bản mới · Mẫu ${template.code}`}
              </h2>
              <Badge label={`Mã mẫu: ${template.code}`} tone="neutral" />
            </div>
            <p className={styles.helper}>
              Hoàn tất 3 bước dưới đây để lưu phiên bản nháp. Sau khi lưu, bạn có thể kiểm tra lại và nhấn <strong>Phát hành phiên bản</strong> để đưa vào sử dụng.
            </p>
          </header>

          {mutation.feedback}

          <form
            aria-busy={mutation.busy}
            className={styles.versionForm}
            onSubmit={async e => {
              e.preventDefault()
              if (disabled || benefitPending) return
              setLocalError('')
              if (!logicalCategories.length || hasDuplicateRooms) {
                setLocalError('Vui lòng chọn hoặc thêm ít nhất một hạng phòng và đảm bảo không trùng tên.')
                document.getElementById('fare-logical-categories')?.focus()
                return
              }
              pendingVersion.current = {
                kind: 'create',
                ids: query.data?.map(v => v.version.id) ?? [],
                content: versionContent(name.trim(), description, logicalCategories, benefits),
              }
              const ok = await mutation.run(
                () =>
                  cruisePackageApi.createVersion(template.id, {
                    expectedTemplateRevision: template.revision,
                    name: name.trim(),
                    description,
                    logicalCategories,
                    reusedLogicalCategoryIds: reusedRooms.map(category => category.id),
                    benefits: benefits.map(b => ({
                      resourceType: b.resourceType,
                      resourceId: b.resourceId,
                      inclusion: b.inclusion,
                      quantityLimit: b.quantityLimit,
                      eligibility: b.eligibility,
                      usagePolicy: b.usagePolicy,
                      usageUnit: b.usageUnit,
                      serviceUnitCode: b.serviceUnitCode,
                      requiresReservation: b.requiresReservation,
                      usageStartsAt: b.usageStartsAt,
                      usageEndsAt: b.usageEndsAt,
                    })),
                  }),
                'Đã lưu phiên bản nháp thành công. Nhấn "Phát hành phiên bản" khi sẵn sàng sử dụng cho chuyến khởi hành.',
              )
              if (ok) {
                clearDraft()
                document.getElementById('fare-new-version')?.focus()
              }
            }}
          >
            {localError && (
              <Notice title="Kiểm tra lại thông tin bản soạn" tone="error">
                <p>{localError}</p>
              </Notice>
            )}

            {/* BƯỚC 1: THÔNG TIN GÓI */}
            <section className={styles.stepSection} aria-labelledby="step-1-package-info">
              <div className={styles.stepSectionHeader}>
                <div className={styles.stepSectionTitle}>
                  <span className={styles.stepNumberBadge}>1</span>
                  <StepIcon kind="info" />
                  <div>
                    <h3 id="step-1-package-info">Thông tin gói du thuyền</h3>
                    <p className={styles.helper}>
                      Tên thương mại và mô tả tổng quan sẽ hiển thị trực tiếp cho hành khách khi chọn gói.
                    </p>
                  </div>
                </div>
                {latestVersion && !name && (
                  <Button type="button" tone="secondary" autoWidth onClick={prefillFromLatest}>
                    Sao chép từ phiên bản {latestVersion.version.versionNumber}
                  </Button>
                )}
              </div>

              <div className={styles.stepSectionBody}>
                <Field
                  htmlFor="fare-version-name"
                  label="Tên gói du thuyền hiển thị cho hành khách *"
                  hint="Ví dụ: Gói Hoàng Gia Trọn Gói (Royal All-Inclusive)."
                >
                  <input
                    id="fare-version-name"
                    required
                    maxLength={200}
                    placeholder="Nhập tên gói du thuyền..."
                    value={name}
                    disabled={disabled}
                    onChange={e => setName(e.target.value)}
                  />
                </Field>
                <Field
                  htmlFor="fare-version-description"
                  label="Mô tả gói du thuyền"
                  hint="Giới thiệu ngắn gọn điểm nổi bật, trải nghiệm ẩm thực, nghỉ dưỡng hoặc đối tượng khách phù hợp."
                >
                  <textarea
                    rows={3}
                    id="fare-version-description"
                    maxLength={10000}
                    placeholder="Nhập mô tả chi tiết cho gói du thuyền..."
                    value={description}
                    disabled={disabled}
                    onChange={e => setDescription(e.target.value)}
                  />
                </Field>
              </div>
            </section>

            {/* BƯỚC 2: HẠNG PHÒNG */}
            <section className={styles.stepSection} aria-labelledby="step-2-cabin-categories">
              <div className={styles.stepSectionHeader}>
                <div className={styles.stepSectionTitle}>
                  <span className={styles.stepNumberBadge}>2</span>
                  <StepIcon kind="cabin" />
                  <div>
                    <h3 id="step-2-cabin-categories">Hạng phòng thương mại trong gói</h3>
                    <p className={styles.helper}>
                      Khai báo các hạng phòng thuộc gói này. Khi gán gói vào chuyến tàu, từng hạng phòng sẽ được ánh xạ với loại cabin thực tế.
                    </p>
                  </div>
                </div>
              </div>

              <div className={styles.stepSectionBody}>
                <CabinCategoryBuilder
                  knownCategories={knownCategories}
                  reusedCategories={reusedCategories}
                  setReusedCategories={setReusedCategories}
                  addedRooms={addedRooms}
                  setAddedRooms={setAddedRooms}
                  roomDraft={roomDraft}
                  setRoomDraft={setRoomDraft}
                  disabled={disabled}
                  hasDuplicateRooms={hasDuplicateRooms}
                />
              </div>
            </section>

            {/* BƯỚC 3: QUYỀN LỢI ĐI KÈM */}
            <section className={styles.stepSection} aria-labelledby="step-3-benefits">
              <div className={styles.stepSectionHeader}>
                <div className={styles.stepSectionTitle}>
                  <span className={styles.stepNumberBadge}>3</span>
                  <StepIcon kind="benefit" />
                  <div>
                    <h3 id="step-3-benefits">Quyền lợi đi kèm trong gói</h3>
                    <p className={styles.helper}>
                      Cấu hình các hoạt động trên tàu, tour bờ và dịch vụ đi kèm cho hành khách mua gói.
                    </p>
                  </div>
                </div>
                <Badge label={`${benefits.length} quyền lợi đã thêm`} tone={benefits.length > 0 ? 'info' : 'neutral'} />
              </div>

              <div className={styles.stepSectionBody}>
                {benefits.length === 0 ? (
                  <div className={styles.emptyBenefitNotice}>
                    <p>
                      <strong>Chưa có quyền lợi đi kèm nào trong bản soạn này.</strong> Bạn có thể nhấn <em>Thêm quyền lợi đi kèm</em> bên dưới để bổ sung hoạt động, tour bờ hoặc dịch vụ.
                    </p>
                  </div>
                ) : (
                  <ul className={styles.benefitList} aria-label="Danh sách quyền lợi đã thêm">
                    {benefits.map((benefit, index) => (
                      <li key={`${benefit.resourceType}:${benefit.resourceId}`} className={styles.benefitRowItem}>
                        <div className={styles.benefitRowMain}>
                          <div className={styles.benefitRowHeader}>
                            <strong>{benefit.resourceName}</strong>
                            <Badge label={resourceLabels[benefit.resourceType]} tone="neutral" />
                            <Badge
                              label={
                                benefit.quantityLimit != null
                                  ? `${inclusionLabels[benefit.inclusion]} · ${benefitQuantity(benefit.quantityLimit, benefit)}`
                                  : inclusionLabels[benefit.inclusion]
                              }
                              tone={
                                benefit.inclusion === 'INCLUDED' || benefit.inclusion === 'LIMITED_INCLUDED'
                                  ? 'success'
                                  : 'warning'
                              }
                            />
                          </div>
                          <p className={styles.helper}>Điều kiện áp dụng: {benefit.eligibility}</p>
                        </div>
                        <Button
                          type="button"
                          tone="secondary"
                          autoWidth
                          disabled={disabled}
                          aria-label={`Bỏ quyền lợi ${benefit.resourceName}`}
                          onClick={() => setBenefits(v => v.filter((_, i) => i !== index))}
                        >
                          <StepIcon kind="trash" />
                          <span>Bỏ quyền lợi</span>
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}

                <BenefitEditor
                  disabled={disabled}
                  onPendingChange={setBenefitPending}
                  onAdd={benefit => {
                    if (
                      benefits.some(
                        b => b.resourceType === benefit.resourceType && b.resourceId === benefit.resourceId,
                      )
                    ) {
                      setLocalError('Quyền lợi này đã có trong danh sách của phiên bản đang soạn.')
                      return false
                    }
                    setLocalError('')
                    setBenefits(v => [...v, benefit])
                    return true
                  }}
                />
              </div>
            </section>

            <footer className={styles.formFooter}>
              <Button
                type="button"
                autoWidth
                tone="secondary"
                disabled={mutation.busy || mutation.needsReview}
                onClick={() => changeWorkspace(clearDraft)}
              >
                Quay lại
              </Button>
              <div className={styles.formFooterRight}>
                {benefitPending && (
                  <p className={styles.validationHint}>
                    Bạn đang nhập dở một quyền lợi. Hãy nhấn &quot;Thêm vào danh sách quyền lợi&quot; hoặc &quot;Hủy nhập quyền lợi&quot; trước khi lưu.
                  </p>
                )}
                <Button
                  autoWidth
                  type="submit"
                  disabled={
                    disabled || !name.trim() || !logicalCategories.length || hasDuplicateRooms || benefitPending
                  }
                >
                  {mutation.busy ? 'Đang lưu phiên bản nháp…' : 'Lưu phiên bản nháp'}
                </Button>
              </div>
            </footer>
          </form>
        </Panel>
      )}
    </>
  )
}

function UnifiedNewTemplateWizard({
  disabled: parentDisabled,
  existingTemplateIds,
  onCreated,
  onCancel,
}: {
  disabled: boolean
  existingTemplateIds: string[]
  onCreated: (templateId: string, createdWithVersion: boolean) => void
  onCancel: () => void
}) {
  const access = useSessionAccess()
  const [code, setCode] = useState('')
  const [codeManuallyEdited, setCodeManuallyEdited] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [addedRooms, setAddedRooms] = useState<string[]>([])
  const [roomDraft, setRoomDraft] = useState('')
  const [reusedCategories, setReusedCategories] = useState<string[]>([])
  const [benefits, setBenefits] = useState<(BenefitInput & { resourceName: string })[]>([])
  const [benefitPending, setBenefitPending] = useState(false)
  const [localError, setLocalError] = useState('')
  const [createdTemplateLocked, setCreatedTemplateLocked] = useState(false)
  const createdTemplateRef = useRef<CruisePackageTemplate | null>(null)
  const nameInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    nameInput.current?.focus()
  }, [])

  const categoryCatalog = useReadQuery(
    `cruise-package-category-catalog:${access.userId}:new-template`,
    cruisePackageApi.logicalCategories,
  )

  const knownCategories = categoryCatalog.data ?? []
  const reusedRooms = knownCategories.filter(category => reusedCategories.includes(category.id))
  const draftPendingNames = roomDraft
    .split('\n')
    .map(value => value.trim())
    .filter(Boolean)
  const logicalCategories = [...reusedRooms.map(category => category.name), ...addedRooms, ...draftPendingNames]
  const hasDuplicateRooms = new Set(logicalCategories).size !== logicalCategories.length

  const pendingAttempt = useRef<{ code: string; ids: string[] } | null>(null)
  const mutation = useCruisePackageMutation(
    () => {},
    undefined,
    async () => {
      const pending = pendingAttempt.current
      if (!pending) return false
      const rows = await cruisePackageApi.templates()
      const matches = rows.filter(row => row.code === pending.code && !pending.ids.includes(row.id))
      if (matches.length !== 1) return false
      onCreated(matches[0].id, false)
      return true
    },
  )

  const disabled = parentDisabled || mutation.busy || mutation.needsReview
  useFormChanges(
    Boolean(code || name || description || addedRooms.length || roomDraft.trim() || benefits.length || reusedCategories.length),
    mutation.busy,
  )

  return (
    <Panel className={styles.panel} title="Thiết lập mẫu gói du thuyền mới">
      <div className={styles.workflowIntroBanner}>
        <div className={styles.workflowStepPill}>
          <span className={styles.stepNumberBadge}>1</span>
          <div>
            <strong> Bước 1: Định danh & Thông tin gói</strong>
            <span>Nhập tên thương mại và mã quản lý</span>
          </div>
        </div>
        <div className={styles.workflowStepPill}>
          <span className={styles.stepNumberBadge}>2</span>
          <div>
            <strong>Bước 2: Hạng phòng áp dụng</strong>
            <span>Chọn hoặc thêm các hạng phòng</span>
          </div>
        </div>
        <div className={styles.workflowStepPill}>
          <span className={styles.stepNumberBadge}>3</span>
          <div>
            <strong>Bước 3: Quyền lợi đi kèm</strong>
            <span>Hoạt động, tour bờ và dịch vụ</span>
          </div>
        </div>
      </div>

      {mutation.feedback}
      {localError && (
        <Notice title="Kiểm tra lại thông tin mẫu gói" tone="error">
          <p>{localError}</p>
        </Notice>
      )}

      <form
        id="fare-template-create"
        aria-busy={mutation.busy}
        className={styles.versionForm}
        onSubmit={async e => {
          e.preventDefault()
          if (disabled || benefitPending) return
          const trimmedCode = code.trim()
          const trimmedName = name.trim()
          if (!trimmedCode) {
            setLocalError('Vui lòng nhập mã định danh mẫu gói (ví dụ: ROYAL-LUX).')
            document.getElementById('fare-template-code')?.focus()
            return
          }
          if (!trimmedName) {
            setLocalError('Vui lòng nhập tên gói du thuyền hiển thị cho hành khách.')
            document.getElementById('fare-version-name')?.focus()
            return
          }
          if (!logicalCategories.length || hasDuplicateRooms) {
            setLocalError('Vui lòng chọn hoặc thêm ít nhất một hạng phòng cho gói và không để trùng tên.')
            document.getElementById('fare-logical-categories')?.focus()
            return
          }
          setLocalError('')
          pendingAttempt.current = { code: trimmedCode, ids: existingTemplateIds }

          await mutation.run(async () => {
            let tpl = createdTemplateRef.current
            if (!tpl || tpl.code !== trimmedCode) {
              const created = await cruisePackageApi.createTemplate(trimmedCode)
              if (created.code !== trimmedCode) {
                throw new Error('Chưa xác nhận đúng mẫu vừa tạo.')
              }
              tpl = created
              createdTemplateRef.current = created
              setCreatedTemplateLocked(true)
            }

            await cruisePackageApi.createVersion(tpl.id, {
              expectedTemplateRevision: tpl.revision,
              name: trimmedName,
              description,
              logicalCategories,
              reusedLogicalCategoryIds: reusedRooms.map(category => category.id),
              benefits: benefits.map(b => ({
                resourceType: b.resourceType,
                resourceId: b.resourceId,
                inclusion: b.inclusion,
                quantityLimit: b.quantityLimit,
                eligibility: b.eligibility,
                usagePolicy: b.usagePolicy,
                usageUnit: b.usageUnit,
                serviceUnitCode: b.serviceUnitCode,
                requiresReservation: b.requiresReservation,
                usageStartsAt: b.usageStartsAt,
                usageEndsAt: b.usageEndsAt,
              })),
            })

            onCreated(tpl.id, true)
          }, 'Đã khởi tạo mẫu gói và lưu phiên bản nháp đầu tiên.')
        }}
      >
        {/* BƯỚC 1 */}
        <section className={styles.stepSection} aria-labelledby="new-tpl-step-1">
          <div className={styles.stepSectionHeader}>
            <div className={styles.stepSectionTitle}>
              <span className={styles.stepNumberBadge}>1</span>
              <StepIcon kind="info" />
              <div>
                <h3 id="new-tpl-step-1">Định danh & Thông tin gói du thuyền</h3>
                <p className={styles.helper}>
                  Nhập tên gói hiển thị cho khách hàng. Mã định danh mẫu sẽ được gợi ý tự động hoặc bạn có thể tùy chỉnh.
                </p>
              </div>
            </div>
          </div>

          <div className={styles.stepSectionBody}>
            <div className={styles.fieldGrid}>
              <Field
                htmlFor="fare-version-name"
                label="Tên gói du thuyền (hiển thị cho khách) *"
                hint="Ví dụ: Gói Hoàng Gia Trọn Gói 3N2Đ."
              >
                <input
                  ref={nameInput}
                  id="fare-version-name"
                  required
                  maxLength={200}
                  placeholder="Nhập tên thương mại của gói..."
                  value={name}
                  disabled={disabled}
                  onChange={e => {
                    const nextName = e.target.value
                    setName(nextName)
                    if (!codeManuallyEdited) {
                      setCode(suggestCodeFromName(nextName))
                    }
                  }}
                />
              </Field>

              <Field
                htmlFor="fare-template-code"
                label="Mã định danh mẫu *"
                hint="Mã quản lý nội bộ ngắn gọn, viết hoa không dấu (ví dụ: ROYAL-3N2D)."
              >
                <input
                  id="fare-template-code"
                  required
                  maxLength={50}
                  placeholder="Ví dụ: ROYAL-LUX"
                  value={code}
                  disabled={disabled || createdTemplateLocked}
                  onChange={e => {
                    setCodeManuallyEdited(true)
                    setCode(e.target.value.toUpperCase())
                  }}
                />
              </Field>
            </div>

            <Field
              htmlFor="fare-version-description"
              label="Mô tả gói du thuyền"
              hint="Tóm tắt quyền lợi nổi bật và phong cách trải nghiệm của gói du thuyền này."
            >
              <textarea
                rows={3}
                id="fare-version-description"
                maxLength={10000}
                placeholder="Nhập mô tả chi tiết cho gói du thuyền..."
                value={description}
                disabled={disabled}
                onChange={e => setDescription(e.target.value)}
              />
            </Field>
          </div>
        </section>

        {/* BƯỚC 2 */}
        <section className={styles.stepSection} aria-labelledby="new-tpl-step-2">
          <div className={styles.stepSectionHeader}>
            <div className={styles.stepSectionTitle}>
              <span className={styles.stepNumberBadge}>2</span>
              <StepIcon kind="cabin" />
              <div>
                <h3 id="new-tpl-step-2">Hạng phòng thương mại trong gói</h3>
                <p className={styles.helper}>
                  Thêm ít nhất 1 hạng phòng thương mại (bằng cách nhập mới hoặc chọn lại từ các hạng phòng sẵn có).
                </p>
              </div>
            </div>
          </div>

          <div className={styles.stepSectionBody}>
            <CabinCategoryBuilder
              knownCategories={knownCategories}
              reusedCategories={reusedCategories}
              setReusedCategories={setReusedCategories}
              addedRooms={addedRooms}
              setAddedRooms={setAddedRooms}
              roomDraft={roomDraft}
              setRoomDraft={setRoomDraft}
              disabled={disabled}
              hasDuplicateRooms={hasDuplicateRooms}
            />
          </div>
        </section>

        {/* BƯỚC 3 */}
        <section className={styles.stepSection} aria-labelledby="new-tpl-step-3">
          <div className={styles.stepSectionHeader}>
            <div className={styles.stepSectionTitle}>
              <span className={styles.stepNumberBadge}>3</span>
              <StepIcon kind="benefit" />
              <div>
                <h3 id="new-tpl-step-3">Quyền lợi đi kèm trong gói</h3>
                <p className={styles.helper}>
                  Thêm các hoạt động trên tàu, tour tham quan bờ hoặc dịch vụ đi kèm trong gói du thuyền.
                </p>
              </div>
            </div>
            <Badge label={`${benefits.length} quyền lợi đã thêm`} tone={benefits.length > 0 ? 'info' : 'neutral'} />
          </div>

          <div className={styles.stepSectionBody}>
            {benefits.length === 0 ? (
              <div className={styles.emptyBenefitNotice}>
                <p>
                  <strong>Chưa thêm quyền lợi đi kèm.</strong> Nhấn <em>Thêm quyền lợi đi kèm</em> bên dưới để chọn hoạt động, tour bờ hoặc dịch vụ cho gói.
                </p>
              </div>
            ) : (
              <ul className={styles.benefitList} aria-label="Danh sách quyền lợi đã thêm">
                {benefits.map((benefit, index) => (
                  <li key={`${benefit.resourceType}:${benefit.resourceId}`} className={styles.benefitRowItem}>
                    <div className={styles.benefitRowMain}>
                      <div className={styles.benefitRowHeader}>
                        <strong>{benefit.resourceName}</strong>
                        <Badge label={resourceLabels[benefit.resourceType]} tone="neutral" />
                        <Badge
                          label={
                            benefit.quantityLimit != null
                              ? `${inclusionLabels[benefit.inclusion]} · ${benefitQuantity(benefit.quantityLimit, benefit)}`
                              : inclusionLabels[benefit.inclusion]
                          }
                          tone={
                            benefit.inclusion === 'INCLUDED' || benefit.inclusion === 'LIMITED_INCLUDED'
                              ? 'success'
                              : 'warning'
                          }
                        />
                      </div>
                      <p className={styles.helper}>Điều kiện áp dụng: {benefit.eligibility}</p>
                    </div>
                    <Button
                      type="button"
                      tone="secondary"
                      autoWidth
                      disabled={disabled}
                      aria-label={`Bỏ quyền lợi ${benefit.resourceName}`}
                      onClick={() => setBenefits(v => v.filter((_, i) => i !== index))}
                    >
                      <StepIcon kind="trash" />
                      <span>Bỏ quyền lợi</span>
                    </Button>
                  </li>
                ))}
              </ul>
            )}

            <BenefitEditor
              disabled={disabled}
              onPendingChange={setBenefitPending}
              onAdd={benefit => {
                if (
                  benefits.some(b => b.resourceType === benefit.resourceType && b.resourceId === benefit.resourceId)
                ) {
                  setLocalError('Quyền lợi này đã có trong danh sách đang soạn.')
                  return false
                }
                setLocalError('')
                setBenefits(v => [...v, benefit])
                return true
              }}
            />
          </div>
        </section>

        <footer className={styles.formFooter}>
          <Button
            type="button"
            autoWidth
            tone="secondary"
            disabled={mutation.busy || mutation.needsReview}
            onClick={onCancel}
          >
            Hủy & về danh mục mẫu
          </Button>
          <div className={styles.formFooterRight}>
            {benefitPending && (
              <p className={styles.validationHint}>
                Hoàn tất hoặc hủy quyền lợi đang nhập dở ở Bước 3 trước khi lưu mẫu gói.
              </p>
            )}
            <Button
              autoWidth
              type="submit"
              disabled={
                disabled ||
                !code.trim() ||
                !name.trim() ||
                !logicalCategories.length ||
                hasDuplicateRooms ||
                benefitPending
              }
            >
              {mutation.busy ? 'Đang khởi tạo mẫu gói…' : 'Tạo mẫu & lưu phiên bản nháp'}
            </Button>
          </div>
        </footer>
      </form>
    </Panel>
  )
}

function VersionCard({
  item,
  onPublish,
  disabled,
  supersededDraft,
}: {
  item: CruisePackageVersion
  onPublish?: () => void
  disabled?: boolean
  supersededDraft?: boolean
}) {
  const version = item.version
  return (
    <details className={styles.version} open={version.status === 'PUBLISHED' || version.status === 'DRAFT'}>
      <summary>
        <span className={styles.versionIdentity}>
          <strong>{version.name}</strong>
          <span>
            Phiên bản {version.versionNumber} · {version.logicalCategories.length} hạng phòng · {item.benefits.length} quyền lợi đi kèm
          </span>
        </span>
        <Badge
          label={lifecycle[version.status]}
          tone={
            version.status === 'PUBLISHED' ? 'success' : version.status === 'DRAFT' ? 'warning' : 'neutral'
          }
        />
        <span className={styles.versionAction}>Chi tiết phiên bản</span>
      </summary>
      <div className={styles.versionBody}>
        <div className={styles.versionFacts}>
          <div>
            <h4>Hạng phòng thương mại ({version.logicalCategories.length})</h4>
            {version.logicalCategories.length > 0 ? (
              <div className={styles.cabinBadgeRow}>
                {version.logicalCategories.map(cat => (
                  <Badge key={cat} label={cat} tone="neutral" />
                ))}
              </div>
            ) : (
              <p>Chưa khai báo hạng cabin</p>
            )}
          </div>
          {version.description && (
            <div>
              <h4>Mô tả gói du thuyền</h4>
              <p>{version.description}</p>
            </div>
          )}
        </div>

        <div>
          <h4>Quyền lợi đi kèm ({item.benefits.length})</h4>
          {item.benefits.length === 0 && <p className={styles.helper}>Phiên bản này chưa cấu hình quyền lợi đi kèm.</p>}
          <ul className={styles.benefitList}>
            {item.benefits.map(b => (
              <li key={b.id}>
                <div>
                  <div className={styles.benefitRowHeader}>
                    <strong>{item.resourceNames[b.id] ?? 'Chưa đọc được tên quyền lợi'}</strong>
                    <Badge
                      label={
                        b.quantityLimit != null
                          ? `${inclusionLabels[b.inclusion]} · ${benefitQuantity(b.quantityLimit, b)}`
                          : inclusionLabels[b.inclusion]
                      }
                      tone={b.inclusion === 'INCLUDED' || b.inclusion === 'LIMITED_INCLUDED' ? 'success' : 'neutral'}
                    />
                  </div>
                  <p className={styles.helper}>Điều kiện: {b.eligibility}</p>
                  {(b.inclusion === 'INCLUDED' || b.inclusion === 'LIMITED_INCLUDED') && (
                    <dl className={styles.benefitFacts}>
                      <div>
                        <dt>Chính sách sử dụng</dt>
                        <dd>
                          {b.usagePolicy === 'UNLIMITED'
                            ? 'Không giới hạn'
                            : b.usagePolicy === 'LIMITED'
                              ? 'Có giới hạn định mức'
                              : 'Chưa cấu hình'}
                        </dd>
                      </div>
                      <div>
                        <dt>Đơn vị ghi nhận</dt>
                        <dd>
                          {b.usageUnit === 'PARTICIPATION'
                            ? 'Lượt tham gia / hành khách'
                            : b.serviceUnitCode ?? 'Chưa có đơn vị hỗ trợ'}
                        </dd>
                      </div>
                      <div>
                        <dt>Đăng ký sử dụng</dt>
                        <dd>
                          {b.requiresReservation === true
                            ? 'Phải đăng ký / yêu cầu phục vụ'
                            : b.requiresReservation === false
                              ? 'Không cần đăng ký'
                              : 'Chưa cấu hình'}
                        </dd>
                      </div>
                      {(b.usageStartsAt || b.usageEndsAt) && (
                        <div>
                          <dt>Khoảng sử dụng</dt>
                          <dd>
                            {b.usageStartsAt ? new Date(b.usageStartsAt).toLocaleString('vi-VN') : 'Chưa có mốc bắt đầu'}{' '}
                            — {b.usageEndsAt ? new Date(b.usageEndsAt).toLocaleString('vi-VN') : 'Chưa có mốc kết thúc'}
                          </dd>
                        </div>
                      )}
                    </dl>
                  )}
                  {(b.inclusion === 'OPTIONAL' || b.inclusion === 'NOT_INCLUDED') && (
                    <p className={styles.helper}>
                      Không cấp quyền sử dụng miễn phí. Hành khách mua thêm theo Add-on Offer hợp lệ.
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>

        {onPublish && (
          <div className={styles.publishRow}>
            <div>
              <strong>Sẵn sàng đưa phiên bản {version.versionNumber} vào sử dụng?</strong>
              <p className={styles.helper}>
                Sau khi phát hành, phiên bản này có thể được chọn khi cấu hình gói du thuyền cho các chuyến khởi hành.
              </p>
            </div>
            <Button autoWidth disabled={disabled} onClick={onPublish}>
              <StepIcon kind="check" />
              <span>Phát hành phiên bản {version.versionNumber}</span>
            </Button>
          </div>
        )}
        {supersededDraft && <p className={styles.helper}>Bản nháp này cũ hơn phiên bản đang phát hành.</p>}
      </div>
    </details>
  )
}

export function CruisePackageTemplatePage() {
  return (
    <UnsavedForms>
      <TemplateWorkspace />
    </UnsavedForms>
  )
}

function TemplateWorkspace() {
  const access = useSessionAccess()
  const canWrite = access.roles.includes('ACTIVITY_SERVICE_MANAGER') && access.canDo('TOUR_PACKAGE_MANAGE')
  const [epoch, setEpoch] = useState(0)
  const [selected, setSelected] = useState('')
  const [creatingTemplate, setCreatingTemplate] = useState(false)
  const [newTemplateId, setNewTemplateId] = useState('')
  const [search, setSearch] = useState('')
  const pageHeading = useRef<HTMLDivElement>(null)

  useEffect(() => {
    pageHeading.current?.focus()
  }, [selected, creatingTemplate])

  const switchWorkspace = useWorkspaceChange()
  const loadTemplates = useCallback((signal: AbortSignal) => cruisePackageApi.templates(signal), [])
  const query = useReadQuery(`fare-templates:${access.userId}:${epoch}`, loadTemplates)
  const refresh = () => setEpoch(v => v + 1)

  const template = query.data?.find(item => item.id === selected)
  const disabled = query.loading || Boolean(query.error) || !query.data
  const templates = query.data
  const showCatalog = !selected && !creatingTemplate

  const catalog = useReadQuery(
    `template-catalog:${access.userId}:${epoch}:${showCatalog}:${Boolean(templates)}`,
    useCallback(
      async signal => {
        const rows: Array<{
          item: CruisePackageTemplate
          versions: Awaited<ReturnType<typeof cruisePackageApi.versions>> | null
        }> = []
        if (!showCatalog || !templates) return rows
        for (let index = 0; index < templates.length && !signal.aborted; index += 6) {
          const batch = templates.slice(index, index + 6)
          const versions = await Promise.allSettled(batch.map(item => cruisePackageApi.versions(item.id, signal)))
          rows.push(
            ...batch.map((item, offset) => {
              const result = versions[offset]
              return { item, versions: result.status === 'fulfilled' ? result.value : null }
            }),
          )
        }
        return rows
      },
      [showCatalog, templates],
    ),
  )

  const term = search.trim().toLocaleLowerCase('vi')
  const rows =
    catalog.data?.filter(
      ({ item, versions }) =>
        item.code.toLocaleLowerCase('vi').includes(term) ||
        versions?.some(({ version }) => version.name.toLocaleLowerCase('vi').includes(term)),
    ) ?? []

  const pageTitle = creatingTemplate
    ? 'Tạo mẫu gói du thuyền mới'
    : template
      ? `Mẫu gói du thuyền · ${template.code}`
      : 'Mẫu gói du thuyền'

  return (
    <AdminShell>
      <div className={styles.workspace}>
        <div ref={pageHeading} tabIndex={-1}>
          <PageHeader
            title={pageTitle}
            breadcrumb="Hoạt động và dịch vụ"
            actions={
              selected || creatingTemplate ? (
                <Button
                  tone="secondary"
                  onClick={() =>
                    switchWorkspace(() => {
                      setSelected('')
                      setCreatingTemplate(false)
                    })
                  }
                >
                  Về danh mục mẫu
                </Button>
              ) : (
                canWrite && (
                  <Button
                    disabled={disabled}
                    aria-controls="fare-template-create"
                    onClick={() => setCreatingTemplate(true)}
                  >
                    <StepIcon kind="plus" />
                    <span>Tạo mẫu gói mới</span>
                  </Button>
                )
              )
            }
          />
        </div>

        <QueryState loading={query.loading} error={query.error} />
        {query.error && (
          <Button tone="secondary" onClick={query.retry}>
            Tải lại danh sách mẫu
          </Button>
        )}

        {showCatalog && !query.loading && !query.error && (
          <Panel className={styles.panel}>
            <div className={styles.workflowIntroBanner}>
              <div className={styles.workflowStepPill}>
                <span className={styles.stepNumberBadge}>1</span>
                <div>
                  <strong>Soạn mẫu & phiên bản gói</strong>
                  <span>Khai báo tên gói, hạng phòng và quyền lợi đi kèm</span>
                </div>
              </div>
              <div className={styles.workflowStepPill}>
                <span className={styles.stepNumberBadge}>2</span>
                <div>
                  <strong>Phát hành phiên bản</strong>
                  <span>Chốt phiên bản chính thức để sẵn sàng sử dụng</span>
                </div>
              </div>
              <div className={styles.workflowStepPill}>
                <span className={styles.stepNumberBadge}>3</span>
                <div>
                  <strong>Gán vào chuyến khởi hành</strong>
                  <span>Ghép cabin thực tế trên tàu và trình duyệt giá bán</span>
                </div>
              </div>
            </div>

            <div className={styles.catalogToolbar}>
              <div className={styles.catalogSearch}>
                <Field htmlFor="fare-template-search" label="Tìm kiếm mẫu gói du thuyền">
                  <input
                    type="search"
                    id="fare-template-search"
                    value={search}
                    onChange={event => setSearch(event.target.value)}
                    placeholder="Nhập tên gói hoặc mã mẫu..."
                  />
                </Field>
              </div>
              {catalog.data && (
                <span className={styles.helper}>
                  Hiển thị {rows.length} / {catalog.data.length} mẫu gói
                </span>
              )}
            </div>

            {catalog.loading && <Loading label="Đang tải phiên bản của các mẫu…" />}
            {catalog.data?.some(row => row.versions === null) && (
              <Notice tone="warning" title="Một số phiên bản chưa tải được">
                <Button tone="secondary" onClick={catalog.retry}>
                  Tải lại phiên bản
                </Button>
              </Notice>
            )}
            {catalog.data && !rows.length && (
              <Empty title={term ? 'Không tìm thấy mẫu phù hợp' : 'Chưa có mẫu gói du thuyền'}>
                <p>
                  {term
                    ? 'Thử tìm bằng tên gói hoặc mã mẫu khác.'
                    : 'Nhấn "Tạo mẫu gói mới" để thiết lập tên gói, hạng phòng và quyền lợi đi kèm.'}
                </p>
              </Empty>
            )}
            {rows.length > 0 && (
              <DataTable
                label="Danh mục mẫu gói du thuyền"
                headers={['Mẫu gói du thuyền', 'Cấu trúc gói', 'Trạng thái phát hành', 'Bản nháp', 'Thao tác']}
              >
                {rows.map(({ item, versions }) => {
                  const published = versions?.find(entry => entry.version.status === 'PUBLISHED')
                  const drafts = versions?.filter(entry => entry.version.status === 'DRAFT') ?? []
                  const primaryVersion = published ?? drafts[0]
                  const name = primaryVersion?.version.name
                  const roomCount = primaryVersion?.version.logicalCategories.length ?? 0
                  const benefitCount = primaryVersion?.benefits.length ?? 0

                  return (
                    <tr key={item.id}>
                      <td>
                        <div className={styles.catalogNameCell}>
                          <strong>{name || 'Chưa đặt tên thương mại'}</strong>
                          <span className={styles.codePill}>Mã: {item.code}</span>
                        </div>
                      </td>
                      <td>
                        {primaryVersion ? (
                          <span className={styles.helper}>
                            {roomCount} hạng phòng · {benefitCount} quyền lợi
                          </span>
                        ) : (
                          <span className={styles.helper}>Chưa cấu hình nội dung</span>
                        )}
                      </td>
                      <td>
                        {published ? (
                          <Badge label={`Phiên bản ${published.version.versionNumber} · Đã phát hành`} tone="success" />
                        ) : versions ? (
                          <Badge label="Chưa phát hành" tone="warning" />
                        ) : (
                          'Chưa tải được'
                        )}
                      </td>
                      <td>
                        {drafts.length === 1
                          ? `Phiên bản ${drafts[0].version.versionNumber} (Nháp)`
                          : drafts.length > 1
                            ? `${drafts.length} bản nháp`
                            : '—'}
                      </td>
                      <td>
                        <Button
                          tone="secondary"
                          autoWidth
                          aria-label={`Mở mẫu ${item.code}`}
                          onClick={() => setSelected(item.id)}
                        >
                          {primaryVersion ? 'Xem & cấu hình' : 'Soạn nội dung'}
                        </Button>
                      </td>
                    </tr>
                  )
                })}
              </DataTable>
            )}
          </Panel>
        )}

        {creatingTemplate && canWrite && (
          <UnifiedNewTemplateWizard
            disabled={disabled}
            existingTemplateIds={query.data?.map(row => row.id) ?? []}
            onCreated={(createdId, createdWithVersion) => {
              refresh()
              setSelected(createdId)
              setNewTemplateId(createdWithVersion ? '' : createdId)
              setCreatingTemplate(false)
            }}
            onCancel={() => switchWorkspace(() => setCreatingTemplate(false))}
          />
        )}

        {template && (
          <TemplateVersions
            key={template.id}
            template={template}
            startNew={template.id === newTemplateId}
            readOnly={disabled}
            onChanged={refresh}
          />
        )}
      </div>
    </AdminShell>
  )
}
