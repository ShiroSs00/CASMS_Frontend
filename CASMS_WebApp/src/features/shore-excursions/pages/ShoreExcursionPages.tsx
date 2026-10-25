import { PermissionLink as Link } from '@/shared/ui'
import { TechnicalDetails } from '@/shared/ui'
import { useCallback, type FormEvent } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import { ApiError, useReadQuery } from '@/shared/api'
import { useSessionAccess } from '@/shared/auth'
import { Button, ButtonLink, DataTable, Empty, Loading, Notice, PageHeader, Panel } from '@/shared/ui'
import { shoreExcursionApi } from '../api/shore-excursion-api'
import { excursionContextApi } from '../api/excursion-context-api'
import { ExcursionActions, ExcursionAvailability } from '../components/ExcursionActions'
import { ExcursionForm } from '../components/ExcursionForm'
import { ExcursionBadge, ShoreError, ShoreLayout } from '../components/ShoreUI'
import styles from '../components/ShoreExcursions.module.css'
import { useShoreMutation, useShoreRequest } from '../hooks/useShoreRequest'
import { canEditExcursion, displayTime, excursionStatuses, isUuid, statusLabels, type ExcursionRequest, type ShoreExcursion } from '../model/shore-excursion'

const root = '/admin/shore-excursions'
export function ShoreExcursionListPage() {
  const access = useSessionAccess()
  const stops = useReadQuery('excursion-filter-stops', excursionContextApi.stops)
  const suppliers = useReadQuery('excursion-filter-suppliers', excursionContextApi.suppliers)
  const [search, setSearch] = useSearchParams()
  const cruiseStopId = search.get('cruiseStopId')?.trim() || undefined
  const supplierId = search.get('supplierId')?.trim() || undefined
  const rawStatus = search.get('status') || undefined
  const load = useCallback((signal: AbortSignal) => {
    const status = excursionStatuses.find((item) => item === rawStatus)
    if ((rawStatus && !status) || (supplierId && !isUuid(supplierId)) || (cruiseStopId && !isUuid(cruiseStopId))) throw new ApiError('Kiểm tra trạng thái và ID UUID trong bộ lọc.', 0)
    return shoreExcursionApi.list({ cruiseStopId, supplierId, status }, signal)
  }, [cruiseStopId, supplierId, rawStatus])
  const query = useShoreRequest(load)
  function filter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const values = new FormData(event.currentTarget), next = new URLSearchParams()
    for (const key of ['cruiseStopId', 'supplierId', 'status']) { const value = String(values.get(key) ?? '').trim(); if (value) next.set(key, value) }
    setSearch(next)
  }
  return <ShoreLayout>
    <PageHeader breadcrumb="Dịch vụ bờ" title="Chuyến tham quan bờ" description="Quản lý chuyến tham quan theo điểm dừng, nhà cung cấp và trạng thái." actions={access.canDo("EXCURSION_CREATE") && <ButtonLink to={`${root}/new`}>Tạo chuyến tham quan</ButtonLink>} />
    <Panel title="Bộ lọc">
      <form key={search.toString()} onSubmit={filter}>
        <div className={styles.filters}>
          <label>Điểm dừng<select key={`${cruiseStopId}:${stops.data?.length}`} name="cruiseStopId" defaultValue={cruiseStopId} disabled={stops.loading || Boolean(stops.error)}><option value="">Tất cả điểm dừng</option>{stops.data?.map(item => <option key={item.cruiseStopId} value={item.cruiseStopId}>{item.label}</option>)}</select></label>
          <label>Nhà cung cấp<select key={`${supplierId}:${suppliers.data?.length}`} name="supplierId" defaultValue={supplierId} disabled={suppliers.loading || Boolean(suppliers.error)}><option value="">Tất cả nhà cung cấp</option>{suppliers.data?.map(item => <option key={item.supplierId} value={item.supplierId}>{item.supplierName}</option>)}</select></label>
          <label>Trạng thái<select name="status" defaultValue={rawStatus ?? ''}><option value="">Tất cả</option>{excursionStatuses.map((value) => <option key={value} value={value}>{statusLabels[value]}</option>)}</select></label>
        </div>
        <div className={styles.actions}><Button type="submit">Áp dụng bộ lọc</Button><Button tone="secondary" onClick={() => setSearch({})}>Xóa bộ lọc</Button><Button tone="secondary" onClick={query.reload}>Tải lại</Button></div>
      </form>
    </Panel>
    {[stops, suppliers].map((lookup, index) => lookup.error && <Notice key={index} title="Chưa tải được tên trong bộ lọc" tone="warning">{lookup.error.message}<Button onClick={lookup.retry}>Thử lại danh mục</Button></Notice>)}
    {query.loading ? <Loading label="Đang tải chuyến tham quan…" /> : query.error != null ? <ShoreError error={query.error} onRetry={query.reload} /> : query.data && <Panel title={`Danh sách · ${query.data.length}`}>
      {!query.data.length ? <Empty title="Chưa có chuyến tham quan phù hợp" /> : <DataTable label="Danh sách chuyến tham quan bờ" headers={['Mã / tên', 'Nhà cung cấp', 'Bắt đầu', 'Trở về dự kiến', 'Chỗ còn lại', 'Trạng thái']}>
        {query.data.map((item) => <tr key={item.shoreExcursionId}><td><Link className={styles.link} to={`${root}/${item.shoreExcursionId}`}>{item.excursionName}</Link><div>{item.excursionCode ?? '—'}</div></td><td>{item.supplierName}</td><td>{displayTime(item.startTime)}</td><td>{displayTime(item.plannedReturnTime)}</td><td>{item.availableCapacity} / {item.maximumCapacity}</td><td><ExcursionBadge status={item.status} /></td></tr>)}
      </DataTable>}
    </Panel>}
  </ShoreLayout>
}

export function ShoreExcursionDetailPage() {
  const { excursionId = '' } = useParams()
  return <ExcursionDetail key={excursionId} id={excursionId} />
}
function ExcursionDetail({ id }: { id: string }) {
  const access = useSessionAccess()
  const load = useCallback((signal: AbortSignal) => shoreExcursionApi.get(id, signal), [id])
  const query = useShoreRequest(load), item = query.data
  return <ShoreLayout>
    <Link className={styles.link} to={root}>← Chuyến tham quan bờ</Link>
    {query.loading ? <Loading label="Đang tải chi tiết…" /> : query.error != null ? <ShoreError error={query.error} onRetry={query.reload} /> : item && <>
      <PageHeader breadcrumb="Dịch vụ bờ / Chuyến tham quan" title={item.excursionName} description={item.excursionCode ?? 'Chưa có mã chuyến tham quan'} actions={<div className={styles.detailToolbar}>
        <div className={styles.recordStatus}><span>Trạng thái</span><ExcursionBadge status={item.status} /></div>
        <ExcursionActions excursion={item} onRefresh={query.reload}>
          {canEditExcursion(item.status) && access.canDo('EXCURSION_UPDATE') && <ButtonLink tone="secondary" to={`${root}/${id}/edit`}>Chỉnh sửa</ButtonLink>}
          <Button tone="secondary" onClick={query.reload}>Tải lại</Button>
        </ExcursionActions>
      </div>} />
      <ExcursionFacts item={item} />
      <Panel title="Thông tin liên quan"><nav className={styles.relatedLinks} aria-label="Thông tin liên quan chuyến tham quan">
        <ButtonLink tone="secondary" to={`/admin/suppliers/${item.supplierId}`}>Xem nhà cung cấp</ButtonLink>
        <ButtonLink tone="secondary" to={`/admin/tour-groups?excursionId=${item.shoreExcursionId}`}>Các nhóm tham quan</ButtonLink>
        {(access.canDo('ACTIVITY_ATTENDANCE') || access.canDo('ACTIVITY_REGISTRATION')) && <ButtonLink tone="secondary" to={`/admin/activity-registrations?excursionId=${encodeURIComponent(id)}`}>Đăng ký & điểm danh hành khách</ButtonLink>}
      </nav></Panel>
      <ExcursionAvailability excursion={item} />
    </>}
  </ShoreLayout>
}
function ExcursionFacts({ item }: { item: ShoreExcursion }) {
  const facts: [string, string | number][] = [
    ['Mã chuyến tham quan', item.excursionCode ?? 'Chưa có mã'], ['Nhà cung cấp', item.supplierName],
    ['Bắt đầu', displayTime(item.startTime)], ['Trở về dự kiến', displayTime(item.plannedReturnTime)], ['Điểm tập trung', item.meetingPoint],
    ['Số khách tối thiểu', item.minimumParticipants ?? 'Chưa đặt'], ['Sức chứa tối đa', item.maximumCapacity], ['Đã đăng ký', item.registeredParticipants], ['Chỗ còn lại', item.availableCapacity],
    ['Giá', item.price === null ? 'Chưa đặt' : `${item.price.toLocaleString('vi-VN')}${item.currencyCode ? ` ${item.currencyCode}` : ''}`],
    ['Lý do hủy', item.cancellationReason ?? '—'], ['Ngày tạo', displayTime(item.createdAt)], ['Cập nhật', displayTime(item.updatedAt)],
  ]
  return <Panel title="Thông tin chuyến tham quan"><dl className={styles.facts}>{facts.map(([label, value]) => <div key={label} style={{ display: 'contents' }}><dt>{label}</dt><dd>{value}</dd></div>)}</dl><TechnicalDetails entries={[["Chuyến tham quan", item.shoreExcursionId], ["Điểm dừng", item.cruiseStopId], ["Nhà cung cấp", item.supplierId]]} /></Panel>
}

export function ShoreExcursionFormPage() {
  const { excursionId } = useParams()
  return <ShoreLayout><Link className={styles.link} to={root}>← Chuyến tham quan bờ</Link><PageHeader breadcrumb="Dịch vụ bờ / Chuyến tham quan" title={excursionId ? 'Chỉnh sửa chuyến tham quan' : 'Tạo chuyến tham quan'} description="Lưu thông tin chuyến tham quan và kiểm tra điều kiện từ hệ thống." />{excursionId ? <EditExcursion key={excursionId} id={excursionId} /> : <SaveExcursion />}</ShoreLayout>
}
function EditExcursion({ id }: { id: string }) {
  const load = useCallback((signal: AbortSignal) => shoreExcursionApi.get(id, signal), [id])
  const query = useShoreRequest(load)
  if (query.loading) return <Loading label="Đang tải biểu mẫu…" />
  if (query.error != null) return <ShoreError error={query.error} onRetry={query.reload} />
  if (!query.data) return null
  if (!canEditExcursion(query.data.status)) return <Notice title="Không thể chỉnh sửa">Chuyến tham quan ở trạng thái {statusLabels[query.data.status]}. <Link to={`${root}/${id}`}>Xem chi tiết</Link></Notice>
  return <SaveExcursion initial={query.data} />
}
function SaveExcursion({ initial }: { initial?: ShoreExcursion }) {
  const access = useSessionAccess()
  const navigate = useNavigate(), mutation = useShoreMutation()
  async function save(request: ExcursionRequest) {
    if (!access.canDo(initial ? 'EXCURSION_UPDATE' : 'EXCURSION_CREATE')) return
    const result = await mutation.run((signal) => initial ? shoreExcursionApi.update(initial.shoreExcursionId, request, signal) : shoreExcursionApi.create(request, signal))
    if (result.ok) navigate(`${root}/${result.value.shoreExcursionId}`)
  }
  return <Panel title="Thông tin chuyến tham quan">{mutation.error != null && <ShoreError error={mutation.error} />}<ExcursionForm initial={initial} busy={mutation.busy} onSave={save} /></Panel>
}
