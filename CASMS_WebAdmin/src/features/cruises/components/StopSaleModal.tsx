import { useState, useRef, type FormEvent } from 'react'
import { Modal, Button, Field, Notice } from '@/shared/ui'
import { departureApi } from '../api/departure-api'
import type { CruiseRecord } from '../model/cruise-record'
import type { CruiseDto } from '../api/dto'
import { type StopSalePreset, STOP_SALE_PRESETS, STOP_SALE_PRESET_LABELS } from '../model/stop-sale'
import styles from './Cruises.module.css'

export type StopSaleModalProps = {
  isOpen: boolean
  cruise: CruiseRecord
  onClose: () => void
  onSuccess: (updated: CruiseDto) => void
}

export function StopSaleModal({ isOpen, cruise, onClose, onSuccess }: StopSaleModalProps) {
  const [preset, setPreset] = useState<StopSalePreset | ''>('')
  const [detail, setDetail] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [errors, setErrors] = useState<{ preset?: string; detail?: string }>({})
  const lock = useRef(false)

  if (!isOpen) return null

  function validate() {
    const nextErrors: { preset?: string; detail?: string } = {}
    if (!preset) {
      nextErrors.preset = 'Vui lòng chọn nhóm lý do dừng bán.'
    }
    const trimmedDetail = detail.trim()
    if (!trimmedDetail) {
      nextErrors.detail = 'Chi tiết lý do dừng bán là bắt buộc. Vui lòng nhập nội dung cụ thể.'
    } else if (trimmedDetail.length > 500) {
      nextErrors.detail = 'Nội dung chi tiết không được vượt quá 500 ký tự.'
    }
    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (busy || lock.current) return
    if (!validate()) return

    lock.current = true
    setBusy(true)
    setError('')

    const selectedLabel = preset ? STOP_SALE_PRESET_LABELS[preset] : 'Dừng bán'
    const fullReason = `${selectedLabel} — ${detail.trim()}`
    const eventIdentity = `EVT-${cruise.cruiseCode}-STOP-${Date.now()}`

    try {
      const response = await departureApi.stopSale(cruise.cruiseId, {
        expectedRevision: cruise.revision,
        reason: fullReason,
        scope: 'CRUISE',
        eventIdentity,
      })
      onSuccess(response)
      onClose()
    } catch (err) {
      // Preserve user input on error; show clear message
      setError(err instanceof Error ? err.message : 'Không thể thực hiện dừng bán. Vui lòng thử lại.')
    } finally {
      lock.current = false
      setBusy(false)
    }
  }

  return (
    <Modal
      title="Dừng bán chuyến khởi hành"
      description={`${cruise.cruiseCode} · ${cruise.cruiseName}`}
      busy={busy}
      onClose={onClose}
      footer={
        <div className={styles.dialogActions}>
          <Button tone="secondary" disabled={busy} onClick={onClose} data-overlay-dismiss>
            Quay lại
          </Button>
          <Button tone="danger" disabled={busy} onClick={handleSubmit}>
            {busy ? 'Đang xử lý…' : 'Xác nhận dừng bán'}
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className={styles.stopSaleForm}>
        <Notice title="Cảnh báo ảnh hưởng mở bán" tone="warning">
          Thao tác này sẽ ngay lập tức tạm dừng mở bán và ngừng tiếp nhận đặt chỗ mới trên toàn bộ hệ thống
          WebBooking. Các đơn đặt chỗ và đăng ký hiện có không bị tự động hủy.
        </Notice>

        {error && (
          <Notice title="Không thể dừng bán" tone="error">
            <p>{error}</p>
          </Notice>
        )}

        <Field htmlFor="stop-sale-preset" label="Nhóm lý do dừng bán (*)" error={errors.preset}>
          <select
            id="stop-sale-preset"
            value={preset}
            disabled={busy}
            onChange={(e) => {
              setPreset(e.target.value as StopSalePreset)
              if (errors.preset) setErrors((prev) => ({ ...prev, preset: undefined }))
            }}
          >
            <option value="">-- Chọn nhóm lý do --</option>
            {STOP_SALE_PRESETS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </Field>

        <Field
          htmlFor="stop-sale-detail"
          label="Chi tiết lý do dừng bán (*)"
          hint="Nhập căn cứ, văn bản hoặc bối cảnh cụ thể của quyết định dừng bán (tối đa 500 ký tự)."
          error={errors.detail}
        >
          <textarea
            id="stop-sale-detail"
            rows={4}
            value={detail}
            disabled={busy}
            maxLength={500}
            placeholder="Ví dụ: Theo công điện khẩn của Cảng vụ hàng hải về áp thấp nhiệt đới trên vùng biển Vịnh Bắc Bộ, cấm tàu rời bến..."
            onChange={(e) => {
              setDetail(e.target.value)
              if (errors.detail) setErrors((prev) => ({ ...prev, detail: undefined }))
            }}
          />
        </Field>
      </form>
    </Modal>
  )
}
