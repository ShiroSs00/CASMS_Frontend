import {useSessionAccess} from '@/shared/auth'
import { CollectionSummary, DataTable, Field, ListFilters } from '@/shared/ui'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'

import { regulationsApi } from '../api/regulations-api'
import type {
  RegulationListItem,
  RegulationListQuery,
} from '../model/regulation'
import {
  regulationInput,
  formatDateTime,
  scopeLabels,
  typeLabels,
} from '../model/regulation'
import {
  AdminFrame,
  Button,
  LoadingPanel,
  Notice,
  PageHeader,
  Panel,
  StatusBadge,
} from '../components/RegulationUI'
import styles from '../components/Regulations.module.css'

const emptyQuery: RegulationListQuery = {
  search: '',
  type: 'ALL',
  scope: 'ALL',
  status: 'ALL',
  effectiveAt: regulationInput(Date.now()),
}
export function RegulationListPage() {
  const navigate = useNavigate()
  const access=useSessionAccess()
  const [query, setQuery] = useState(()=>({...emptyQuery,effectiveAt:regulationInput(Date.now())}))
  const [appliedQuery, setAppliedQuery] = useState(query)
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
    const next={...query,effectiveAt:query.effectiveAt||regulationInput(Date.now())}
    setQuery(next);setAppliedQuery(next)
  }
  const resetFilters = () => {
    setLoading(true)
    setError('')
    const next={...emptyQuery,effectiveAt:regulationInput(Date.now())}
    setQuery(next)
    setAppliedQuery(next)
  }

  return (
    <AdminFrame>
      <PageHeader
        title="Quy định vận hành"

        actions={access.canDo('REGULATION_CREATE')&&
          <Button disabled={!access.canDo('REGULATION_CREATE')} onClick={() => {if(access.canDo('REGULATION_CREATE'))navigate('/admin/regulations/new')}}>
            Tạo quy định
          </Button>
        }
      />

      <CollectionSummary count={loading || error ? null : items.length} filtered={Boolean(appliedQuery.search || appliedQuery.type !== 'ALL' || appliedQuery.scope !== 'ALL' || appliedQuery.status !== 'ALL')} label="Quy định trong kết quả" scope="Tra cứu theo thời điểm đã chọn" />
      <Panel title="Bộ lọc">
        <ListFilters label="Bộ lọc quy định" onSubmit={applyFilters} actions={<><Button type="submit">Áp dụng bộ lọc</Button><Button onClick={resetFilters} tone="secondary">Xóa bộ lọc</Button></>}>
          <Field htmlFor="reg-search" label="Tìm quy định">
            <input
              id="reg-search"
              onChange={(event) =>
                setQuery((current) => ({ ...current, search: event.target.value }))
              }
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
              <option value="GLOBAL">Toàn hệ thống</option>
              <option value="SHIP">Theo tàu</option>
              <option value="CRUISE">Theo lần khởi hành</option>
            </select>
          </Field>
          <Field htmlFor="reg-status" label="Trạng thái">
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
              <option value="ACTIVE">Đã kích hoạt</option>
              <option value="INACTIVE">Đã ngừng kích hoạt</option>
              <option value="EXPIRED">Hết hạn</option>
            </select>
          </Field>
          <Field htmlFor="reg-effective-at" label="Tra cứu hiệu lực lúc · Giờ Việt Nam">
            <input
              id="reg-effective-at"
              onChange={(event) =>
                setQuery((current) => ({
                  ...current,
                  effectiveAt: event.target.value,
                }))
              }
              type="datetime-local"
              step={1}
              value={query.effectiveAt}
            />
          </Field>
        </ListFilters>
      </Panel>

      <Panel title={loading||error?'Danh sách quy định':`Danh sách quy định · ${items.length}`} >
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
              Hiệu lực tại {formatDateTime(appliedQuery.effectiveAt)} · Giờ Việt Nam.
            </p>
            <DataTable label="Danh sách quy định" headers={['Mã / tên quy định', 'Loại', 'Phạm vi', 'Trạng thái kích hoạt', 'Hiệu lực tại thời điểm tra cứu', 'Thao tác']}>

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


            </DataTable>
          </>
        ) : null}
      </Panel>
    </AdminFrame>
  )
}
