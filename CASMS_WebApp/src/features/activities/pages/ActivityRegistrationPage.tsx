import { useCallback, useState } from 'react'
import { useSearchParams } from 'react-router'
import { useReadQuery } from '@/shared/api'
import { Field, PageHeader, Panel } from '@/shared/ui'
import { activityApi } from '../api/activity-api'
import { registrationContextApi } from '../api/registration-context-api'
import { ActivityFrame, ActivityState } from '../components/ActivityUI'
import { RegistrationPanel } from '../components/RegistrationPanel'
export function ActivityRegistrationPage() {
  const [params] = useSearchParams()
  const [kind, setKind] = useState<'activities' | 'excursions'>(params.has('excursionId') ? 'excursions' : 'activities'), [id, setId] = useState(params.get('excursionId') ?? '')
  const choices = useReadQuery('registration-choices:' + kind, useCallback(async (signal: AbortSignal) => kind === 'activities' ? (await activityApi.list(signal)).filter(item=>item.cruiseId!==null).map(item => ({ id: item.id, name: item.name })) : registrationContextApi.list(signal), [kind]))
  const detail = useReadQuery('registration-context:' + kind + id, useCallback(async (signal: AbortSignal) => !id ? null : kind === 'activities' ? activityApi.get(id, signal) : registrationContextApi.get(id, signal), [kind, id]))
  return <ActivityFrame><PageHeader title="Đăng ký & điểm danh" breadcrumb="DỊCH VỤ / HÀNH KHÁCH" description="Chọn hoạt động hoặc chuyến tham quan, quản lý đăng ký và điểm danh theo đúng chuyến đi." /><Panel title="Nội dung tham gia"><Field htmlFor="registration-kind" label="Nhóm"><select id="registration-kind" value={kind} onChange={event => { setKind(event.target.value as typeof kind); setId('') }}><option value="activities">Hoạt động trên tàu</option><option value="excursions">Chuyến tham quan</option></select></Field><ActivityState {...choices} /><Field htmlFor="registration-target" label="Hoạt động / chuyến tham quan"><select id="registration-target" value={id} onChange={event => setId(event.target.value)}><option value="">Chọn nội dung có thật</option>{choices.data?.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>{id && <ActivityState {...detail} />}</Panel>{detail.data?.cruiseId && <RegistrationPanel key={kind + id} context={{ kind, id: detail.data.id, cruiseId: detail.data.cruiseId, status: detail.data.status, startTime: detail.data.startTime, endTime: detail.data.endTime }} />}</ActivityFrame>
}
