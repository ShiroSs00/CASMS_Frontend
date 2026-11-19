import { destinationVisitLabel } from '../model/destination-label'
import { useCallback, useId, useRef } from 'react'
import { useReadQuery } from '@/shared/api'
import { Button, Field, Loading, Notice } from '@/shared/ui'
import { apiRequest } from '@/shared/api'
import { countryLabel } from '../model/plan'
import type { DestinationVisit } from '../api/current-contract'
import styles from '../Planning.module.css'
import visitStyles from './DestinationVisits.module.css'
export function DestinationVisits({ visits, onChange, port, readOnly }: {
  visits: DestinationVisit[]
  onChange: (visits: DestinationVisit[]) => void
  readOnly?: boolean
  port?: { name: string; countryCode?: string; destinationId?: string; servedDestinationIds?: string[] }
}) {
 const catalog=useReadQuery('visit-destinations',useCallback(signal=>apiRequest<{destinationId:string;destinationName:string;countryCode:string}[]>('/destinations/active',{signal}),[]))
 const hasServedInfo = Array.isArray(port?.servedDestinationIds)
 const servedSet = new Set<string>(hasServedInfo ? port!.servedDestinationIds! : (port?.destinationId ? [port.destinationId] : []))
 const local = (catalog.data ?? []).filter(destination =>
   servedSet.has(destination.destinationId) ||
   destination.destinationId === port?.destinationId ||
   !port?.countryCode || destination.countryCode?.toUpperCase() === port.countryCode.toUpperCase(),
 )
 const selectId = useId()
 const pending = useRef<{ base: DestinationVisit[]; next: DestinationVisit[] } | null>(null)
 const selectedIds = new Set<string>()
 const duplicates = new Map<string, DestinationVisit>()
 for (const visit of visits) {
   if (selectedIds.has(visit.destinationId)) duplicates.set(visit.destinationId, visit)
   selectedIds.add(visit.destinationId)
 }
 const linked = local.find(destination => destination.destinationId === port?.destinationId)
 const available = local.filter(destination => !selectedIds.has(destination.destinationId))
 const servedAvailable = hasServedInfo ? available.filter(destination => servedSet.has(destination.destinationId)) : []
 const otherAvailable = hasServedInfo ? available.filter(destination => !servedSet.has(destination.destinationId)) : available
 const labels = new Map<string, string>()
 for (const destination of catalog.data ?? []) labels.set(destination.destinationId, destinationVisitLabel(destination.destinationName))
 for (const visit of visits) {
   if (!labels.has(visit.destinationId)) labels.set(visit.destinationId, destinationVisitLabel(visit.destinationName ?? 'Điểm đến đã lưu'))
 }
 const nameCounts = new Map<string, number>()
 for (const name of labels.values()) nameCounts.set(name, (nameCounts.get(name) ?? 0) + 1)
 function label(destinationId: string) {
   const name = labels.get(destinationId) ?? 'Điểm đến đã lưu'
   return (nameCounts.get(name) ?? 0) > 1 ? `${name} (${destinationId})` : name
 }
 function currentVisits() {
   return pending.current?.base === visits ? pending.current.next : visits
 }
 function change(next: DestinationVisit[]) {
   pending.current = { base: visits, next }
   onChange(next)
 }
 function add(destinationId: string) {
   const current = currentVisits()
   const destination = available.find(item => item.destinationId === destinationId)
   if (!destination || !port || readOnly || catalog.loading || catalog.error ||
     current.some(visit => visit.destinationId === destinationId)) return
   change([...current, {
     clientKey: crypto.randomUUID(),
     destinationId,
     destinationName: destination.destinationName,
     sequence: current.length + 1,
   }])
 }
 function remove(clientKey: string) {
   if (readOnly) return
   change(currentVisits().filter(visit => visit.clientKey !== clientKey)
     .map((visit, index) => ({ ...visit, sequence: index + 1 })))
 }
 return <fieldset className={styles.formGroup}><legend>Điểm tham quan</legend>
 {duplicates.size > 0 && <Notice title="Có điểm tham quan bị lặp" tone="error">
   <p>{[...duplicates.keys()].map(label).join(', ')}. {readOnly ? 'Liên hệ người quản lý lịch trình để xử lý.' : 'Chọn Bỏ ở lượt bị lặp trước khi lưu.'}</p>
 </Notice>}
 {visits.length > 0 && <ol className={visitStyles.list}>
   {visits.map(visit => {
     const name = label(visit.destinationId)
     const servedByPort = !hasServedInfo || servedSet.has(visit.destinationId)
     return <li key={visit.clientKey}><div className={visitStyles.row}>
       <span>
         {name}
         {!servedByPort && <small className={styles.muted}> · Chỉ ghi nhận lượt tham quan (cảng không phục vụ tour bờ)</small>}
       </span>
       <Button disabled={readOnly} tone="text" size="compact" aria-label={'Bỏ ' + name} onClick={() => remove(visit.clientKey)}>Bỏ</Button>
     </div></li>
   })}
 </ol>}
 {readOnly ? null : !port ? <p>Chọn cảng ở trên để xem các điểm đến.</p> : <>
   <p className={visitStyles.context}>Lần ghé: <strong>{port.name}</strong>{hasServedInfo && servedSet.size > 0 ? ' · Chỉ các điểm đến được cảng phục vụ mới gắn được tour bờ.' : ''}</p>
   {catalog.loading ? <Loading label="Đang tải điểm đến…"/> : catalog.error
     ? <Notice title="Chưa tải được điểm đến" tone="error"><Button onClick={catalog.retry}>Thử lại</Button></Notice>
     : available.length === 0 ? <p>{local.length ? 'Đã thêm tất cả điểm đến phù hợp.' : 'Chưa có điểm đến phù hợp trong danh mục.'}</p> : <>
       {linked && !selectedIds.has(linked.destinationId) &&
         <Button tone="secondary" onClick={() => add(linked.destinationId)}>Thêm {label(linked.destinationId)}</Button>}
       <Field htmlFor={selectId} label={port.countryCode ? `Thêm điểm tham quan tại ${countryLabel(port.countryCode)}` : 'Thêm điểm tham quan'}>
         <select id={selectId} value="" onChange={event => add(event.target.value)}>
           <option value="">Chọn điểm đến để thêm vào lần ghé</option>
           {hasServedInfo ? <>
             {servedAvailable.length > 0 && (
               <optgroup label="Được cảng phục vụ (có thể gắn tour bờ)">
                 {servedAvailable.map(destination => <option key={destination.destinationId} value={destination.destinationId}>{label(destination.destinationId)}</option>)}
               </optgroup>
             )}
             {otherAvailable.length > 0 && (
               <optgroup label="Điểm đến khác cùng quốc gia (chỉ ghi nhận lượt tham quan)">
                 {otherAvailable.map(destination => <option key={destination.destinationId} value={destination.destinationId}>{label(destination.destinationId)}</option>)}
               </optgroup>
             )}
           </> : available.map(destination => <option key={destination.destinationId} value={destination.destinationId}>{label(destination.destinationId)}</option>)}
         </select>
       </Field>
     </>}
   <p className={visitStyles.context}>Điểm mới nằm cuối danh sách. Áp dụng lần ghé trước khi lưu lịch trình.</p>
 </>}
 </fieldset>
}
