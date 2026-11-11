import { PermissionLink as Link } from '@/shared/ui'
import { useCallback, useState } from 'react'

import { useReadQuery } from '@/shared/api'
import { useSessionAccess } from '@/shared/auth'
import { Badge, Button, ButtonLink, CollectionSummary, DataTable, Empty, Field, ListFilters, ListFooter, Modal, PageHeader, Panel } from '@/shared/ui'
import { servicePackageApi } from '../api/service-package-api'
import { CatalogFrame, CatalogState } from '../components/CatalogUI'
import { catalogTime, catalogConfig, statusLabels, type CatalogKind } from '../model/catalog'

import styles from '../components/Catalog.module.css'
import { catalogPermission, productTypes } from '../model/catalog-editor'
import { CatalogDetail } from './CatalogDetailPage'
function CatalogList({ kind }: { kind: CatalogKind }) {
  const access = useSessionAccess()
  const config = catalogConfig[kind], query = useReadQuery(kind, useCallback(signal => servicePackageApi.list(kind, signal), [kind]))
  const [search, setSearch] = useState(''), [status, setStatus] = useState('')
  const items = query.data?.filter(item => (!status || item.status === status) && `${item.name} ${item.code}`.toLocaleLowerCase('vi').includes(search.toLocaleLowerCase('vi'))) ?? []
  const [selected, setSelected] = useState<{id:string;name:string}|null>(null)
  const statuses = [...new Set(query.data?.map(item => item.status) ?? [])]
  return <CatalogFrame><PageHeader breadcrumb="DỊCH VỤ TÀU" title={kind === 'packages' ? 'Danh mục gói dịch vụ' : config.label} description={kind === 'packages' ? 'Quản lý gói dịch vụ dùng chung. Để cấu hình gói du thuyền hoặc dịch vụ mua thêm cho một chuyến, mở chuyến đó trong mục Chuẩn bị cho chuyến.' : kind === 'products' ? 'Quản lý mặt hàng bán riêng trên tàu, ví dụ quà lưu niệm. Hạng cabin và quyền lợi nằm trong Mẫu gói du thuyền.' : undefined} actions={access.canDo(catalogPermission(kind, 'create')) && <ButtonLink to={`${config.route}/new`}>Tạo {config.label.toLocaleLowerCase('vi')}</ButtonLink>} />
    <CollectionSummary count={query.loading || query.error ? null : query.data?.length ?? null} visible={items.length} filtered={Boolean(search || status)} label={`${config.label} đã tải`} />
    <Panel title="Bộ lọc"><ListFilters label="Bộ lọc danh mục" actions={<Button tone="secondary" disabled={!search && !status} onClick={() => { setSearch(''); setStatus('') }}>Xóa bộ lọc</Button>}>
      <Field htmlFor="catalog-search" label="Tên hoặc mã"><input id="catalog-search" type="search" placeholder="Nhập tên hoặc mã" value={search} onChange={event => setSearch(event.target.value)} /></Field>
      <Field htmlFor="catalog-status" label="Trạng thái"><select id="catalog-status" value={status} onChange={event => setStatus(event.target.value)}><option value="">Tất cả trạng thái</option>{statuses.map(value => <option key={value} value={value}>{statusLabels[value] ?? value}</option>)}</select></Field>
    </ListFilters></Panel>
    <Panel title={`Danh sách ${config.label.toLocaleLowerCase('vi')}`}><CatalogState {...query} />{query.data && !items.length && <Empty title={query.data.length ? 'Không có kết quả phù hợp' : `Chưa có ${config.label.toLocaleLowerCase('vi')}`} />}{query.data && items.length > 0 && <DataTable label={`Danh sách ${config.label.toLocaleLowerCase('vi')}`} headers={['Tên / mã', 'Loại', 'Giá', 'Trạng thái', '']}>{items.map(item => <tr key={item.id}><td><span className={styles.recordName}>{item.name}</span><span className={styles.recordCode}>{item.code}</span></td><td>{kind === 'products' ? productTypes[item.type] ?? item.type : item.type}</td><td>{item.price == null ? 'Chưa cấu hình' : `${item.price.toLocaleString('vi-VN')} ${item.currency ?? ''}`}</td><td><Badge label={statusLabels[item.status] ?? item.status} tone={['ACTIVE', 'COMPLETED', 'AVAILABLE'].includes(item.status) ? 'success' : ['REJECTED', 'CANCELLED'].includes(item.status) ? 'error' : item.status === 'IN_PROGRESS' ? 'info' : 'neutral'} /></td><td><Button tone="secondary" size="compact" autoWidth onClick={() => setSelected({id:item.id,name:item.name})}>Xem chi tiết</Button></td></tr>)}</DataTable>}{query.data && <ListFooter summary={`${items.length} kết quả`} />}</Panel>
  {selected && <Modal title={selected.name} large protectChanges={false} onClose={() => setSelected(null)} footer={<Button tone="secondary" onClick={() => setSelected(null)}>Đóng</Button>}><div className={styles.stack}><CatalogDetail kind={kind} recordId={selected.id} embedded /></div></Modal>}</CatalogFrame>
}
export function ServiceListPage() { return <CatalogList kind="services" /> }
export function ProductListPage() { return <CatalogList kind="products" /> }
export function PackageListPage() { return <CatalogList kind="packages" /> }
function requestSearchText(value: string) {
  return value.trim().toLocaleLowerCase('vi').normalize('NFD').replace(/\p{M}/gu, '').replaceAll('đ', 'd')
}

export function ServiceRequestListPage() {
  const access = useSessionAccess()
  const query = useReadQuery('service-requests', servicePackageApi.requests), [search, setSearch] = useState(''), [status, setStatus] = useState('')
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
  return <CatalogFrame><PageHeader breadcrumb="DỊCH VỤ TÀU" title="Yêu cầu dịch vụ"  actions={access.roles.includes('PASSENGER') && access.canDo('SERVICE_REQUEST_CREATE') && <ButtonLink to="/admin/service-requests/new">Tạo yêu cầu dịch vụ</ButtonLink>} />
    <CollectionSummary count={query.loading || query.error ? null : query.data?.length ?? null} visible={items.length} filtered={Boolean(search || status)} label="Yêu cầu đã tải" />
    <Panel title="Bộ lọc"><ListFilters label="Bộ lọc yêu cầu dịch vụ" actions={<Button tone="secondary" disabled={!search && !status} onClick={() => { setSearch(''); setStatus('') }}>Xóa bộ lọc</Button>}>
      <Field htmlFor="request-search" label="Tìm yêu cầu" hint={canReadServices && !services.error ? "Tên hoặc mã dịch vụ, mã định danh hoặc ghi chú." : "Mã định danh hoặc ghi chú."}><input id="request-search" type="search" value={search} onChange={event => setSearch(event.target.value)} /></Field>
      <Field htmlFor="request-status" label="Trạng thái"><select id="request-status" value={status} onChange={event => setStatus(event.target.value)}><option value="">Tất cả trạng thái</option>{['REQUESTED', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'REJECTED', 'CANCELLED'].map(value => <option key={value} value={value}>{statusLabels[value]}</option>)}</select></Field>
    </ListFilters></Panel>
    <Panel title="Danh sách yêu cầu"><CatalogState {...query} />{query.data && !items.length && <Empty title={query.data.length ? 'Không có kết quả phù hợp' : 'Chưa có yêu cầu dịch vụ'} />}{query.data && items.length > 0 && <DataTable label="Yêu cầu dịch vụ" headers={['Dịch vụ', 'Số lượng', 'Trạng thái', 'Yêu cầu lúc', '']}>
      {items.map(item => <tr key={item.id}><td>{serviceById.get(item.serviceId)?.name ?? 'Dịch vụ'}{canReadServices && <> · <Link to={'/admin/services/' + item.serviceId}>Xem dịch vụ</Link></>}</td><td>{item.quantity}</td><td><Badge label={statusLabels[item.status] ?? item.status} tone={['ACTIVE', 'COMPLETED', 'AVAILABLE'].includes(item.status) ? 'success' : ['REJECTED', 'CANCELLED'].includes(item.status) ? 'error' : item.status === 'IN_PROGRESS' ? 'info' : 'neutral'} /></td><td>{catalogTime(item.requestTime)}</td><td><Link to={'/admin/service-requests/' + item.id}>Xem yêu cầu</Link></td></tr>)}
    </DataTable>}{query.data && <ListFooter summary={`${items.length} kết quả`} />}</Panel>
  </CatalogFrame>
}
