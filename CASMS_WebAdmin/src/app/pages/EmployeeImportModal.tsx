import { useRef, useState } from 'react'
import { getApiAccessToken, getApiBaseUrl } from '@/shared/api'
import { Badge, Button, DataTable, Modal, Notice } from '@/shared/ui'

type ImportRowResult = {
  rowNumber: number
  employeeCode: string | null
  result: string
  error: string | null
  employeeId: string | null
}

type ImportBatch = {
  batchId: string
  status: 'PREVIEW' | 'CONFIRMED' | string
  rows: ImportRowResult[]
}

const MAX_UPLOAD_BYTES = 2 * 1024 * 1024

const rowResultMeta: Record<string, { label: string; tone: 'success' | 'warning' | 'error' | 'info' | 'neutral' }> = {
  PENDING: { label: 'Hợp lệ', tone: 'info' },
  CREATED: { label: 'Đã tạo', tone: 'success' },
  INVALID: { label: 'Lỗi dữ liệu', tone: 'error' },
  FAILED: { label: 'Thất bại', tone: 'error' },
}

async function downloadBinary(path: string, fallbackName: string) {
  const token = getApiAccessToken()
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    method: 'GET',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  if (!response.ok) {
    throw new Error(`Không thể tải tệp (HTTP ${response.status}).`)
  }
  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fallbackName
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export function EmployeeImportModal({
  onClose,
  onImported,
}: {
  onClose: () => void
  onImported: (createdCount: number) => void
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [batch, setBatch] = useState<ImportBatch | null>(null)
  const [busy, setBusy] = useState<'template' | 'upload' | 'confirm' | 'result' | null>(null)
  const [error, setError] = useState('')

  const validCount = batch?.rows.filter(r => r.result === 'PENDING' || r.result === 'CREATED').length ?? 0
  const invalidCount = batch?.rows.filter(r => r.result === 'INVALID' || r.result === 'FAILED').length ?? 0
  const createdCount = batch?.rows.filter(r => r.result === 'CREATED').length ?? 0
  const pendingCount = batch?.rows.filter(r => r.result === 'PENDING').length ?? 0

  async function handleDownloadTemplate() {
    setBusy('template')
    setError('')
    try {
      await downloadBinary('/employees/imports/template', 'CASMS_Employee_Import_Template.xlsx')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chưa tải được file mẫu Excel.')
    } finally {
      setBusy(null)
    }
  }

  async function handleUpload() {
    if (!selectedFile) {
      setError('Vui lòng chọn tệp Excel (.xlsx) trước khi kiểm tra.')
      return
    }
    if (selectedFile.size === 0 || selectedFile.size > MAX_UPLOAD_BYTES) {
      setError('Tệp Excel phải có dữ liệu và không vượt quá 2 MB.')
      return
    }
    setBusy('upload')
    setError('')
    try {
      const formData = new FormData()
      formData.append('file', selectedFile)
      const token = getApiAccessToken()
      const response = await fetch(`${getApiBaseUrl()}/employees/imports`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok || !payload?.success || !payload?.data) {
        throw new Error(payload?.message || payload?.error || `Không thể đọc tệp Excel (HTTP ${response.status}).`)
      }
      setBatch(payload.data as ImportBatch)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể kiểm tra tệp Excel.')
    } finally {
      setBusy(null)
    }
  }

  async function handleConfirm() {
    if (!batch || pendingCount === 0) return
    setBusy('confirm')
    setError('')
    try {
      const token = getApiAccessToken()
      const response = await fetch(`${getApiBaseUrl()}/employees/imports/${encodeURIComponent(batch.batchId)}/confirm`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok || !payload?.success || !payload?.data) {
        throw new Error(payload?.message || payload?.error || `Chưa xác nhận được lô nhập (HTTP ${response.status}).`)
      }
      const confirmed = payload.data as ImportBatch
      setBatch(confirmed)
      const created = confirmed.rows.filter(r => r.result === 'CREATED').length
      if (created > 0) onImported(created)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chưa thể nhập danh sách nhân sự.')
    } finally {
      setBusy(null)
    }
  }

  async function handleDownloadResult() {
    if (!batch) return
    setBusy('result')
    setError('')
    try {
      await downloadBinary(
        `/employees/imports/${encodeURIComponent(batch.batchId)}/result`,
        'CASMS_Employee_Import_Result.xlsx',
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chưa tải được tệp kết quả.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <Modal
      wide
      title="Nhập danh sách nhân sự từ Excel"
      busy={busy !== null}
      protectChanges={false}
      onClose={() => { if (!busy) onClose() }}
      footer={
        <>
          <Button tone="secondary" data-overlay-dismiss disabled={busy !== null} onClick={onClose}>
            Đóng
          </Button>
          {batch && batch.status === 'CONFIRMED' ? (
            <Button tone="secondary" busy={busy === 'result'} disabled={busy !== null} onClick={() => void handleDownloadResult()}>
              Tải file kết quả (.xlsx)
            </Button>
          ) : batch && pendingCount > 0 ? (
            <Button busy={busy === 'confirm'} disabled={busy !== null} onClick={() => void handleConfirm()}>
              Xác nhận nhập {pendingCount} nhân sự hợp lệ
            </Button>
          ) : null}
        </>
      }
    >
      <div style={{ display: 'grid', gap: '16px' }}>
        {error && <Notice title="Chưa thể xử lý tệp Excel" tone="error">{error}</Notice>}

        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '12px', padding: '12px 16px', background: 'var(--ui-subtle)', border: '1px solid var(--ui-border)', borderRadius: '8px' }}>
          <div>
            <strong>Bước 1: Tải file mẫu chuẩn (.xlsx)</strong>
            <div style={{ fontSize: '13px', color: 'var(--ui-muted)', marginTop: '2px' }}>
              File mẫu chỉ bao gồm các vai trò bạn có quyền tạo (tối đa 2 MB).
            </div>
          </div>
          <Button tone="secondary" size="compact" autoWidth busy={busy === 'template'} disabled={busy !== null} onClick={() => void handleDownloadTemplate()}>
            Tải file mẫu
          </Button>
        </div>

        <div style={{ display: 'grid', gap: '10px', padding: '12px 16px', border: '1px solid var(--ui-border)', borderRadius: '8px' }}>
          <strong>Bước 2: Chọn tệp và kiểm tra dữ liệu</strong>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px' }}>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              disabled={busy !== null}
              onChange={event => {
                setSelectedFile(event.target.files?.[0] ?? null)
                setBatch(null)
                setError('')
              }}
            />
            <Button
              tone="secondary"
              size="compact"
              autoWidth
              busy={busy === 'upload'}
              disabled={!selectedFile || busy !== null}
              onClick={() => void handleUpload()}
            >
              Kiểm tra tệp
            </Button>
          </div>
        </div>

        {batch && (
          <div style={{ display: 'grid', gap: '12px' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
              <Badge label={`Tổng: ${batch.rows.length} dòng`} tone="neutral" />
              <Badge label={batch.status === 'CONFIRMED' ? `Đã tạo: ${createdCount}` : `Hợp lệ: ${validCount}`} tone="success" />
              {invalidCount > 0 && <Badge label={`Lỗi: ${invalidCount}`} tone="error" />}
            </div>

            {batch.status === 'CONFIRMED' && (
              <Notice
                title="Đã hoàn tất nhập nhân sự"
                tone={invalidCount > 0 ? 'warning' : 'success'}
              >
                Đã tạo thành công <strong>{createdCount}</strong> hồ sơ nhân sự{invalidCount > 0 ? `, ${invalidCount} dòng không hợp lệ đã bị bỏ qua.` : '.'}
              </Notice>
            )}

            {batch.rows.length > 0 && (
              <DataTable label="Kết quả kiểm tra dữ liệu nhập" headers={['Dòng', 'Mã nhân viên', 'Trạng thái', 'Chi tiết']}>
                {batch.rows.map(row => {
                  const meta = rowResultMeta[row.result] ?? { label: row.result, tone: 'neutral' as const }
                  return (
                    <tr key={row.rowNumber}>
                      <td>{row.rowNumber}</td>
                      <td>{row.employeeCode || '—'}</td>
                      <td><Badge label={meta.label} tone={meta.tone} /></td>
                      <td>{row.error || 'Sẵn sàng nhập'}</td>
                    </tr>
                  )
                })}
              </DataTable>
            )}
          </div>
        )}
      </div>
    </Modal>
  )
}
