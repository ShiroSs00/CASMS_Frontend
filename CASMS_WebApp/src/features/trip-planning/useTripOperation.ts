import { useRef, useState } from 'react'
import { usePlanning } from './hooks'
import { failure } from './api/live'
import { newKey } from './model/plan'

type Kind='create'|'clone'
type RecordState={schema:1;owner:string;kind:Kind;key:string;status:'sending'|'unknown'|'failed'|'succeeded';createdAt:string;tripId?:string}
/** Recovery metadata only. No form, passenger data, token or automatic replay. */
export function useTripOperation(kind:Kind){
  const {actorId,gateway}=usePlanning(),storageKey=`ocvviet:trip-operation:v1:${actorId}:${kind}`,persistent=gateway.mode==='api'
  function read():{record:RecordState|null;warning:string}{
    if(!persistent)return {record:null,warning:''}
    try{
      const raw=localStorage.getItem(storageKey);if(!raw)return {record:null,warning:''}
      const value=JSON.parse(raw) as Partial<RecordState>
      if(value.schema!==1||value.owner!==actorId||value.kind!==kind||typeof value.key!=='string'||typeof value.createdAt!=='string'||!['sending','unknown','failed','succeeded'].includes(value.status??'')||(value.tripId!==undefined&&typeof value.tripId!=='string'))throw new Error('Invalid recovery metadata')
      return {record:{...value,status:value.status==='sending'?'unknown':value.status} as RecordState,warning:''}
    }catch{return {record:{schema:1,owner:actorId,kind,key:'',status:'unknown',createdAt:''},warning:'Chưa đọc được thông tin thao tác trước. Hãy đối soát danh sách chuyến trước khi bắt đầu thao tác mới.'}}
  }
  const [initial]=useState(read),[record,setRecord]=useState(initial.record),[warning,setWarning]=useState(initial.warning),activeRef=useRef(initial.record)
  function write(next:RecordState|null){
    activeRef.current=next;setRecord(next)
    if(!persistent)return
    try{if(next)localStorage.setItem(storageKey,JSON.stringify({...next,status:next.status==='sending'?'unknown':next.status}));else localStorage.removeItem(storageKey);setWarning('')}
    catch{setWarning('Trình duyệt chưa lưu được thông tin khôi phục. Giữ màn hình này và ghi lại chuyến đã tạo nếu có; không gửi lại khi chưa rõ kết quả.')}
  }
  function begin<T>(payload:T){
    if(activeRef.current&&(activeRef.current.status==='sending'||activeRef.current.status==='unknown'))throw new Error('Cần đối soát thao tác trước khi bắt đầu thao tác mới.')
    const next:RecordState={schema:1,owner:actorId,kind,key:newKey(),status:'sending',createdAt:new Date().toISOString()}
    // Clone once; the caller sends this immutable snapshot rather than the editable form.
    const fixed=structuredClone(payload);write(next);return {key:next.key,payload:fixed}
  }
  function failed(error:unknown){
    const current=activeRef.current;if(!current)return
    const fault=failure(error)
    const rejected=fault.status===401||fault.status===403||fault.status===404||((fault.status===400||fault.status===422)&&['INVALID_INPUT','INVALID_DURATION'].includes(fault.code))
    write({...current,status:rejected?'failed':'unknown'})
  }
  return {record,warning,blocked:Boolean(record&&(record.status==='sending'||record.status==='unknown')),begin,failed,succeeded:(tripId:string)=>{if(activeRef.current)write({...activeRef.current,status:'succeeded',tripId})},clear:()=>write(null)}
}
