import type { Trip, TripInfo, Version, Content, SourceKind, Source, SourceQuery, Report, History, Violation, PageResult, ReviewItem } from '../model/plan'
export type Scenario = 'normal' | 'loading' | 'empty' | 'error' | '409' | '422' | 'readonly'
export type TripFilters={search:string;durationGroup:''|'SHORT'|'LONG';plannedScope:''|'DOMESTIC'|'INTERNATIONAL'}
export class PlanningFault extends Error {
  status: number; code: string; violations: Violation[]; stage?: string; updatedTrip?: Trip
  constructor(message: string, status = 0, code = 'UNAVAILABLE', violations: Violation[] = []) { super(message); this.name='PlanningFault'; this.status=status; this.code=code; this.violations=violations }
}
export interface PlanningGateway {
  mode: 'api' | 'preview'; readOnly: boolean; supportsMiddleDayRemoval: boolean; supportsFullInfo: boolean
  list(page: number, status: string, signal: AbortSignal, filters?:TripFilters): Promise<{ content: Trip[]; totalPages: number; totalElements: number }>
  getTrip(id: string, signal?: AbortSignal): Promise<Trip>
  saveInfo(info: TripInfo, key: string, previous?: Trip): Promise<Trip>
  clone(id: string, sourceVersionId: string | undefined, key: string): Promise<Trip>
  archive(id: string,revision:number,reason?:string): Promise<Trip>
  version(id: string, signal?: AbortSignal): Promise<Version>
  createVersion(trip: Trip, sourceVersionId?: string): Promise<Version>
  save(version: Version, content: Content): Promise<Version>
  changeDay(trip: Trip, version: Version, removeDay?: number): Promise<{ trip: Trip; version: Version }>
  sources(kind: SourceKind, signal: AbortSignal, query?:SourceQuery): Promise<Source[]>
  validate(version: Version): Promise<Report>
  action(version: Version, action: 'submit' | 'return' | 'publish' | 'finalize' | 'withdraw' | 'cancel', reason?: string): Promise<Version>
  history(versionId: string, signal: AbortSignal): Promise<History[]>
  historyPage?(id:string,scope:'trip'|'version',page:number,signal:AbortSignal):Promise<PageResult<History>>
  reviewQueue?(page:number,signal:AbortSignal):Promise<PageResult<ReviewItem>>
}
