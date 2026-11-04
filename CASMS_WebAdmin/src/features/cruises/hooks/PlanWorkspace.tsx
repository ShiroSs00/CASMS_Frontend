import { useCallback, type ReactNode } from 'react'
import { useReadQuery } from '@/shared/api'
import { useSessionAccess } from '@/shared/auth'
import { mainflowApi } from '../api/mainflow-api'
import {PlanWorkspaceContext as Context} from './plan-workspace-context'
/** One actor-scoped Plan read for the OPS workspace; no global cross-account cache. */
export function PlanWorkspace({ id, children }: { id: string; children: ReactNode }) {
  const access = useSessionAccess()
  const allowed = access.roles.includes('OPERATIONS_MANAGER') && access.has('CRUISE_READ')
  const query = useReadQuery(`ops-plan:${access.userId}:${access.status}:${id}:${allowed}`, useCallback(signal => allowed && id ? mainflowApi.get(id, signal) : Promise.resolve(null), [allowed, id]))
  return <Context.Provider value={allowed ? { id, query } : null}>{children}</Context.Provider>
}
