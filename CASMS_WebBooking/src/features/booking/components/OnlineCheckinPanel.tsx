import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError, apiRequest } from '@/shared/api'
import { useSessionAccess } from '@/shared/auth'
import { Badge, Button, Field, Modal, Notice, Panel } from '@/shared/ui'
import type { BookingDetail } from '../api/real-booking-api'
import styles from './LiveBooking.module.css'

type CheckinRecord = {
  checkinStatus: string
  boardingBlockReason?: string | null
}

const CHECKIN_LABELS: Record<string, string> = {
  NotStarted: 'Chưa bắt đầu',
  InProgress: 'Đang thực hiện',
  NeedsReview: 'Cần đối chiếu tại quầy',
  Completed: 'Đã hoàn tất',
  BoardingReady: 'Sẵn sàng lên tàu',
}

function checkinTone(status: string): 'neutral' | 'warning' | 'success' | 'error' {
  if (status === 'BoardingReady' || status === 'Completed') return 'success'
  if (status === 'InProgress' || status === 'NeedsReview') return 'warning'
  return 'neutral'
}

function PassengerOnlineCheckinRow({
  passengerId,
  fullName,
  cabinNumber,
  canCheckinWindow,
}: {
  passengerId: string
  fullName: string
  cabinNumber: string | null
  canCheckinWindow: boolean
}) {
  const access = useSessionAccess()
  const canRead = access.permissions.includes('CHECKIN_READ')
  const canCreate = access.permissions.includes('CHECKIN_CREATE')
  const canUpdate = access.permissions.includes('CHECKIN_UPDATE')
  const lockRef = useRef(false)
  const [record, setRecord] = useState<CheckinRecord | null>(null)
  const [forbiddenSelfOnly, setForbiddenSelfOnly] = useState(false)
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [modalAction, setModalAction] = useState<'start' | 'complete' | null>(null)
  const [emergencyName, setEmergencyName] = useState('')
  const [emergencyPhone, setEmergencyPhone] = useState('')

  const loadStatus = useCallback(async () => {
    if (!canRead) return
    setLoading(true)
    setError('')
    setForbiddenSelfOnly(false)
    try {
      const data = await apiRequest<CheckinRecord>(`/checkin/passenger/${encodeURIComponent(passengerId)}/status`)
      setRecord({
        checkinStatus: data?.checkinStatus ?? 'NotStarted',
        boardingBlockReason: data?.boardingBlockReason ?? null,
      })
    } catch (reason) {
      if (reason instanceof ApiError && reason.status === 404) {
        setRecord({ checkinStatus: 'NotStarted', boardingBlockReason: null })
      } else if (reason instanceof ApiError && reason.status === 403) {
        setForbiddenSelfOnly(true)
        setRecord(null)
      } else {
        setError(reason instanceof Error ? reason.message : 'Chưa tải được trạng thái check-in.')
      }
    } finally {
      setLoading(false)
    }
  }, [canRead, passengerId])

  useEffect(() => {
    void loadStatus()
  }, [loadStatus])

  async function submitAction() {
    if (!modalAction || lockRef.current) return
    if (modalAction === 'start' && (!emergencyName.trim() || !emergencyPhone.trim())) {
      setError('Vui lòng nhập đầy đủ tên và số điện thoại người liên hệ khẩn cấp.')
      return
    }
    lockRef.current = true
    setBusy(true)
    setError('')
    try {
      const query = modalAction === 'start'
        ? { emergencyContactName: emergencyName.trim(), emergencyContactPhone: emergencyPhone.trim() }
        : undefined
      const data = await apiRequest<CheckinRecord>(
        `/checkin/passenger/${encodeURIComponent(passengerId)}/${modalAction}`,
        { method: 'POST', query },
      )
      setRecord({
        checkinStatus: data?.checkinStatus ?? (modalAction === 'start' ? 'InProgress' : 'BoardingReady'),
        boardingBlockReason: data?.boardingBlockReason ?? null,
      })
      setModalAction(null)
      setEmergencyName('')
      setEmergencyPhone('')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Chưa cập nhật được thủ tục check-in.')
    } finally {
      lockRef.current = false
      setBusy(false)
    }
  }

  const status = record?.checkinStatus ?? 'NotStarted'

  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        padding: '14px 16px',
        border: '1px solid var(--border-soft, #D5E0E4)',
        borderRadius: '10px',
        background: 'var(--surface, #FFFFFF)',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <strong>{fullName}</strong>
          {cabinNumber && <span style={{ color: 'var(--muted, #506777)', fontSize: '13px' }}>· Cabin {cabinNumber}</span>}
          <Badge
            label={
              loading
                ? 'Đang kiểm tra…'
                : forbiddenSelfOnly
                  ? 'Tự check-in bằng tài khoản riêng'
                  : (CHECKIN_LABELS[status] ?? status)
            }
            tone={forbiddenSelfOnly ? 'neutral' : checkinTone(status)}
          />
        </div>
        {record?.boardingBlockReason && (
          <small style={{ color: 'var(--warn, #995700)' }}>{record.boardingBlockReason}</small>
        )}
        {error && <small role="alert" style={{ color: 'var(--danger, #B42318)' }}>{error}</small>}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        {!forbiddenSelfOnly && status === 'NotStarted' && canCreate && (
          <Button
            size="compact"
            autoWidth
            disabled={loading || busy || !canCheckinWindow}
            onClick={() => { setError(''); setModalAction('start') }}
          >
            Bắt đầu Check-in online
          </Button>
        )}
        {!forbiddenSelfOnly && status === 'InProgress' && canUpdate && (
          <Button
            size="compact"
            autoWidth
            disabled={loading || busy || !canCheckinWindow}
            onClick={() => { setError(''); setModalAction('complete') }}
          >
            Hoàn tất Check-in online
          </Button>
        )}
        <Button tone="secondary" size="compact" autoWidth disabled={loading || busy} onClick={() => void loadStatus()}>
          Làm mới
        </Button>
      </div>

      {modalAction && (
        <Modal
          title={modalAction === 'start' ? 'Bắt đầu Check-in online' : 'Hoàn tất Check-in online'}
          description={fullName}
          busy={busy}
          onClose={() => setModalAction(null)}
          footer={
            <>
              <Button tone="secondary" autoWidth data-overlay-dismiss onClick={() => setModalAction(null)}>
                Quay lại
              </Button>
              <Button
                autoWidth
                busy={busy}
                disabled={modalAction === 'start' && (!emergencyName.trim() || !emergencyPhone.trim())}
                onClick={() => void submitAction()}
              >
                {modalAction === 'start' ? 'Lưu & bắt đầu' : 'Xác nhận hoàn tất'}
              </Button>
            </>
          }
        >
          {modalAction === 'start' ? (
            <div className={styles.stack}>
              <p>Khai báo thông tin người liên hệ khẩn cấp để khởi tạo hồ sơ check-in lên tàu.</p>
              <Field htmlFor={`online-em-name-${passengerId}`} label="Tên người liên hệ khẩn cấp *">
                <input
                  id={`online-em-name-${passengerId}`}
                  required
                  disabled={busy}
                  value={emergencyName}
                  onChange={e => setEmergencyName(e.target.value)}
                  placeholder="Ví dụ: Lê Văn B"
                />
              </Field>
              <Field htmlFor={`online-em-phone-${passengerId}`} label="Số điện thoại liên hệ khẩn cấp *">
                <input
                  id={`online-em-phone-${passengerId}`}
                  required
                  disabled={busy}
                  value={emergencyPhone}
                  onChange={e => setEmergencyPhone(e.target.value)}
                  placeholder="Ví dụ: 0901112223"
                />
              </Field>
            </div>
          ) : (
            <p>
              Xác nhận thông tin hành khách, hợp đồng vận chuyển và liên hệ khẩn cấp đã đầy đủ để chuyển sang trạng thái
              <strong> Sẵn sàng lên tàu</strong>.
            </p>
          )}
          {error && <Notice title="Chưa thực hiện được" tone="error">{error}</Notice>}
        </Modal>
      )}
    </div>
  )
}

export function OnlineCheckinPanel({ booking }: { booking: BookingDetail }) {
  const access = useSessionAccess()
  if (booking.bookingStatus !== 'Confirmed' || !access.permissions.includes('CHECKIN_READ')) return null

  const activePassengers = booking.passengers.filter(p => p.participationStatus === 'Active')
  if (!activePassengers.length) return null

  const departureMs = booking.departureDatetime ? Date.parse(booking.departureDatetime) : NaN
  const nowMs = Date.now()
  const threeHoursMs = 3 * 60 * 60 * 1000
  const inWindow = Number.isFinite(departureMs) && departureMs > nowMs && departureMs - nowMs <= threeHoursMs
  const departed = Number.isFinite(departureMs) && departureMs <= nowMs

  return (
    <Panel title="Làm thủ tục Check-in trực tuyến">
      <div className={styles.stack}>
        {departed ? (
          <Notice title="Chuyến đã qua giờ khởi hành" tone="info">
            Cửa sổ check-in trực tuyến đã đóng. Vui lòng liên hệ quầy hỗ trợ tại cảng nếu cần trợ giúp.
          </Notice>
        ) : !inWindow ? (
          <Notice title="Cửa sổ Check-in trực tuyến mở trước giờ khởi hành 3 giờ" tone="info">
            Bạn có thể kiểm tra trạng thái hồ sơ bên dưới và thực hiện check-in trực tuyến khi còn tối đa 3 giờ trước giờ xuất bến.
          </Notice>
        ) : (
          <Notice title="Đang trong khung giờ Check-in trực tuyến" tone="success">
            Chuyến khởi hành trong vòng 3 giờ tới. Hành khách có thể hoàn tất khai báo liên hệ khẩn cấp và xác nhận sẵn sàng lên tàu ngay tại đây.
          </Notice>
        )}
        {activePassengers.map(person => (
          <PassengerOnlineCheckinRow
            key={person.bookingPassengerId}
            passengerId={person.bookingPassengerId}
            fullName={person.fullName}
            cabinNumber={person.cabinNumber ?? null}
            canCheckinWindow={inWindow}
          />
        ))}
      </div>
    </Panel>
  )
}
