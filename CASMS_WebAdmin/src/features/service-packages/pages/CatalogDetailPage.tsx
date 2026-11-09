import { PermissionLink as Link } from '@/shared/ui'
import { ServiceSchedules } from '../components/ServiceSchedules'
import { Fragment, useCallback, useContext, useState } from 'react'
import { useParams } from 'react-router'
import { apiRequest, useReadQuery } from '@/shared/api'
import { useSessionAccess } from '@/shared/auth'
import { RecordFacts, Badge, ButtonLink, DataTable, Empty, Notice, PageHeader, Panel } from '@/shared/ui'
import { AdminRoleContext, canRoleOpenAdminPath, staffRoleHome } from '@/shared/ui/admin-v3'
import { servicePackageApi } from '../api/service-package-api'
import { CatalogFrame, CatalogState } from '../components/CatalogUI'
import { CatalogActions } from '../components/CatalogActions'
import { PackageBenefitsEditor } from '../components/PackageBenefitsEditor'
import { ServiceRequestActions } from '../components/ServiceRequestActions'
import { benefitLabels, catalogTime, catalogConfig, servicePurchaseFlags, serviceUsagePolicyLabels, statusLabels, type CatalogKind } from '../model/catalog'
import styles from '../components/Catalog.module.css'
function ServiceAvailability({ id, unitCode }: { id: string; unitCode?: string | null }) {
  const query = useReadQuery('service-availability:' + id, useCallback(signal => servicePackageApi.availability(id, signal), [id]))
  return <Panel title="Khả năng đáp ứng"><CatalogState {...query} />{query.data && <p>{query.data.available ? (unitCode ? `Có thể phục vụ ít nhất 1 ${unitCode}.` : 'Dịch vụ còn khả dụng.') : 'Dịch vụ hiện chưa khả dụng.'}</p>}</Panel>
}
function PackageBenefits({ id, showComponents = true }: { id: string; showComponents?: boolean }) {
  const access = useSessionAccess(), canServices = access.canDo('SERVICE_READ')
  const names = useReadQuery(`package-service-names:${id}:${canServices}`, useCallback(signal => canServices ? servicePackageApi.benefitOptions('services', signal) : Promise.resolve([]), [canServices]))
  const categories = useReadQuery(`package-categories:${id}:${canServices}`, useCallback(signal => canServices ? apiRequest<{ id: string; name: string }[]>('/servicepackage/service-categories', { signal }) : Promise.resolve([]), [canServices]))
  const query = useReadQuery('package-benefits:' + id, useCallback(signal => servicePackageApi.benefits(id, signal), [id]))
  if (!showComponents && query.data && !query.data.entitlements?.length) return null
  return <Panel title={showComponents ? 'Thành phần & quyền lợi' : 'Ưu đãi theo nhóm dịch vụ'}><CatalogState {...query} />{query.data && <>
    {showComponents && <>
    {!query.data.services.length && !query.data.activities.length && !query.data.excursions.length && <Empty title="Gói chưa có dịch vụ, hoạt động hoặc tham quan liên kết" />}
    <ul className={styles.benefits}>
      {query.data.services.map(item => <li key={'service-' + item.serviceId}>{canServices ? <Link to={'/admin/services/' + item.serviceId}>{names.data?.find(s => s.id === item.serviceId)?.name ?? 'Dịch vụ liên kết'}</Link> : 'Dịch vụ trong gói'} · {benefitLabels[item.benefitType] ?? item.benefitType}</li>)}
      {query.data.activities.map(item => <li key={'activity-' + item.activityId}><Link to={'/admin/activities/' + item.activityId}>Xem hoạt động liên kết</Link> · {benefitLabels[item.benefitType] ?? item.benefitType}</li>)}
      {query.data.excursions.map(item => <li key={'excursion-' + item.excursionId}><Link to={'/admin/shore-excursions/' + item.excursionId}>Xem tham quan bờ liên kết</Link> · {benefitLabels[item.benefitType] ?? item.benefitType}</li>)}
    </ul></>}{query.data.entitlements && query.data.entitlements.length > 0 && <DataTable label="Ưu đãi theo nhóm dịch vụ" headers={['Nhóm dịch vụ', 'Quyền lợi', 'Định mức', 'Giảm giá']}>
      {query.data.entitlements.map(item => <tr key={item.id}><td>{categories.data?.find(c => c.id === item.categoryId)?.name ?? 'Nhóm dịch vụ trong gói'}</td><td>{benefitLabels[item.benefitType] ?? item.benefitType}</td><td>{item.quantityLimit == null ? 'Chưa có định mức' : `${item.quantityLimit} ${item.unitCode ?? ''}`}</td><td>{item.discountPercent == null ? '—' : `${item.discountPercent}%`}</td></tr>)}
    </DataTable>}
  </>}</Panel>
}
export function CatalogDetail({ kind, recordId, embedded = false }: { kind: CatalogKind; recordId?: string; embedded?: boolean }) {
  const params = useParams(), id = recordId ?? params.id ?? '', config = catalogConfig[kind]
  const Frame = embedded ? Fragment : CatalogFrame
  const [benefitsVersion, setBenefitsVersion] = useState(0)
  const roles=useContext(AdminRoleContext)
  const access=useSessionAccess()
  const back=canRoleOpenAdminPath(roles,config.route,'',access)?config.route:staffRoleHome(roles,access)??'/admin'
  const query = useReadQuery(access.userId + ':' + kind + ':' + id, useCallback(signal => servicePackageApi.get(kind, id, signal), [kind, id]))
  const item = query.data
  return <Frame>{!embedded && <Link className={styles.backLink} to={back}>← {back === config.route ? config.label : 'Về trang quản lý'}</Link>}{!embedded ? <PageHeader breadcrumb={'DỊCH VỤ TÀU / ' + config.label.toLocaleUpperCase('vi')} title={item?.name ?? 'Chi tiết ' + config.label.toLocaleLowerCase('vi')}  actions={item && <div className={styles.detailToolbar}><div className={styles.recordStatus}><span>Trạng thái</span><Badge label={statusLabels[item.status] ?? item.status} tone={item.status === 'ACTIVE' ? 'success' : 'neutral'} /></div><CatalogActions kind={kind} item={item} onChanged={query.retry} /></div>} /> : item && <div className={styles.detailToolbar}><Badge label={statusLabels[item.status] ?? item.status} tone={item.status === 'ACTIVE' ? 'success' : 'neutral'} /><CatalogActions kind={kind} item={item} onChanged={query.retry} /></div>}<CatalogState {...query} />
    {item && <><Panel title="Thông tin chi tiết"><RecordFacts entries={[
      ['Mã', item.code], ['Loại', item.type],
      ['Giá', item.price == null ? 'Chưa cấu hình' : `${item.price.toLocaleString('vi-VN')} ${item.currency ?? ''}`],
      ...(kind === 'services' ? [['Sức chứa cấu hình', item.capacity ?? 'Chưa cấu hình'] as const,['Lịch đặt trước',item.requiresSchedule===true?'Bắt buộc':item.requiresSchedule===false?'Không bắt buộc':'Chưa xác định'] as const,['Nhóm dịch vụ',item.categoryName??'Chưa chọn nhóm'] as const,['Đơn vị phục vụ',item.unitCode??'Chưa cấu hình'] as const] : []),
      ...(kind === 'services' ? [
        ...(Object.keys(servicePurchaseFlags) as (keyof typeof servicePurchaseFlags)[]).map(key =>
          [servicePurchaseFlags[key], item[key] == null ? 'Chưa xác định' : item[key] ? 'Có' : 'Không'] as const),
        ['Định mức trước chuyến', item.preCruiseUsagePolicy ? serviceUsagePolicyLabels[item.preCruiseUsagePolicy] : 'Chưa xác định'] as const,
        ['Số lượng tối đa', item.preCruiseUsageLimit ?? '—'] as const,
        ['Múi giờ tính định mức', item.usageTimeZone ?? 'Chưa cấu hình'] as const,
      ] : []),
      ...(kind === 'packages' ? [['Thời hạn sử dụng', `${item.startDate ?? 'Chưa xác định'} → ${item.endDate ?? 'Chưa xác định'}`] as const] : []),
      ['Mô tả', item.description || 'Chưa có mô tả'],
    ]} /></Panel>
      {kind === 'packages' && access.can({mode:'ANY',permissions:['TOUR_PACKAGE_MANAGE','PACKAGE_COMPONENT_MANAGE']}) && <PackageBenefitsEditor key={item.id} packageId={item.id} status={item.status} onChanged={() => setBenefitsVersion(version => version + 1)} />}
      {kind === 'services' && <><ServiceAvailability id={item.id} unitCode={item.unitCode} /><ServiceSchedules key={item.id} serviceId={item.id} /></>}{kind === 'packages' && <PackageBenefits key={`${item.id}:${benefitsVersion}`} id={item.id} showComponents={!access.can({mode:'ANY',permissions:['TOUR_PACKAGE_MANAGE','PACKAGE_COMPONENT_MANAGE']})} />}
    </>}
  </Frame>
}
export function ServiceDetailPage() { return <CatalogDetail kind="services" /> }
export function ProductDetailPage() { return <CatalogDetail kind="products" /> }
export function PackageDetailPage() { return <CatalogDetail kind="packages" /> }
export function ServiceRequestDetailPage() {
  const { id = '' } = useParams()
  const query = useReadQuery('service-request:' + id, useCallback(signal => servicePackageApi.request(id, signal), [id]))
  const request = query.data
  return <CatalogFrame><Link className={styles.backLink} to="/admin/service-requests">← Yêu cầu dịch vụ</Link><PageHeader breadcrumb="DỊCH VỤ TÀU / YÊU CẦU" title="Chi tiết yêu cầu dịch vụ"  /><CatalogState {...query} />
    {request && <><ServiceRequestActions key={request.id} request={request} onChanged={query.retry} /><Panel title="Thông tin yêu cầu"><RecordFacts entries={[
      ['Trạng thái', statusLabels[request.status] ?? request.status], ['Số lượng', request.quantity],
      ['Giá tham chiếu danh mục', request.unitPriceSnapshot != null && request.currencySnapshot ? `${request.unitPriceSnapshot} ${request.currencySnapshot}` : 'Chưa ghi nhận'],
      ['Kênh sử dụng', request.usageMode === 'PRE_CRUISE' ? 'Trước chuyến' : request.usageMode === 'ONBOARD' ? 'Trên tàu' : 'Yêu cầu cũ'],
      ['Quyền lợi trong gói', request.fareBenefitSnapshotId ? 'Đã liên kết quyền lợi gói du thuyền' : 'Chưa ghi nhận quyền lợi gói du thuyền'],
      ['Đã phục vụ', request.fulfilledQuantity == null ? 'Chưa ghi nhận' : `${request.fulfilledQuantity} ${request.fulfillmentUnitCode ?? ''}`],
      ['Định mức tại thời điểm yêu cầu', request.usagePolicySnapshot ? `${serviceUsagePolicyLabels[request.usagePolicySnapshot]}${request.usageLimitSnapshot == null ? '' : ` · ${request.usageLimitSnapshot}`}${request.usageTimeZoneSnapshot ? ` · ${request.usageTimeZoneSnapshot}` : ''}` : 'Chưa ghi nhận'],
      ['Đặt theo lịch', request.scheduleId ? 'Đã chọn khung giờ khi đặt' : 'Không có khung giờ liên kết'],
      ['Yêu cầu lúc', catalogTime(request.requestTime)], ['Hoàn thành lúc', catalogTime(request.completedAt)],
      ['Phân công', request.assignedUserId ? 'Đã phân công nhân viên' : 'Chưa phân công'], ['Ghi chú', request.note || 'Không có ghi chú'],
    ]} /><ButtonLink tone="secondary" to={'/admin/services/' + request.serviceId}>Xem dịch vụ được yêu cầu</ButtonLink>{!request.bookingPassengerId && <Notice title="Chưa liên kết hành khách của đặt chỗ">Yêu cầu hiện chưa có liên kết hành khách thuộc đặt chỗ.</Notice>}</Panel></>}
  </CatalogFrame>
}
