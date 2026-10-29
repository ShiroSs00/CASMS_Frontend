import { ApiError } from '@/shared/api'
import type { OperationalProgramSyncDto, ReadinessDto, ReadinessIssueDto, ReadinessStatusDto, ShipChangeImpactDto, ShipCompatibilityDto } from '../api/dto'

export type ScheduleStop = {
  cruiseStopId: string | null; portCode: string | null; tenderTransferMinutes: number | null
  sourceStopId: string | null; stopOrder: number | null; portId: string | null; portName: string | null
  countryCode: string | null; portTimeZoneId: string | null; plannedArrival: string | null
  plannedDeparture: string | null; allAboardTime: string | null; callType: string | null; arrivalMethod: string | null
}
export type ScheduleEntry = {
  category: string | null; sourceActivityId: string | null; sourceExcursionId: string | null
  targetId: string | null; targetCode: string | null; status: string | null
  sourceEntryId: string | null; clientKey: string | null; kind: string | null
  plannedStartTime: string | null; plannedEndTime: string | null; stopOrder: number | null
}
export type DepartureSchedule = {
  sourceTripCode: string | null; sourceTripName: string | null; sourceVersionNumber: number | null
  durationDays: number | null; durationNights: number | null
  departurePortName: string | null; departurePortCode: string | null; returnPortName: string | null; returnPortCode: string | null
  itineraryId: string | null; itineraryStatus: string | null; materialized: boolean | null; warnings: string[] | null
  sourceTripId: string | null; sourceVersionId: string | null; sourceVersionRevision: number | null
  departureDatetime: string | null; returnDatetime: string | null; departurePortId: string | null; returnPortId: string | null
  days: { itineraryDayId: string | null; dayNumber: number; calendarDate: string | null; dayRole?: string | null; dayType: string | null; title: string | null
    shipTimeZoneId: string | null; stops: ScheduleStop[]; entries: ScheduleEntry[] }[]
}
export type InventorySummary = {
  blockedCabins:number|null;canSell:boolean|null;policyVersion:string|null
  cruiseCode: string | null; shipName: string | null
  cruiseId: string; shipId: string | null; physicalCapacity: number | null; totalCabins: number | null
  operationalCabins: number | null; bookedPassengersCount: number | null; heldPassengersCount: number | null
  remainingCapacity: number | null; activePackagesCount: number | null
  cabinTypeInventory: { cabinType: string | null; totalCabins: number | null; operationalCabins: number | null
    totalSlots: number | null; occupiedSlots: number | null; remainingSlots: number | null; baseFare: number | null; blockedCabins:number|null;bookedSlots:number|null;heldSlots:number|null;canSell:boolean|null }[] | null
}
export type PublicSellability = {
  cruiseId:string;cruiseCode:string|null;cruiseName:string|null;departureDatetime:string|null;returnDatetime:string|null
  sellable:boolean|null;saleState:string|null;stopReason:string|null;stoppedAt:string|null;totalCapacity:number|null;remainingCapacity:number|null
  pricingPolicyVersion:string|null;currency:string|null;depositPercentage:number|null;finalPaymentCutoffDays:number|null
  cabinTypes:{cabinType:string|null;baseFare:number|null;currency:string|null;totalSlots:number|null;availableSlots:number|null;sellable:boolean|null}[]|null
  availablePackages:{tourPackageId:string|null;packageCode:string|null;packageName:string|null;price:number|null;currency:string|null;mandatory:boolean|null;entitlementType:string|null;sellable:boolean|null}[]|null
}
export type PreparationSection = {sectionCode:string;sectionName:string|null;ownerRole:string|null;status:string|null;evidence:string|null;notes:string|null;submittedByUserId:string|null;submittedAt:string|null;confirmedByUserId:string|null;confirmedByUsername:string|null;confirmedAt:string|null;returnReason:string|null;returnedAt:string|null;revision:number|null;checkItems:{itemCode:string|null;itemName:string|null;ready:boolean|null;details:string|null}[]|null}
export type PreparationDashboard = {cruiseId:string;cruiseCode:string|null;cruiseName:string|null;cruiseStatus:string|null;overallStatus:string|null;allConfirmed:boolean|null;sections:PreparationSection[];lastUpdatedAt:string|null}
export type CruiseAuditEvent = {eventId:string;cruiseId:string;eventType:string|null;eventIdentity:string|null;actorUsername:string|null;actorRole:string|null;requiredPermission:string|null;scope:string|null;beforeDigest:string|null;afterDigest:string|null;reason:string|null;evidence:string|null;fingerprint:string|null;sourceVersionId:string|null;revision:number|null;timestamp:string|null}
export type ImpactNotificationAggregate = {cruiseId:string;cruiseCode:string|null;totalImpactedBookings:number|null;totalImpactedPassengers:number|null;notificationsSentCount:number|null;inAppDeliveredCount:number|null;deliveryChannel:string|null;deliverySemantics:string|null;notificationsPendingCount:number|null;notificationsFailedCount:number|null;notificationsAcknowledgedCount:number|null;deliveryStatus:string|null;lastDispatchedAt:string|null}
export type SaleReadiness = {
  gateType: string | null; policyVersion: string | null; cabinOnlySalePermitted: boolean | null
  priceVersion: string | null; shipVersion: string | null; supplierVersion: string | null
  activePackagesCount: number | null; remainingCapacity: number | null; physicalCapacity: number | null
  status: ReadinessStatusDto | null; fingerprint: string | null; validUntil: string | null; details: ReadinessIssueDto[] | null
  cruiseId: string; ready: boolean; operationalReady: boolean | null; packagesConfigured: boolean | null
  inventoryAvailable: boolean | null; departureInFuture: boolean | null; pricingConfigured: boolean | null
  blockers: string[] | null; warnings: string[] | null; issues: string[] | null
  evaluatedAt: string | null; cruiseRevision: number | null
}
export type ImpactTask = {
  taskCode:string|null;category:string|null;eventIdentity:string|null;targetType:string|null;targetId:string|null
  assignedToUserId:string|null;resolvedByUserId:string|null;resolvedByUsername:string|null;resolvedAt:string|null
  taskId: string | null; cruiseId: string; title: string | null; description: string | null
  status: string | null; severity: string | null; assignedToUsername: string | null
  evidence: string | null; resolutionNotes: string | null; revision: number | null; createdAt: string | null; updatedAt: string | null
}
export type ChangeInput = {
  newDepartureDatetime?:string|null;newReturnDatetime?:string|null;newShipId?:string|null
  newDeparturePortId?:string|null;newReturnPortId?:string|null;eventIdentity?:string|null;expectedRevision?:number|null;reason?:string|null
}
export type ChangePreview = {
  scheduleImpacted:boolean|null;dateShiftDays:number|null;shipImpacted:boolean|null;bookedPassengersCount:number|null
  cruiseId: string; currentRevision: number | null; canProceed: boolean | null
  affectedBookingsCount: number | null; affectedActivitiesCount: number | null; affectedExcursionsCount: number | null
  blockers: string[] | null; warnings: string[] | null; generatedTasks: ImpactTask[] | null
}
export type DownstreamHandoff = {
  cruiseId: string; cruiseCode: string | null; cruiseStatus: string | null; sourceTripCode: string | null
  sourceVersionId: string | null; sourceVersionNumber: number | null; shipName: string | null
  departureDatetime: string | null; returnDatetime: string | null
  totalBookingsCount: number | null; confirmedBookingsCount: number | null; draftBookingsCount: number | null
  cancelledBookingsCount: number | null; totalPassengersCount: number | null; checkedInPassengersCount: number | null
  boardedPassengersCount: number | null; captainAssigned: boolean | null; departureClearanceReady: boolean | null; manifestLocked: boolean | null
}

type Row = Record<string, unknown>
const invalid = () => new ApiError('Dữ liệu chuẩn bị lần khởi hành chưa đúng định dạng. Vui lòng tải lại.', 502)
export function object(value: unknown): Row { if (!value || typeof value !== 'object' || Array.isArray(value)) throw invalid(); return value as Row }
export function text(row: Row, key: string): string | null { const value = row[key]; if (value == null) return null; if (typeof value !== 'string') throw invalid(); return value }
export function number(row: Row, key: string): number | null { const value = row[key]; if (value == null) return null; if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) throw invalid(); return value }
export function flag(row: Row, key: string): boolean | null { const value = row[key]; if (value == null) return null; if (typeof value !== 'boolean') throw invalid(); return value }
export function strings(row: Row, key: string): string[] | null { const value = row[key]; if (value == null) return null; if (!Array.isArray(value) || value.some(item => typeof item !== 'string')) throw invalid(); return value }
export function rows(row: Row, key: string): Row[] | null { const value = row[key]; if (value == null) return null; if (!Array.isArray(value)) throw invalid(); return value.map(object) }
export function context(value: unknown, id: string) { const row = object(value); if (text(row, 'cruiseId') !== id) throw invalid(); return row }
function instant(row: Row, key: string) { const value = text(row, key); if (value != null && !Number.isFinite(Date.parse(value))) throw invalid(); return value }

function count(row: Row, key: string) {
  const value = number(row, key)
  if (value != null && !Number.isSafeInteger(value)) throw invalid()
  return value
}
function readinessMetadata(row: Row) {
  const status = text(row, 'status')
  if (status != null && !['READY','NOT_READY','INDETERMINATE','WARNING','NOT_APPLICABLE'].includes(status)) throw invalid()
  const details: ReadinessIssueDto[] | null = rows(row, 'details')?.map(item => ({
    code:text(item,'code'),targetType:text(item,'targetType'),targetId:text(item,'targetId'),scope:text(item,'scope'),severity:text(item,'severity'),
    message:text(item,'message'),evidence:text(item,'evidence'),allowedAction:text(item,'allowedAction'),requiredPermission:text(item,'requiredPermission'),
    ownerRole:text(item,'ownerRole'),remediationUrl:text(item,'remediationUrl'),remediationOperation:text(item,'remediationOperation'),
  })) ?? null
  return { gateType:text(row,'gateType'),policyVersion:text(row,'policyVersion'),status:status as ReadinessStatusDto|null, fingerprint:text(row,'fingerprint'), validUntil:instant(row,'validUntil'), details }
}
export function decodePreparation(value:unknown,id:string):PreparationDashboard {
  const r=context(value,id),sectionRows=rows(r,'sections');if(!sectionRows)throw invalid()
  const sections=sectionRows.map(s=>{const sectionCode=text(s,'sectionCode');if(!sectionCode)throw invalid();return {sectionCode,sectionName:text(s,'sectionName'),ownerRole:text(s,'ownerRole'),status:text(s,'status'),evidence:text(s,'evidence'),notes:text(s,'notes'),submittedByUserId:text(s,'submittedByUserId'),submittedAt:instant(s,'submittedAt'),confirmedByUserId:text(s,'confirmedByUserId'),confirmedByUsername:text(s,'confirmedByUsername'),confirmedAt:instant(s,'confirmedAt'),returnReason:text(s,'returnReason'),returnedAt:instant(s,'returnedAt'),revision:count(s,'revision'),checkItems:rows(s,'checkItems')?.map(c=>({itemCode:text(c,'itemCode'),itemName:text(c,'itemName'),ready:flag(c,'ready'),details:text(c,'details')}))??null}})
  if(new Set(sections.map(s=>s.sectionCode)).size!==sections.length)throw invalid()
  return {cruiseId:id,cruiseCode:text(r,'cruiseCode'),cruiseName:text(r,'cruiseName'),cruiseStatus:text(r,'cruiseStatus'),overallStatus:text(r,'overallStatus'),allConfirmed:flag(r,'allConfirmed'),sections,lastUpdatedAt:instant(r,'lastUpdatedAt')}
}
export function decodeAuditEvents(value:unknown,id:string):CruiseAuditEvent[] {
  if(!Array.isArray(value))throw invalid()
  return value.map(item=>{const r=context(item,id),eventId=text(r,'eventId');if(!eventId)throw invalid();return {eventId,cruiseId:id,eventType:text(r,'eventType'),eventIdentity:text(r,'eventIdentity'),actorUsername:text(r,'actorUsername'),actorRole:text(r,'actorRole'),requiredPermission:text(r,'requiredPermission'),scope:text(r,'scope'),beforeDigest:text(r,'beforeDigest'),afterDigest:text(r,'afterDigest'),reason:text(r,'reason'),evidence:text(r,'evidence'),fingerprint:text(r,'fingerprint'),sourceVersionId:text(r,'sourceVersionId'),revision:count(r,'revision'),timestamp:instant(r,'timestamp')}})
}
export function decodeNotificationAggregate(value:unknown,id:string):ImpactNotificationAggregate {
  const r=context(value,id);return {cruiseId:id,cruiseCode:text(r,'cruiseCode'),totalImpactedBookings:count(r,'totalImpactedBookings'),totalImpactedPassengers:count(r,'totalImpactedPassengers'),notificationsSentCount:count(r,'notificationsSentCount'),inAppDeliveredCount:count(r,'inAppDeliveredCount'),deliveryChannel:text(r,'deliveryChannel'),deliverySemantics:text(r,'deliverySemantics'),notificationsPendingCount:count(r,'notificationsPendingCount'),notificationsFailedCount:count(r,'notificationsFailedCount'),notificationsAcknowledgedCount:count(r,'notificationsAcknowledgedCount'),deliveryStatus:text(r,'deliveryStatus'),lastDispatchedAt:instant(r,'lastDispatchedAt')}
}
export function decodeReadiness(value: unknown, id: string): ReadinessDto {
  const r=context(value,id), ready=flag(r,'ready')
  if(ready==null)throw invalid()
  return { cruiseId:id,ready,...readinessMetadata(r),evaluatedAt:instant(r,'evaluatedAt'),cruiseRevision:count(r,'cruiseRevision'),
    shipAssigned:flag(r,'shipAssigned')??undefined,shipActive:flag(r,'shipActive')??undefined,scheduleValid:flag(r,'scheduleValid')??undefined,
    shipConfigurationValid:flag(r,'shipConfigurationValid')??undefined,portsActive:flag(r,'portsActive')??undefined,itineraryConfigured:flag(r,'itineraryConfigured')??undefined,
    staffAssigned:flag(r,'staffAssigned'),captainAssigned:flag(r,'captainAssigned'),regulationsCompliant:flag(r,'regulationsCompliant'),
    preparationSectionsConfirmed:flag(r,'preparationSectionsConfirmed'),unconfirmedPreparationSectionsCount:count(r,'unconfirmedPreparationSectionsCount'),
    staffConflicts:strings(r,'staffConflicts'),regulationConflicts:strings(r,'regulationConflicts'),blockers:strings(r,'blockers'),warnings:strings(r,'warnings'),issues:strings(r,'issues')??undefined }
}
export function decodeShipCompatibility(value: unknown, id: string, shipId: string): ShipCompatibilityDto {
  const r=context(value,id),compatible=flag(r,'compatible'),issues=strings(r,'issues')
  if(text(r,'shipId')!==shipId||compatible==null||!issues)throw invalid()
  return {cruiseId:id,shipId,compatible,issues,shipActive:flag(r,'shipActive'),scheduleAvailable:flag(r,'scheduleAvailable'),capacitySufficient:flag(r,'capacitySufficient'),shipConfigured:flag(r,'shipConfigured'),decksCount:count(r,'decksCount'),cabinsCount:count(r,'cabinsCount'),totalCapacity:count(r,'totalCapacity'),bookedPassengersCount:count(r,'bookedPassengersCount')}
}
export function decodeShipChange(value: unknown, id: string, newShipId: string): ShipChangeImpactDto {
  const r=context(value,id),canProceed=flag(r,'canProceed'),blockers=strings(r,'blockers'),warnings=strings(r,'warnings')
  if(text(r,'newShipId')!==newShipId||canProceed==null||!blockers||!warnings)throw invalid()
  return {cruiseId:id,currentShipId:text(r,'currentShipId'),newShipId,canProceed,blockers,warnings,bookedPassengersCount:count(r,'bookedPassengersCount'),capacitySufficient:flag(r,'capacitySufficient'),affectedCabinAssignmentsCount:count(r,'affectedCabinAssignmentsCount'),affectedOnboardActivitiesCount:count(r,'affectedOnboardActivitiesCount')}
}
export function decodeProgramSync(value: unknown, id: string): OperationalProgramSyncDto {
  const r=context(value,id),onboardActivitiesCount=count(r,'onboardActivitiesCount'),shoreExcursionsCount=count(r,'shoreExcursionsCount'),warnings=strings(r,'warnings')
  if(onboardActivitiesCount==null||shoreExcursionsCount==null||!warnings)throw invalid()
  return {cruiseId:id,onboardActivitiesCount,shoreExcursionsCount,servingWindowsCount:count(r,'servingWindowsCount'),warnings,syncedAt:instant(r,'syncedAt'),items:rows(r,'items')?.map(item=>({
    sourceEntryId:text(item,'sourceEntryId'),clientKey:text(item,'clientKey'),kind:text(item,'kind'),title:text(item,'title'),targetId:text(item,'targetId'),targetCode:text(item,'targetCode'),targetType:text(item,'targetType'),status:text(item,'status'),reservationRequired:flag(item,'reservationRequired'),reason:text(item,'reason'),warnings:strings(item,'warnings'),requiredData:text(item,'requiredData'),
  }))??null}
}

export function decodeSchedule(value: unknown): DepartureSchedule {
  const row = object(value), days = rows(row, 'days')
  if (!days) throw invalid()
  const decoded = days.map(day => {
    const dayNumber = number(day, 'dayNumber')
    if (!dayNumber || !Number.isSafeInteger(dayNumber)) throw invalid()
    const stops = rows(day, 'stops'), entries = rows(day, 'entries')
    if (!stops || !entries) throw invalid()
    return { itineraryDayId: text(day, 'itineraryDayId'), dayNumber, calendarDate: text(day, 'calendarDate'), dayRole: text(day, 'dayRole'), dayType: text(day, 'dayType'), title: text(day, 'title'), shipTimeZoneId: text(day, 'shipTimeZoneId'),
      stops: stops.map(stop => ({ cruiseStopId: text(stop, 'cruiseStopId'), portCode: text(stop, 'portCode'), tenderTransferMinutes: number(stop, 'tenderTransferMinutes'), sourceStopId: text(stop, 'sourceStopId'), stopOrder: number(stop, 'stopOrder'), portId: text(stop, 'portId'), portName: text(stop, 'portName'), countryCode: text(stop, 'countryCode'), portTimeZoneId: text(stop, 'portTimeZoneId'), plannedArrival: instant(stop, 'plannedArrival'), plannedDeparture: instant(stop, 'plannedDeparture'), allAboardTime: instant(stop, 'allAboardTime'), callType: text(stop, 'callType'), arrivalMethod: text(stop, 'arrivalMethod') })),
      entries: entries.map(entry => ({ category: text(entry, 'category'), sourceActivityId: text(entry, 'sourceActivityId'), sourceExcursionId: text(entry, 'sourceExcursionId'), targetId: text(entry, 'targetId'), targetCode: text(entry, 'targetCode'), status: text(entry, 'status'), sourceEntryId: text(entry, 'sourceEntryId'), clientKey: text(entry, 'clientKey'), kind: text(entry, 'kind'), plannedStartTime: instant(entry, 'plannedStartTime'), plannedEndTime: instant(entry, 'plannedEndTime'), stopOrder: number(entry, 'stopOrder') })) }
  })
  if (new Set(decoded.map(day => day.dayNumber)).size !== decoded.length) throw invalid()
  return {
    sourceTripCode: text(row, 'sourceTripCode'), sourceTripName: text(row, 'sourceTripName'), sourceVersionNumber: number(row, 'sourceVersionNumber'),
    durationDays: number(row, 'durationDays'), durationNights: number(row, 'durationNights'),
    departurePortName: text(row, 'departurePortName'), departurePortCode: text(row, 'departurePortCode'), returnPortName: text(row, 'returnPortName'), returnPortCode: text(row, 'returnPortCode'),
    itineraryId: text(row, 'itineraryId'), itineraryStatus: text(row, 'itineraryStatus'), materialized: flag(row, 'materialized'), warnings: strings(row, 'warnings'),
    sourceTripId: text(row, 'sourceTripId'), sourceVersionId: text(row, 'sourceVersionId'), sourceVersionRevision: number(row, 'sourceVersionRevision'), departureDatetime: instant(row, 'departureDatetime'), returnDatetime: instant(row, 'returnDatetime'), departurePortId: text(row, 'departurePortId'), returnPortId: text(row, 'returnPortId'), days: decoded,
  }
}

export function decodeInventory(value: unknown, id: string): InventorySummary {
  const r = context(value, id)
  return { cruiseId: id, cruiseCode:text(r,'cruiseCode'),shipName:text(r,'shipName'),shipId: text(r, 'shipId'), physicalCapacity: number(r, 'physicalCapacity'), totalCabins: number(r, 'totalCabins'), operationalCabins: number(r, 'operationalCabins'),blockedCabins:count(r,'blockedCabins'),canSell:flag(r,'canSell'),policyVersion:text(r,'policyVersion'), bookedPassengersCount: number(r, 'bookedPassengersCount'), heldPassengersCount: number(r, 'heldPassengersCount'), remainingCapacity: number(r, 'remainingCapacity'), activePackagesCount: number(r, 'activePackagesCount'),
    cabinTypeInventory: rows(r, 'cabinTypeInventory')?.map(c => ({ cabinType: text(c, 'cabinType'), totalCabins: number(c, 'totalCabins'), operationalCabins: number(c, 'operationalCabins'), totalSlots: number(c, 'totalSlots'), occupiedSlots: number(c, 'occupiedSlots'), remainingSlots: number(c, 'remainingSlots'), baseFare: number(c, 'baseFare'),blockedCabins:count(c,'blockedCabins'),bookedSlots:count(c,'bookedSlots'),heldSlots:count(c,'heldSlots'),canSell:flag(c,'canSell') })) ?? null }
}
export function decodePublicSellability(value:unknown,id:string):PublicSellability {
  const r=context(value,id)
  return {cruiseId:id,cruiseCode:text(r,'cruiseCode'),cruiseName:text(r,'cruiseName'),departureDatetime:instant(r,'departureDatetime'),returnDatetime:instant(r,'returnDatetime'),sellable:flag(r,'sellable'),saleState:text(r,'saleState'),stopReason:text(r,'stopReason'),stoppedAt:instant(r,'stoppedAt'),totalCapacity:count(r,'totalCapacity'),remainingCapacity:count(r,'remainingCapacity'),pricingPolicyVersion:text(r,'pricingPolicyVersion'),currency:text(r,'currency'),depositPercentage:number(r,'depositPercentage'),finalPaymentCutoffDays:count(r,'finalPaymentCutoffDays'),
    cabinTypes:rows(r,'cabinTypes')?.map(c=>({cabinType:text(c,'cabinType'),baseFare:number(c,'baseFare'),currency:text(c,'currency'),totalSlots:count(c,'totalSlots'),availableSlots:count(c,'availableSlots'),sellable:flag(c,'sellable')}))??null,
    availablePackages:rows(r,'availablePackages')?.map(p=>({tourPackageId:text(p,'tourPackageId'),packageCode:text(p,'packageCode'),packageName:text(p,'packageName'),price:number(p,'price'),currency:text(p,'currency'),mandatory:flag(p,'mandatory'),entitlementType:text(p,'entitlementType'),sellable:flag(p,'sellable')}))??null}
}
export function decodeSaleReadiness(value: unknown, id: string): SaleReadiness {
  const r = context(value, id), ready = flag(r, 'ready')
  if (ready == null) throw invalid()
  return { cruiseId: id, ready,...readinessMetadata(r),cabinOnlySalePermitted:flag(r,'cabinOnlySalePermitted'),priceVersion:text(r,'priceVersion'),shipVersion:text(r,'shipVersion'),supplierVersion:text(r,'supplierVersion'),activePackagesCount:count(r,'activePackagesCount'),remainingCapacity:count(r,'remainingCapacity'),physicalCapacity:count(r,'physicalCapacity'), operationalReady: flag(r, 'operationalReady'), packagesConfigured: flag(r, 'packagesConfigured'), inventoryAvailable: flag(r, 'inventoryAvailable'), departureInFuture: flag(r, 'departureInFuture'), pricingConfigured: flag(r, 'pricingConfigured'), blockers: strings(r, 'blockers'), warnings: strings(r, 'warnings'), issues: strings(r, 'issues'), evaluatedAt: instant(r, 'evaluatedAt'), cruiseRevision: count(r, 'cruiseRevision') }
}
export function decodeImpactTask(value: unknown, id: string): ImpactTask {
  const r = context(value, id)
  return { cruiseId: id,taskCode:text(r,'taskCode'),category:text(r,'category'),eventIdentity:text(r,'eventIdentity'),targetType:text(r,'targetType'),targetId:text(r,'targetId'),assignedToUserId:text(r,'assignedToUserId'),resolvedByUserId:text(r,'resolvedByUserId'),resolvedByUsername:text(r,'resolvedByUsername'),resolvedAt:instant(r,'resolvedAt'), taskId: text(r, 'taskId'), title: text(r, 'title'), description: text(r, 'description'), status: text(r, 'status'), severity: text(r, 'severity'), assignedToUsername: text(r, 'assignedToUsername'), evidence: text(r, 'evidence'), resolutionNotes: text(r, 'resolutionNotes'), revision: count(r, 'revision'), createdAt: instant(r, 'createdAt'), updatedAt: instant(r, 'updatedAt') }
}
export function decodeChange(value: unknown, id: string): ChangePreview {
  const r = context(value, id)
  const dateShiftDays=r.dateShiftDays
  if(dateShiftDays!=null&&(typeof dateShiftDays!=='number'||!Number.isSafeInteger(dateShiftDays)))throw invalid()
  return { cruiseId: id,scheduleImpacted:flag(r,'scheduleImpacted'),dateShiftDays:dateShiftDays==null?null:dateShiftDays as number,shipImpacted:flag(r,'shipImpacted'),bookedPassengersCount:count(r,'bookedPassengersCount'), currentRevision: count(r, 'currentRevision'), canProceed: flag(r, 'canProceed'), affectedBookingsCount: count(r, 'affectedBookingsCount'), affectedActivitiesCount: count(r, 'affectedActivitiesCount'), affectedExcursionsCount: count(r, 'affectedExcursionsCount'), blockers: strings(r, 'blockers'), warnings: strings(r, 'warnings'), generatedTasks: rows(r, 'generatedTasks')?.map(task => decodeImpactTask(task, id)) ?? null }
}
export function decodeHandoff(value: unknown, id: string): DownstreamHandoff {
  const r = context(value, id)
  return { cruiseId: id, cruiseCode: text(r, 'cruiseCode'), cruiseStatus: text(r, 'cruiseStatus'), sourceTripCode: text(r, 'sourceTripCode'), sourceVersionId: text(r, 'sourceVersionId'), sourceVersionNumber: number(r, 'sourceVersionNumber'), shipName: text(r, 'shipName'), departureDatetime: instant(r, 'departureDatetime'), returnDatetime: instant(r, 'returnDatetime'), totalBookingsCount: number(r, 'totalBookingsCount'), confirmedBookingsCount: number(r, 'confirmedBookingsCount'), draftBookingsCount: number(r, 'draftBookingsCount'), cancelledBookingsCount: number(r, 'cancelledBookingsCount'), totalPassengersCount: number(r, 'totalPassengersCount'), checkedInPassengersCount: number(r, 'checkedInPassengersCount'), boardedPassengersCount: number(r, 'boardedPassengersCount'), captainAssigned: flag(r, 'captainAssigned'), departureClearanceReady: flag(r, 'departureClearanceReady'), manifestLocked: flag(r, 'manifestLocked') }
}

/** View state only. A readiness response does not authorize sale mutations. */
export function saleAssessment(value: SaleReadiness | null, revision?: number | null, updatedAt?: string, now=Date.now()) {
  if (!value) return 'UNKNOWN'
  if (value.status==='INDETERMINATE'||value.status==='NOT_APPLICABLE') return 'UNKNOWN'
  if (value.cruiseRevision == null || !value.evaluatedAt) return 'UNKNOWN'
  if (revision != null && value.cruiseRevision !== revision || updatedAt && Date.parse(updatedAt) > Date.parse(value.evaluatedAt) || value.validUntil && Date.parse(value.validUntil)<=now) return 'STALE'
  if (!value.ready || value.status==='NOT_READY' || value.blockers?.length || value.details?.some(issue=>issue.severity==='BLOCKER')) return 'BLOCKED'
  return 'UNVERIFIED'
}
