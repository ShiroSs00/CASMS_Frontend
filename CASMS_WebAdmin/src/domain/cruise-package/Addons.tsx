import styles from './Workspace.module.css'
import { useCallback, useRef, useState } from 'react'
import { apiRequestRaw, useReadQuery } from '@/shared/api'
import { useSessionAccess } from '@/shared/auth'
import { Badge, Button, Empty, Field, Modal, Notice, useFormChanges } from '@/shared/ui'
import { QueryState } from './Workspace'
import { useCruisePackageMutation } from './useCruisePackageMutation'
import { fareObject, fareText, fareUuid, fareAmount } from './purchase-contract'
import { cruisePackageApi, type ResourceType } from './api'
import { journeyTime, wallTimeToInstant, zonedInput, SHIP_TIME_ZONE } from '@/shared/lib/journey-time'

type Stage = 'BOOKING' | 'PRE_DEPARTURE' | 'ONBOARD'
type Window = { stage: Stage; startsAt: string; endsAt: string; operationalCutoff: string }
type Addon = {
  id: string
  cruiseId: string
  shipId: string
  resourceName: string
  amount: string
  pricingUnit: 'PERSON' | 'SERVICE_UNIT'
  serviceUnitCode: string | null
  salesWindows: Window[]
  eligibility: string
  revision: number
  publishedAt: string | null
}

const root = (id: string) => `/cruise/${encodeURIComponent(id)}/cruise-package-addons`
const stageNames: Record<Stage, string> = {
  BOOKING: 'Trong khung nhận đặt chỗ',
  PRE_DEPARTURE: 'Trước giờ khởi hành',
  ONBOARD: 'Trên tàu'
}

function toInputDateTime(iso?: string | null): string {
  if (!iso) return ''
  try {
    return zonedInput(iso, SHIP_TIME_ZONE).slice(0, 16)
  } catch {
    const d = new Date(iso)
    if (isNaN(d.getTime())) return ''
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  }
}

function decode(value: unknown, cruiseId: string): Addon {
  const r = fareObject(value)
  if (r.cruiseId !== cruiseId || r.currencyCode !== 'USD' || !['PERSON', 'SERVICE_UNIT'].includes(String(r.pricingUnit)) || !Number.isSafeInteger(r.revision) || !Array.isArray(r.salesWindows)) {
    throw new Error('Nội dung Add-on không khớp chuyến, giá hoặc giai đoạn bán.')
  }
  const salesWindows = r.salesWindows.map(value => {
    const w = fareObject(value)
    if (!Object.prototype.hasOwnProperty.call(stageNames, String(w.stage))) {
      throw new Error('Giai đoạn bán chưa được hỗ trợ.')
    }
    for (const key of ['startsAt', 'endsAt', 'operationalCutoff']) {
      if (!Number.isFinite(Date.parse(String(w[key])))) throw new Error('Thời hạn Add-on chưa hợp lệ.')
    }
    return {
      stage: w.stage as Stage,
      startsAt: fareText(w.startsAt),
      endsAt: fareText(w.endsAt),
      operationalCutoff: fareText(w.operationalCutoff)
    }
  })
  return {
    id: fareUuid(r.id),
    cruiseId,
    shipId: fareUuid(r.shipId),
    resourceName: fareText(r.resourceName),
    amount: fareAmount(r.amount),
    pricingUnit: r.pricingUnit as Addon['pricingUnit'],
    serviceUnitCode: r.serviceUnitCode == null ? null : fareText(r.serviceUnitCode),
    salesWindows,
    eligibility: fareText(r.eligibility),
    revision: Number(r.revision),
    publishedAt: r.publishedAt == null ? null : fareText(r.publishedAt)
  }
}

function response(value: unknown) {
  const envelope = fareObject(value)
  if (envelope.success !== true) throw new Error('Máy chủ chưa xác nhận thao tác Add-on.')
  return envelope.data
}

export function CruisePackageAddons({ cruiseId, onChanged }: { cruiseId: string; onChanged?: () => void }) {
  const access = useSessionAccess()
  const canWrite = access.roles.includes('ACTIVITY_SERVICE_MANAGER') && access.canDo('TOUR_PACKAGE_MANAGE')
  const [creating, setCreating] = useState(false)
  const [epoch, setEpoch] = useState(0)
  const [type, setType] = useState<ResourceType>('ACTIVITY')
  const [resource, setResource] = useState('')
  const [unit, setUnit] = useState<string | null>(null)
  const [amount, setAmount] = useState('')
  const [eligibility, setEligibility] = useState('')
  const [windows, setWindows] = useState<Window[]>([])
  const [stage, setStage] = useState<Stage | ''>('')
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [cutoff, setCutoff] = useState('')
  const [error, setError] = useState('')

  const query = useReadQuery(`cruise-package-addons:${access.userId}:${cruiseId}:${epoch}`, useCallback(async signal => {
    const v = response(await apiRequestRaw(root(cruiseId), value => value, { signal }))
    if (!Array.isArray(v)) throw new Error('Danh sách Add-on không hợp lệ.')
    return v.map(value => decode(value, cruiseId))
  }, [cruiseId]))

  const configuration = useReadQuery(`addon-configuration:${access.userId}:${cruiseId}:${epoch}`, useCallback(signal => {
    return canWrite ? cruisePackageApi.addonConfiguration(cruiseId, signal) : Promise.resolve(null)
  }, [cruiseId, canWrite]))

  const candidate = configuration.data?.candidates.find(c => c.resourceType === type && c.resourceId === resource)
  const pending = useRef<{ kind: 'create'; ids: string[]; body: unknown } | { kind: 'publish'; id: string } | null>(null)

  const reset = () => {
    setType('ACTIVITY')
    setError('')
    setResource('')
    setUnit(null)
    setAmount('')
    setWindows([])
    setEligibility('')
    setStage('')
    setStart('')
    setEnd('')
    setCutoff('')
    setCreating(false)
  }

  const mutation = useCruisePackageMutation(() => {
    setEpoch(n => n + 1)
    onChanged?.()
  }, undefined, async () => {
    const operation = pending.current
    if (!operation) return false
    const raw = response(await apiRequestRaw(root(cruiseId), value => value))
    if (!Array.isArray(raw)) throw new Error('Chưa đọc được danh sách Add-on đã lưu.')
    if (operation.kind === 'publish') {
      return raw.some(value => {
        const saved = decode(value, cruiseId)
        return saved.id === operation.id && Boolean(saved.publishedAt)
      })
    }
    const expected = fareObject(operation.body)
    const equalDecimal = (a: unknown, b: unknown) => String(a).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '') === String(b).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '')
    const matches = raw.filter(value => {
      const row = fareObject(value)
      const saved = decode(value, cruiseId)
      const source = expected.resourceType === 'SERVICE' ? row.serviceId : expected.resourceType === 'ACTIVITY' ? row.onboardActivityId : row.shoreExcursionId
      return !operation.ids.includes(saved.id) && source === expected.resourceId && equalDecimal(saved.amount, expected.amount) && saved.eligibility === expected.eligibility && Array.isArray(expected.windows) && saved.salesWindows.length === expected.windows.length && saved.salesWindows.every(w => {
        const expectedWindow = (expected.windows as unknown[]).map(fareObject).find(v => v.stage === w.stage)
        return expectedWindow && (['startsAt', 'endsAt', 'operationalCutoff'] as const).every(key => Date.parse(w[key]) === Date.parse(String(expectedWindow[key])))
      })
    })
    if (matches.length !== 1) return false
    reset()
    return true
  })

  const disabled = mutation.busy || mutation.needsReview || query.loading || Boolean(query.error)
  const createBlocked = disabled || configuration.loading || Boolean(configuration.error) || !configuration.data?.canCreate

  const sourceChoices = configuration.data?.candidates.filter(item => item.resourceType === type) ?? []
  const canSave = !createBlocked && Boolean(candidate?.eligible && resource && windows.length && amount.trim() && eligibility.trim()) && !(stage || start || end || cutoff)

  useFormChanges(Boolean(resource || amount || eligibility || windows.length || stage || start || end || cutoff), mutation.busy)

  const handleStageSelect = (selectedStage: Stage | '') => {
    setStage(selectedStage)
    setError('')
    const bounds = configuration.data
    if (!selectedStage || !bounds) {
      setStart('')
      setEnd('')
      setCutoff('')
      return
    }

    const first = selectedStage === 'BOOKING' ? bounds.bookingOpensAt
      : selectedStage === 'PRE_DEPARTURE' ? bounds.bookingClosesAt : bounds.departureAt
    const last = selectedStage === 'BOOKING' ? bounds.bookingClosesAt
      : selectedStage === 'PRE_DEPARTURE' ? bounds.departureAt : bounds.returnAt
    const limit = candidate?.cutoffLimit
    const endLimit = last && limit && Date.parse(last) > Date.parse(limit) ? limit : last
    setStart(toInputDateTime(first))
    setEnd(endLimit && (!first || Date.parse(endLimit) > Date.parse(first)) ? toInputDateTime(endLimit) : '')
    setCutoff(toInputDateTime(limit))
  }

  return (
    <section aria-label="Cấu hình Add-on">
      <h3>Dịch vụ mua thêm</h3>
      <QueryState loading={query.loading} error={query.error} />
      {query.error && <Button onClick={query.retry}>Tải lại Add-on</Button>}
      {!creating && mutation.feedback}
      {canWrite && (
        <>
          <QueryState loading={configuration.loading} error={configuration.error} />
          {configuration.error && <Button tone="secondary" onClick={configuration.retry}>Tải lại điều kiện Add-on</Button>}
          {configuration.data && !configuration.data.canCreate && <Notice title="Chưa thể cấu hình Add-on" tone="warning">{configuration.data.reason}</Notice>}
          {!creating && <Button disabled={createBlocked} onClick={() => setCreating(true)}>Thêm dịch vụ mua thêm</Button>}
        </>
      )}
      {!creating && !query.loading && !query.error && query.data?.length === 0 && (
        <Empty title="Chưa cấu hình dịch vụ mua thêm">
          {!canWrite && <p>Quản lý hoạt động và dịch vụ chọn hoạt động, tour hoặc dịch vụ đủ điều kiện của chuyến để cấu hình bán thêm.</p>}
        </Empty>
      )}
      {query.data?.map(a => (
        <article key={a.id}>
          <h4>{a.resourceName} · {a.amount} USD/{a.pricingUnit === 'PERSON' ? 'người' : a.serviceUnitCode ?? 'chưa xác định đơn vị'}</h4>
          <p>{a.publishedAt ? 'Đã phát hành cấu hình Add-on' : 'Cấu hình nháp'} · Revision {a.revision}</p>
          <p>{a.eligibility}</p>
          <ul>
            {a.salesWindows.map(w => (
              <li key={w.stage}>
                {stageNames[w.stage]}: {journeyTime(w.startsAt)} → {journeyTime(w.endsAt)} · Hạn chốt phục vụ {journeyTime(w.operationalCutoff)}
              </li>
            ))}
          </ul>
          {canWrite && !a.publishedAt && (
            <Button
              disabled={disabled}
              onClick={() => {
                pending.current = { kind: 'publish', id: a.id }
                void mutation.run(
                  () => apiRequestRaw(
                    root(cruiseId) + `/${a.id}/publish`,
                    value => {
                      const saved = decode(response(value), cruiseId)
                      if (saved.id !== a.id || !saved.publishedAt) throw new Error('Chưa xác nhận đúng Add-on đã phát hành.')
                      return saved
                    },
                    { method: 'POST', body: { expectedRevision: a.revision } }
                  ),
                  'Đã phát hành cấu hình Add-on. Chưa tạo giao dịch mua hoặc giữ chỗ dịch vụ.'
                )
              }}
            >
              Phát hành cấu hình Add-on
            </Button>
          )}
        </article>
      ))}

      {canWrite && creating && (
        <Modal
          variant="drawer"
          large
          title="Thêm dịch vụ mua thêm"
          busy={mutation.busy}
          onClose={reset}
          footer={
            <>
              <Button tone="secondary" disabled={mutation.busy} data-overlay-dismiss onClick={reset}>Hủy</Button>
              <Button type="submit" form="cruise-addon-create" disabled={!canSave}>Lưu dịch vụ nháp</Button>
            </>
          }
        >
          {mutation.feedback}
          {configuration.error && (
            <Notice title="Chưa tải được nguồn dịch vụ" tone="error">
              <Button tone="secondary" onClick={configuration.retry}>Thử lại</Button>
            </Notice>
          )}

          <form
            id="cruise-addon-create"
            className={styles.form}
            onSubmit={async e => {
              e.preventDefault()
              setError('')
              if (createBlocked || !candidate?.eligible || !resource || !windows.length || !eligibility.trim()) return
              if (stage || start || end || cutoff) {
                setError('Thêm thời hạn đang nhập vào danh sách hoặc xóa nội dung thời hạn trước khi lưu.')
                return
              }
              if (!/^\d{1,15}(\.\d{1,4})?$/.test(amount)) {
                setError('Nhập giá USD hợp lệ, tối đa bốn chữ số thập phân.')
                return
              }
              if (type === 'SERVICE' && !unit) {
                setError('Dịch vụ chưa có đơn vị tính giá.')
                return
              }
              pending.current = {
                kind: 'create',
                ids: query.data?.map(a => a.id) ?? [],
                body: { resourceType: type, resourceId: resource, amount, windows, eligibility: eligibility.trim() }
              }
              const ok = await mutation.run(
                () => apiRequestRaw(root(cruiseId), value => decode(response(value), cruiseId), {
                  method: 'POST',
                  body: { resourceType: type, resourceId: resource, amount, windows, eligibility: eligibility.trim() }
                }),
                'Đã lưu cấu hình Add-on nháp. Chưa tạo purchase hoặc entitlement.'
              )
              if (ok) reset()
            }}
          >
            {error && <Notice title="Kiểm tra thông tin dịch vụ" tone="error">{error}</Notice>}

            {/* Bước 1: Nội dung bán thêm */}
            <div className={styles.stepGroup}>
              <div className={styles.stepHeader}>
                <h4 className={styles.stepTitle}>
                  Nội dung bán thêm
                </h4>
                {candidate && candidate.eligible && (
                  <Badge label="Đủ điều kiện" tone="success" />
                )}
              </div>

              <div className={styles.fieldGrid2}>
                <Field htmlFor="addon-type" label="Nguồn dịch vụ">
                  <select
                    id="addon-type"
                    value={type}
                    disabled={disabled}
                    onChange={e => {
                      setType(e.target.value as ResourceType)
                      setResource('')
                      setUnit(null)
                      setWindows([])
                      setStage('')
                      setStart('')
                      setEnd('')
                      setCutoff('')
                    }}
                  >
                    <option value="ACTIVITY">Hoạt động trên tàu</option>
                    <option value="EXCURSION">Tour bờ</option>
                    <option value="SERVICE">Dịch vụ</option>
                  </select>
                </Field>

                <Field htmlFor="addon-resource" label="Nội dung của chuyến">
                  <select
                    id="addon-resource"
                    value={resource}
                    disabled={createBlocked || !sourceChoices.some(item => item.eligible)}
                    onChange={e => {
                      const next = configuration.data?.candidates.find(c => c.resourceType === type && c.resourceId === e.target.value)
                      setResource(next?.resourceId ?? '')
                      setUnit(next?.unitCode ?? null)
                      setWindows([])
                      setStage('')
                      setStart('')
                      setEnd('')
                      setCutoff('')
                    }}
                  >
                    <option value="">Chọn nội dung</option>
                    {sourceChoices.map(c => (
                      <option key={c.resourceId} value={c.resourceId} disabled={!c.eligible}>
                        {c.name}{!c.eligible ? ' · Chưa đủ điều kiện' : ''}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>

              {configuration.data && !configuration.loading && sourceChoices.length === 0 && (
                <Notice title="Chưa có nội dung thuộc nhóm này" tone="warning">
                  Chọn nguồn khác hoặc bổ sung nội dung cho chuyến.
                </Notice>
              )}

              {sourceChoices.some(c=>!c.eligible)&&<details>
                <summary>Xem nội dung chưa thể bán</summary>
                <ul>{sourceChoices.filter(c=>!c.eligible).map(c=><li key={c.resourceId}>
                  <strong>{c.name}</strong> · {c.blocker?.replace(/^[A-Z0-9_]+:\s*/, '')}
                </li>)}</ul>
              </details>}

              {candidate?.cutoffLimit && (
                <p className={styles.templateHint}>
                  Hạn chốt tối đa · {journeyTime(candidate.cutoffLimit)}
                </p>
              )}
            </div>

            {/* Bước 2: Giá & Điều kiện sử dụng */}
            <div className={styles.stepGroup}>
              <div className={styles.stepHeader}>
                <h4 className={styles.stepTitle}>
                  Giá và điều kiện sử dụng
                </h4>
              </div>

              <Field htmlFor="addon-amount" label={`Giá USD / ${type === 'SERVICE' ? unit ?? 'chưa có đơn vị nguồn' : 'người'}`}>
                <input
                  id="addon-amount"
                  required
                  inputMode="decimal"
                                    value={amount}
                  disabled={disabled}
                  onChange={e => setAmount(e.target.value)}
                />
              </Field>

              <Field htmlFor="addon-eligibility" label="Điều kiện sử dụng">
                <textarea
                  id="addon-eligibility"
                  required
                  maxLength={4000}
                  rows={3}
                                    value={eligibility}
                  disabled={disabled}
                  onChange={e => setEligibility(e.target.value)}
                />
              </Field>
            </div>

            {/* Bước 3: Thời gian bán */}
            <div className={styles.stepGroup}>
              <div className={styles.stepHeader}>
                <h4 className={styles.stepTitle}>
                  Thời gian bán · Giờ Việt Nam
                </h4>
                {windows.length > 0 && (
                  <Badge label={`Đã thêm ${windows.length} giai đoạn`} tone="neutral" />
                )}
              </div>

              <fieldset disabled={disabled || !candidate?.eligible} className={styles.controls}>
                <div className={styles.fieldGrid2}>
                  <Field htmlFor="addon-stage" label="Giai đoạn được bán">
                    <select
                      id="addon-stage"
                      value={stage}
                      onChange={e => handleStageSelect(e.target.value as Stage | '')}
                    >
                      <option value="">Chọn giai đoạn</option>
                      {(Object.keys(stageNames) as Stage[])
                        .filter(s => candidate?.allowedStages.includes(s) && !windows.some(w => w.stage === s))
                        .map(s => (
                          <option key={s} value={s}>{stageNames[s]}</option>
                        ))}
                    </select>
                  </Field>


                </div>

                <div className={styles.fieldGrid3}>
                  <Field htmlFor="addon-start" label="Bắt đầu bán">
                    <input
                      id="addon-start"
                      type="datetime-local"
                      value={start}
                      onChange={e => setStart(e.target.value)}
                    />
                  </Field>

                  <Field htmlFor="addon-end" label="Kết thúc bán">
                    <input
                      id="addon-end"
                      type="datetime-local"
                      value={end}
                      onChange={e => setEnd(e.target.value)}
                    />
                  </Field>

                  <Field htmlFor="addon-cutoff" label="Hạn chốt phục vụ">
                    <input
                      id="addon-cutoff"
                      type="datetime-local"
                      value={cutoff}
                      onChange={e => setCutoff(e.target.value)}
                    />
                  </Field>
                </div>

                <div style={{ marginTop: '12px' }}>
                  <Button
                    type="button"
                    tone="secondary"
                    onClick={() => {
                      if (!stage || !candidate?.allowedStages.includes(stage) || !start || !end || !cutoff ||
                          windows.some(w => w.stage === stage)) {
                        setError('Chọn giai đoạn và điền đủ các mốc giờ.')
                        return
                      }
                      let startsAt: string, endsAt: string, operationalCutoff: string
                      try {
                        startsAt = wallTimeToInstant(start, SHIP_TIME_ZONE)
                        endsAt = wallTimeToInstant(end, SHIP_TIME_ZONE)
                        operationalCutoff = wallTimeToInstant(cutoff, SHIP_TIME_ZONE)
                      } catch {
                        setError('Nhập ngày và giờ hợp lệ theo giờ Việt Nam.')
                        return
                      }
                      const startMs = Date.parse(startsAt), endMs = Date.parse(endsAt), cutoffMs = Date.parse(operationalCutoff)
                      if (startMs >= endMs || endMs > cutoffMs) {
                        setError('Giờ bán phải kết thúc sau giờ bắt đầu và không được muộn hơn hạn chốt phục vụ.')
                        return
                      }
                      if (!candidate.cutoffLimit || cutoffMs > Date.parse(candidate.cutoffLimit)) {
                        setError('Chọn hạn chốt không muộn hơn giờ kết thúc lần phục vụ.')
                        return
                      }
                      const bounds = configuration.data
                      if (stage === 'BOOKING' && (!bounds?.bookingOpensAt || !bounds.bookingClosesAt ||
                          startMs < Date.parse(bounds.bookingOpensAt) || endMs > Date.parse(bounds.bookingClosesAt))) {
                        setError('Thời gian bán phải nằm trong khung nhận đặt chỗ của chuyến.')
                        return
                      }
                      if ((stage === 'PRE_DEPARTURE' && (!bounds?.departureAt || endMs > Date.parse(bounds.departureAt))) ||
                          (stage === 'ONBOARD' && (!bounds?.departureAt || !bounds.returnAt ||
                          startMs < Date.parse(bounds.departureAt) || endMs > Date.parse(bounds.returnAt)))) {
                        setError('Thời gian bán nằm ngoài phạm vi của giai đoạn đã chọn.')
                        return
                      }
                      setWindows(old => [...old, { stage, startsAt, endsAt, operationalCutoff }])
                      setStage('')
                      setStart('')
                      setEnd('')
                      setCutoff('')
                      setError('')
                    }}
                  >
                    Thêm thời hạn cho giai đoạn
                  </Button>
                </div>
              </fieldset>

              {windows.length > 0 && (
                <div className={styles.windowCard}>
                  <div className={styles.windowHeader}>
                    <strong className={styles.windowTitle}>Các giai đoạn bán đã thêm ({windows.length})</strong>
                  </div>
                  <ul style={{ margin: 0, paddingLeft: '1.25rem', display: 'grid', gap: '8px' }}>
                    {windows.map(w => (
                      <li key={w.stage}>
                        <strong>{stageNames[w.stage]}</strong>: {journeyTime(w.startsAt)} → {journeyTime(w.endsAt)} (Hạn phục vụ: {journeyTime(w.operationalCutoff)})
                        <span style={{ marginLeft: '12px' }}>
                          <Button type="button" tone="text" disabled={disabled} onClick={() => setWindows(old => old.filter(x => x.stage !== w.stage))}>
                            Bỏ giai đoạn
                          </Button>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </form>
        </Modal>
      )}
    </section>
  )
}
