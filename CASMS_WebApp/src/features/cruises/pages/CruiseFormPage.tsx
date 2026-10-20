import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router'
import { useSessionAccess } from '@/shared/auth'

import { Button, Field, Loading, Notice, PageHeader, Panel } from '@/shared/ui'

import { CruiseFrame } from '../components/CruiseUI'
import { cruiseApi } from '../api/cruise-api'
import styles from '../components/Cruises.module.css'
import type { CruiseDraft, CruiseStatus, CruiseType, PortRecord } from '../model/cruise-record'
import { validateCruiseDraft, type CruiseFormErrors } from '../model/cruise-validation'

const EMPTY_DRAFT: CruiseDraft = {
  cruiseCode: '',
  cruiseName: '',
  cruiseType: 'ONE_DAY',
  departureDatetime: '',
  returnDatetime: '',
  departurePortId: '',
  returnPortId: '',
}

function localInputValue(value: string) {
  const date = new Date(value)
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}

export function CruiseFormPage() {
  const access = useSessionAccess()
  const { cruiseId } = useParams()
  const editing = Boolean(cruiseId)
  const navigate = useNavigate()
  const [draft, setDraft] = useState<CruiseDraft>(EMPTY_DRAFT)
  const [currentStatus, setCurrentStatus] = useState<CruiseStatus>('DRAFT')
  const [currentShip, setCurrentShip] = useState('Chưa phân công')
  const [loading, setLoading] = useState(editing)
  const [errors, setErrors] = useState<CruiseFormErrors>({})
  const [submitError, setSubmitError] = useState('')
  const [busy, setBusy] = useState(false)
  const [ports, setPorts] = useState<PortRecord[]>([])
  const [loadedId, setLoadedId] = useState<string | null>(null)
  const submitLock = useRef(false)
  const canSave = access.has(editing ? 'CRUISE_UPDATE_DRAFT' : 'CRUISE_CREATE') && (!editing || (loadedId === cruiseId && currentStatus === 'DRAFT'))

  useEffect(() => {
    if (!cruiseId) return
    const controller = new AbortController()
    void cruiseApi.getDetail(cruiseId, controller.signal).then((detail) => {
      if (controller.signal.aborted) return
      setDraft({
        cruiseCode: detail.cruise.cruiseCode,
        cruiseName: detail.cruise.cruiseName,
        cruiseType: detail.cruise.cruiseType,
        departureDatetime: localInputValue(detail.cruise.departureDatetime),
        returnDatetime: localInputValue(detail.cruise.returnDatetime),
        departurePortId: detail.cruise.departurePortId,
        returnPortId: detail.cruise.returnPortId,
      })
      setCurrentStatus(detail.cruise.status)
      setLoadedId(cruiseId)
      setCurrentShip(detail.ship?.shipName ?? 'Chưa phân công')
      setLoading(false)
    }).catch((error: unknown) => {
      if (controller.signal.aborted) return
      setSubmitError(error instanceof Error ? error.message : 'Không tải được cruise.')
      setLoading(false)
    })
    return () => controller.abort()
  }, [cruiseId])

  useEffect(() => {
    const controller = new AbortController()
    void cruiseApi.listPorts(controller.signal).then((result) => {
      if (!controller.signal.aborted) setPorts(result)
    }).catch((error: unknown) => {
      if (!controller.signal.aborted) setSubmitError(error instanceof Error ? error.message : 'Không tải được danh mục cảng.')
    })
    return () => controller.abort()
  }, [])

  function update<K extends keyof CruiseDraft>(key: K, value: CruiseDraft[K]) {
    const next = { ...draft, [key]: value }
    setDraft(next)
    if (errors[key] || key === 'cruiseType' || key === 'departureDatetime' || key === 'returnDatetime') {
      setErrors(validateCruiseDraft(next))
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (submitLock.current || !canSave) return
    const nextErrors = validateCruiseDraft(draft)
    setErrors(nextErrors)
    setSubmitError('')
    if (Object.keys(nextErrors).length) {
      document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
      return
    }
    submitLock.current = true
    setBusy(true)
    try {
      const saved = editing && cruiseId
        ? await cruiseApi.updateCruise(cruiseId, draft)
        : await cruiseApi.createCruise(draft)
      navigate(`/admin/cruises/${saved.cruiseId}`)
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Không lưu được cruise.')
    } finally {
      submitLock.current = false
      setBusy(false)
    }
  }

  if (loading) return <CruiseFrame><Loading label="Đang tải cruise…" /></CruiseFrame>

  return <CruiseFrame>
    <div className={styles.content}>
      <PageHeader breadcrumb="VẬN HÀNH / CRUISE" title={editing ? 'Chỉnh sửa cruise' : 'Tạo cruise'} description={editing ? 'Chỉnh sửa dữ liệu chuyến. Phân công tàu được kiểm tra và xác nhận trong luồng riêng.' : 'Tạo chuyến ở trạng thái DRAFT. Có thể phân công tàu sau khi lưu.'} />
      <form onSubmit={submit} noValidate>
        <Panel title="Thông tin chuyến">
          <div className={styles.formGrid}>
            <Field htmlFor="cruise-code" label="Mã chuyến" error={errors.cruiseCode}><input id="cruise-code" value={draft.cruiseCode} disabled={editing} aria-invalid={Boolean(errors.cruiseCode)} aria-describedby={errors.cruiseCode ? 'cruise-code-hint' : undefined} onChange={(event) => update('cruiseCode', event.target.value)} /></Field>
            <Field htmlFor="cruise-name" label="Tên hiển thị" error={errors.cruiseName}><input id="cruise-name" value={draft.cruiseName} aria-invalid={Boolean(errors.cruiseName)} aria-describedby={errors.cruiseName ? 'cruise-name-hint' : undefined} onChange={(event) => update('cruiseName', event.target.value)} /></Field>
            <Field htmlFor="cruise-type-form" label="Loại chuyến"><select id="cruise-type-form" value={draft.cruiseType} onChange={(event) => update('cruiseType', event.target.value as CruiseType)}><option value="ONE_DAY">ONE_DAY · Một ngày</option><option value="MULTI_DAYS">MULTI_DAYS · Nhiều ngày</option></select></Field>
            <Field htmlFor="departure-time" label="Khởi hành" error={errors.departureDatetime}><input id="departure-time" type="datetime-local" value={draft.departureDatetime} aria-invalid={Boolean(errors.departureDatetime)} aria-describedby={errors.departureDatetime ? 'departure-time-hint' : undefined} onChange={(event) => update('departureDatetime', event.target.value)} /></Field>
            <Field htmlFor="return-time" label="Kết thúc" error={errors.returnDatetime}><input id="return-time" type="datetime-local" value={draft.returnDatetime} aria-invalid={Boolean(errors.returnDatetime)} aria-describedby={errors.returnDatetime ? 'return-time-hint' : undefined} onChange={(event) => update('returnDatetime', event.target.value)} /></Field>
            <Field htmlFor="cruise-form-status" label="Trạng thái"><input id="cruise-form-status" value={currentStatus} disabled /></Field>
            <Field htmlFor="departure-port" label="Cảng khởi hành" error={errors.departurePortId}><select id="departure-port" value={draft.departurePortId} aria-invalid={Boolean(errors.departurePortId)} aria-describedby={errors.departurePortId ? 'departure-port-hint' : undefined} onChange={(event) => update('departurePortId', event.target.value)}><option value="">Chọn cảng khởi hành</option>{ports.map((port) => <option value={port.portId} key={port.portId}>{port.portName}</option>)}</select></Field>
            <Field htmlFor="return-port" label="Cảng trở về" error={errors.returnPortId}><select id="return-port" value={draft.returnPortId} aria-invalid={Boolean(errors.returnPortId)} aria-describedby={errors.returnPortId ? 'return-port-hint' : undefined} onChange={(event) => update('returnPortId', event.target.value)}><option value="">Chọn cảng trở về</option>{ports.map((port) => <option value={port.portId} key={port.portId}>{port.portName}</option>)}</select></Field>
            <Field htmlFor="current-ship" label="Tàu hiện tại"><input id="current-ship" value={currentShip} disabled /></Field>
          </div>
          <Notice title="Kiểm tra lịch theo loại chuyến"><p>ONE_DAY phải cùng ngày; MULTI_DAYS phải sang ngày sau; thời gian kết thúc luôn sau khởi hành.</p></Notice>
          <Notice title="Phân công tàu" tone="warning"><p>Gán, đổi hoặc gỡ tàu qua precheck riêng trên trang chi tiết. Lưu form không tự xác nhận assignment khi có conflict.</p></Notice>
          {editing && loadedId === cruiseId && currentStatus !== 'DRAFT' && <Notice title="Không thể sửa chuyến" tone="warning"><p>Chỉ chuyến ở trạng thái DRAFT mới được chỉnh sửa.</p></Notice>}
          {submitError && <Notice title="Không lưu được cruise" tone="error"><p>{submitError}</p></Notice>}
          <div className={styles.formActions}><Button type="submit" disabled={busy || !canSave}>{busy ? 'Đang lưu…' : editing ? 'Lưu thay đổi' : 'Tạo cruise'}</Button><Button tone="secondary" disabled={busy} onClick={() => navigate(editing && cruiseId ? `/admin/cruises/${cruiseId}` : '/admin/cruises')}>Hủy</Button></div>
        </Panel>
      </form>
    </div>
  </CruiseFrame>
}
