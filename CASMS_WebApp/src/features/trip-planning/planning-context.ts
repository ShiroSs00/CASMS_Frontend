import { createContext, type RefObject } from 'react'
import type { PlanningGateway } from './api/gateway'
type PlanningContext = { gateway: PlanningGateway; root: string; can: (permission: string) => boolean; actorId: string; unsavedRef: RefObject<boolean> }
export const Context=createContext<PlanningContext|null>(null)
