import { useCallback, useContext } from 'react'
import { Link, useParams } from 'react-router'
import { useReadQuery } from '@/shared/api'
import { useSessionAccess } from '@/shared/auth'
import { ButtonLink, Empty, Notice, PageHeader, Panel } from '@/shared/ui'
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
  const query = useReadQuery('package-benefits:' + id, useCallback(signal => servicePackageApi.benefits(id, signal), [id]))
  return <Panel title="Thành phần & quyền lợi"><CatalogState {...query} />{query.data && <>
    {!query.data.services.length && !query.data.activities.length && !query.data.excursions.length && <Empty title="Gói chưa có thành phần quyền lợi" />}
    <ul className={styles.benefits}>
      {query.data.services.map(item => <li key={'service-' + item.serviceId}><Link to={'/admin/services/' + item.serviceId}>Xem dịch vụ liên kết</Link> · {benefitLabels[item.benefitType] ?? item.benefitType}</li>)}
      {query.data.activities.map(item => <li key={'activity-' + item.activityId}><Link to={'/admin/activities/' + item.activityId}>Xem hoạt động liên kết</Link> · {benefitLabels[item.benefitType] ?? item.benefitType}</li>)}
      {query.data.excursions.map(item => <li key={'excursion-' + item.excursionId}><Link to={'/admin/shore-excursions/' + item.excursionId}>Xem tham quan bờ liên kết</Link> · {benefitLabels[item.benefitType] ?? item.benefitType}</li>)}
    </ul><p>Quyền lợi được xác định theo từng thành phần của gói; không mặc định bao gồm mọi dịch vụ trên tàu.</p>
  </>}</Panel>
}
function CatalogDetail({ kind }: { kind: CatalogKind }) {
  const { id = '' } = useParams(), config = catalogConfig[kind]
  const roles=useContext(AdminRoleContext)
  const access=useSessionAccess()
  const back=canRoleOpenAdminPath(roles,config.route,'',access)?config.route:staffRoleHome(roles)??'/admin'
  const query = useReadQuery(kind + ':' + id, useCallback(signal => servicePackageApi.get(kind, id, signal), [kind, id]))
  const item = query.data
  return <CatalogFrame><PageHeader breadcrumb={'DỊCH VỤ TÀU / ' + config.label.toLocaleUpperCase('vi')} title={item?.name ?? 'Chi tiết ' + config.label.toLocaleLowerCase('vi')} description="Thông tin cung cấp, giá và các quan hệ đã được cấu hình." actions={<ButtonLink tone="secondary" to={back}>Về danh sách</ButtonLink>} /><CatalogState {...query} />
    {item && <><CatalogActions kind={kind} item={item} onChanged={query.retry} /><Panel title="Thông tin chi tiết"><dl className={styles.definition}><dt>Mã</dt><dd>{item.code}</dd><dt>Loại</dt><dd>{item.type}</dd><dt>Trạng thái</dt><dd>{statusLabels[item.status] ?? item.status}</dd><dt>Giá</dt><dd>{item.price == null ? 'Chưa cấu hình' : `${item.price} ${item.currency ?? ''}`}</dd>{kind === 'services' && <><dt>Sức chứa cấu hình</dt><dd>{item.capacity ?? 'Không có thông tin'}</dd></>}{kind === 'packages' && <><dt>Thời hạn sử dụng</dt><dd>{item.startDate ?? 'Chưa xác định'} → {item.endDate ?? 'Chưa xác định'}</dd></>}<dt>Mô tả</dt><dd>{item.description || 'Chưa có mô tả'}</dd></dl></Panel>
      {kind === 'packages' && <PackageBenefitsEditor packageId={item.id} status={item.status} onChanged={query.retry} />}
      {kind === 'services' && <ServiceAvailability id={item.id} />}{kind === 'packages' && <PackageBenefits id={item.id} />}
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
  return <CatalogFrame><PageHeader breadcrumb="DỊCH VỤ TÀU / YÊU CẦU" title="Chi tiết yêu cầu dịch vụ" description="Số lượng, nội dung yêu cầu và tiến độ xử lý." actions={<ButtonLink tone="secondary" to="/admin/service-requests">Về danh sách yêu cầu</ButtonLink>} /><CatalogState {...query} />
    {request && <><ServiceRequestActions request={request} onChanged={query.retry} /><Panel title="Thông tin yêu cầu"><dl className={styles.definition}><dt>Trạng thái</dt><dd>{statusLabels[request.status] ?? request.status}</dd><dt>Số lượng</dt><dd>{request.quantity}</dd><dt>Yêu cầu lúc</dt><dd>{catalogTime(request.requestTime)}</dd><dt>Hoàn thành lúc</dt><dd>{catalogTime(request.completedAt)}</dd><dt>Phân công</dt><dd>{request.assignedUserId ? 'Đã phân công nhân viên' : 'Chưa phân công'}</dd><dt>Ghi chú</dt><dd>{request.note || 'Không có ghi chú'}</dd></dl><ButtonLink tone="secondary" to={'/admin/services/' + request.serviceId}>Xem dịch vụ được yêu cầu</ButtonLink>{!request.bookingPassengerId && <Notice title="Chưa liên kết hành khách của đặt chỗ">Yêu cầu hiện chưa có liên kết hành khách thuộc đặt chỗ.</Notice>}</Panel></>}
  </CatalogFrame>
}
