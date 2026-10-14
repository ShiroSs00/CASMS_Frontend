import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'

import { regulationAdapter } from '../api/regulation-adapter'
import type {
  ConflictResult,
  MockRegulation,
  RegulationCapabilities,
  RegulationStatus,
  RegulationTargetAssignment,
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
  regulation: MockRegulation
  capabilities: RegulationCapabilities
  targets: RegulationTargetAssignment[]
}

export function RegulationDetailPage() {
  const { regulationId = '' } = useParams()
  const navigate = useNavigate()
  const [data, setData] = useState<DetailData | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [nextStatus, setNextStatus] = useState<RegulationStatus | null>(null)
  const [precheck, setPrecheck] = useState<ConflictResult | null>(null)
  const [checking, setChecking] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [mutationError, setMutationError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError('')
    try {
      const result = await regulationAdapter.get(regulationId)
      setData(result)
      setNotFound(!result)
    } catch (error) {
      setData(null)
      setNotFound(false)
      setLoadError(error instanceof Error ? error.message : 'Không thể tải chi tiết quy định.')
    } finally {
      setLoading(false)
    }
  }, [regulationId])

  useEffect(() => {
    let active = true
    void regulationAdapter.get(regulationId)
      .then((result) => {
        if (!active) return
        setData(result)
        setNotFound(!result)
      })
      .catch((error: unknown) => {
        if (!active) return
        setData(null)
        setNotFound(false)
        setLoadError(error instanceof Error ? error.message : 'Không thể tải chi tiết quy định.')
      })
      .finally(() => {
        if (active) setLoading(false)
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
        setPrecheck(await regulationAdapter.precheckStatus(
          regulationId,
          status,
        ))
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
      await regulationAdapter.changeStatus(
        regulationId,
        nextStatus,
      )
      setNextStatus(null)
      await load()
    } catch (error) {
      setMutationError(error instanceof Error ? error.message : 'Không thể cập nhật trạng thái.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AdminFrame>
      {loading ? <LoadingPanel /> : null}
      {!loading && loadError ? (
        <>
          <PageHeader title="Không tải được quy định" description="Backend đã từ chối hoặc không trả được dữ liệu." />
          <Notice title="Không thể tải dữ liệu" tone="error" role="alert">
            {loadError}
            <div className={styles.modalActions}>
              <Button onClick={() => void load()}>Thử lại</Button>
              <Button onClick={() => navigate('/admin/regulations')} tone="secondary">Về danh sách</Button>
            </div>
          </Notice>
        </>
      ) : null}
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
            description={`${data.regulation.code} · Quy định vận hành / Chi tiết · ${data.regulation.source === 'backend' ? 'Backend' : 'Demo fallback'}`}
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
                  {data.targets.map((target) => (
                    <tr key={`${target.type}:${target.id}`}>
                      <td>{target.name} · {target.id}</td>
                      <td>{target.sourceLabel}</td>
                      <td>
                        {target.type === 'global' ? (
                          'Chỉ đọc'
                        ) : (
                          <Link
                            className={styles.linkButton}
                            to={`/admin/${target.type === 'ship' ? 'ships' : 'cruises'}/${target.id}/regulations`}
                          >
                            {target.type === 'ship' ? 'Xem tại hồ sơ tàu' : 'Xem tại chuyến'}
                          </Link>
                        )}
                      </td>
                    </tr>
                  ))}
                  {data.targets.length === 0 ? (
                    <tr><td colSpan={3}>BE chưa cung cấp tra cứu ngược tàu/chuyến đã gán theo quy định. Chưa thể xác nhận danh sách tại đây.</td></tr>
                  ) : null}
                </tbody>
              </table>
            </TableScroll>
          </Panel>
          {data.regulation.hasBeenActive ? (
            <Notice title="Chính sách bảo vệ giá trị tại FE" tone="info">
              FE đang khóa giá trị với quy định không còn DRAFT. BE chưa cung cấp lịch sử ACTIVE hoặc quyền sửa từng trường để xác nhận chính sách này.
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
