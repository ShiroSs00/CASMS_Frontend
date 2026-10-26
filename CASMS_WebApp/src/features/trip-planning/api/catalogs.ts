import { apiRequest } from '@/shared/api'
import { PlanningFault } from './gateway'
import type { Source, SourceKind, SourceQuery } from '../model/plan'

const root='/trip-planning/catalogs'
type Row=Record<string,unknown>
function rows(value:unknown):Row[]{
  if(!Array.isArray(value)||value.some(row=>!row||typeof row!=='object'||Array.isArray(row)))throw new PlanningFault('Chưa đọc được danh mục. Vui lòng tải lại.',502)
  return value as Row[]
}
const text=(row:Row,key:string)=>typeof row[key]==='string'?row[key] as string:undefined
const number=(row:Row,key:string)=>typeof row[key]==='number'?row[key] as number:undefined
function identity(row:Row,idKey:string,nameKey:string){
  const id=text(row,idKey),name=text(row,nameKey)
  if(!id?.trim()||!name?.trim())throw new PlanningFault('Danh mục có mục thiếu mã hoặc tên.',502)
  return {id,name,label:name}
}
export async function planningSources(kind:SourceKind,signal:AbortSignal,query:SourceQuery={}):Promise<Source[]>{
  if(kind==='regions'||kind==='countries'||kind==='durations'){
    const catalog=await apiRequest<Record<string,unknown>>(root,{signal})
    const values=rows(catalog?.[kind==='regions'?'domesticRegions':kind==='countries'?'countries':'durationGroups'])
    return values.map(row=>{
      const source=identity(row,'code','name')
      if(kind!=='durations')return source
      const minDays=number(row,'minDays'),maxDays=number(row,'maxDays'),defaultDays=number(row,'defaultDays')
      if(!Number.isSafeInteger(minDays)||!Number.isSafeInteger(maxDays)||!Number.isSafeInteger(defaultDays)||minDays!<1||maxDays!<minDays!||defaultDays!<minDays!||defaultDays!>maxDays!)throw new PlanningFault('Danh mục thời lượng chưa hợp lệ.',502)
      return {...source,label:`${source.name} · ${minDays}–${maxDays} ngày`,minDays,maxDays,defaultDays}
    })
  }
  if(kind==='activityCategories')return rows(await apiRequest(`${root}/catalogs/activity-categories`,{signal})).map(row=>({...identity(row,'code','name'),description:text(row,'description')}))
  // These endpoints return arrays. Do not fabricate page totals or paging parameters.
  const values=rows(await apiRequest(`${root}/sources/${kind}`,{signal,query:{keyword:query.keyword?.trim()||undefined,...(kind==='activities'?{category:query.category||undefined}:kind==='excursions'?{portId:query.portId||undefined}:kind==='ports'?{destinationId:query.destinationId||undefined}:{})}}))
  return values.map(row=>{
    const source=identity(row,kind==='ports'?'portId':kind==='activities'?'sourceActivityId':kind==='excursions'?'sourceExcursionId':'serviceId',kind==='ports'?'portName':kind==='activities'?'activityName':kind==='excursions'?'excursionName':'serviceName')
    const code=text(row,kind==='ports'?'portCode':kind==='activities'?'activityCode':kind==='excursions'?'excursionCode':'serviceCode')
    const context=[code,kind==='excursions'?text(row,'portName'):undefined,kind==='excursions'?text(row,'supplierName'):undefined].filter(Boolean)
    return {...source,label:context.length?`${source.name} · ${context.join(' · ')}`:source.name,
      timeZoneId:text(row,'timeZoneId'),portId:text(row,'portId'),countryCode:text(row,'countryCode'),domesticRegion:text(row,'domesticRegion'),
      destinationId:text(row,'destinationId'),destinationName:text(row,'destinationName'),supplierName:text(row,'supplierName'),
      description:text(row,'description'),location:text(row,'location'),meetingPoint:text(row,'meetingPoint'),
      category:text(row,'category'),categoryName:text(row,'categoryName'),categoryIcon:text(row,'categoryIcon'),
      deckId:text(row,'deckId'),deckNumber:number(row,'deckNumber'),deckName:text(row,'deckName'),
      cabinId:text(row,'cabinId'),cabinNumber:text(row,'cabinNumber'),roomName:text(row,'roomName'),
      displayLocation:text(row,'displayLocation'),locationType:text(row,'locationType')}
  })
}
