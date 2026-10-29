/** DEV-only illustrative gateway. No HTTP, tokens, database or production persistence. */
import { PlanningFault, type PlanningGateway, type Scenario } from './gateway'
import { contentOf, localViolations, newKey, SHIP_ZONE, type Trip, type Version, type Source, type SourceKind, type History } from '../model/plan'
const copy = <T,>(value:T):T => structuredClone(value)
export function createPreviewGateway(scenario:Scenario):PlanningGateway {
  const trips=new Map<string,Trip>(),versions=new Map<string,Version>(),events:Record<string,History[]>={}
  const sourceData:Record<SourceKind,Source[]>={
    durations:[{id:"SHORT",label:"Ngắn ngày · 1–2 ngày",minDays:1,maxDays:2,defaultDays:1},{id:"LONG",label:"Dài ngày · 3–5 ngày",minDays:3,maxDays:5,defaultDays:3}],activityCategories:[],
    ports:[{id:'22222222-2222-4222-8222-222222222222',label:'Minh họa · Cảng Hạ Long',countryCode:'VN',domesticRegion:'BAC_BO',timeZoneId:SHIP_ZONE},{id:'33333333-3333-4333-8333-333333333333',label:'Minh họa · Cảng Singapore',countryCode:'SG',timeZoneId:'Asia/Singapore'}],
    services:[{id:'44444444-4444-4444-8444-444444444444',label:'Minh họa · Nhà hàng'},{id:'55555555-5555-4555-8555-555555555555',label:'Minh họa · Spa'}],
    activities:[{id:'66666666-6666-4666-8666-666666666666',label:'Minh họa · Chương trình trên tàu'}],
    excursions:[{id:'77777777-7777-4777-8777-777777777777',label:'Minh họa · Tham quan tại cảng'}],
    regions:[{id:'BAC_BO',label:'Miền Bắc'},{id:'TRUNG_BO',label:'Miền Trung'},{id:'NAM_BO',label:'Miền Nam'}],
    countries:[{id:'VN',label:'Việt Nam'},{id:'SG',label:'Singapore'},{id:'TH',label:'Thái Lan'},{id:'MY',label:'Malaysia'},{id:'JP',label:'Nhật Bản'}],
  }
  function refreshTrip(trip:Trip) {
    trip.versions=[...versions.values()].filter(v=>v.tripId===trip.tripId).map(v=>({versionId:v.versionId,versionNumber:v.versionNumber,status:v.status,revision:v.revision,creatorId:v.creatorId,submitterId:v.submitterId,rejectionReason:v.rejectionReason}))
    const last=trip.versions.at(-1);trip.latestVersionNumber=last?.versionNumber;trip.latestVersionStatus=last?.status;trip.updatedAt=new Date().toISOString();trips.set(trip.tripId,copy(trip));return copy(trip)
  }
  function needTrip(id:string) {const value=trips.get(id);if(!value)throw new PlanningFault('Không tìm thấy chuyến minh họa.',404);return copy(value)}
  function needVersion(id:string) {const value=versions.get(id);if(!value)throw new PlanningFault('Không tìm thấy phiên bản minh họa.',404);return copy(value)}
  function record(v:Version,action:string) {(events[v.versionId]??=[]).unshift({auditId:newKey(),action,actorUserId:action==='PUBLISH'||action==='RETURN'?'preview-reviewer':'preview-editor',detail:'Dữ liệu minh họa — '+action,occurredAt:new Date().toISOString(),result:'SUCCESS'})}
  function newVersion(trip:Trip,source?:Version):Version {
    const version:Version={versionId:newKey(),tripId:trip.tripId,versionNumber:(trip.latestVersionNumber??0)+1,status:'DRAFT',revision:1,creatorId:'preview-editor',submitterId:null,days:source?copy(source.days).map(d=>({...d,key:newKey(),dayId:undefined})):Array.from({length:trip.durationDays},(_,i)=>({key:newKey(),dayNumber:i+1,dayType:'SEA_DAY',shipTimeZoneId:SHIP_ZONE,title:`Ngày ${i+1}`,description:''})),stops:source?copy(source.stops):[],entries:source?copy(source.entries):[]}
    versions.set(version.versionId,copy(version));record(version,'CREATE_VERSION');refreshTrip(trip);return copy(version)
  }
  if(scenario!=='empty') {
    const trip:Trip={tripId:'11111111-1111-4111-8111-111111111111',tripCode:'MINH-HOA-01',name:'Dữ liệu minh họa · Chuyến ba ngày',description:'Chỉ dùng thử giao diện.',durationDays:3,durationNights:2,tripType:null,createdByUserId:'preview-editor',plannedScope:'DOMESTIC',revision:1,status:'DRAFT',info:{name:'Dữ liệu minh họa · Chuyến ba ngày',description:'Chỉ dùng thử giao diện.',durationBand:'LONG',scope:'DOMESTIC',regionIds:['BAC_BO'],countryCodes:[]}}
    trips.set(trip.tripId,trip);const v=newVersion(trip)
    if(scenario==='422') {v.status='IN_REVIEW';v.submitterId='preview-editor';versions.set(v.versionId,v);refreshTrip(trip)}
  }
  async function delay(signal?:AbortSignal) {signal?.throwIfAborted();await new Promise(resolve=>setTimeout(resolve,scenario==='loading'?1800:150));signal?.throwIfAborted();if(scenario==='error')throw new PlanningFault('Lỗi kết nối minh họa. Chọn kịch bản bình thường để tiếp tục.',503,'PREVIEW_NETWORK')}
  function writable(v?:Version) {if(scenario==='readonly'||(v&&v.status!=='DRAFT'))throw new PlanningFault('Phiên bản chỉ đọc.',409,'INVALID_STATE')}
  function revision(v:Version) {if(needVersion(v.versionId).revision!==v.revision)throw new PlanningFault('Phiên bản minh họa đã thay đổi; bản nhập của bạn được giữ nguyên.',409,'STALE_REVISION')}
  return {
    mode:'preview',readOnly:scenario==='readonly',supportsMiddleDayRemoval:true,supportsFullInfo:true,
    async list(page,status,signal,filters) {await delay(signal);const rows=[...trips.values()].filter(t=>(!status||t.status===status)&&(!filters?.search||`${t.tripCode} ${t.name}`.toLocaleLowerCase('vi').includes(filters.search.toLocaleLowerCase('vi')))&&(!filters?.durationGroup||t.info.durationBand===filters.durationGroup)&&(!filters?.plannedScope||t.info.scope===filters.plannedScope));return {content:copy(rows.slice(page*20,(page+1)*20)),totalPages:Math.ceil(rows.length/20),totalElements:rows.length}},
    async getTrip(id,signal) {await delay(signal);return refreshTrip(needTrip(id))},
    async saveInfo(info,_key,previous) {
      await delay();writable()
      if(previous) {
        const current=needTrip(previous.tripId);if(current.revision!==previous.revision)throw new PlanningFault('Thông tin chuyến đã thay đổi.',409,'STALE_REVISION')
        if(current.structuralLockedAt&&info.durationBand!==current.info.durationBand)throw new PlanningFault('Khung chuyến có mẫu đã chốt nên không thể đổi số ngày. Hãy nhân bản chuyến.',422)
        const count=info.durationBand===current.info.durationBand?current.durationDays:info.durationBand==='SHORT'?1:3
        for(const v of versions.values()) if(v.tripId===current.tripId&&v.status==='DRAFT'&&count!==v.days.length) {
          if(v.stops.some(s=>s.departureDayNumber>count)||v.entries.some(e=>e.endDayNumber>count))throw new PlanningFault('Còn nội dung ở ngày bị ảnh hưởng; hãy xử lý trước khi đổi thời lượng.',422)
          while(v.days.length<count)v.days.push({key:newKey(),dayNumber:v.days.length+1,dayType:'SEA_DAY',shipTimeZoneId:SHIP_ZONE,title:'Ngày mới',description:''})
          v.days=v.days.slice(0,count);v.revision++;versions.set(v.versionId,v)
        }
        return refreshTrip({...current,info:copy(info),name:info.name,description:info.description,durationDays:count,revision:current.revision+1})
      }
      const count=info.durationBand==='SHORT'?1:3,trip:Trip={tripId:newKey(),tripCode:'MINH-HOA-'+(trips.size+1),name:info.name,description:info.description,info:copy(info),durationDays:count,durationNights:Math.max(0,count-1),tripType:null,createdByUserId:'preview-editor',revision:1,status:'DRAFT'}
      trips.set(trip.tripId,trip);newVersion(trip);return refreshTrip(trip)
    },
    async clone(id,sourceId) {await delay();writable();const source=needTrip(id),version=sourceId?needVersion(sourceId):[...versions.values()].filter(v=>v.tripId===id).at(-1);if(version&&version.tripId!==id)throw new PlanningFault('Phiên bản nguồn không thuộc chuyến.',422);const trip={...copy(source),tripId:newKey(),tripCode:'MINH-HOA-'+(trips.size+1),name:source.name+' · bản sao',status:'DRAFT' as const,revision:1,structuralLockedAt:null,versions:[],latestVersionNumber:undefined};trip.info.name=trip.name;trips.set(trip.tripId,trip);newVersion(trip,version);return refreshTrip(trip)},
    async archive(id) {await delay();writable();const trip=needTrip(id);trip.status='ARCHIVED';trip.revision++;return refreshTrip(trip)},
    async version(id,signal) {await delay(signal);return needVersion(id)},
    async createVersion(trip,sourceId) {await delay();writable();const current=refreshTrip(needTrip(trip.tripId));if(current.versions?.some(v=>v.status!=='PUBLISHED'))throw new PlanningFault('Đã có phiên bản chưa hoàn tất.',409,'DUPLICATE_DRAFT_VERSION');const source=sourceId?needVersion(sourceId):undefined;if(source&&source.tripId!==trip.tripId)throw new PlanningFault('Nguồn phải thuộc cùng chuyến.',422);return newVersion(current,source)},
    async save(version,content) {await delay();writable(version);revision(version);if(scenario==='409')throw new PlanningFault('Xung đột minh họa. Không tự ghi đè bản server.',409,'STALE_REVISION');const v={...copy(version),...copy(content),revision:version.revision+1};versions.set(v.versionId,v);record(v,'SAVE_CONTENT');refreshTrip(needTrip(v.tripId));return copy(v)},
    async changeDay(trip,version,removeDay) {
      await delay();writable(version);revision(version);const current=needTrip(trip.tripId);if(current.structuralLockedAt)throw new PlanningFault('Khung chuyến có mẫu đã chốt nên không thể đổi số ngày. Hãy nhân bản chuyến.',422)
      if(current.revision!==trip.revision)throw new PlanningFault('Thông tin chuyến minh họa đã thay đổi.',409,'STALE_REVISION')
      const nextCount=version.days.length+(removeDay===undefined?1:-1),limits=current.info.durationBand==='SHORT'?[1,2]:[3,5]
      if(nextCount<limits[0]||nextCount>limits[1])throw new PlanningFault('Số ngày vượt giới hạn thời lượng minh họa.',422)
      const content=contentOf(version)
      if(removeDay!==undefined) {
        if(content.stops.some(s=>s.arrivalDayNumber<=removeDay&&s.departureDayNumber>=removeDay)||content.entries.some(e=>e.startDayNumber<=removeDay&&e.endDayNumber>=removeDay))throw new PlanningFault('Ngày vẫn còn nội dung tham chiếu.',422)
        content.days=content.days.filter(d=>d.dayNumber!==removeDay).map((d,i)=>({...d,dayNumber:i+1}))
        const reindex=(n:number)=>n>removeDay?n-1:n
        content.stops=content.stops.map(s=>({...s,arrivalDayNumber:reindex(s.arrivalDayNumber),departureDayNumber:reindex(s.departureDayNumber),allAboardDayNumber:s.allAboardDayNumber?reindex(s.allAboardDayNumber):null}))
        content.entries=content.entries.map(e=>({...e,dayNumber:reindex(e.dayNumber),startDayNumber:reindex(e.startDayNumber),endDayNumber:reindex(e.endDayNumber)}))
      } else content.days.push({key:newKey(),dayNumber:content.days.length+1,dayType:null,shipTimeZoneId:SHIP_ZONE,title:`Ngày ${content.days.length+1}`,description:''})
      const v={...version,...content,revision:version.revision+1};versions.set(v.versionId,copy(v));current.durationDays=v.days.length;current.revision++;return {trip:refreshTrip(current),version:copy(v)}
    },
    async sources(kind,signal,query) {await delay(signal);return copy(sourceData[kind].filter(row=>(!query?.keyword||row.label.toLocaleLowerCase('vi').includes(query.keyword.toLocaleLowerCase('vi')))&&(!query?.category||row.category===query.category)&&(!query?.portId||row.portId===query.portId)))},
    async validate(version) {await delay();revision(version);const violations=localViolations(version);return {versionId:version.versionId,revision:version.revision,validForSubmit:!violations.length,violations,deferredChecks:['Minh họa: chưa đối chiếu dữ liệu vận hành thực tế.']}},
    async action(version,action,reason) {
      await delay();revision(version)
      if(scenario==='readonly')throw new PlanningFault('Chế độ minh họa chỉ đọc.',403)
      if(action==='cancel'||action==='withdraw'){
        if(version.status!==(action==='cancel'?'DRAFT':'IN_REVIEW'))throw new PlanningFault('Trạng thái không cho phép thao tác.',409)
        const saved:Version={...version,status:action==='cancel'?'CANCELLED':'DRAFT',revision:version.revision+1,rejectionReason:action==='cancel'?reason:version.rejectionReason}
        versions.set(saved.versionId,copy(saved));record(saved,action==='cancel'?'CANCEL_DRAFT':'WITHDRAW');refreshTrip(needTrip(saved.tripId));return copy(saved)
      }
      if(action!=='finalize')throw new PlanningFault('Quy trình xét duyệt mẫu cũ đã dừng.',410,'TEMPLATE_REVIEW_RETIRED')
      writable(version)
      const violations=localViolations(version)
      if(violations.length||scenario==='422')throw new PlanningFault('Còn thông tin cần chỉnh sửa.',422,'VALIDATION_FAILED',violations)
      const v={...version,status:'PUBLISHED' as const,revision:version.revision+1};versions.set(v.versionId,copy(v));record(v,'FINALIZE')
      const trip=needTrip(v.tripId);trip.structuralLockedAt=new Date().toISOString();trip.status='READY';trip.revision++;refreshTrip(trip);return copy(v)
    },
    async history(id,signal) {await delay(signal);return copy(events[id]??[])},
  }
}
