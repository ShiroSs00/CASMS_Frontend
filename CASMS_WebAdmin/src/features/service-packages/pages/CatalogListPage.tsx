import { PermissionLink as Link } from '@/shared/ui'
import { useCallback, useState } from 'react'

import { useReadQuery } from '@/shared/api'
import { useSessionAccess } from '@/shared/auth'
import { Badge, Button, ButtonLink, DataTable, Empty, Field, ListFilters, ListFooter, Modal, PageHeader, Panel } from '@/shared/ui'
import { servicePackageApi } from '../api/service-package-api'
import { CatalogFrame, CatalogState } from '../components/CatalogUI'
import { catalogTime, catalogConfig, formatCatalogType, statusLabels, type CatalogKind } from '../model/catalog'

import styles from '../components/Catalog.module.css'
import { catalogPermission, productTypes } from '../model/catalog-editor'
import { CatalogDetail } from './CatalogDetailPage'
import { OnboardTaskWorkspace } from '../components/OnboardTaskWorkspace'

function CatalogList({ kind }: { kind: CatalogKind }) {
  const access = useSessionAccess()
  const config = catalogConfig[kind], query = useReadQuery(kind, useCallback(signal => servicePackageApi.list(kind, signal), [kind]))
  const [search, setSearch] = useState(''), [status, setStatus] = useState('')
  const items = query.data?.filter(item => (!status || item.status === status) && `${item.name} ${item.code}`.toLocaleLowerCase('vi').includes(search.toLocaleLowerCase('vi'))) ?? []
  const [selected, setSelected] = useState<{id:string;name:string}|null>(null)
  const defaultStatuses = kind === 'packages' ? ['ACTIVE', 'INACTIVE', 'DRAFT'] : ['ACTIVE', 'INACTIVE']
  const statuses = [...new Set([...defaultStatuses, ...(query.data?.map(item => item.status) ?? [])])]
  const filtered = Boolean(search || status)
  return <CatalogFrame><PageHeader breadcrumb="DỊCH VỤ TÀU" title={kind === 'packages' ? 'Gói dịch vụ bổ sung' : config.label} actions={access.canDo(catalogPermission(kind, 'create')) && <ButtonLink to={`${config.route}/new`}>+ Tạo {config.label.toLocaleLowerCase('vi')}</ButtonLink>} />
    <Panel>
      <div style={{ display: 'grid', gap: '16px' }}>
        <ListFilters label="Bộ lọc danh mục" actions={filtered ? <Button tone="secondary" onClick={() => { setSearch(''); setStatus('') }}>Xóa lọc</Button> : undefined}>
          <Field htmlFor="catalog-search" label="Tìm kiếm"><input id="catalog-search" type="search" placeholder="Tên hoặc mã…" value={search} onChange={event => setSearch(event.target.value)} /></Field>
          <Field htmlFor="catalog-status" label="Trạng thái"><select id="catalog-status" value={status} onChange={event => setStatus(event.target.value)}><option value="">Tất cả</option>{statuses.map(value => <option key={value} value={value}>{statusLabels[value] ?? value}</option>)}</select></Field>
        </ListFilters>
        <CatalogState {...query} />
        {query.data && !items.length && <Empty title={query.data.length ? 'Không có kết quả phù hợp' : `Chưa có ${config.label.toLocaleLowerCase('vi')}`} />}
        {query.data && items.length > 0 && <DataTable label={`Danh sách ${config.label.toLocaleLowerCase('vi')}`} headers={['Tên / mã', 'Loại', 'Giá', 'Trạng thái', 'Thao tác']}>{items.map(item => <tr key={item.id}><td><span className={styles.recordName}>{item.name}</span><span className={styles.recordCode}>{item.code}</span></td><td>{kind === 'products' ? (productTypes[item.type] ?? formatCatalogType(item.type)) : formatCatalogType(item.type)}</td><td>{item.price == null ? 'Chưa cấu hình' : `${item.price.toLocaleString('vi-VN')} ${item.currency ?? ''}`}</td><td><Badge label={statusLabels[item.status] ?? item.status} tone={['ACTIVE', 'COMPLETED', 'AVAILABLE'].includes(item.status) ? 'success' : ['REJECTED', 'CANCELLED'].includes(item.status) ? 'error' : item.status === 'IN_PROGRESS' ? 'info' : 'neutral'} /></td><td><Button tone="secondary" size="compact" autoWidth onClick={() => setSelected({id:item.id,name:item.name})}>Chi tiết</Button></td></tr>)}</DataTable>}
        {query.data && items.length > 0 && <ListFooter summary={`${items.length} kết quả`} />}
      </div>
    </Panel>
  {selected && <Modal title={selected.name} large protectChanges={false} onClose={() => setSelected(null)} footer={<Button tone="secondary" onClick={() => setSelected(null)}>Đóng</Button>}><div className={styles.stack}><CatalogDetail kind={kind} recordId={selected.id} embedded onDeleted={() => { setSelected(null); query.retry() }} /></div></Modal>}</CatalogFrame>
}
export function ServiceListPage() { return <CatalogList kind="services" /> }
export function ProductListPage() { return <CatalogList kind="products" /> }
export function PackageListPage() { return <CatalogList kind="packages" /> }
function requestSearchText(value: string) {
  return value.trim().toLocaleLowerCase('vi').normalize('NFD').replace(/\p{M}/gu, '').replaceAll('đ', 'd')
}

export function ServiceRequestListPage() {
  const access = useSessionAccess()
  return access.roles.includes('ONBOARD_STAFF') ? <OnboardTaskWorkspace /> : <ManagedServiceRequestList />
}
function ManagedServiceRequestList() {
  const access = useSessionAccess()
  const query = useReadQuery('service-requests:' + access.userId, servicePackageApi.requests), [search, setSearch] = useState(''), [status, setStatus] = useState('')
  const canReadServices = access.canDo('SERVICE_READ')
  const services = useReadQuery('request-service-catalog:' + access.userId + ':' + canReadServices,
    useCallback(signal => canReadServices ? servicePackageApi.list('services', signal) : Promise.resolve([]), [canReadServices]))
  const serviceById = new Map(services.data?.map(item => [item.id, item]))
  const term = requestSearchText(search)
  const items = query.data?.filter(item => {
    if (status && item.status !== status) return false
    if (!term) return true
    const service = serviceById.get(item.serviceId)
    return [item.id, item.note, item.serviceId, item.bookingId, item.bookingPassengerId,
      item.passengerId, service?.code, service?.name].some(value => value && requestSearchText(value).includes(term))
  }) ?? []
  const filtered = Boolean(search || status)
  return <CatalogFrame><PageHeader breadcrumb="DỊCH VỤ TÀU" title="Yêu cầu dịch vụ" actions={access.canDo('SERVICE_REQUEST_CREATE') && <ButtonLink to="/admin/service-requests/new">+ Tạo yêu cầu dịch vụ</ButtonLink>} />
    <Panel>
      <div style={{ display: 'grid', gap: '16px' }}>
        <ListFilters label="Bộ lọc yêu cầu dịch vụ" actions={filtered ? <Button tone="secondary" onClick={() => { setSearch(''); setStatus('') }}>Xóa lọc</Button> : undefined}>
          <Field htmlFor="request-search" label="Tìm yêu cầu"><input id="request-search" type="search" placeholder="Tên dịch vụ, mã yêu cầu hoặc ghi chú…" value={search} onChange={event => setSearch(event.target.value)} /></Field>
          <Field htmlFor="request-status" label="Trạng thái"><select id="request-status" value={status} onChange={event => setStatus(event.target.value)}><option value="">Tất cả</option>{['REQUESTED', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'REJECTED', 'CANCELLED'].map(value => <option key={value} value={value}>{statusLabels[value]}</option>)}</select></Field>
        </ListFilters>
        <CatalogState {...query} />
        {query.data && !items.length && <Empty title={query.data.length ? 'Không có kết quả phù hợp' : 'Chưa có yêu cầu dịch vụ'} />}
        {query.data && items.length > 0 && <DataTable label="Yêu cầu dịch vụ" headers={['Dịch vụ', 'Khách / Đặt chỗ', 'Số lượng', 'Người xử lý', 'Trạng thái', 'Yêu cầu lúc', 'Thao tác']}>
          {items.map(item => <tr key={item.id}><td>{serviceById.get(item.serviceId)?.name ?? 'Dịch vụ'}{canReadServices && <> · <Link to={'/admin/services/' + item.serviceId}>Xem</Link></>}</td><td>{item.bookingId ? `Đặt chỗ #${item.bookingId.slice(0, 8)}` : `Khách #${item.passengerId.slice(0, 8)}`}</td><td>{item.quantity}</td><td>{item.assignedUserId ? (item.assignedUserId === access.userId ? 'Bạn' : `NV #${item.assignedUserId.slice(0, 8)}`) : 'Chưa phân công'}</td><td><Badge label={statusLabels[item.status] ?? item.status} tone={['ACTIVE', 'COMPLETED', 'AVAILABLE'].includes(item.status) ? 'success' : ['REJECTED', 'CANCELLED'].includes(item.status) ? 'error' : item.status === 'IN_PROGRESS' ? 'info' : 'neutral'} /></td><td>{catalogTime(item.requestTime)}</td><td><Link to={'/admin/service-requests/' + item.id}>Chi tiết</Link></td></tr>)}
        </DataTable>}
        {query.data && items.length > 0 && <ListFooter summary={`${items.length} kết quả`} />}
      </div>
    </Panel>
  </CatalogFrame>
}
