import { useState } from 'react'
import { Button, Modal, Notice } from '@/shared/ui'
import { shipDeckCabinAdapter } from '../mocks/adapter'
import { useMutation } from '../hooks/useAdminData'
import { cabinStatuses, shipStatuses } from '../model/types'
import type { Cabin, CabinStatus, CheckResult, Ship, ShipStatus } from '../model/types'
import { InputField, SelectField } from './Common'
import styles from './Management.module.css'

export type Operation = 'status' | 'block' | 'release' | 'schedule' | 'ready' | 'availability'
const titles: Record<Operation, string> = {
  status: 'Đổi trạng thái', block: 'Khóa cabin', release: 'Mở cabin',
  schedule: 'Kiểm tra lịch trống', ready: 'Kiểm tra sẵn sàng vận hành', availability: 'Kiểm tra cabin',
}
export function OperationDialog({ item, operation, onClose }: { item: Ship | Cabin; operation: Operation; onClose: () => void }) {
  const isShip = 'code' in item
  const isCheck = operation === 'schedule' || operation === 'ready' || operation === 'availability'
  const [status, setStatus] = useState<string>(item.status)
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [guests, setGuests] = useState(1)
  const [accessible, setAccessible] = useState(false)
  const [scenario, setScenario] = useState<'clear' | 'blocked' | 'error'>('clear')
  const [result, setResult] = useState<CheckResult | null>(null)
  const [validation, setValidation] = useState('')
  const mutation = useMutation()
  const capability = !isShip ? shipDeckCabinAdapter.operationalCapability(item.id) : { allowed: true }
  const blockedShip = isShip && item.id === 'ship-aurora' && status !== 'ACTIVE'
  const clear = () => { setResult(null); setValidation(''); mutation.clear() }
  const check = async () => {
    if (mutation.busy) return
    clear()
    if (operation !== 'ready' && (!start || !end || new Date(end).getTime() <= new Date(start).getTime())) {
      setValidation('Chọn khoảng thời gian hợp lệ: kết thúc phải sau bắt đầu.'); return
    }
    if (operation === 'availability' && (!Number.isSafeInteger(guests) || guests <= 0)) {
      setValidation('Số khách phải là số nguyên dương.'); return
    }
    await mutation.run(async () => {
      setResult(isShip ? await shipDeckCabinAdapter.inspectShip(item.id, operation === 'schedule' ? 'schedule' : 'ready', scenario)
        : await shipDeckCabinAdapter.inspectCabin(item.id, scenario))
    }, '')
  }
  const confirm = () => {
    if (mutation.busy) return
    void mutation.run(async () => {
      if (isShip) await shipDeckCabinAdapter.changeShipStatus(item.id, status as ShipStatus, item.version)
      else await shipDeckCabinAdapter.changeCabinStatus(item.id, operation === 'block' ? 'OUT_OF_SERVICE' : operation === 'release' ? 'AVAILABLE' : status as CabinStatus, item.version)
      onClose()
    })
  }
  return <Modal title={titles[operation]} onClose={onClose} busy={mutation.busy}>
    <div className={styles.stack}>
      <Notice title={isShip ? `${item.code} · ${item.name}` : `Cabin ${item.number}`}>
        {isCheck ? 'Kết quả kiểm tra dưới đây là kịch bản minh họa, chưa kết nối dịch vụ thật.' : 'Thao tác chỉ thay đổi dữ liệu trong phiên demo hiện tại.'}
      </Notice>
      {isCheck ? <>
        {operation !== 'ready' && <div className={styles.twoColumns}>
          <InputField label="Bắt đầu *" type="datetime-local" value={start} disabled={mutation.busy} onChange={(event) => { setStart(event.target.value); clear() }} />
          <InputField label="Kết thúc *" type="datetime-local" value={end} disabled={mutation.busy} onChange={(event) => { setEnd(event.target.value); clear() }} />
        </div>}
        {operation === 'availability' && <div className={styles.twoColumns}>
          <InputField label="Số khách *" type="number" min={1} step={1} value={guests} disabled={mutation.busy} onChange={(event) => { setGuests(Number(event.target.value)); clear() }} />
          <label className={styles.check}><input type="checkbox" checked={accessible} disabled={mutation.busy} onChange={(event) => { setAccessible(event.target.checked); clear() }} />Yêu cầu hỗ trợ tiếp cận</label>
        </div>}
        <SelectField label="Kịch bản kiểm tra demo" value={scenario} disabled={mutation.busy} onChange={(value) => { setScenario(value as typeof scenario); clear() }}>
          <option value="clear">Đáp ứng / khả dụng</option><option value="blocked">Không đáp ứng / bị chặn</option><option value="error">Dịch vụ kiểm tra thất bại</option>
        </SelectField>
        {operation === 'availability' && <p className={styles.muted}>Kiểm tra khả dụng, sức chứa và tương thích cho cabin đang chọn. Kết quả mock theo kịch bản đã chọn; chưa tính tồn phòng hoặc gán khách.</p>}
        {validation && <Notice title="Thông tin kiểm tra chưa hợp lệ" tone="error">{validation}</Notice>}
        {result && <Notice title={result.title} tone={result.tone}>{result.message}</Notice>}
      </> : <>
        {operation === 'status' && <SelectField label="Trạng thái mới" value={status} disabled={mutation.busy} onChange={(value) => { setStatus(value); mutation.clear() }}>
          {Object.entries(isShip ? shipStatuses : cabinStatuses).filter(([value]) => value !== 'OCCUPIED').map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </SelectField>}
        {operation === 'block' && <Notice title="Xác nhận khóa cabin" tone="warning">Trong bản demo, khóa cabin chuyển trạng thái sang Ngừng phục vụ. Điều kiện khóa thật cần được xác nhận khi tích hợp service.</Notice>}
        {operation === 'release' && <Notice title="Xác nhận mở cabin" tone="warning">Trong bản demo, mở cabin chuyển trạng thái sang Sẵn sàng. Đây không phải thao tác checkout hoặc kết thúc gán khách.</Notice>}
        {!capability.allowed && <Notice title="Thao tác bị chặn" tone="error">{capability.reason}</Notice>}
        {blockedShip && <Notice title="Có chuyến đang vận hành" tone="warning">Kịch bản mock không cho đổi trạng thái tàu này. Xem các chuyến liên quan trước khi xử lý.</Notice>}
      </>}
      {mutation.error && <Notice title="Thao tác chưa hoàn tất" tone="error">{mutation.error}</Notice>}
      <div className={styles.actions}>
        <Button disabled={mutation.busy || (!isCheck && (!capability.allowed || blockedShip || (operation === 'status' && status === item.status)))} onClick={() => isCheck ? void check() : confirm()}>
          {mutation.busy ? 'Đang xử lý…' : isCheck ? result || mutation.error ? 'Kiểm tra lại' : 'Kiểm tra' : 'Xác nhận'}
        </Button>
        <Button tone="secondary" disabled={mutation.busy} onClick={onClose}>{isCheck ? 'Đóng' : 'Hủy'}</Button>
      </div>
    </div>
  </Modal>
}
