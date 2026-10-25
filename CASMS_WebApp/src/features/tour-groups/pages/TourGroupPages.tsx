import { PermissionLink as Link } from '@/shared/ui'
import { TechnicalDetails } from '@/shared/ui'
import { useCallback, useState, type FormEvent } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import { ApiError, useReadQuery } from '@/shared/api'
import { useSessionAccess } from '@/shared/auth'
import { Button, ButtonLink, DataTable, Empty, Loading, Notice, PageHeader, Panel } from '@/shared/ui'
import { tourGroupApi } from '../api/tour-group-api'
import { listExcursionOptions } from '../api/group-context-api'
import { GroupCapacity } from '../components/GroupCapacity'
import { GroupControls } from '../components/GroupControls'
import { GroupForm } from '../components/GroupForm'
import { GroupPassengers, type PassengerReceipt } from '../components/GroupPassengers'
import { GroupBadge, TourError, TourLayout } from '../components/TourUI'
import styles from '../components/TourGroups.module.css'
import { useTourMutation, useTourResource } from '../hooks/useTourResource'
import { canPrepareGroup, displayTime, groupStatuses, groupStatusLabels, isUuid, type GroupRequest, type TourGroup } from '../model/tour-group'

const root = '/admin/tour-groups'
export function TourGroupListPage() {
  const access = useSessionAccess()
  const excursions = useReadQuery('group-filter-excursions', listExcursionOptions)
  const [search, setSearch] = useSearchParams()
  const excursionId = search.get('excursionId')?.trim() || undefined, guideId = search.get('guideId')?.trim() || undefined, rawStatus = search.get('status') || undefined
  const load = useCallback((signal: AbortSignal) => {
    const status = groupStatuses.find((item) => item === rawStatus)
    if ((rawStatus && !status) || (excursionId && !isUuid(excursionId)) || (guideId && !isUuid(guideId))) throw new ApiError('Kiểm tra trạng thái và ID UUID trong bộ lọc.', 0)
    return tourGroupApi.list({ excursionId, guideId, status }, signal)
  }, [excursionId, guideId, rawStatus])
  const query = useTourResource(load)
  function filter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget), next = new URLSearchParams()
    for (const key of ['excursionId', 'guideId', 'status']) { const value = String(form.get(key) ?? '').trim(); if (value) next.set(key, value) }
    setSearch(next)
  }
  return <TourLayout>
    <PageHeader breadcrumb="Dịch vụ bờ" title="Nhóm tour" description="Quản lý nhóm tham quan, phân công hướng dẫn viên và sức chứa." actions={access.has("TOUR_GROUP_CREATE") && <ButtonLink to={`${root}/new${excursionId ? `?excursionId=${encodeURIComponent(excursionId)}` : ''}`}>Tạo nhóm tour</ButtonLink>} />
    <Panel title="Bộ lọc"><form key={search.toString()} onSubmit={filter}>
      <div className={styles.filters}><label>Chuyến tham quan<select key={`${excursionId}:${excursions.data?.length}`} name="excursionId" defaultValue={excursionId} disabled={excursions.loading || Boolean(excursions.error)}><option value="">Tất cả chuyến tham quan</option>{excursions.data?.map(item => <option key={item.shoreExcursionId} value={item.shoreExcursionId}>{item.excursionName}</option>)}</select></label><label>Hướng dẫn viên<select disabled><option>Chưa có danh mục hướng dẫn viên</option></select></label><label>Trạng thái<select name="status" defaultValue={rawStatus ?? ''}><option value="">Tất cả</option>{groupStatuses.map((value) => <option key={value} value={value}>{groupStatusLabels[value]}</option>)}</select></label></div>
      <div className={styles.actions}><Button type="submit">Áp dụng bộ lọc</Button><Button tone="secondary" onClick={() => setSearch({})}>Xóa bộ lọc</Button><Button tone="secondary" onClick={query.reload}>Tải lại</Button></div>
    </form></Panel>
    {excursions.error && <Notice title="Không tải được danh mục chuyến tham quan" tone="warning">{excursions.error.message}<Button onClick={excursions.retry}>Thử lại</Button></Notice>}
    {query.loading ? <Loading label="Đang tải nhóm tour…" /> : query.error != null ? <TourError error={query.error} onRetry={query.reload} /> : query.data && <Panel title={`Danh sách · ${query.data.length}`}>
      {!query.data.length ? <Empty title="Chưa có nhóm tour phù hợp" /> : <DataTable label="Danh sách nhóm tour" headers={['Mã nhóm', 'Chuyến tham quan', 'Hướng dẫn viên', 'Đã phân công / tối đa', 'Chỗ còn lại', 'Trạng thái']}>
        {query.data.map((group) => <tr key={group.tourGroupId}><td><Link className={styles.link} to={`${root}/${group.tourGroupId}`}>{group.groupCode}</Link></td><td>{group.excursionName}</td><td className={styles.text}>{group.guideId ? 'Đã phân công · chưa có tên' : 'Chưa phân công'}</td><td>{group.assignedPassengers} / {group.maximumCapacity}</td><td>{group.availableCapacity}</td><td><GroupBadge status={group.status} /></td></tr>)}
      </DataTable>}
    </Panel>}
  </TourLayout>
}
export function TourGroupDetailPage() {
  const { groupId = '' } = useParams()
  return <GroupDetail key={groupId} id={groupId} />
}
function GroupDetail({ id }: { id: string }) {
  const access = useSessionAccess()
  const load = useCallback((signal: AbortSignal) => tourGroupApi.get(id, signal), [id])
  const query = useTourResource(load), group = query.data
  const [receipt, setReceipt] = useState<PassengerReceipt | null>(null)
  return <TourLayout><Link className={styles.link} to={root}>← Nhóm tour</Link>
    {receipt && <Notice title="Đã cập nhật phân công"><p>{receipt.message}</p>{receipt.targetId && <Link className={styles.link} to={`${root}/${receipt.targetId}`}>Xem nhóm đích {receipt.targetCode}</Link>}</Notice>}
    {query.loading ? <Loading label="Đang tải chi tiết nhóm…" /> : query.error != null ? <TourError error={query.error} onRetry={query.reload} /> : group && <>
      <PageHeader breadcrumb="Dịch vụ bờ / Nhóm tour" title={`Nhóm ${group.groupCode}`} description={group.excursionName} actions={<div className={styles.detailToolbar}>
        <div className={styles.recordStatus}><span>Trạng thái</span><GroupBadge status={group.status} /></div>
        <GroupControls group={group} onRefresh={query.reload}>
          {canPrepareGroup(group.status) && access.has('TOUR_GROUP_UPDATE') && <ButtonLink tone="secondary" to={`${root}/${id}/edit`}>Chỉnh sửa</ButtonLink>}
          <Button tone="secondary" onClick={query.reload}>Tải lại</Button>
        </GroupControls>
      </div>} />
      <GroupFacts group={group} /><GroupCapacity group={group} />
      <Panel title="Thông tin liên quan"><nav className={styles.relatedLinks} aria-label="Thông tin liên quan nhóm tour"><ButtonLink tone="secondary" to={`/admin/shore-excursions/${group.shoreExcursionId}`}>Xem chuyến tham quan</ButtonLink></nav></Panel>
      <GroupPassengers group={group} onChanged={(result) => { setReceipt(result); query.reload() }} />
    </>}
  </TourLayout>
}
function GroupFacts({ group }: { group: TourGroup }) {
  const facts: [string, string][] = [
    ['Chuyến tham quan', group.excursionName], ['Hướng dẫn viên', group.guideId ? 'Đã phân công · Chưa có thông tin tên' : 'Chưa phân công'], ['Phương tiện', group.vehicleId ? 'Đã phân công · Chưa có thông tin tên' : 'Chưa đặt'],
    ['Điểm tập trung', group.meetingPoint ?? 'Chưa đặt'], ['Giờ tập trung', displayTime(group.assemblyTime)], ['Khởi hành dự kiến', displayTime(group.plannedDepartureTime)],
    ['Trở về dự kiến', displayTime(group.plannedReturnTime)], ['Khởi hành thực tế', displayTime(group.actualDepartureTime)], ['Trở về thực tế', displayTime(group.actualReturnTime)], ['Ghi chú', group.notes ?? '—'],
  ]
  return <Panel title="Thông tin nhóm tour"><dl className={styles.facts}>{facts.map(([label, value]) => <div key={label} style={{ display: 'contents' }}><dt>{label}</dt><dd>{value}</dd></div>)}</dl><TechnicalDetails entries={[["Nhóm tour", group.tourGroupId], ["Chuyến tham quan", group.shoreExcursionId], ["Hướng dẫn viên", group.guideId], ["Phương tiện", group.vehicleId]]} /></Panel>
}
export function TourGroupFormPage() {
  const { groupId } = useParams()
  const [search] = useSearchParams()
  const excursionId = search.get('excursionId')?.trim() ?? ''
  return <TourLayout><Link className={styles.link} to={root}>← Nhóm tour</Link><PageHeader breadcrumb="Dịch vụ bờ / Nhóm tour" title={groupId ? 'Chỉnh sửa nhóm tour' : 'Tạo nhóm tour'} description="Lấy thông tin từ chuyến tham quan và bổ sung các thông tin riêng của nhóm." />{groupId ? <EditGroup key={groupId} id={groupId} /> : <SaveGroup key={excursionId} initialExcursionId={excursionId} />}</TourLayout>
}
function EditGroup({ id }: { id: string }) {
  const load = useCallback((signal: AbortSignal) => tourGroupApi.get(id, signal), [id])
  const query = useTourResource(load)
  if (query.loading) return <Loading label="Đang tải biểu mẫu…" />
  if (query.error != null) return <TourError error={query.error} onRetry={query.reload} />
  if (!query.data) return null
  if (!canPrepareGroup(query.data.status)) return <Notice title="Không thể chỉnh sửa">Nhóm đang ở trạng thái {groupStatusLabels[query.data.status]}. Chỉ có thể chỉnh sửa nhóm đang lên kế hoạch. <Link to={`${root}/${id}`}>Xem chi tiết</Link></Notice>
  return <SaveGroup initial={query.data} />
}
function SaveGroup({ initial, initialExcursionId }: { initial?: TourGroup; initialExcursionId?: string }) {
  const access = useSessionAccess()
  const navigate = useNavigate(), mutation = useTourMutation()
  async function save(request: GroupRequest) {
    if (!access.has(initial ? 'TOUR_GROUP_UPDATE' : 'TOUR_GROUP_CREATE')) return
    const result = await mutation.run((signal) => initial ? tourGroupApi.update(initial.tourGroupId, request, signal) : tourGroupApi.create(request, signal))
    if (result.ok) navigate(`${root}/${result.value.tourGroupId}`)
  }
  return <Panel title="Thông tin nhóm tour">{mutation.error != null && <TourError error={mutation.error} />}<GroupForm initial={initial} initialExcursionId={initialExcursionId} busy={mutation.busy} onSave={save} /></Panel>
}
