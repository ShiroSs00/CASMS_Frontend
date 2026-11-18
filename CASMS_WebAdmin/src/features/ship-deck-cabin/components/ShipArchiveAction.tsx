import { useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { ApiError } from '@/shared/api'
import { Button, Modal, Notice } from '@/shared/ui'
import { shipDeckCabinApi } from '../api/ship-deck-cabin-api'
import { shipError } from '../ship-types/api'
import type { Ship } from '../model/types'

const blockerLabels: Record<string, string> = {
  ALREADY_ARCHIVED: 'Tàu đã được lưu trữ.',
  NOT_DRAFT: 'Chỉ lưu trữ tàu ở trạng thái bản nháp.',
  CRUISE_HISTORY: 'Tàu đang được gán hoặc đã từng được gán cho một chuyến.',
  MODEL_IMPORT_RUNNING: 'Tàu đang được nhập cấu trúc từ mô hình.',
  OPERATIONAL_HISTORY: 'Tàu có quy định hoặc dữ liệu vận hành.',
  TRIP_PLANNING: 'Boong hoặc cabin đang được tham chiếu trong kế hoạch chuyến đi.',
  ACTIVITY_CONFIGURATION: 'Tàu có cấu hình hoạt động.',
  BLE_HISTORY: 'Tàu có thiết bị hoặc dữ liệu định vị.',
  SERVICE_ASSIGNMENT: 'Tàu có cấu hình hoặc yêu cầu bố trí dịch vụ.',
  STAFFING: 'Tàu có dữ liệu phân công nhân sự.',
  POS_HISTORY: 'Tàu có cấu hình hoặc dữ liệu giao dịch POS.',
  PASSENGER_ASSIGNMENT: 'Cabin có dữ liệu phân phòng hành khách.',
  BOOKING: 'Tàu có dữ liệu đặt chỗ.',
  CRUISE_PACKAGE: 'Tàu có dữ liệu liên kết với gói chuyến.',
}

export function ShipArchiveAction({ ship }: { ship: Ship }) {
  const navigate = useNavigate()
  const locked = useRef(false)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{ eligible: boolean; blockers: string[]; error?: string } | null>(null)

  async function run(confirm: boolean) {
    if (locked.current) return
    locked.current = true
    setBusy(true)
    try {
      if (confirm) {
        const archived = await shipDeckCabinApi.archiveShip(ship.id)
        navigate('/admin/ships', { replace: true, state: { archivedShipName: archived.name } })
      } else {
        setResult(await shipDeckCabinApi.archiveEligibility(ship.id))
      }
    } catch (error) {
      const details = error instanceof ApiError ? error.details as { blockers?: unknown } | undefined : undefined
      const blockers = Array.isArray(details?.blockers) ? details.blockers.filter(code => typeof code === 'string') : []
      setResult({ eligible: false, blockers, error: blockers.length ? undefined : shipError(error) })
    } finally {
      locked.current = false
      setBusy(false)
    }
  }

  return <>
    <Button tone="secondary" autoWidth busy={busy && !result} onClick={() => void run(false)}>{busy && !result ? 'Đang kiểm tra…' : 'Lưu trữ tàu'}</Button>
    {result && <Modal title={result.eligible ? 'Lưu trữ tàu?' : 'Chưa thể lưu trữ tàu'}
      description={ship.code + ' · ' + ship.name} busy={busy} protectChanges={false} onClose={() => setResult(null)}
      footer={<><Button tone="secondary" disabled={busy} onClick={() => setResult(null)}>{result.eligible ? 'Hủy' : 'Đóng'}</Button>
        {result.eligible && <Button busy={busy} onClick={() => void run(true)}>{busy ? 'Đang lưu trữ…' : 'Xác nhận lưu trữ'}</Button>}</>}>
      {result.eligible && <p>Tàu sẽ được gỡ khỏi danh sách vận hành. Boong, cabin, mô hình và hồ sơ vẫn được lưu để tra cứu.</p>}
      {result.error && <Notice title="Không thực hiện được thao tác" tone="error">{result.error}</Notice>}
      {result.blockers.length > 0 && <ul>{[...new Set(result.blockers.map(code => blockerLabels[code] ?? 'Tàu có tham chiếu nghiệp vụ.'))].map(label => <li key={label}>{label}</li>)}</ul>}
    </Modal>}
  </>
}
