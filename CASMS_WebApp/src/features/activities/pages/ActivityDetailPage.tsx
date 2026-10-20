import { useCallback } from 'react'
import { useParams } from 'react-router'
import { useReadQuery } from '@/shared/api'
import { ButtonLink, PageHeader, Panel } from '@/shared/ui'
import { activityApi } from '../api/activity-api'
import { ActivityFrame, ActivityState } from '../components/ActivityUI'
import { activityTime, activityStatusLabels, type Activity } from '../model/activity'
import { ActivityOperations } from '../components/ActivityOperations'
import { RegistrationPanel } from '../components/RegistrationPanel'
import styles from '../components/Activities.module.css'

function ActivityRelated({ activity }: { activity: Activity }) {
  const id = activity.id
  const available = useReadQuery('activity-availability:' + id, useCallback(signal => activityApi.availability(id, signal), [id]))
  const schedule = useReadQuery('activity-schedule:' + id, useCallback(signal => activityApi.schedule(id, signal), [id]))
  return <>
    <Panel title="Sức chứa & lịch hoạt động"><ActivityState {...available} />{available.data && <p>Còn {available.data.availableSeats} / {available.data.capacity} chỗ.</p>}<ActivityState {...schedule} />{schedule.data && <p>{schedule.data.conflictFree ? 'Chưa phát hiện xung đột lịch.' : `Cần kiểm tra ${schedule.data.conflicts} xung đột lịch.`}</p>}</Panel>
    <RegistrationPanel key={activity.id + activity.status} context={{kind: 'activities', id, cruiseId: activity.cruiseId, status: activity.status, startTime: activity.startTime, endTime: activity.endTime}} />
  </>
}
export function ActivityDetailPage() {
  const { activityId = '' } = useParams()
  const query = useReadQuery('activity:' + activityId, useCallback(signal => activityApi.get(activityId, signal), [activityId]))
  const activity = query.data
  return <ActivityFrame><PageHeader breadcrumb="DỊCH VỤ TÀU / HOẠT ĐỘNG" title={activity?.name ?? 'Chi tiết hoạt động'} description="Lịch tổ chức, sức chứa và các đăng ký liên quan." actions={<><ButtonLink tone="secondary" to="/admin/activities">Danh sách hoạt động</ButtonLink></>} /><ActivityState {...query} />
    {activity && <><Panel title="Thông tin hoạt động"><dl className={styles.definition}><dt>Mã hoạt động</dt><dd>{activity.code}</dd><dt>Trạng thái</dt><dd>{activityStatusLabels[activity.status] ?? activity.status}</dd><dt>Thời gian</dt><dd>{activityTime(activity.startTime)} → {activityTime(activity.endTime)}</dd><dt>Địa điểm</dt><dd>{activity.location || 'Chưa xác định'}</dd><dt>Sức chứa</dt><dd>{activity.capacity}</dd><dt>Giá tham gia</dt><dd>{activity.price === null ? 'Chưa cấu hình' : `${activity.price} ${activity.currencyCode ?? ''}`}</dd><dt>Mô tả</dt><dd>{activity.description || 'Chưa có mô tả'}</dd></dl><ButtonLink tone="secondary" to={`/admin/cruises/${activity.cruiseId}`}>Xem chuyến du lịch</ButtonLink></Panel><ActivityOperations activity={activity} onChanged={query.retry} /><ActivityRelated activity={activity} /></>}
  </ActivityFrame>
}
