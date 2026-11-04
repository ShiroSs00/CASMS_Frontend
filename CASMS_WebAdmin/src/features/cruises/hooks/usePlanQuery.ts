import {useCallback,useContext} from 'react'
import {useReadQuery} from '@/shared/api'
import {useSessionAccess} from '@/shared/auth'
import {mainflowApi} from '../api/mainflow-api'
import {PlanWorkspaceContext as Context} from './plan-workspace-context'
export function usePlanQuery(id: string, key: string, allowed: boolean) {
  const shared = useContext(Context), access = useSessionAccess()
  const provided = shared?.id === id && allowed ? shared.query : null
  const hasProvided = provided !== null
  const fallback = useReadQuery(`plan-local:${access.userId}:${access.status}:${id}:${key}:${allowed}:${Boolean(provided)}`, useCallback(signal => allowed && !hasProvided ? mainflowApi.get(id, signal) : Promise.resolve(null), [allowed, id, hasProvided]))
  return provided ?? fallback
}
