import { ServiceSchedules } from '../components/ServiceSchedules'
import { useCallback, useContext } from 'react'
import { Link, useParams } from 'react-router'
import { apiRequest, useReadQuery } from '@/shared/api'
import { useSessionAccess } from '@/shared/auth'
import { Badge, ButtonLink, DataTable, Empty, Notice, PageHeader, Panel } from '@/shared/ui'
import { AdminRoleContext, canRoleOpenAdminPath, staffRoleHome } from '@/shared/ui/admin-v3'
import { servicePackageApi } from '../api/service-package-api'
import { CatalogFrame, CatalogState } from '../components/CatalogUI'
import { CatalogActions } from '../components/CatalogActions'
import { PackageBenefitsEditor } from '../components/PackageBenefitsEditor'
import { ServiceRequestActions } from '../components/ServiceRequestActions'
import { benefitLabels, catalogTime, catalogConfig, statusLabels, type CatalogKind } from '../model/catalog'
import styles from '../components/Catalog.module.css'
function ServiceAvailability({ id }: { id: string }) {
  const query = useReadQuery('service-availability:' + id, useCallback(signal => servicePackageApi.availability(id, signal), [id]))
  return <Panel title="Khả năng đáp ứng"><CatalogState {...query} />{query.data && <p>{query.data.available ? 'Dịch vụ đáp ứng được yêu cầu 1 đơn vị.' : 'Dịch vụ hiện chưa đáp ứng được yêu cầu 1 đơn vị.'}</p>}</Panel>
}
function PackageBenefits({ id }: { id: string }) {
  const access = useSessionAccess(), canServices = access.has('SERVICE_READ')
  const names = useReadQuery(`package-service-names:${id}:${canServices}`, useCallback(signal => canServices ? servicePackageApi.benefitOptions('services', signal) : Promise.resolve([]), [canServices]))
  const categories = useReadQuery(`package-categories:${id}:${canServices}`, useCallback(signal => canServices ? apiRequest<{ id: string; name: string }[]>('/servicepackage/service-categories', { signal }) : Promise.resolve([]), [canServices]))
  const query = useReadQuery('package-benefits:' + id, useCallback(signal => servicePackageApi.benefits(id, signal), [id]))
  return <Panel title="Thành phần & quyền lợi"><CatalogState {...query} />{query.data && <>
    {!query.data.services.length && !query.data.activities.length && !query.data.excursions.length && <Empty title="Gói chưa có thành phần quyền lợi" />}
    <ul className={styles.benefits}>
      {query.data.services.map(item => <li key={'service-' + item.serviceId}>{canServices ? <Link to={'/admin/services/' + item.serviceId}>{names.data?.find(s => s.id === item.serviceId)?.name ?? 'Dịch vụ liên kết'}</Link> : 'Dịch vụ trong gói'} · {benefitLabels[item.benefitType] ?? item.benefitType}</li>)}
      {query.data.activities.map(item => <li key={'activity-' + item.activityId}><Link to={'/admin/activities/' + item.activityId}>Xem hoạt động liên kết</Link> · {benefitLabels[item.benefitType] ?? item.benefitType}</li>)}
      {query.data.excursions.map(item => <li key={'excursion-' + item.excursionId}><Link to={'/admin/shore-excursions/' + item.excursionId}>Xem tham quan bờ liên kết</Link> · {benefitLabels[item.benefitType] ?? item.benefitType}</li>)}
    </ul>{query.data.entitlements && query.data.entitlements.length > 0 && <DataTable label="Ưu đãi theo nhóm dịch vụ" headers={['Nhóm dịch vụ', 'Quyền lợi', 'Định mức', 'Giảm giá']}>
      {query.data.entitlements.map(item => <tr key={item.id}><td>{categories.data?.find(c => c.id === item.categoryId)?.name ?? 'Nhóm dịch vụ trong gói'}</td><td>{benefitLabels[item.benefitType] ?? item.benefitType}</td><td>{item.quantityLimit == null ? 'Chưa có định mức' : `${item.quantityLimit} ${item.unitCode ?? ''}`}</td><td>{item.discountPercent == null ? '—' : `${item.discountPercent}%`}</td></tr>)}
    </DataTable>}<p>Quyền lợi được xác định theo từng thành phần của gói; không mặc định bao gồm mọi dịch vụ trên tàu.</p>
  </>}</Panel>
}
function CatalogDetail({ kind }: { kind: CatalogKind }) {
  const { id = '' } = useParams(), config = catalogConfig[kind]
  const roles=useContext(AdminRoleContext)
  const access=useSessionAccess()
  const back=canRoleOpenAdminPath(roles,config.route,'',access)?config.route:staffRoleHome(roles)??'/admin'
  const query = useReadQuery(kind + ':' + id, useCallback(signal => servicePackageApi.get(kind, id, signal), [kind, id]))
  const item = query.data
  return <CatalogFrame><Link className={styles.backLink} to={back}>← {back === config.route ? config.label : 'Về trang quản lý'}</Link><PageHeader breadcrumb={'DỊCH VỤ TÀU / ' + config.label.toLocaleUpperCase('vi')} title={item?.name ?? 'Chi tiết ' + config.label.toLocaleLowerCase('vi')} description="Thông tin cung cấp, giá và các quan hệ đã được cấu hình." actions={item && <div className={styles.detailToolbar}><div className={styles.recordStatus}><span>Trạng thái</span><Badge label={statusLabels[item.status] ?? item.status} tone={item.status === 'ACTIVE' ? 'success' : 'neutral'} /></div><CatalogActions kind={kind} item={item} onChanged={query.retry} /></div>} /><CatalogState {...query} />
    {item && <><Panel title="Thông tin chi tiết"><dl className={styles.definition}><dt>Mã</dt><dd>{item.code}</dd><dt>Loại</dt><dd>{item.type}</dd><dt>Trạng thái</dt><dd>{statusLabels[item.status] ?? item.status}</dd><dt>Giá</dt><dd>{item.price == null ? 'Chưa cấu hình' : `${item.price} ${item.currency ?? ''}`}</dd>{kind === 'services' && <><dt>Sức chứa cấu hình</dt><dd>{item.capacity ?? 'Không có thông tin'}</dd></>}{kind === 'packages' && <><dt>Thời hạn sử dụng</dt><dd>{item.startDate ?? 'Chưa xác định'} → {item.endDate ?? 'Chưa xác định'}</dd></>}<dt>Mô tả</dt><dd>{item.description || 'Chưa có mô tả'}</dd></dl></Panel>
      {kind === 'packages' && <PackageBenefitsEditor packageId={item.id} status={item.status} onChanged={query.retry} />}
      {kind === 'services' && <><ServiceAvailability id={item.id} /><ServiceSchedules key={item.id} serviceId={item.id} /></>}{kind === 'packages' && <PackageBenefits id={item.id} />}
    </>}
  </CatalogFrame>
}
export function ServiceDetailPage() { return <CatalogDetail kind="services" /> }
export function ProductDetailPage() { return <CatalogDetail kind="products" /> }
export function PackageDetailPage() { return <CatalogDetail kind="packages" /> }
export function ServiceRequestDetailPage() {
  const { id = '' } = useParams()
  const query = useReadQuery('service-request:' + id, useCallback(signal => servicePackageApi.request(id, signal), [id]))
  const request = query.data
  return <CatalogFrame><Link className={styles.backLink} to="/admin/service-requests">← Yêu cầu dịch vụ</Link><PageHeader breadcrumb="DỊCH VỤ TÀU / YÊU CẦU" title="Chi tiết yêu cầu dịch vụ" description="Số lượng, nội dung yêu cầu và tiến độ xử lý." /><CatalogState {...query} />
    {request && <><ServiceRequestActions request={request} onChanged={query.retry} /><Panel title="Thông tin yêu cầu"><dl className={styles.definition}><dt>Trạng thái</dt><dd>{statusLabels[request.status] ?? request.status}</dd><dt>Số lượng</dt><dd>{request.quantity}</dd><dt>Yêu cầu lúc</dt><dd>{catalogTime(request.requestTime)}</dd><dt>Hoàn thành lúc</dt><dd>{catalogTime(request.completedAt)}</dd><dt>Phân công</dt><dd>{request.assignedUserId ? 'Đã phân công nhân viên' : 'Chưa phân công'}</dd><dt>Ghi chú</dt><dd>{request.note || 'Không có ghi chú'}</dd></dl><ButtonLink tone="secondary" to={'/admin/services/' + request.serviceId}>Xem dịch vụ được yêu cầu</ButtonLink>{!request.bookingPassengerId && <Notice title="Chưa liên kết hành khách của đặt chỗ">Yêu cầu hiện chưa có liên kết hành khách thuộc đặt chỗ.</Notice>}</Panel></>}
  </CatalogFrame>
}
