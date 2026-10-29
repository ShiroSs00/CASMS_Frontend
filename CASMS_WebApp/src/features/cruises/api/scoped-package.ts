import {ApiError,apiRequest} from '@/shared/api'
export type ScopedPackage={id:string;name:string;description:string|null;type:string;ownerCruiseId:string|null;price:number;currency:string;status:string}
export type ComponentKind='services'|'activities'|'excursions'
export type PackageComponent={kind:ComponentKind;referenceId:string;name:string;benefitType:'INCLUDED'|'OPTIONAL'}
type Components={cruiseId:string;packageId:string;components:PackageComponent[]}
const root=(cruiseId:string)=>`/cruise-plans/${encodeURIComponent(cruiseId)}/packages`
export async function packageComponents(cruiseId:string,packageId:string,signal?:AbortSignal){
 const value=await apiRequest<Components>(root(cruiseId)+'/'+encodeURIComponent(packageId)+'/components',{signal})
 if(!value||value.cruiseId!==cruiseId||value.packageId!==packageId||!Array.isArray(value.components)||value.components.some(c=>!c||!['services','activities','excursions'].includes(c.kind)||typeof c.referenceId!=='string'||!c.referenceId||typeof c.name!=='string'||!['INCLUDED','OPTIONAL'].includes(c.benefitType)))throw new ApiError('',502)
 return value.components
}
export async function updateScopedPackage(cruiseId:string,base:ScopedPackage,revision:number,body:{name:string;description:string;price:number;currency:string}){
 if(base.ownerCruiseId!==cruiseId)throw new ApiError('',403,'CROSS_CRUISE_ACCESS')
 const saved=await apiRequest<{id:string;cruiseId:string}>(root(cruiseId)+'/'+encodeURIComponent(base.id),{method:'PUT',ifMatch:revision,body:{...body,type:base.type}})
 const rows=await apiRequest<ScopedPackage[]>(root(cruiseId)),actual=Array.isArray(rows)?rows.find(p=>p.id===base.id):undefined
 if(saved.id!==base.id||saved.cruiseId!==cruiseId||!actual||actual.ownerCruiseId!==cruiseId||actual.type!==base.type||Object.entries(body).some(([key,value])=>actual[key as keyof ScopedPackage]!==value))throw new ApiError('',502)
 return actual
}
export async function addScopedPackageComponent(cruiseId:string,packageId:string,revision:number,input:Omit<PackageComponent,'name'>){
 await apiRequest(root(cruiseId)+'/'+encodeURIComponent(packageId)+'/'+input.kind,{method:'POST',ifMatch:revision,body:{referenceId:input.referenceId,benefitType:input.benefitType}})
 const rows=await packageComponents(cruiseId,packageId)
 if(rows.filter(c=>c.kind===input.kind&&c.referenceId===input.referenceId&&c.benefitType===input.benefitType).length!==1)throw new ApiError('',502)
 return rows
}
