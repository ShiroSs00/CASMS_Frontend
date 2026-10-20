import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'

import { regulationsApi } from '../api/regulations-api'
import type {
  RegulationListItem,
  RegulationListQuery,
} from '../model/regulation'
import {
  formatDateTime,
  scopeLabels,
  typeLabels,
} from '../model/regulation'
import {
  AdminFrame,
  Button,
  Field,
  LoadingPanel,
  Notice,
  PageHeader,
  Panel,
  StatusBadge,
  TableScroll,
} from '../components/RegulationUI'
import styles from '../components/Regulations.module.css'

const emptyQuery: RegulationListQuery = {
  search: '',
  type: 'ALL',
  scope: 'ALL',
  status: 'ALL',
  effectiveAt: new Date().toISOString().slice(0, 16),
}
export function RegulationListPage() {
  const navigate = useNavigate()
  const [query, setQuery] = useState(emptyQuery)
  const [appliedQuery, setAppliedQuery] = useState(emptyQuery)
  const [items, setItems] = useState<RegulationListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    void regulationsApi
      .list(appliedQuery)
      .then((data) => {
        if (active) setItems(data)
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : 'Không tải được danh sách quy định.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [appliedQuery])

  const applyFilters = () => {
    setLoading(true)
    setError('')
    setAppliedQuery({ ...query })
  }
  const resetFilters = () => {
    setLoading(true)
    setError('')
    setQuery(emptyQuery)
    setAppliedQuery({ ...emptyQuery })
  }

  return (
    <AdminFrame>
      <PageHeader
        title="Quy định vận hành"
        description="Tìm kiếm, theo dõi hiệu lực và quản lý trạng thái quy định."
        actions={
          <Button onClick={() => navigate('/admin/regulations/new')}>
            Tạo quy định
          </Button>
        }
      />

      <Panel title="Tìm kiếm & bộ lọc">
        <div className={styles.filters}>
          <Field htmlFor="reg-search" label="Tìm quy định">
            <input
              id="reg-search"
              onChange={(event) =>
                setQuery((current) => ({ ...current, search: event.target.value }))
              }
              onKeyDown={(event) => {
                if (event.key === 'Enter') applyFilters()
              }}
              placeholder="Nhập mã hoặc tên"
              value={query.search}
            />
          </Field>
          <Field htmlFor="reg-type" label="Loại quy định">
            <select
              id="reg-type"
              onChange={(event) =>
                setQuery((current) => ({
                  ...current,
                  type: event.target.value as RegulationListQuery['type'],
                }))
              }
              value={query.type}
            >
              <option value="ALL">Tất cả</option>
              <option value="SPEED">Tốc độ</option>
              <option value="CAPACITY">Sức chứa</option>
              <option value="SAFETY">An toàn</option>
              <option value="WEATHER">Thời tiết</option>
              <option value="ENVIRONMENT">Môi trường</option>
              <option value="HEALTH">Sức khỏe</option>
            </select>
          </Field>
          <Field htmlFor="reg-scope" label="Phạm vi">
            <select
              id="reg-scope"
              onChange={(event) =>
                setQuery((current) => ({
                  ...current,
                  scope: event.target.value as RegulationListQuery['scope'],
                }))
              }
              value={query.scope}
            >
              <option value="ALL">Tất cả</option>
              <option value="GLOBAL">GLOBAL · Toàn hệ thống</option>
              <option value="SHIP">SHIP · Theo tàu</option>
              <option value="CRUISE">CRUISE · Theo chuyến</option>
            </select>
          </Field>
          <Field htmlFor="reg-status" label="Trạng thái cấu hình">
            <select
              id="reg-status"
              onChange={(event) =>
                setQuery((current) => ({
                  ...current,
                  status: event.target.value as RegulationListQuery['status'],
                }))
              }
              value={query.status}
            >
              <option value="ALL">Tất cả</option>
              <option value="DRAFT">Bản nháp</option>
              <option value="ACTIVE">Đang hoạt động</option>
              <option value="INACTIVE">Ngừng hoạt động</option>
              <option value="EXPIRED">Hết hạn</option>
            </select>
          </Field>
          <Field htmlFor="reg-effective-at" label="Hiệu lực tại thời điểm">
            <input
              id="reg-effective-at"
              onChange={(event) =>
                setQuery((current) => ({
                  ...current,
                  effectiveAt: event.target.value,
                }))
              }
              type="datetime-local"
              value={query.effectiveAt}
            />
          </Field>
        </div>
        <div className={styles.toolbar}>
          <Button onClick={applyFilters}>Áp dụng bộ lọc</Button>
          <Button onClick={resetFilters} tone="secondary">
            Xóa bộ lọc
          </Button>
          <Button
            onClick={() => {
              setLoading(true)
              setError('')
              setQuery((curr) => ({ ...curr, effectiveOnly: !curr.effectiveOnly }))
              setAppliedQuery((curr) => ({ ...curr, effectiveOnly: !curr.effectiveOnly }))
            }}
            tone={appliedQuery.effectiveOnly ? 'primary' : 'secondary'}
          >
            {appliedQuery.effectiveOnly ? 'Đang lọc: Quy định hiện có hiệu lực' : 'Xem quy định hiện có hiệu lực'}
          </Button>
        </div>
        {appliedQuery.effectiveOnly ? (
          <Notice title="Nguồn dữ liệu hiệu lực" tone="success">
            Danh sách được lấy trực tiếp từ máy chủ qua endpoint GET /operational-regulations/effective.
          </Notice>
        ) : null}
        <Notice title="Hai trạng thái khác nhau" tone="info">
          Trạng thái cấu hình cho biết quy định đang DRAFT, ACTIVE hay INACTIVE.
          Hiệu lực tại thời điểm được tính riêng từ trạng thái và khoảng thời gian áp dụng.
        </Notice>
        <Notice title="Lọc trên danh sách đã tải" tone="info">Bộ lọc áp dụng cho dữ liệu hiện có. Tìm kiếm và phân trang trên máy chủ chưa khả dụng.</Notice>
      </Panel>

      <Panel title={`Danh sách quy định · ${items.length}`}>
        {loading ? <LoadingPanel /> : null}
        {!loading && error ? (
          <Notice title="Không tải được dữ liệu" tone="error" role="alert">
            <p>{error}</p>
            <Button
              onClick={() => {
                setLoading(true)
                setError('')
                setAppliedQuery({ ...appliedQuery })
              }}
              tone="secondary"
            >
              Thử lại
            </Button>
          </Notice>
        ) : null}
        {!loading && !error && items.length === 0 ? (
          <div className={styles.emptyState}>
            <strong>Không có kết quả phù hợp</strong>
            <p>Thử mã/tên khác hoặc xóa bộ lọc.</p>
            <Button onClick={resetFilters} tone="secondary">
              Xóa bộ lọc
            </Button>
          </div>
        ) : null}
        {!loading && !error && items.length ? (
          <>
            <p className={styles.resultsMeta}>
              Kết quả tính hiệu lực tại {formatDateTime(appliedQuery.effectiveAt)}.
            </p>
            <TableScroll>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>MÃ / TÊN QUY ĐỊNH</th>
                    <th>LOẠI</th>
                    <th>PHẠM VI</th>
                    <th>TRẠNG THÁI</th>
                    <th>HIỆU LỰC</th>
                    <th>THAO TÁC</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <strong>{item.code}</strong>
                        <br />
                        {item.name}
                      </td>
                      <td>{typeLabels[item.type]}</td>
                      <td>{scopeLabels[item.scope]}</td>
                      <td><StatusBadge status={item.status} /></td>
                      <td><StatusBadge status={item.effectiveStatus} /></td>
                      <td>
                        <button
                          className={styles.linkButton}
                          onClick={() => navigate(`/admin/regulations/${item.id}`)}
                          type="button"
                        >
                          Xem {item.code}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableScroll>
          </>
        ) : null}
      </Panel>
    </AdminFrame>
  )
}
