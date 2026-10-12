import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'

import { mockRegulationAdapter } from '../mocks/mock-regulation-adapter'
import type {
  ConflictResult,
  Regulation,
  RegulationCapabilities,
  RegulationStatus,
} from '../model/regulation'
import {
  formatDateTime,
  scopeLabels,
  statusLabels,
  typeLabels,
} from '../model/regulation'
import {
  AdminFrame,
  Button,
  ConflictCard,
  LoadingPanel,
  Modal,
  Notice,
  PageHeader,
  Panel,
  TableScroll,
} from '../components/RegulationUI'
import styles from '../components/Regulations.module.css'

type DetailData = {
  regulation: Regulation
  capabilities: RegulationCapabilities
}

export function RegulationDetailPage() {
  const { regulationId = '' } = useParams()
  const navigate = useNavigate()
  const [data, setData] = useState<DetailData | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [nextStatus, setNextStatus] = useState<RegulationStatus | null>(null)
  const [precheck, setPrecheck] = useState<ConflictResult | null>(null)
  const [checking, setChecking] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [mutationError, setMutationError] = useState('')

  const load = useCallback(async () => {
    const result = await mockRegulationAdapter.get(regulationId)
    setData(result)
    setNotFound(!result)
    setLoading(false)
  }, [regulationId])

  useEffect(() => {
    let active = true
    void mockRegulationAdapter.get(regulationId).then((result) => {
      if (!active) return
      setData(result)
      setNotFound(!result)
      setLoading(false)
    })
    return () => {
      active = false
    }
  }, [regulationId])

  const openStatusDialog = async (status: RegulationStatus) => {
    setNextStatus(status)
    setMutationError('')
    setPrecheck(null)
    if (status === 'ACTIVE') {
      setChecking(true)
      try {
        setPrecheck(await mockRegulationAdapter.precheckStatus(regulationId, status))
      } catch {
        setPrecheck({
          severity: 'unavailable',
          title: 'Chưa xác định / kiểm tra thất bại',
          message: 'Không thể kiểm tra xung đột. Không thể tiếp tục khi chưa có policy.',
          canProceed: false,
          comparedWith: [],
        })
      } finally {
        setChecking(false)
      }
    }
  }

  const confirmStatus = async () => {
    if (!nextStatus || submitting) return
    setSubmitting(true)
    setMutationError('')
    try {
      await mockRegulationAdapter.changeStatus(regulationId, nextStatus)
      setNextStatus(null)
      await load()
    } catch {
      setMutationError('Không thể cập nhật trạng thái. Dữ liệu cũ vẫn được giữ nguyên.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AdminFrame>
      {loading ? <LoadingPanel /> : null}
      {!loading && notFound ? (
        <>
          <PageHeader
            title="Không tìm thấy quy định"
            description={`Không có dữ liệu cho mã định danh “${regulationId}”.`}
          />
          <Notice title="Đường dẫn không hợp lệ hoặc dữ liệu đã thay đổi" tone="error">
            <Button onClick={() => navigate('/admin/regulations')} tone="secondary">
              Về danh sách
            </Button>
          </Notice>
        </>
      ) : null}
      {!loading && data ? (
        <>
          <PageHeader
            title={data.regulation.name}
            description={`${data.regulation.code} · Quy định vận hành / Chi tiết · Dữ liệu mock`}
            actions={
              <>
                <Button
                  onClick={() => navigate(`/admin/regulations/${data.regulation.id}/edit`)}
                >
                  Chỉnh sửa
                </Button>
                {data.regulation.status === 'ACTIVE' ? (
                  <Button
                    disabled={!data.capabilities.canDeactivate.allowed}
                    onClick={() => void openStatusDialog('INACTIVE')}
                    tone="secondary"
                  >
                    Ngừng kích hoạt
                  </Button>
                ) : (
                  <Button
                    disabled={!data.capabilities.canActivate.allowed}
                    onClick={() => void openStatusDialog('ACTIVE')}
                  >
                    Kích hoạt
                  </Button>
                )}
                <Button onClick={() => navigate('/admin/regulations')} tone="secondary">
                  Danh sách
                </Button>
              </>
            }
          />

          <Notice
            title={`${statusLabels[data.regulation.status]} · ${data.regulation.code}`}
            tone={data.regulation.status === 'ACTIVE' ? 'success' : 'info'}
          >
            {formatDateTime('2026-11-20T08:00')} · Asia/Ho_Chi_Minh. Khoảng hiệu lực từ{' '}
            {formatDateTime(data.regulation.effectiveFrom)} đến{' '}
            {formatDateTime(data.regulation.effectiveTo)}.
          </Notice>

          <Panel title="Thông tin quy định">
            <TableScroll>
              <table className={styles.table}>
                <thead><tr><th>THUỘC TÍNH</th><th>NỘI DUNG</th></tr></thead>
                <tbody>
                  <tr><td>Loại / giá trị / đơn vị</td><td>{typeLabels[data.regulation.type]} · {data.regulation.value} {data.regulation.unit}</td></tr>
                  <tr><td>Phạm vi</td><td>{data.regulation.scope} · {scopeLabels[data.regulation.scope]}</td></tr>
                  <tr><td>Mô tả</td><td>{data.regulation.description}</td></tr>
                  <tr><td>Hiệu lực</td><td>{formatDateTime(data.regulation.effectiveFrom)} → {formatDateTime(data.regulation.effectiveTo)}</td></tr>
                </tbody>
              </table>
            </TableScroll>
          </Panel>

          <Panel title="Đối tượng được gán" subtitle="Liên kết trực tiếp theo phạm vi của quy định.">
            <TableScroll>
              <table className={styles.table}>
                <thead><tr><th>ĐỐI TƯỢNG</th><th>NGUỒN GÁN</th><th>THAO TÁC</th></tr></thead>
                <tbody>
                  {data.regulation.scope === 'GLOBAL' ? (
                    <tr><td>Toàn hệ thống</td><td>GLOBAL</td><td>Chỉ đọc</td></tr>
                  ) : data.regulation.scope === 'SHIP' ? (
                    <tr>
                      <td>CASMS Aurora · CAS-AUR-01</td>
                      <td>Trực tiếp · Ship regulation</td>
                      <td><Link className={styles.linkButton} to="/admin/ships/CAS-AUR-01/regulations">Xem tại hồ sơ tàu</Link></td>
                    </tr>
                  ) : (
                    <tr>
                      <td>CR-261120-01 · Hạ Long — Lan Hạ</td>
                      <td>Trực tiếp · Cruise regulation</td>
                      <td><Link className={styles.linkButton} to="/admin/cruises/CR-261120-01/regulations">Xem tại chuyến</Link></td>
                    </tr>
                  )}
                </tbody>
              </table>
            </TableScroll>
          </Panel>
          {data.regulation.hasBeenActive ? (
            <Notice title="Quy định đã từng ACTIVE" tone="info">
              Giá trị được khóa. Muốn đổi giá trị, hãy tạo quy định mới.
            </Notice>
          ) : null}
        </>
      ) : null}

      {nextStatus && data ? (
        <Modal
          description="Thao tác chỉ được gửi một lần sau khi xác nhận."
          onClose={() => {
            if (!submitting) setNextStatus(null)
          }}
          title={nextStatus === 'ACTIVE' ? 'Kích hoạt quy định?' : 'Ngừng hoạt động quy định?'}
        >
          <Notice title={`${data.regulation.code} · ${data.regulation.name}`} tone="neutral">
            Trạng thái hiện tại: {statusLabels[data.regulation.status]}. Trạng thái mới:{' '}
            {statusLabels[nextStatus]}.
          </Notice>
          {checking ? <LoadingPanel label="Đang kiểm tra xung đột…" /> : null}
          {precheck ? <ConflictCard result={precheck} /> : null}
          {mutationError ? <Notice title="Không cập nhật được" tone="error" role="alert">{mutationError}</Notice> : null}
          <div className={styles.modalActions}>
            <Button
              disabled={
                submitting ||
                checking ||
                (nextStatus === 'ACTIVE' && !precheck?.canProceed)
              }
              onClick={() => void confirmStatus()}
              tone={nextStatus === 'INACTIVE' ? 'danger' : 'primary'}
            >
              {submitting ? 'Đang cập nhật…' : 'Xác nhận'}
            </Button>
            <Button disabled={submitting} onClick={() => setNextStatus(null)} tone="secondary">
              Hủy
            </Button>
          </div>
        </Modal>
      ) : null}
    </AdminFrame>
  )
}
