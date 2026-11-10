import { useSessionAccess } from '@/shared/auth'
import { Fragment, useCallback } from 'react'
import { useParams } from 'react-router'
import { useReadQuery } from '@/shared/api'
import { Badge, ButtonLink, PageHeader, Panel, RecordFacts } from '@/shared/ui'
import { activityApi } from '../api/activity-api'
import { ActivityFrame, ActivityState } from '../components/ActivityUI'
import { activityTime, activityStatusLabels, type Activity } from '../model/activity'
import { ActivityOperations } from '../components/ActivityOperations'
import { RegistrationPanel } from '../components/RegistrationPanel'
import styles from '../components/Activities.module.css'

function ActivityRelated({ activity }: { activity: Activity }) {
  const access = useSessionAccess()
  const id = activity.id
  const available = useReadQuery('activity-availability:' + id, useCallback(signal => activityApi.availability(id, signal), [id]))
  const schedule = useReadQuery('activity-schedule:' + id, useCallback(signal => activityApi.schedule(id, signal), [id]))
  return <>
    <Panel title="Sức chứa & lịch hoạt động"><ActivityState {...available} />{available.data && <p>Còn {available.data.availableSeats} / {available.data.capacity} chỗ.</p>}<ActivityState {...schedule} />{schedule.data && <p>{schedule.data.conflictFree ? 'Chưa phát hiện xung đột lịch.' : `Cần kiểm tra ${schedule.data.conflicts} xung đột lịch.`}</p>}</Panel>
    {activity.cruiseId && access.can({mode:'ANY',permissions:['ACTIVITY_ATTENDANCE','ACTIVITY_REGISTRATION']}) && <RegistrationPanel key={activity.id + activity.status} context={{kind: 'activities', id, cruiseId: activity.cruiseId, status: activity.status, startTime: activity.startTime, endTime: activity.endTime}} />}
  </>
}
export function ActivityDetailPage({ recordId, embedded = false }: { recordId?: string; embedded?: boolean } = {}) {
  const access = useSessionAccess()
  const params = useParams(), activityId = recordId ?? params.activityId ?? ''
  const Frame = embedded ? Fragment : ActivityFrame
  const query = useReadQuery('activity:' + activityId, useCallback(signal => activityApi.read(activityId, signal), [activityId]))
  const activity = query.data
  if (activity?.catalogEntry === true) return <Frame>
    <ActivityOperations key={activity.id} activity={activity} onChanged={query.retry} renderCatalogHeader={deleteAction => {
      const editAction = access.canDo('ACTIVITY_UPDATE') && <ButtonLink tone={embedded ? 'secondary' : 'primary'} to={`/admin/activities/${activity.id}/edit`}>Chỉnh sửa</ButtonLink>
      return embedded
        ? editAction && <div className={styles.actions}>{editAction}{deleteAction}</div>
        : <PageHeader breadcrumb="DỊCH VỤ TÀU / DANH MỤC" title={activity.name} actions={<>
          <ButtonLink tone="secondary" to="/admin/activities">Danh mục hoạt động</ButtonLink>
          {editAction}
          {deleteAction}
        </>} />
    }} />
    <Panel title="Thông tin hoạt động dùng chung"><RecordFacts entries={[
      ['Mã hoạt động', activity.code], ['Mô tả', activity.description || 'Chưa có mô tả'],
      ['Sức chứa', activity.capacity ?? 'Chưa cấu hình'], ['Giá tham chiếu', activity.price == null ? 'Chưa cấu hình' : `${activity.price} ${activity.currencyCode ?? ''}`],
    ]} /><p>Giờ và địa điểm phục vụ được chọn khi lập chương trình cho chuyến khởi hành.</p></Panel>
  </Frame>
  return <Frame>{!embedded && <PageHeader breadcrumb="DỊCH VỤ TÀU / HOẠT ĐỘNG" title={activity?.name ?? 'Chi tiết hoạt động'}  actions={<><ButtonLink tone="secondary" to="/admin/activities">Danh sách hoạt động</ButtonLink></>} />}<ActivityState {...query} />
    {activity && <><div className={styles.detailLayout}><Panel title="Thông tin hoạt động"><RecordFacts entries={[
      ['Mã hoạt động', activity.code], ['Trạng thái', <Badge label={activityStatusLabels[activity.status] ?? activity.status} tone={activity.status === 'IN_PROGRESS' ? 'info' : activity.status === 'COMPLETED' ? 'success' : 'neutral'} />],
      ['Thời gian', `${activityTime(activity.startTime)} → ${activityTime(activity.endTime)}`], ['Địa điểm', [activity.deckName||(activity.deckNumber!=null?`Boong ${activity.deckNumber}`:null),activity.cabinNumber?`Cabin ${activity.cabinNumber}`:null].filter(Boolean).join(' · ') || 'Chưa có địa điểm được liên kết'],
      ['Mô tả địa điểm', activity.location || 'Chưa có mô tả'],
      ['Sức chứa', activity.capacity], ['Giá tham gia', activity.price === null ? 'Chưa cấu hình' : `${activity.price} ${activity.currencyCode ?? ''}`], ['Mô tả', activity.description || 'Chưa có mô tả'],
    ]} />{activity.cruiseId?<ButtonLink tone="secondary" to={`/admin/cruises/${activity.cruiseId}`}>Xem chuyến khởi hành</ButtonLink>:<p>Hoạt động nguồn dùng để lập chương trình chuyến đi.</p>}</Panel><aside className={styles.actionRail}><ActivityOperations activity={activity} onChanged={query.retry} /></aside></div><ActivityRelated activity={activity} /></>}
  </Frame>
}
