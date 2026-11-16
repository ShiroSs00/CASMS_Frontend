import { useCallback, useRef, useState } from 'react'
import { ApiError, useReadQuery } from '@/shared/api'
import { Badge, Button, Empty, Field, Loading, Notice, Panel } from '@/shared/ui'
import { staffingApi, staffingError, staffingStatus } from './staffing-api'
import styles from './Staffing.module.css'

export function StaffingPreparation({cruiseId, refreshKey}:{cruiseId:string; refreshKey:string}) {
  const query=useReadQuery('staffing-preparation:'+cruiseId+':'+refreshKey,useCallback(
    signal=>staffingApi.preparation(cruiseId,signal),[cruiseId]))
  const [counts,setCounts]=useState<Record<string,string>>({})
  const [error,setError]=useState('')
  const [busy,setBusy]=useState(false)
  const lock=useRef(false)
  const data=query.data
  if(query.error instanceof ApiError&&query.error.status===403)return null
  if(query.loading)return <Loading label="Đang tải nhu cầu nhân sự…" />
  if(query.error||!data)return <Notice tone="error" title="Chưa tải được nhu cầu nhân sự">{staffingError(query.error)} <Button tone="secondary" onClick={query.retry}>Thử lại</Button></Notice>
  const current=data.request
  if(current && current.status !== 'RETURNED')return <Panel title="Nhân sự của tour">
    <Badge label={staffingStatus[current.status] ?? 'Trạng thái chưa xác định'} />
    <ul className={styles.rows}>{current.requirements.map(row=><li className={styles.row} key={row.serviceId}><strong>{row.serviceName}</strong><span>{row.assigned}/{row.required} đã bố trí</span></li>)}</ul>
    {error&&<Notice tone="error" title="Chưa xác nhận được phương án">{error}</Notice>}
    <div className={styles.actions}>
      {current.status==='SHIP_CONFIRMED'&&<Button busy={busy} onClick={async()=>{
        if(lock.current)return
        lock.current=true;setBusy(true);setError('')
        try {await staffingApi.transition(current,'PLANNER_CONFIRMED');query.retry()}
        catch(cause){setError(staffingError(cause))}
        finally{lock.current=false;setBusy(false)}
      }}>Gửi phương án nhân sự cho Vận hành</Button>}
      <Button tone="text" disabled={busy} onClick={query.retry}>Cập nhật tiến độ</Button>
    </div>
  </Panel>
  const requirements=data.services.filter(service=>counts[service.id]).map(service=>({serviceId:service.id,requiredCount:Number(counts[service.id])}))
  const ready=data.hasOperatingBudget && requirements.length>0 && requirements.every(row=>Number.isInteger(row.requiredCount)&&row.requiredCount>0&&row.requiredCount<=2147483647)
  return <Panel title="Nhân sự của tour">
    {current?.status === 'RETURNED' && <Notice title="Quản lý tàu yêu cầu bổ sung">
      {current.returnReason ?? 'Kiểm tra lại nhu cầu nhân sự trước khi gửi yêu cầu mới.'}
    </Notice>}
    {!data.services.length ? <Empty title="Chưa có dịch vụ để bố trí nhân sự"><p>Phân công tàu và cấu hình dịch vụ trên tàu trước khi gửi yêu cầu.</p></Empty>
      : <form className={styles.form} onSubmit={async event=>{
        event.preventDefault()
        if(lock.current||!ready)return
        lock.current=true;setBusy(true);setError('')
        try {await staffingApi.send(cruiseId,data.scheduleRevision,requirements);query.retry()}
        catch(cause){setError(staffingError(cause))}
        finally{lock.current=false;setBusy(false)}
      }}>
        <p className={styles.subtle}>Nhập số người cho từng dịch vụ cần bộ phận Nhân sự bố trí.</p>
        {!data.hasOperatingBudget&&<p>Lưu ngân sách vận hành dự kiến để gửi yêu cầu nhân sự.</p>}
        {data.services.map(service=><Field key={service.id} htmlFor={`need-${service.id}`} label={service.name}>
          <input id={`need-${service.id}`} type="number" min="1" max="2147483647" step="1"
            value={counts[service.id]??''} disabled={busy} placeholder="Số người cần"
            onChange={event=>setCounts(current=>({...current,[service.id]:event.target.value}))}/>
        </Field>)}
        {error&&<Notice tone="error" title="Chưa gửi được yêu cầu">{error} <Button tone="text" onClick={query.retry}>Tải lại</Button></Notice>}
        <Button autoWidth type="submit" busy={busy} disabled={!ready}>Gửi nhu cầu nhân sự</Button>
      </form>}
  </Panel>
}
