import { useState } from 'react'
import { Button, Modal, Notice } from '@/shared/ui'
import { shipDeckCabinApi } from '../api/ship-deck-cabin-api'
import { useMutation } from '../hooks/useAdminData'
import { cabinStatuses, shipStatuses } from '../model/types'
import type { CabinStatus, CheckResult, CruisePreview, Entity, EntityKind, Ship, ShipStatus } from '../model/types'
import { InputField, SelectField } from './Common'
import { CruiseTable } from './CruiseTable'
import styles from './Management.module.css'

export type Operation = 'status' | 'block' | 'release' | 'schedule' | 'ready' | 'availability' | 'affected' | 'validate' | 'ownership'
const titles: Record<Operation, string> = {
  status: 'Đổi trạng thái', block: 'Khóa cabin', release: 'Mở cabin',
  schedule: 'Kiểm tra lịch trống', ready: 'Kiểm tra sẵn sàng vận hành', availability: 'Kiểm tra cabin',
  affected: 'Các chuyến bị ảnh hưởng', validate: 'Kiểm tra cấu hình', ownership: 'Kiểm tra boong thuộc tàu',
}
export function OperationDialog({ item, kind, ships, operation, onClose }: { item: Entity; kind: EntityKind; ships: Ship[]; operation: Operation; onClose: () => void }) {
  const isShip = 'code' in item
  const isCheck = ['schedule', 'ready', 'availability', 'affected', 'validate', 'ownership'].includes(operation)
  const [status, setStatus] = useState<string>('status' in item ? item.status : '')
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [guests, setGuests] = useState(1)
  const [accessible, setAccessible] = useState(false)
  const [reasonStatus, setReasonStatus] = useState<'OCCUPIED' | 'MAINTENANCE'>('MAINTENANCE')
  const [shipId, setShipId] = useState('shipId' in item ? item.shipId : '')
  const [results, setResults] = useState<CheckResult[]>([])
  const [cruises, setCruises] = useState<CruisePreview[] | null>(null)
  const [validation, setValidation] = useState('')
  const mutation = useMutation()
  const clear = () => { setResults([]); setCruises(null); setValidation(''); mutation.clear() }
  const check = async () => {
    if (mutation.busy) return
    clear()
    const startTime = new Date(start).getTime()
    const endTime = new Date(end).getTime()
    if ((operation === 'schedule' || operation === 'affected') && (!Number.isFinite(startTime) || !Number.isFinite(endTime) || endTime <= startTime)) {
      setValidation('Chọn khoảng thời gian hợp lệ: kết thúc phải sau bắt đầu.'); return
    }
    if (operation === 'availability' && (!Number.isSafeInteger(guests) || guests <= 0)) {
      setValidation('Số khách phải là số nguyên dương.'); return
    }
    if (operation === 'ownership' && !shipId) { setValidation('Vui lòng chọn tàu để kiểm tra.'); return }
    await mutation.run(async () => {
      if (operation === 'affected') setCruises(await shipDeckCabinApi.getAffectedCruises(item.id, new Date(startTime).toISOString(), new Date(endTime).toISOString()))
      else if (operation === 'availability') setResults(await shipDeckCabinApi.inspectCabin(item.id, guests, accessible))
      else if (operation === 'ready') setResults([await shipDeckCabinApi.inspectReadiness(item.id)])
      else if (operation === 'validate') setResults([await shipDeckCabinApi.validate(kind, item.id)])
      else if (operation === 'ownership') setResults([await shipDeckCabinApi.validateDeckShip(item.id, shipId)])
      else setResults([await shipDeckCabinApi.inspectSchedule(item.id, new Date(startTime).toISOString(), new Date(endTime).toISOString())])
    }, '')
  }
  const confirm = () => {
    if (mutation.busy) return
    void mutation.run(async () => {
      if (operation === 'block') await shipDeckCabinApi.blockCabin(item.id, reasonStatus)
      else if (operation === 'release') await shipDeckCabinApi.releaseCabin(item.id)
      else if (isShip) await shipDeckCabinApi.changeShipStatus(item.id, status as ShipStatus)
      else await shipDeckCabinApi.changeCabinStatus(item.id, status as CabinStatus)
      onClose()
    })
  }
  return <Modal title={titles[operation]} onClose={onClose} busy={mutation.busy}>
    <div className={styles.stack}>
      <Notice title={isShip ? `${item.code} · ${item.name}` : `${kind === 'decks' ? 'Boong' : 'Cabin'} ${item.number}`}>
        {isCheck ? 'Kiểm tra điều kiện hiện tại từ hệ thống.' : 'Thao tác sẽ cập nhật dữ liệu trong hệ thống sau khi xác nhận.'}
      </Notice>
      {isCheck ? <>
        {(operation === 'schedule' || operation === 'affected') && <div className={styles.twoColumns}>
          <InputField label="Bắt đầu *" type="datetime-local" value={start} disabled={mutation.busy} onChange={(event) => { setStart(event.target.value); clear() }} />
          <InputField label="Kết thúc *" type="datetime-local" value={end} disabled={mutation.busy} onChange={(event) => { setEnd(event.target.value); clear() }} />
        </div>}
        {operation === 'ownership' && <SelectField label="Tàu cần kiểm tra *" value={shipId} disabled={mutation.busy} onChange={(value) => { setShipId(value); clear() }}><option value="">Chọn tàu</option>{ships.map((ship) => <option key={ship.id} value={ship.id}>{ship.code} · {ship.name}</option>)}</SelectField>}
        {operation === 'availability' && <div className={styles.twoColumns}>
          <InputField label="Số khách *" type="number" min={1} step={1} value={guests} disabled={mutation.busy} onChange={(event) => { setGuests(Number(event.target.value)); clear() }} />
          <label className={styles.check}><input type="checkbox" checked={accessible} disabled={mutation.busy} onChange={(event) => { setAccessible(event.target.checked); clear() }} />Yêu cầu hỗ trợ tiếp cận</label>
        </div>}
        {operation === 'availability' && <p className={styles.muted}>Khả dụng được kiểm tra theo trạng thái cabin hiện tại. Kiểm tra riêng sức chứa và hỗ trợ tiếp cận; kết quả không giữ chỗ hoặc gán khách.</p>}
        {validation && <Notice title="Thông tin kiểm tra chưa hợp lệ" tone="error">{validation}</Notice>}
        {results.map((result) => <Notice key={result.title} title={result.title} tone={result.tone}>{result.message}</Notice>)}
        {cruises && <CruiseTable rows={cruises} />}
      </> : <>
        {operation === 'status' && <SelectField label="Trạng thái mới" value={status} disabled={mutation.busy} onChange={(value) => { setStatus(value); mutation.clear() }}>
          {Object.entries(isShip ? shipStatuses : cabinStatuses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </SelectField>}
        {operation === 'block' && <><SelectField label="Trạng thái khóa" value={reasonStatus} disabled={mutation.busy} onChange={(value) => { setReasonStatus(value as typeof reasonStatus); mutation.clear() }}><option value="MAINTENANCE">Bảo trì</option><option value="OCCUPIED">Đang có khách</option></SelectField><Notice title="Xác nhận khóa cabin" tone="warning">Khóa cabin sẵn sàng sang trạng thái đã chọn. Hệ thống sẽ kiểm tra điều kiện trước khi cập nhật.</Notice></>}
        {operation === 'release' && <Notice title="Xác nhận mở cabin" tone="warning">Cabin sẽ được chuyển về trạng thái Sẵn sàng nếu hệ thống cho phép.</Notice>}
      </>}
      {mutation.error && <Notice title="Thao tác chưa hoàn tất" tone="error">{mutation.error}</Notice>}
      <div className={styles.actions}>
        <Button disabled={mutation.busy || (operation === 'status' && 'status' in item && status === item.status)} onClick={() => isCheck ? void check() : confirm()}>
          {mutation.busy ? 'Đang xử lý…' : isCheck ? results.length || cruises || mutation.error ? 'Kiểm tra lại' : 'Kiểm tra' : 'Xác nhận'}
        </Button>
        <Button tone="secondary" disabled={mutation.busy} onClick={onClose}>{isCheck ? 'Đóng' : 'Hủy'}</Button>
      </div>
    </div>
  </Modal>
}
