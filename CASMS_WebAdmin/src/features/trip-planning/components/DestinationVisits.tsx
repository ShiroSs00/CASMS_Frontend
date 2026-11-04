import { destinationVisitLabel } from '../model/destination-label'
import { useCallback } from 'react'
import { useReadQuery } from '@/shared/api'
import { Button, Field, Loading, Notice } from '@/shared/ui'
import { apiRequest } from '@/shared/api'
import { countryLabel } from '../model/plan'
import type { DestinationVisit } from '../api/current-contract'
import styles from '../Planning.module.css'
import visitStyles from './DestinationVisits.module.css'
export function DestinationVisits({ visits, onChange, port }: {
  visits: DestinationVisit[]
  onChange: (visits: DestinationVisit[]) => void
  port?: { name: string; countryCode?: string; destinationId?: string }
}) {
 const catalog=useReadQuery('visit-destinations',useCallback(signal=>apiRequest<{destinationId:string;destinationName:string;countryCode:string}[]>('/destinations/active',{signal}),[]))
 const local = (catalog.data ?? []).filter(destination =>
   destination.destinationId === port?.destinationId ||
   !port?.countryCode || destination.countryCode?.toUpperCase() === port.countryCode.toUpperCase(),
 )
 const linked = local.find(destination => destination.destinationId === port?.destinationId)
 function add(destinationId: string) {
   const destination = local.find(item => item.destinationId === destinationId)
   if (!destination || !port) return
   onChange([...visits, {
     clientKey: crypto.randomUUID(),
     destinationId,
     destinationName: destination.destinationName,
     sequence: visits.length + 1,
   }])
 }
 function remove(clientKey: string) {
   onChange(visits.filter(visit => visit.clientKey !== clientKey)
     .map((visit, index) => ({ ...visit, sequence: index + 1 })))
 }
 return <fieldset className={styles.formGroup}><legend>Điểm tham quan</legend>
 {visits.length > 0 && <ol className={visitStyles.list}>
   {visits.map(visit => {
     const name = destinationVisitLabel(visit.destinationName ?? catalog.data?.find(item => item.destinationId === visit.destinationId)?.destinationName ?? 'Điểm đến đã lưu')
     return <li key={visit.clientKey}><div className={visitStyles.row}>
       <span>{name}</span>
       <Button tone="text" size="compact" aria-label={'Bỏ ' + name} onClick={() => remove(visit.clientKey)}>Bỏ</Button>
     </div></li>
   })}
 </ol>}
 {!port ? <p>Chọn cảng ở trên để xem các điểm đến.</p> : <>
   <p className={visitStyles.context}>Lần ghé: <strong>{port.name}</strong></p>
   {catalog.loading ? <Loading label="Đang tải điểm đến…"/> : catalog.error
     ? <Notice title="Chưa tải được điểm đến" tone="error"><Button onClick={catalog.retry}>Thử lại</Button></Notice>
     : local.length === 0 ? <p>Chưa có điểm đến phù hợp trong danh mục.</p> : <>
       {linked && !visits.some(visit => visit.destinationId === linked.destinationId) &&
         <Button tone="secondary" onClick={() => add(linked.destinationId)}>Thêm {destinationVisitLabel(linked.destinationName)}</Button>}
       <Field htmlFor="visit-destination" label={port.countryCode ? `Thêm điểm tham quan · ${countryLabel(port.countryCode)}` : 'Thêm điểm tham quan'}>
         <select id="visit-destination" value="" onChange={event => add(event.target.value)}>
           <option value="">Chọn điểm đến để thêm vào lần ghé</option>
           {local.map(destination => <option key={destination.destinationId} value={destination.destinationId}>{destinationVisitLabel(destination.destinationName)}</option>)}
         </select>
       </Field>
     </>}
   <p className={visitStyles.context}>Điểm mới nằm cuối danh sách. Áp dụng lần ghé trước khi lưu lịch trình.</p>
 </>}
 </fieldset>
}
