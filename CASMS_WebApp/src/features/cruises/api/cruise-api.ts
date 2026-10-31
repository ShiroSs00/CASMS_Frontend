import { getSessionAccess, hasPermissions } from '@/shared/auth'
import { ApiError, apiRequest, apiRequestRaw } from '@/shared/api'
import { scheduleInstant, localCruiseInput } from '../model/cruise-validation'
import { readinessSnapshot } from '../model/readiness'
import { decodeProgramSync, decodeReadiness, decodeSchedule, decodeShipChange, decodeShipCompatibility } from '../model/departure-contract'

import type { CruiseQuery } from '../model/cruise-query'
import { CRUISE_STATUSES, CRUISE_TYPES } from '../model/cruise-record'
import type { CruiseDraft, CruiseRecord, PortRecord, ShipRecord } from '../model/cruise-record'
import type { CruiseDetailView, CruiseListItem, CruiseListResult, ReadinessCheck, ItinerarySummary } from '../model/cruise-view'
import type { ShipCandidate } from '../model/ship-assignment'
import type { CapacityDto, CruiseDto, CruiseSaveRequestDto, PageDto, ReadinessDto } from './dto'

const root = '/cruise'
const byId = (id: string) => `${root}/${encodeURIComponent(id)}`
async function readReadiness(id:string,signal?:AbortSignal) {
  return decodeReadiness(await apiRequest<unknown>(`${byId(id)}/readiness`,{signal}),id)
}

type RegulationProjection = {
  source: 'CRUISE' | 'SHIP' | 'GLOBAL'
  regulation: { regulationId: string; regulationCode: string; name: string; status: 'DRAFT' | 'ACTIVE' | 'INACTIVE' | 'EXPIRED' }
}

function cruiseBody(draft: CruiseDraft): CruiseSaveRequestDto {
  return { cruiseName:draft.cruiseName.trim(), itineraryMode:draft.itineraryMode, plannedScope:draft.plannedScope,
    ...(!draft.sourceVersionId && draft.shipId ? {shipId:draft.shipId} : {}),
    ...(draft.sourceVersionId ? {sourceVersionId:draft.sourceVersionId} : {}),
    ...(draft.cruiseType ? {cruiseType:draft.cruiseType} : {}),
    departureDatetime:scheduleInstant(draft.departureDatetime).toISOString(), returnDatetime:scheduleInstant(draft.returnDatetime).toISOString(),
    departurePortId:draft.departurePortId, returnPortId:draft.returnPortId }
}
async function readPage<T>(path: string, page: number, signal?: AbortSignal) {
  const result = await apiRequest<PageDto<T>>(path,{query:{page,size:100},signal})
  if (!result || !Array.isArray(result.content) || !Number.isSafeInteger(result.totalPages) || result.totalPages < 0 || result.totalPages > 10000) throw new ApiError('Danh sách phân trang từ hệ thống không hợp lệ.',502)
  return result
}

function toCruise(dto: CruiseDto): CruiseRecord {
  if (!dto || [dto.cruiseId, dto.cruiseCode, dto.cruiseName, dto.departurePortId, dto.returnPortId].some(value => typeof value !== 'string' || !value.trim()) || !CRUISE_STATUSES.includes(dto.status) || !CRUISE_TYPES.includes(dto.cruiseType) || [dto.departureDatetime, dto.returnDatetime, dto.createdAt, dto.updatedAt].some(value => typeof value !== 'string' || !Number.isFinite(Date.parse(value)))) throw new ApiError('Thông tin chuyến khởi hành trả về chưa đúng định dạng. Đối chiếu dữ liệu trước khi tiếp tục.', 502)
  if (dto.revision != null && (!Number.isSafeInteger(dto.revision) || dto.revision < 0)) throw new ApiError('Phiên dữ liệu chuyến khởi hành không hợp lệ.', 502)
  return {
    itineraryMode:dto.itineraryMode, plannedScope:dto.plannedScope,
    revision: dto.revision ?? null,
    cruiseId: dto.cruiseId,
    cruiseCode: dto.cruiseCode,
    cruiseName: dto.cruiseName,
    shipId: dto.shipId ?? dto.ship?.shipId ?? null,
    cruiseType: dto.cruiseType,
    departureDatetime: dto.departureDatetime,
    returnDatetime: dto.returnDatetime,
    departurePortId: dto.departurePortId,
    returnPortId: dto.returnPortId,
    status: dto.status,
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt,
    sourceTripId: dto.sourceTripId ?? null,
    sourceTripCode: dto.sourceTripCode ?? null,
    sourceVersionId: dto.sourceVersionId ?? null,
    sourceVersionNumber: dto.sourceVersionNumber ?? null,
  }
}

const fallbackPort = (id: string): PortRecord => ({
  portId: id, portCode: null, portName: 'Chưa tải thông tin cảng', countryCode: '', timeZoneId: '', status: 'UNKNOWN',
})

function toItem(dto: CruiseDto): CruiseListItem {
  return {
    cruise: toCruise(dto),
    ship: dto.ship ?? null,
    departurePort: dto.departurePort ?? { ...fallbackPort(dto.departurePortId), portName: dto.departurePortName ?? dto.departurePortId },
    returnPort: dto.returnPort ?? { ...fallbackPort(dto.returnPortId), portName: dto.returnPortName ?? dto.returnPortId },
    itinerary: null,
  }
}

async function getShip(id: string | null, signal?: AbortSignal) {
  if (!id) return null
  return apiRequest<ShipRecord>(`/ships/${encodeURIComponent(id)}`, { signal })
}

async function getPort(id: string, signal?: AbortSignal) {
  return apiRequest<PortRecord>(`/ports/${encodeURIComponent(id)}`, { signal })
}

async function listShips(signal?: AbortSignal) {
  const first = await readPage<ShipRecord>('/ships',0,signal)
  const ships = [...first.content]
  for (let page=1;page<first.totalPages;page++) ships.push(...(await readPage<ShipRecord>('/ships',page,signal)).content)
  return ships
}

function readinessChecks(value: ReadinessDto,fromSource=false): ReadinessCheck[] {
  const issue = (keywords:string[], fallback:string) => value.issues?.find(item=>keywords.some(keyword=>item.toLocaleLowerCase('vi').includes(keyword)))??fallback
  const state=(flag:boolean|undefined):ReadinessCheck['state']=>flag===true?'PASS':flag===false?'BLOCKED':'UNKNOWN'
  const shipState=value.shipAssigned===false||value.shipActive===false?'BLOCKED':value.shipAssigned===true&&value.shipActive===true?'PASS':'UNKNOWN'
  return [
    {key:'SHIP',label:'Phân công tàu',state:shipState,reason:shipState==='PASS'?'Tàu đã được phân công và đang hoạt động.':issue(['ship','gán tàu','phân công tàu'],shipState==='UNKNOWN'?'Chưa đủ dữ liệu kiểm tra tàu.':'Chưa có tàu hoạt động được phân công.')},
    {key:'SCHEDULE',label:'Lịch chạy',state:state(value.scheduleValid),reason:value.scheduleValid?'Lịch chạy đáp ứng kiểm tra hiện có.':issue(['schedule','lịch chạy','thời điểm'],value.scheduleValid===false?'Cần kiểm tra lịch chạy.':'Chưa đủ dữ liệu kiểm tra lịch chạy.')},
    {key:'ITINERARY',label:fromSource?'Lịch thực tế từ nguồn':'Lịch trình',state:state(value.itineraryConfigured),reason:value.itineraryConfigured?'Lịch thực tế đáp ứng kiểm tra hiện có.':fromSource&&value.itineraryConfigured===false?'Lịch trình nguồn đã phát hành, nhưng lịch thực tế chưa được BE chấp nhận. Cần đối chiếu trạng thái lịch của chuyến khởi hành; không tự gửi duyệt lại nguồn.':issue(['itinerary','lịch trình','hải trình'],value.itineraryConfigured===false?'Lịch trình chưa đáp ứng điều kiện vận hành/phát hành.':'Chưa đủ dữ liệu kiểm tra lịch trình.')},
    {key:'CONFIGURATION',label:'Cấu hình tàu',state:state(value.shipConfigurationValid),reason:value.shipConfigurationValid?'Cấu hình boong và cabin đáp ứng kiểm tra hiện có.':issue(['configuration','boong','cabins','decks'],value.shipConfigurationValid===false?'Cần hoàn tất cấu hình boong và cabin.':'Chưa đủ dữ liệu kiểm tra cấu hình tàu.')},
    {key:'PORTS',label:'Cảng đi / về',state:state(value.portsActive),reason:value.portsActive?'Cảng đi và cảng về đang hoạt động.':issue(['ports','cảng đi','cảng về'],value.portsActive===false?'Cần kiểm tra trạng thái cảng.':'Chưa đủ dữ liệu kiểm tra cảng.')},
  ]
}

async function linkedItinerary(cruiseId: string, signal?: AbortSignal): Promise<ItinerarySummary | null> {
  const schedule=decodeSchedule(await apiRequest<unknown>(byId(cruiseId)+'/schedule',{signal}))
  if(!schedule.materialized||!schedule.itineraryId)return null
  const found=await apiRequest<ItinerarySummary & {cruiseId:string}>('/itineraries/'+encodeURIComponent(schedule.itineraryId),{signal})
  if(found?.itineraryId!==schedule.itineraryId||found.cruiseId!==cruiseId)throw new ApiError('Lịch trả về chưa khớp chuyến khởi hành.',502)
  return {...found,dayCount:schedule.days.length,portCallCount:schedule.days.reduce((sum,day)=>sum+day.stops.length,0),seaDayCount:schedule.days.filter(day=>day.dayType==='SEA_DAY').length,routeLabel:'',schedule:[]}
}

export const cruiseApi = {
  async list(query: CruiseQuery, signal?: AbortSignal): Promise<CruiseListResult> {
    if (query.shipId === 'UNASSIGNED') {
      await apiRequestRaw('/v3/api-docs', value => {
        const spec=value as { paths?: Record<string, { get?: { parameters?: { name?: string; in?: string }[] } }> } | null
        const parameters=spec?.paths?.['/cruise']?.get?.parameters
        if(!Array.isArray(parameters)||!parameters.some(parameter=>parameter.name==='unassigned'&&parameter.in==='query')) {
          throw new ApiError('Chưa xác minh được bộ lọc chuyến khởi hành chưa phân công trên hệ thống. Vui lòng liên hệ quản trị viên.',502)
        }
        return true
      },{signal,authenticated:false})
    }
    const page = await apiRequest<PageDto<CruiseDto>>(root, {
      query: {
        status: query.status || undefined,
        shipId: query.shipId && query.shipId !== 'UNASSIGNED' ? query.shipId : undefined,
        unassigned: query.shipId === 'UNASSIGNED' ? true : undefined,
        cruiseType: query.cruiseType || undefined,
        sourceTripId: query.sourceTripId || undefined,
        sourceVersionId: query.sourceVersionId || undefined,
        page: query.page - 1,
        size: query.pageSize,
        sort: 'createdAt,cruiseId,desc',
      }, signal,
    })
    const items = page.content.map(toItem)
    const shipIds = [...new Set(items.flatMap((item) => item.cruise.shipId ? [item.cruise.shipId] : []))]
    const ships = await Promise.allSettled(shipIds.map(id => getShip(id,signal)))
    for (const item of items) {
      const result = ships[shipIds.indexOf(item.cruise.shipId ?? '')]
      if (result?.status === 'fulfilled') item.ship = result.value
    }
    // BE has no batch readiness contract. Read it on detail, never once per list row.
    return {
      items,
      total: page.totalElements,
      page: page.number + 1,
      pageSize: page.size ?? query.pageSize,
      pageCount: Math.max(1, page.totalPages),
      metrics: {
        conflict: undefined,
        draft: items.filter((item) => item.cruise.status === 'DRAFT').length,
        published: items.filter((item) => item.cruise.status === 'PUBLISHED').length,
        completed: items.filter((item) => item.cruise.status === 'COMPLETED').length,
        inProgress: items.filter((item) => item.cruise.status === 'IN_PROGRESS').length,
      },
    }
  },
  listShips,
  async listPorts(signal?: AbortSignal,tripId?:string) {
    // Planning catalog returns ACTIVE ports only, scoped authoritatively by Trip.
    const rows = await apiRequest<PortRecord[]>(tripId?'/trip-planning/catalogs/sources/ports':'/ports/active',{signal,...(tripId?{query:{tripId}}:{})})
    const ports=tripId&&Array.isArray(rows)?rows.map(port=>({...port,status:'ACTIVE' as const})):rows
    if (!Array.isArray(ports) || ports.some(port => !port || typeof port.portId !== 'string' || !port.portId || typeof port.portName !== 'string' || !port.portName.trim() || port.status !== 'ACTIVE') || new Set(ports.map(port=>port.portId)).size !== ports.length) throw new ApiError('Không đọc được danh sách cảng hoạt động. Vui lòng thử lại.',502)
    return [...ports].sort((a,b)=>a.portName.localeCompare(b.portName,'vi'))
  },
  async getDetail(id: string, signal?: AbortSignal, onCore?: (detail: CruiseDetailView) => void): Promise<CruiseDetailView> {
    const dto = await apiRequest<CruiseDto>(byId(id), { signal })
    if(dto?.cruiseId!==id||typeof dto.status!=='string')throw new ApiError('Chi tiết trả về chưa khớp chuyến khởi hành đã chọn.',502)
    const cruise = toCruise(dto)
    const base: CruiseDetailView = {
      ...toItem(dto), supplementaryLoading: true, supplementaryErrors: {},
      capacity: { shipTotalCapacity: null, activePassengerCount: null, remainingPassengerHeadroom: null },
      readiness: { state: 'UNKNOWN', checks: [] }, regulations: [], issues: [], bookingHasData: null,
      assignmentCapabilities: { assign: { allowed: false, reason: 'Đang tải thông tin phân công.' }, change: { allowed: false, reason: 'Đang tải thông tin phân công.' }, unassign: { allowed: false, reason: 'Đang tải thông tin phân công.' } },
    }
    onCore?.(base)
    const access = getSessionAccess()
    const optional = <T,>(permission: string, load: () => Promise<T>) => hasPermissions(access,{mode:'ANY',permissions:[permission]}) ? load() : Promise.resolve(null)
    const results = await Promise.allSettled([
      optional('SHIP_READ', () => dto.ship ? Promise.resolve(dto.ship) : getShip(cruise.shipId, signal)),
      optional('PORT_READ', () => dto.departurePort ? Promise.resolve(dto.departurePort) : getPort(cruise.departurePortId, signal)),
      optional('PORT_READ', () => dto.returnPort ? Promise.resolve(dto.returnPort) : getPort(cruise.returnPortId, signal)),
      optional('CRUISE_VALIDATE', () => readReadiness(id, signal)),
      cruise.shipId ? optional('CRUISE_VALIDATE', () => apiRequest<CapacityDto>(`${byId(id)}/validate-capacity`, { signal })) : Promise.resolve(null),
      optional('OPERATIONAL_ISSUE_READ', () => apiRequest<CruiseDetailView['issues']>('/operational-issues', { query: { cruiseId: id }, signal })),
      optional('CRUISE_REGULATION_READ', () => apiRequest<{ direct: RegulationProjection[]; inherited: RegulationProjection[] }>(`/cruises/${encodeURIComponent(id)}/regulations/effective`, { signal })),
      optional('ITINERARY_READ', () => linkedItinerary(id, signal)),
      hasPermissions(access,{mode:'ANY',permissions:['CRUISE_ASSIGN_SHIP','CRUISE_CHANGE_SHIP','CRUISE_UNASSIGN_SHIP']})
        ? apiRequest<{cruiseId:string;cruiseRevision:number;hasBookings:boolean;editablePlan:boolean}>(`/cruise-plans/${encodeURIComponent(id)}/ship-assignment-context`,{signal}).then(context=>{
            if(context.cruiseId!==id||!Number.isSafeInteger(context.cruiseRevision)||typeof context.hasBookings!=='boolean'||typeof context.editablePlan!=='boolean')throw new ApiError('Không thể hoàn tất thao tác. Vui lòng tải lại và thử lại.',502)
            return context
          }) : Promise.resolve(null),
    ])
    const supplementaryErrors: Record<string, string> = {}
    for (const [index, key] of ['ship', 'departurePort', 'returnPort', 'readiness', 'capacity', 'issues', 'regulations', 'itinerary','bookingSafety'].entries()) {
      const result = results[index]
      if (result.status === 'rejected') supplementaryErrors[key] = result.reason instanceof Error ? result.reason.message : 'Không tải được dữ liệu liên quan.'
    }
    const [s, p, r, ready, cap, incidents, regulations, plan] = results
    const ship = s.status === 'fulfilled' ? s.value : null
    const departurePort = p.status === 'fulfilled' && p.value ? p.value : { ...fallbackPort(cruise.departurePortId), portName: 'Chưa tải được cảng đi' }
    const returnPort = r.status === 'fulfilled' && r.value ? r.value : { ...fallbackPort(cruise.returnPortId), portName: 'Chưa tải được cảng về' }
    const readiness = ready.status === 'fulfilled' ? ready.value : null
    const capacity = cap.status === 'fulfilled' ? cap.value : null
    const regulationSnapshot = regulations.status === 'fulfilled' ? regulations.value : null
    const bookingSummary=results[8].status==='fulfilled'?results[8].value:null
    const noBookings=bookingSummary?.hasBookings===false&&bookingSummary.cruiseRevision===cruise.revision
    const assessment=readinessSnapshot(readiness,cruise.updatedAt,cruise.revision)
    const checks=readiness?readinessChecks(readiness,Boolean(cruise.sourceVersionId)):[]
    const safeDraft=cruise.status==='DRAFT'&&noBookings&&bookingSummary?.editablePlan===true
    const unsafeReason=cruise.status!=='DRAFT'?'Chỉ thay đổi trực tiếp khi chuyến khởi hành còn nháp; trường hợp sau phát hành cần đánh giá tác động.':!noBookings?'Cần xác nhận không có đặt chỗ trước khi thay đổi phân công.':!bookingSummary?.editablePlan?'Kế hoạch đang bị khóa. Cần xử lý trạng thái kế hoạch trước khi đổi phân công.':null
    return {
      cruise,
      ship,
      departurePort,
      returnPort,
      itinerary: plan.status === 'fulfilled' ? plan.value : null,
      supplementaryLoading: false, supplementaryErrors,
      capacity: { shipTotalCapacity: capacity?.shipTotalCapacity ?? null, activePassengerCount: capacity?.bookedPassengersCount ?? null, remainingPassengerHeadroom: capacity?.availableCapacity ?? null },
      readiness: { ...assessment,details:readiness?.details, checks: assessment.state==='UNKNOWN'?checks.map(check=>({...check,state:'UNKNOWN' as const,reason:'Chưa có đánh giá hiện hành đủ tin cậy. Tải lại điều kiện để đối chiếu.'})):checks, issues: readiness?.issues },
      regulations: regulationSnapshot ? [...regulationSnapshot.direct, ...regulationSnapshot.inherited].map((item) => ({ regulationId: item.regulation.regulationId, code: item.regulation.regulationCode, name: item.regulation.name, source: item.source, status: item.regulation.status })) : [],
      issues: incidents.status === 'fulfilled' ? incidents.value ?? [] : [],
      bookingHasData: bookingSummary?.hasBookings??null,
      assignmentCapabilities: {
        assign: { allowed: !cruise.shipId && safeDraft, reason: cruise.shipId ? 'Chuyến đã có tàu.' : unsafeReason },
        change: { allowed: Boolean(ship) && safeDraft, reason: unsafeReason??(ship?null:'Chưa tải được tàu để đổi phân công.') },
        unassign: { allowed: Boolean(ship) && safeDraft, reason: unsafeReason },
      },
    }
  },
  async createCruise(draft: CruiseDraft, idempotencyKey: string, expectedSourceVersionRevision = draft.expectedSourceVersionRevision ?? undefined) {
    if (!idempotencyKey?.trim()) throw new ApiError('Thiếu mã thao tác tạo chuyến khởi hành.', 400, 'INVALID_INPUT')
    if (expectedSourceVersionRevision != null && (!draft.sourceVersionId || !Number.isSafeInteger(expectedSourceVersionRevision) || expectedSourceVersionRevision < 0)) throw new ApiError('Phiên dữ liệu nguồn không hợp lệ. Xem trước lại lịch trước khi tạo.', 400, 'INVALID_INPUT')
    const body: CruiseSaveRequestDto = { ...cruiseBody(draft), ...(expectedSourceVersionRevision != null ? { expectedSourceVersionRevision } : {}) }
    const saved=await apiRequest<CruiseDto>(root, { method: 'POST', body, idempotencyKey })
    if(typeof saved?.cruiseId!=='string'||!saved.cruiseId.trim()||typeof saved.status!=='string')throw new ApiError('Phản hồi tạo chưa xác nhận được bản ghi đã lưu. Giữ mã thao tác để đối chiếu.',502)
    return toCruise(saved)
  },
  async updateCruise(id: string, draft: CruiseDraft, original?: CruiseRecord) {
    const body = cruiseBody(draft)
    const saved = await apiRequest<CruiseDto>(`${byId(id)}/draft`, { method: 'PATCH', body: { ...(draft.revision != null ? {expectedRevision:draft.revision} : {}), cruiseName: body.cruiseName, ...(original&&!original.sourceVersionId&&!original.sourceTripId?{plannedScope:body.plannedScope,itineraryMode:body.itineraryMode}:{}), ...(body.cruiseType ? {cruiseType:body.cruiseType} : {}), ...(!original || draft.departureDatetime !== localCruiseInput(original.departureDatetime) ? { departureDatetime: body.departureDatetime } : {}), ...(!original || draft.returnDatetime !== localCruiseInput(original.returnDatetime) ? { returnDatetime: body.returnDatetime } : {}), ...(!original || body.departurePortId !== original.departurePortId ? { departurePortId: body.departurePortId } : {}), ...(!original || body.returnPortId !== original.returnPortId ? { returnPortId: body.returnPortId } : {}) } })
    if(saved?.cruiseId!==id||typeof saved.status!=='string'||original&&!original.sourceVersionId&&!original.sourceTripId&&(body.plannedScope!=null&&saved.plannedScope!==body.plannedScope||body.itineraryMode!=null&&saved.itineraryMode!==body.itineraryMode))throw new ApiError('Phản hồi lưu chưa xác nhận đúng chuyến khởi hành. Giữ bản nhập và đối chiếu bản đã lưu trước khi gửi tiếp.',502)
    return toCruise(saved)
  },
  async shipCompatibility(id:string,shipId:string,signal?:AbortSignal){
    return decodeShipCompatibility(await apiRequest<unknown>(`${byId(id)}/ship-compatibility`,{query:{shipId},signal}),id,shipId)
  },
  async previewShipChange(id:string,newShipId:string,signal?:AbortSignal){
    return decodeShipChange(await apiRequest<unknown>(`${byId(id)}/preview-ship-change`,{query:{newShipId},signal}),id,newShipId)
  },
  async syncPrograms(id:string){
    return decodeProgramSync(await apiRequest<unknown>(`${byId(id)}/sync-operational-programs`,{method:'POST'}),id)
  },
  async checkShip(id:string,shipId:string,changing=false,signal?:AbortSignal){
    const r=await cruiseApi.shipCompatibility(id,shipId,signal)
    if(!changing)return {allowed:r.compatible,reasons:r.issues,compatibility:r,impact:null}
    const impact=await cruiseApi.previewShipChange(id,shipId,signal)
    return {allowed:r.compatible&&impact.canProceed,reasons:[...r.issues,...impact.blockers,...impact.warnings],compatibility:r,impact}
  },
  async getShipCandidates(id: string,changing=false,signal?:AbortSignal) {
    const ships = await listShips(signal)
    return Promise.all(ships.map(async (ship): Promise<ShipCandidate> => {
      if (!['READY','IN_SERVICE'].includes(ship.status)) return { ship, state: 'UNAVAILABLE', reasons: ['Trạng thái tàu chưa cho phép khai thác.'] }
      try{
        const result=await cruiseApi.checkShip(id,ship.shipId,changing,signal)
        return {ship,state:result.allowed?'AVAILABLE':'UNAVAILABLE',compatibility:result.compatibility,impact:result.impact,reasons:result.reasons.length?result.reasons:['Tàu đáp ứng kiểm tra lịch, cấu hình và sức chứa hiện có.']}
      }catch(error){if(signal?.aborted)throw error;return {ship,state:'UNKNOWN',reasons:[error instanceof Error?error.message:'Chưa kiểm tra được tàu.']}}
    }))
  },
  async assignShip(id: string, shipId: string) {
    const saved=toCruise(await apiRequest<CruiseDto>(`${byId(id)}/assign-ship`, { method: 'POST', query: { shipId } }))
    if(saved.cruiseId!==id||saved.shipId!==shipId)throw new ApiError('Phản hồi phân công chưa khớp tàu hoặc chuyến khởi hành. Tải lại để đối chiếu.',502)
    return saved
  },
  async changeShip(id: string, shipId: string) {
    const saved=toCruise(await apiRequest<CruiseDto>(`${byId(id)}/change-assigned-ship`, { method: 'PUT', query: { newShipId: shipId } }))
    if(saved.cruiseId!==id||saved.shipId!==shipId)throw new ApiError('Phản hồi đổi tàu chưa khớp yêu cầu. Tải lại để đối chiếu.',502)
    return saved
  },
  async unassignShip(id: string) {
    const saved=toCruise(await apiRequest<CruiseDto>(`${byId(id)}/unassign-ship`, { method: 'POST' }))
    if(saved.cruiseId!==id||saved.shipId!==null)throw new ApiError('Chưa xác nhận được kết quả gỡ tàu. Tải lại hồ sơ để đối chiếu.',502)
    return saved
  },
  async listPackages(id:string,signal?:AbortSignal) {
    const rows=await apiRequest<Array<{cruiseTourPackageId:string;cruiseId:string;tourPackageId:string;packageCode:string;packageName:string;active:boolean}>>(byId(id)+'/packages',{signal})
    if(!Array.isArray(rows)||rows.some(row=>!row||row.cruiseId!==id||typeof row.cruiseTourPackageId!=='string'||!row.cruiseTourPackageId||typeof row.tourPackageId!=='string'||!row.tourPackageId||typeof row.packageCode!=='string'||typeof row.packageName!=='string'||typeof row.active!=='boolean')||new Set(rows.map(row=>row.cruiseTourPackageId)).size!==rows.length||new Set(rows.map(row=>row.tourPackageId)).size!==rows.length)throw new ApiError('Chưa đọc được gói dịch vụ gắn với chuyến khởi hành.',502)
    return rows
  },
  validateSchedule: (id: string) => apiRequest<boolean>(`${byId(id)}/validate-schedule`),
  validateCapacity: (id: string) => apiRequest<CapacityDto>(`${byId(id)}/validate-capacity`),
  readiness: readReadiness,
  publish: (id: string) => apiRequest<CruiseDto>(`${byId(id)}/publish`, { method: 'POST' }),
  start: (id: string) => apiRequest<CruiseDto>(`${byId(id)}/start`, { method: 'POST' }),
  complete: (id: string) => apiRequest<CruiseDto>(`${byId(id)}/complete`, { method: 'POST' }),
  cancel: (id: string, reason: string) => apiRequest<CruiseDto>(`${byId(id)}/cancel`, { method: 'POST', body: { reason } }),
  deleteDraft: (id: string) => apiRequest<void>(`${byId(id)}/draft`, { method: 'DELETE' }),
}
