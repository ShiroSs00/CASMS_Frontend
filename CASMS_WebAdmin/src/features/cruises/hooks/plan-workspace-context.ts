import {createContext} from 'react'
import type {PlanView} from '../api/mainflow-api'
export type PlanQuery = {data: PlanView | null; loading: boolean; error: Error | null; retry: () => void}
export const PlanWorkspaceContext = createContext<{id: string; query: PlanQuery} | null>(null)
