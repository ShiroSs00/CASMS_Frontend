import { useCallback, useState } from 'react'
import { useReadQuery } from '@/shared/api'
import { Button, Field, Loading, Notice } from '@/shared/ui'
import { apiRequest } from '@/shared/api'
import type { DestinationVisit } from '../api/current-contract'
import styles from '../Planning.module.css'
import visitStyles from './DestinationVisits.module.css'
export function DestinationVisits({visits,onChange}:{visits:DestinationVisit[];onChange:(visits:DestinationVisit[])=>void}){
 const catalog=useReadQuery('visit-destinations',useCallback(signal=>apiRequest<{destinationId:string;destinationName:string;countryCode:string}[]>('/destinations/active',{signal}),[])),[selected,setSelected]=useState('')
 function move(index:number,delta:number){const next=[...visits];[next[index],next[index+delta]]=[next[index+delta],next[index]];onChange(next.map((v,i)=>({...v,sequence:i+1})))}
 return <fieldset className={styles.formGroup}><legend>Các điểm tham quan trong lần ghé cảng</legend>
 {visits.length?<ol>{visits.map((v,index)=><li key={v.clientKey}><strong>{v.destinationName??catalog.data?.find(d=>d.destinationId===v.destinationId)?.destinationName??'Điểm đến đã lưu'}</strong><div className={visitStyles.actions}><Button tone="text" disabled={index===0} onClick={()=>move(index,-1)}>Lên</Button><Button tone="text" disabled={index===visits.length-1} onClick={()=>move(index,1)}>Xuống</Button><Button tone="text" onClick={()=>onChange(visits.filter((_,i)=>i!==index).map((v,i)=>({...v,sequence:i+1})))}>Loại bỏ lượt tham quan</Button></div></li>)}</ol>:<p>Chưa thêm điểm tham quan. Có thể thêm nhiều lượt tham quan vào cùng lần ghé này.</p>}
 {catalog.loading?<Loading label="Đang tải điểm đến…"/>:catalog.error?<Notice title="Chưa tải được điểm đến" tone="error"><Button onClick={catalog.retry}>Thử lại</Button></Notice>:<><Field htmlFor="visit-destination" label="Điểm đến trong danh mục"><select id="visit-destination" value={selected} onChange={e=>setSelected(e.target.value)}><option value="">Chọn điểm đến</option>{catalog.data?.map(d=><option key={d.destinationId} value={d.destinationId}>{d.destinationName} · {d.countryCode}</option>)}</select></Field><Button tone="secondary" disabled={!selected} onClick={()=>{const d=catalog.data?.find(d=>d.destinationId===selected);if(d){onChange([...visits,{clientKey:crypto.randomUUID(),destinationId:d.destinationId,destinationName:d.destinationName,sequence:visits.length+1}]);setSelected('')}}}>Thêm lượt tham quan</Button></>}
 <p>Điểm tham quan được lưu dưới lần ghé cảng; không tạo đặt chỗ hoặc đăng ký tour.</p>
 </fieldset>
}
