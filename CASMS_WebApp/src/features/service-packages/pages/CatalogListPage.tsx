import { useCallback, useState } from 'react'
import { Link } from 'react-router'
import { useReadQuery } from '@/shared/api'
import { useSessionAccess } from '@/shared/auth'
import { Button, ButtonLink, DataTable, Empty, PageHeader, Panel } from '@/shared/ui'
import { servicePackageApi } from '../api/service-package-api'
import { CatalogFrame, CatalogState } from '../components/CatalogUI'
import { catalogTime, catalogConfig, statusLabels, type CatalogKind } from '../model/catalog'
import styles from '../components/Catalog.module.css'
import { catalogPermission } from '../model/catalog-editor'
function CatalogList({ kind }: { kind: CatalogKind }) {
  const access = useSessionAccess()
  const config = catalogConfig[kind], query = useReadQuery(kind, useCallback(signal => servicePackageApi.list(kind, signal), [kind]))
  const [search, setSearch] = useState(''), [status, setStatus] = useState('')
  const items = query.data?.filter(item => (!status || item.status === status) && `${item.name} ${item.code}`.toLocaleLowerCase('vi').includes(search.toLocaleLowerCase('vi'))) ?? []
  const statuses = [...new Set(query.data?.map(item => item.status) ?? [])]
  return <CatalogFrame><PageHeader breadcrumb="DỊCH VỤ TÀU" title={config.label} description={kind === 'packages' ? 'Danh mục gói, thành phần và quyền lợi đã cấu hình.' : `Tra cứu ${config.label.toLocaleLowerCase('vi')}, giá và trạng thái cung cấp.`} actions={access.has(catalogPermission(kind, 'create')) && <ButtonLink to={`${config.route}/new`}>Tạo {config.label.toLocaleLowerCase('vi')}</ButtonLink>} />
    <Panel title="Tìm kiếm & bộ lọc"><div className={styles.filters}><label>Tên hoặc mã<input type="search" value={search} onChange={event => setSearch(event.target.value)} /></label><label>Trạng thái<select value={status} onChange={event => setStatus(event.target.value)}><option value="">Tất cả</option>{statuses.map(value => <option key={value} value={value}>{statusLabels[value] ?? value}</option>)}</select></label><Button tone="secondary" onClick={() => { setSearch(''); setStatus('') }}>Xóa bộ lọc</Button></div></Panel>
    <Panel title={`Danh sách ${config.label.toLocaleLowerCase('vi')}`}><CatalogState {...query} />{query.data && !items.length && <Empty title={query.data.length ? 'Không có kết quả phù hợp' : `Chưa có ${config.label.toLocaleLowerCase('vi')}`} />}{query.data && items.length > 0 && <DataTable label={`Danh sách ${config.label.toLocaleLowerCase('vi')}`} headers={['Tên / mã', 'Loại', 'Giá', 'Trạng thái', '']}>{items.map(item => <tr key={item.id}><td>{item.name}<br />{item.code}</td><td>{item.type}</td><td>{item.price == null ? 'Chưa cấu hình' : `${item.price} ${item.currency ?? ''}`}</td><td>{statusLabels[item.status] ?? item.status}</td><td><Link to={config.route + '/' + item.id}>Xem chi tiết</Link></td></tr>)}</DataTable>}</Panel>
  </CatalogFrame>
}
export function ServiceListPage() { return <CatalogList kind="services" /> }
export function ProductListPage() { return <CatalogList kind="products" /> }
export function PackageListPage() { return <CatalogList kind="packages" /> }
export function ServiceRequestListPage() {
  const access = useSessionAccess()
  const query = useReadQuery('service-requests', servicePackageApi.requests), [search, setSearch] = useState(''), [status, setStatus] = useState('')
  const items = query.data?.filter(item => (!status || item.status === status) && (item.note ?? '').toLocaleLowerCase('vi').includes(search.toLocaleLowerCase('vi'))) ?? []
  return <CatalogFrame><PageHeader breadcrumb="DỊCH VỤ TÀU" title="Yêu cầu dịch vụ" description="Theo dõi các yêu cầu, số lượng, phân công và tiến độ thực hiện." actions={access.has('SERVICE_REQUEST_CREATE') && <ButtonLink to="/admin/service-requests/new">Tạo yêu cầu dịch vụ</ButtonLink>} />
    <Panel title="Tìm kiếm & bộ lọc"><div className={styles.filters}><label>Nội dung ghi chú<input type="search" value={search} onChange={event => setSearch(event.target.value)} /></label><label>Trạng thái<select value={status} onChange={event => setStatus(event.target.value)}><option value="">Tất cả</option>{['REQUESTED', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'REJECTED', 'CANCELLED'].map(value => <option key={value} value={value}>{statusLabels[value]}</option>)}</select></label><Button tone="secondary" onClick={() => { setSearch(''); setStatus('') }}>Xóa bộ lọc</Button></div></Panel>
    <Panel title="Danh sách yêu cầu"><CatalogState {...query} />{query.data && !items.length && <Empty title={query.data.length ? 'Không có kết quả phù hợp' : 'Chưa có yêu cầu dịch vụ'} />}{query.data && items.length > 0 && <DataTable label="Yêu cầu dịch vụ" headers={['Dịch vụ', 'Số lượng', 'Trạng thái', 'Yêu cầu lúc', '']}>
      {items.map(item => <tr key={item.id}><td><Link to={'/admin/services/' + item.serviceId}>Xem dịch vụ</Link></td><td>{item.quantity}</td><td>{statusLabels[item.status] ?? item.status}</td><td>{catalogTime(item.requestTime)}</td><td><Link to={'/admin/service-requests/' + item.id}>Xem yêu cầu</Link></td></tr>)}
    </DataTable>}</Panel>
  </CatalogFrame>
}
