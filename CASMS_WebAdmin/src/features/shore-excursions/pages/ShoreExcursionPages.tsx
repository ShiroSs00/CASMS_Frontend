import { PermissionLink as Link } from '@/shared/ui'
import { TechnicalDetails, RecordFacts } from '@/shared/ui'
import { useCallback, useState, type FormEvent } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import {cruiseContextReturn} from '@/shared/lib/cruise-context'
import { ApiError, useReadQuery } from '@/shared/api'
import { useSessionAccess } from '@/shared/auth'
import { Button, ButtonLink, DataTable, Empty, Field, Loading, Modal, Notice, PageHeader, Panel } from '@/shared/ui'
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
  const canReadSuppliers = access.has('SUPPLIER_READ')
  const stops = useReadQuery('excursion-filter-stops', excursionContextApi.stops)
  const suppliers = useReadQuery(
    `excursion-filter-suppliers:${canReadSuppliers}`,
    useCallback((signal: AbortSignal) => canReadSuppliers ? excursionContextApi.suppliers(signal) : Promise.resolve([]), [canReadSuppliers]),
  )
  const [search, setSearch] = useSearchParams()
  const keyword = search.get('q')?.trim() || ''
  const cruiseStopId = search.get('cruiseStopId')?.trim() || undefined
  const supplierId = search.get('supplierId')?.trim() || undefined
  const rawStatus = search.get('status') || undefined
  const load = useCallback((signal: AbortSignal) => {
    const status = excursionStatuses.find((item) => item === rawStatus)
    if ((rawStatus && !status) || (supplierId && !isUuid(supplierId)) || (cruiseStopId && !isUuid(cruiseStopId))) throw new ApiError('Bộ lọc chưa hợp lệ. Vui lòng chọn lại giá trị trong danh sách.', 0)
    return shoreExcursionApi.list({ cruiseStopId, supplierId, status }, signal)
  }, [cruiseStopId, supplierId, rawStatus])
  const query = useShoreRequest(load)
  const normalizedKeyword = keyword.toLocaleLowerCase('vi')
  const visibleItems = (query.data ?? []).filter(item =>
    !normalizedKeyword || [item.excursionName, item.excursionCode ?? '', item.supplierName]
      .some(value => value.toLocaleLowerCase('vi').includes(normalizedKeyword)),
  )
  function filter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const values = new FormData(event.currentTarget), next = new URLSearchParams()
    for (const key of ['q', 'cruiseStopId', 'supplierId', 'status']) { const value = String(values.get(key) ?? '').trim(); if (value) next.set(key, value) }
    setSearch(next)
  }
  const hasFilters = Boolean(keyword || cruiseStopId || supplierId || rawStatus)
  return <ShoreLayout>
    <PageHeader breadcrumb="Dịch vụ bờ" title="Chuyến tham quan bờ" actions={access.canDo("EXCURSION_CREATE") && <ButtonLink to={`${root}/new`}>+ Tạo tour bờ</ButtonLink>} />
    {[stops, suppliers].map((lookup, index) => lookup.error && <Notice key={index} title="Chưa tải được danh mục lọc" tone="warning"><p>{lookup.error.message}</p><Button tone="secondary" size="compact" autoWidth onClick={lookup.retry}>Thử lại</Button></Notice>)}
    <Panel>
      <div style={{ display: 'grid', gap: '16px' }}>
        <form key={search.toString()} noValidate onSubmit={filter}>
          <div className={styles.filters} style={{ alignItems: 'end' }}>
            <Field htmlFor="excursion-filter-q" label="Tìm kiếm">
              <input id="excursion-filter-q" name="q" type="search" defaultValue={keyword} placeholder="Tên tour, mã tour hoặc nhà cung cấp…" />
            </Field>
            <Field htmlFor="excursion-filter-stop" label="Điểm dừng">
              <select id="excursion-filter-stop" key={`${cruiseStopId}:${stops.data?.length}`} name="cruiseStopId" defaultValue={cruiseStopId} disabled={stops.loading || Boolean(stops.error)}><option value="">Tất cả điểm dừng</option>{stops.data?.map(item => <option key={item.cruiseStopId} value={item.cruiseStopId}>{item.label}</option>)}</select>
            </Field>
            {canReadSuppliers && (
              <Field htmlFor="excursion-filter-supplier" label="Nhà cung cấp">
                <select id="excursion-filter-supplier" key={`${supplierId}:${suppliers.data?.length}`} name="supplierId" defaultValue={supplierId} disabled={suppliers.loading || Boolean(suppliers.error)}><option value="">Tất cả nhà cung cấp</option>{suppliers.data?.map(item => <option key={item.supplierId} value={item.supplierId}>{item.supplierName}</option>)}</select>
              </Field>
            )}
            <Field htmlFor="excursion-filter-status" label="Trạng thái">
              <select id="excursion-filter-status" name="status" defaultValue={rawStatus ?? ''}><option value="">Tất cả</option>{excursionStatuses.map((value) => <option key={value} value={value}>{statusLabels[value]}</option>)}</select>
            </Field>
            <div className={styles.actions}>
              <Button type="submit" autoWidth>Lọc</Button>
              {hasFilters && <Button tone="secondary" autoWidth onClick={() => setSearch({})}>Xóa lọc</Button>}
            </div>
          </div>
        </form>
        {query.loading ? <Loading label="Đang tải chuyến tham quan…" /> : query.error != null ? <ShoreError error={query.error} onRetry={query.reload} /> : query.data && (
          !visibleItems.length ? <Empty title="Chưa có chuyến tham quan phù hợp" /> : <DataTable label="Danh sách chuyến tham quan bờ" headers={['Mã / tên', 'Nhà cung cấp', 'Bắt đầu', 'Trở về dự kiến', 'Chỗ còn lại', 'Trạng thái']}>
            {[...visibleItems].sort((a, b) => (Date.parse(b.createdAt ?? b.startTime) || 0) - (Date.parse(a.createdAt ?? a.startTime) || 0)).map((item) => <tr key={item.shoreExcursionId}><td><Link className={styles.link} to={`${root}/${item.shoreExcursionId}`}>{item.excursionName}</Link><div>{item.excursionCode ?? '—'}</div></td><td>{item.supplierName}</td><td>{displayTime(item.startTime)}</td><td>{displayTime(item.plannedReturnTime)}</td><td>{item.availableCapacity} / {item.maximumCapacity}</td><td><ExcursionBadge status={item.status} /></td></tr>)}
          </DataTable>
        )}
      </div>
    </Panel>
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
  const canLinkDestination = Boolean(item && !item.cruiseStopId && access.roles.includes('ACTIVITY_SERVICE_MANAGER') && access.canDo('EXCURSION_UPDATE'))
  const [destOpen, setDestOpen] = useState(false)
  const [destId, setDestId] = useState('')
  const [destBusy, setDestBusy] = useState(false)
  const [destError, setDestError] = useState('')
  const [destSuccess, setDestSuccess] = useState('')
  const destinations = useReadQuery(
    `excursion-destinations:${destOpen}`,
    useCallback((signal: AbortSignal) => (destOpen ? excursionContextApi.destinations(signal) : Promise.resolve([])), [destOpen]),
  )
  async function saveDestination() {
    if (!item || !destId || destBusy) return
    setDestBusy(true); setDestError('')
    try {
      await shoreExcursionApi.linkDefinitionDestination(item.shoreExcursionId, destId)
      setDestOpen(false)
      setDestSuccess('Đã cập nhật điểm đến cho tour tham quan mẫu.')
      query.reload()
    } catch (cause) {
      setDestError(cause instanceof Error ? cause.message : 'Chưa cập nhật được điểm đến.')
    } finally {
      setDestBusy(false)
    }
  }
  return <ShoreLayout>
    <Link className={styles.link} to={root}>← Chuyến tham quan bờ</Link>
    {destSuccess && <Notice title="Đã cập nhật" tone="success">{destSuccess}</Notice>}
    {query.loading ? <Loading label="Đang tải chi tiết…" /> : query.error != null ? <ShoreError error={query.error} onRetry={query.reload} /> : item && <>
      <PageHeader breadcrumb="Dịch vụ bờ / Chuyến tham quan" title={item.excursionName} description={item.excursionCode ?? 'Chưa có mã chuyến tham quan'} actions={<div className={styles.detailToolbar}>
        <div className={styles.recordStatus}><span>Trạng thái</span><ExcursionBadge status={item.status} /></div>
        <ExcursionActions excursion={item} onRefresh={query.reload}>
          {canLinkDestination && <Button tone="secondary" onClick={() => { setDestId(''); setDestError(''); setDestOpen(true) }}>Gắn điểm đến</Button>}
          {canEditExcursion(item.status) && access.canDo('EXCURSION_UPDATE') && <ButtonLink tone="secondary" to={`${root}/${id}/edit`}>Chỉnh sửa</ButtonLink>}
          <Button tone="secondary" onClick={query.reload}>Tải lại</Button>
        </ExcursionActions>
      </div>} />
      <ExcursionFacts item={item} />
      {destOpen && (
        <Modal
          title="Gắn / đổi điểm đến cho tour mẫu"
          description={item.excursionName}
          busy={destBusy}
          onClose={() => { if (!destBusy) setDestOpen(false) }}
          footer={
            <>
              <Button tone="secondary" disabled={destBusy} data-overlay-dismiss onClick={() => setDestOpen(false)}>Hủy</Button>
              <Button busy={destBusy} disabled={destBusy || !destId || destinations.loading} onClick={() => void saveDestination()}>Lưu điểm đến</Button>
            </>
          }
        >
          <div style={{ display: 'grid', gap: '12px' }}>
            {destinations.loading && <Loading label="Đang tải danh sách điểm đến…" />}
            {destinations.error && <Notice title="Chưa tải được điểm đến" tone="error">{destinations.error.message}</Notice>}
            <Field htmlFor="excursion-def-dest" label="Điểm đến *">
              <select id="excursion-def-dest" value={destId} disabled={destBusy || destinations.loading} onChange={e => setDestId(e.target.value)}>
                <option value="">Chọn điểm đến</option>
                {(destinations.data ?? []).map(d => <option key={d.destinationId} value={d.destinationId}>{d.destinationName}{d.country ? ` · ${d.country}` : ''}</option>)}
              </select>
            </Field>
            {destError && <Notice title="Chưa lưu được" tone="error">{destError}</Notice>}
          </div>
        </Modal>
      )}
      {!item.cruiseStopId&&<Notice title="Tour chưa gắn với lần ghé cảng">Chưa có chuyến khởi hành để đăng ký hoặc điểm danh hành khách. Tour này không tự trở thành quyền lợi trong Gói du thuyền.</Notice>}
      <Panel title="Thông tin liên quan"><nav className={styles.relatedLinks} aria-label="Thông tin liên quan chuyến tham quan">
        <ButtonLink tone="secondary" to={`/admin/suppliers/${item.supplierId}`}>Xem nhà cung cấp</ButtonLink>
        {item.cruiseStopId&&<ButtonLink tone="secondary" to={`/admin/tour-groups?excursionId=${item.shoreExcursionId}`}>Các nhóm tham quan</ButtonLink>}
        {item.cruiseStopId&&(access.canDo('ACTIVITY_ATTENDANCE') || access.canDo('ACTIVITY_REGISTRATION')) && <ButtonLink tone="secondary" to={`/admin/activity-registrations?excursionId=${encodeURIComponent(id)}`}>Đăng ký & điểm danh hành khách</ButtonLink>}
      </nav></Panel>
      {item.cruiseStopId&&<ExcursionAvailability excursion={item} />}
    </>}
  </ShoreLayout>
}
function ExcursionFacts({ item }: { item: ShoreExcursion }) {
  const facts: [string, string | number][] = [
    ['Mã chuyến tham quan', item.excursionCode ?? 'Chưa có mã'], ['Nhà cung cấp', item.supplierName],
    ['Bắt đầu', displayTime(item.startTime)], ['Trở về dự kiến', displayTime(item.plannedReturnTime)], ['Điểm tập trung', item.meetingPoint],
    ['Số khách tối thiểu để tổ chức', item.minimumParticipants ?? 'Chưa đặt'], ['Sức chứa tối đa', item.maximumCapacity], ['Đã đăng ký', item.registeredParticipants], ['Chỗ còn lại', item.availableCapacity],
    ['Giá', item.price === null ? 'Chưa đặt' : `${item.price.toLocaleString('vi-VN')}${item.currencyCode ? ` ${item.currencyCode}` : ''}`],
    ['Lý do hủy', item.cancellationReason ?? '—'], ['Ngày tạo', displayTime(item.createdAt)], ['Cập nhật', displayTime(item.updatedAt)],
  ]
  return <Panel title="Thông tin chuyến tham quan"><RecordFacts entries={facts} /><TechnicalDetails entries={[["Chuyến tham quan", item.shoreExcursionId], ["Điểm dừng", item.cruiseStopId], ["Nhà cung cấp", item.supplierId]]} /></Panel>
}

export function ShoreExcursionFormPage() {
  const { excursionId } = useParams()
  const [params] = useSearchParams(), contextKey = JSON.stringify([excursionId, params.get('cruiseId'), params.get('cruiseStopId'), params.get('returnTo')])
  const returnTo = cruiseContextReturn(params.get('returnTo'), params.get('cruiseId'))
  return <ShoreLayout><Link className={styles.link} to={returnTo ?? root}>← {returnTo ? 'Chuyến khởi hành' : 'Chuyến tham quan bờ'}</Link><PageHeader breadcrumb="Dịch vụ bờ / Chuyến tham quan" title={excursionId ? 'Chỉnh sửa chuyến tham quan' : 'Tạo chuyến tham quan'}  />{excursionId ? <EditExcursion key={contextKey} id={excursionId} /> : <SaveExcursion key={contextKey} />}</ShoreLayout>
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
  const navigate = useNavigate(), mutation = useShoreMutation(),[params]=useSearchParams()
  async function save(request: ExcursionRequest,allowLeave:()=>void) {
    if (!access.canDo(initial ? 'EXCURSION_UPDATE' : 'EXCURSION_CREATE')) return
    const result = await mutation.run(async signal => {
      const saved = initial ? await shoreExcursionApi.update(initial.shoreExcursionId, request, signal) : await shoreExcursionApi.create(request, signal)
      if (saved.cruiseStopId !== request.cruiseStopId || initial && saved.shoreExcursionId !== initial.shoreExcursionId) throw new ApiError('Phản hồi chưa khớp chuyến tham quan hoặc lần ghé cảng. Đối chiếu kết quả trước khi gửi tiếp.', 502)
      return saved
    })
    if (result.ok) {allowLeave();navigate(cruiseContextReturn(params.get('returnTo'),params.get('cruiseId'))??`${root}/${result.value.shoreExcursionId}`)}
  }
  return <Panel title="Thông tin chuyến tham quan">{mutation.error != null && <ShoreError error={mutation.error} />}<>{mutation.unknown&&<Notice title="Cần kiểm tra kết quả trước khi gửi lại" tone="warning">Chưa xác định được kết quả lưu. Đối chiếu danh sách tour của lần ghé cảng; thao tác gửi lại hiện bị khóa.</Notice>}<ExcursionForm initial={initial} busy={mutation.busy||mutation.unknown} pending={mutation.busy} onSave={save} /></></Panel>
}


