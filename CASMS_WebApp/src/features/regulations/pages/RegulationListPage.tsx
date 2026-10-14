import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'

import { paginateItems } from '../../../shared/pagination.ts'
import { regulationAdapter } from '../api/regulation-adapter'
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
  Pagination,
  PageHeader,
  Panel,
  StatusBadge,
  TableScroll,
} from '../components/RegulationUI'
import {
  DEFAULT_REGULATION_LIST_QUERY,
  parseRegulationListQuery,
  REGULATION_PAGE_SIZE_OPTIONS,
  serializeRegulationListQuery,
} from '../model/regulation-query'
import styles from '../components/Regulations.module.css'

export function RegulationListPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const appliedQuery = useMemo(
    () => parseRegulationListQuery(searchParams),
    [searchParams],
  )
  const adapterQuery = useMemo(
    () => ({
      search: appliedQuery.search,
      type: appliedQuery.type,
      scope: appliedQuery.scope,
      status: appliedQuery.status,
      effectiveAt: appliedQuery.effectiveAt,
    }),
    [
      appliedQuery.effectiveAt,
      appliedQuery.scope,
      appliedQuery.search,
      appliedQuery.status,
      appliedQuery.type,
    ],
  )
  const adapterKey = JSON.stringify(adapterQuery)
  const [draft, setDraft] = useState(() => ({
    baseKey: adapterKey,
    value: adapterQuery,
  }))
  const query = draft.baseKey === adapterKey ? draft.value : adapterQuery
  const setQuery = (
    update: (current: RegulationListQuery) => RegulationListQuery,
  ) => {
    setDraft({ baseKey: adapterKey, value: update(query) })
  }
  const [items, setItems] = useState<RegulationListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reloadToken, setReloadToken] = useState(0)
  const [loadedKey, setLoadedKey] = useState('')
  const visibleLoading = loading || loadedKey !== adapterKey

  useEffect(() => {
    let active = true
    void regulationAdapter
      .list(adapterQuery)
      .then((data) => {
        if (!active) return
        setItems(data)
        setError('')
      })
      .catch((failure: unknown) => {
        if (active) setError(failure instanceof Error ? failure.message : 'Không tải được danh sách quy định.')
      })
      .finally(() => {
        if (!active) return
        setLoadedKey(adapterKey)
        setLoading(false)
      })
    return () => {
      active = false
    }
  }, [adapterKey, adapterQuery, reloadToken])

  const page = useMemo(
    () => paginateItems(items, appliedQuery.page, appliedQuery.pageSize),
    [appliedQuery.page, appliedQuery.pageSize, items],
  )

  useEffect(() => {
    if (visibleLoading || error || page.page === appliedQuery.page) return
    setSearchParams(
      serializeRegulationListQuery({ ...appliedQuery, page: page.page }),
      { replace: true },
    )
  }, [appliedQuery, error, page.page, setSearchParams, visibleLoading])

  const applyFilters = () => {
    setSearchParams(serializeRegulationListQuery({
      ...appliedQuery,
      ...query,
      page: 1,
    }))
  }
  const resetFilters = () => {
    const reset = {
      ...DEFAULT_REGULATION_LIST_QUERY,
      pageSize: appliedQuery.pageSize,
    }
    setDraft({ baseKey: adapterKey, value: reset })
    setSearchParams(serializeRegulationListQuery(reset))
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

      <Notice
        title={regulationAdapter.sourceLabel}
        tone={regulationAdapter.source === 'backend' ? 'success' : 'warning'}
        role="status"
      >
        {regulationAdapter.sourceNotice || 'Các thao tác trên màn hình này đang sử dụng API Regulation.'}
      </Notice>

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
        </div>
        <Notice title="Hai trạng thái khác nhau" tone="info">
          Trạng thái cấu hình cho biết quy định đang DRAFT, ACTIVE hay INACTIVE.
          Hiệu lực tại thời điểm được tính riêng từ trạng thái và khoảng thời gian áp dụng.
        </Notice>
      </Panel>

      <Panel title={`Danh sách quy định · ${items.length}`}>
        {visibleLoading ? <LoadingPanel /> : null}
        {!visibleLoading && error ? (
          <Notice title="Không tải được dữ liệu" tone="error" role="alert">
            <p>{error}</p>
            <Button
              onClick={() => {
                setLoading(true)
                setError('')
                setReloadToken((current) => current + 1)
              }}
              tone="secondary"
            >
              Thử lại
            </Button>
          </Notice>
        ) : null}
        {!visibleLoading && !error && items.length === 0 ? (
          <div className={styles.emptyState}>
            <strong>Không có kết quả phù hợp</strong>
            <p>Thử mã/tên khác hoặc xóa bộ lọc.</p>
            <Button onClick={resetFilters} tone="secondary">
              Xóa bộ lọc
            </Button>
          </div>
        ) : null}
        {!visibleLoading && !error && items.length ? (
          <>
            <p className={styles.resultsMeta}>
              Hiển thị {page.start}–{page.end} trong {page.total} kết quả · Hiệu lực tại{' '}
              {appliedQuery.effectiveAt ? formatDateTime(appliedQuery.effectiveAt) : 'hiện tại'}.
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
                  {page.items.map((item) => (
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
            <Pagination
              end={page.end}
              itemLabel="quy định"
              onPageChange={(nextPage) => {
                setSearchParams(serializeRegulationListQuery({
                  ...appliedQuery,
                  page: nextPage,
                }))
              }}
              onPageSizeChange={(pageSize) => {
                setSearchParams(serializeRegulationListQuery({
                  ...appliedQuery,
                  page: 1,
                  pageSize,
                }))
              }}
              page={page.page}
              pageSize={page.pageSize}
              pageSizeOptions={REGULATION_PAGE_SIZE_OPTIONS}
              start={page.start}
              total={page.total}
              totalPages={page.totalPages}
            />
          </>
        ) : null}
      </Panel>
    </AdminFrame>
  )
}
