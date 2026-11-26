import { apiRequest, useReadQuery } from '@/shared/api'
import {useSessionAccess} from '@/shared/auth'
import { downloadCsv } from '@/shared/lib/download-csv'
import { CollectionSummary, DataTable, Field, ListFilters } from '@/shared/ui'
import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router'

import { regulationsApi } from '../api/regulations-api'
import type {
  RegulationListItem,
  RegulationListQuery,
} from '../model/regulation'
import {
  regulationInput,
  regulationInstant,
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
  effectiveOnly: false,
}

type ComplianceScope = keyof typeof scopeLabels
type ComplianceRow = { scope: ComplianceScope; active: number; upcoming: number; expired: number }

export function RegulationListPage() {
  const navigate = useNavigate()
  const access=useSessionAccess()
  const showCompliance = access.status === 'ready' && access.roles.includes('OPERATIONS_MANAGER') && access.has('REGULATION_READ')
  const [scope, setScope] = useState<ComplianceScope | ''>('')
  const [effectiveAt, setEffectiveAt] = useState(() => regulationInput(Date.now()))
  const [complianceFilter, setComplianceFilter] = useState<{ at: string; scope?: ComplianceScope }>(
    () => ({ at: regulationInstant(effectiveAt) }))
  const [exporting, setExporting] = useState(false)
  const [complianceError, setComplianceError] = useState('')
  const compliance = useReadQuery(
    `regulation-compliance:${access.userId}:${showCompliance}:${complianceFilter.at}:${complianceFilter.scope}`, useCallback(
      signal => showCompliance ? apiRequest<ComplianceRow[]>(
        '/operational-regulations/compliance-summary', { signal, query: complianceFilter }) : Promise.resolve(null),
      [showCompliance, complianceFilter]))

  function applyComplianceFilters() {
    setComplianceError('')
    try {
      setComplianceFilter({ at: regulationInstant(effectiveAt), scope: scope || undefined })
    } catch {
      setComplianceError('Chọn thời điểm kiểm tra hợp lệ.')
    }
  }

  async function exportCompliance() {
    if (exporting || !access.has('REPORT_GENERATE')) return
    setExporting(true)
    setComplianceError('')
    try {
      const csv = await apiRequest<string>('/operational-regulations/compliance-summary/export', {
        method: 'POST', body: complianceFilter,
      })
      downloadCsv(csv, 'bao-cao-quy-dinh-van-hanh.csv')
    } catch {
      setComplianceError('Chưa xuất được báo cáo quy định.')
    } finally {
      setExporting(false)
    }
  }

  const [query, setQuery] = useState(()=>({...emptyQuery,effectiveAt:regulationInput(Date.now())}))
  const [appliedQuery, setAppliedQuery] = useState(query)
  const [items, setItems] = useState<RegulationListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    const controller=new AbortController()
    void regulationsApi
      .list(appliedQuery,controller.signal)
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
      controller.abort()
    }
  }, [appliedQuery])

  const applyFilters = () => {
    setLoading(true)
    setError('')
    const next={...query,effectiveAt:regulationInput(Date.now())}
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

      {showCompliance && <Panel title="Tổng hợp quy định theo phạm vi">
        <ListFilters className={styles.regulationFilters} label="Bộ lọc báo cáo quy định" onSubmit={applyComplianceFilters}
          actions={<Button type="submit">Xem tổng hợp</Button>}>
          <Field htmlFor="compliance-scope" label="Phạm vi báo cáo">
            <select id="compliance-scope" value={scope} onChange={event => setScope(event.target.value as ComplianceScope | '')}>
              <option value="">Tất cả phạm vi</option>
              {Object.entries(scopeLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </select>
          </Field>
          <Field htmlFor="compliance-at" label="Thời điểm kiểm tra (giờ Việt Nam)">
            <input id="compliance-at" type="datetime-local" required value={effectiveAt} onChange={event => setEffectiveAt(event.target.value)} />
          </Field>
        </ListFilters>
        {complianceError && <p role="alert">{complianceError}</p>}
        {compliance.loading && <p role="status">Đang tải tổng hợp…</p>}
        {compliance.error && <p role="alert">Chưa tải được tổng hợp. <Button onClick={compliance.retry}>Tải lại</Button></p>}
        {compliance.data && <DataTable label="Tổng hợp quy định" headers={['Phạm vi', 'Hiệu lực', 'Sắp đến hạn', 'Hết hiệu lực']}>
          {compliance.data.map(row => <tr key={row.scope}><td>{scopeLabels[row.scope]}</td>
            <td>{row.active}</td><td>{row.upcoming}</td><td>{row.expired}</td></tr>)}
        </DataTable>}
        {compliance.data && !compliance.error && access.has('REPORT_GENERATE')
          && <Button tone="secondary" disabled={exporting} onClick={() => void exportCompliance()}>Xuất CSV quy định</Button>}
      </Panel>}
      <CollectionSummary count={loading || error ? null : items.length} filtered={Boolean(appliedQuery.search || appliedQuery.type !== 'ALL' || appliedQuery.scope !== 'ALL' || appliedQuery.status !== 'ALL')} label="Quy định trong kết quả" scope="Tra cứu theo thời điểm đã chọn" />
      <Panel title="Bộ lọc">
        <ListFilters className={styles.regulationFilters} label="Bộ lọc quy định" onSubmit={applyFilters} actions={<><Button type="submit">Áp dụng bộ lọc</Button><Button onClick={resetFilters} tone="secondary">Xóa bộ lọc</Button></>}>
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
              <option value="CRUISE">Theo chuyến khởi hành</option>
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
          <Field htmlFor="reg-current-only" label="Hiệu lực"><select id="reg-current-only" value={query.effectiveOnly?'current':'all'} onChange={event=>setQuery(current=>({...current,effectiveOnly:event.target.value==='current'}))}><option value="all">Tất cả quy định</option><option value="current">Đang có hiệu lực theo hệ thống</option></select></Field>
          <div className={styles.effectiveTime}><Field htmlFor="reg-effective-at" label="Thời điểm tra cứu · Giờ Việt Nam">
            <input
              id="reg-effective-at"
              disabled
              readOnly
              type="datetime-local"
              step={1}
              value={query.effectiveAt.slice(0,16)}
            />
          </Field></div>
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
              {appliedQuery.effectiveOnly?'Quy định đang có hiệu lực theo kết quả hệ thống trả về.':'Trạng thái kích hoạt và thời hạn được hiển thị theo hồ sơ quy định.'}
            </p>
            <DataTable label="Danh sách quy định" headers={['Mã / tên quy định', 'Loại', 'Phạm vi', 'Trạng thái kích hoạt', ...(appliedQuery.effectiveOnly?['Hiệu lực hiện tại']:[]), 'Thao tác']}>

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
                      {appliedQuery.effectiveOnly&&<td><StatusBadge status={item.effectiveStatus} /></td>}
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
