import { useEffect, useState } from 'react'
import { useSessionAccess } from '@/shared/auth'
import { programApi, type ProgramActivity, type ProgramExcursion, type ProgramService } from '../api/program-api'

export function useJourneyProgram(cruiseId: string) {
  const access = useSessionAccess()
  const scopedActivities = access.roles.includes('CRUISE_MANAGER') && access.has('CRUISE_UPDATE_DRAFT')
  const canActivities = scopedActivities || access.canDo('ACTIVITY_READ'), canExcursions = access.canDo('EXCURSION_READ'), canServices = access.canDo('SERVICE_READ')
  const sessionKey = `${access.userId}:${access.status}:${access.roles.join(',')}:${access.permissions.join(',')}`
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState<{ cruiseId: string; sessionKey: string; attempt: number; activities: ProgramActivity[]; excursions: ProgramExcursion[]; services: ProgramService[]; errors: string[]; impactKnown: boolean } | null>(null)
  useEffect(() => {
    if (!cruiseId || access.status === 'loading') return
    const controller = new AbortController()
    const denied = (name: string) => Promise.reject(new Error(`Chưa có quyền đọc ${name}.`))
    void Promise.allSettled([
      canActivities ? programApi.activities(cruiseId, controller.signal, scopedActivities) : denied('hoạt động'),
      canExcursions ? programApi.excursions(controller.signal) : denied('tham quan trên bờ'),
      canServices ? programApi.services(controller.signal) : denied('dịch vụ'),
    ]).then(([activities, excursions, services]) => {
      if (controller.signal.aborted) return
      setResult({ cruiseId, sessionKey, attempt, impactKnown: activities.status === 'fulfilled' && excursions.status === 'fulfilled', activities: activities.status === 'fulfilled' ? activities.value : [], excursions: excursions.status === 'fulfilled' ? excursions.value : [], services: services.status === 'fulfilled' ? services.value : [], errors: [activities, excursions, services].flatMap(row => row.status === 'rejected' ? [row.reason instanceof Error ? row.reason.message : 'Không tải được chương trình.'] : []) })
    })
    return () => controller.abort()
  }, [cruiseId, attempt, canActivities, canExcursions, canServices, scopedActivities, access.status, sessionKey])
  const data = result?.cruiseId === cruiseId && result.sessionKey === sessionKey && result.attempt === attempt ? result : null
  return { data, retry: () => setAttempt(value => value + 1) }
}
