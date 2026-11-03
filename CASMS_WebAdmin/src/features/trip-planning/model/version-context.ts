import type { VersionSummary } from '../api/current-contract'

export function versionContext(versions:readonly VersionSummary[]=[]){
  const newest=[...versions].sort((a,b)=>b.versionNumber-a.versionNumber)
  return {published:newest.find(v=>v.status==='PUBLISHED'),working:newest.find(v=>v.status==='DRAFT'||v.status==='IN_REVIEW')}
}
export const workingVersionLabel=(status:string)=>status==='IN_REVIEW'?'Mẫu chờ xử lý theo quy trình cũ':'Đang chỉnh sửa'
