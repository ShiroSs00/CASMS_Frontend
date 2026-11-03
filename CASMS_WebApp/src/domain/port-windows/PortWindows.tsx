import { useCallback, useState, type FormEvent } from 'react'
import { useReadQuery } from '@/shared/api'
import { useSessionAccess } from '@/shared/auth'
import { Button, Field, Loading, Notice, Panel } from '@/shared/ui'
import { portWindowApi, type PortWindow, type PortClosure, type WindowWrite } from './api'
import styles from './PortWindows.module.css'
import windowStyles from './PortWindows.module.css'
const weekdays=[['MONDAY','Thứ 2'],['TUESDAY','Thứ 3'],['WEDNESDAY','Thứ 4'],['THURSDAY','Thứ 5'],['FRIDAY','Thứ 6'],['SATURDAY','Thứ 7'],['SUNDAY','Chủ nhật']] as const
const blank=():WindowWrite=>({windowType:'ARRIVAL',validFrom:'',validTo:null,daysOfWeek:[],localStartTime:'',localEndTime:'',sourceType:'PORT_AUTHORITY',sourceReference:'',sourceEffectiveDate:null,overnightAllowed:null,maxStayMinutes:null})
export function PortWindows({portId,manage=false}:{portId:string;manage?:boolean}) {
 const access=useSessionAccess(),ops=manage&&access.roles.includes('OPERATIONS_MANAGER')
 const query=useReadQuery('port-windows:'+portId,useCallback(signal=>portWindowApi.read(portId,signal),[portId]))
 const [editor,setEditor]=useState<{id?:string;exception:boolean;revision?:number}|null>(null),[draft,setDraft]=useState<WindowWrite>(blank),[reason,setReason]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[history,setHistory]=useState<Awaited<ReturnType<typeof portWindowApi.history>>|null>(null)
 const fail=(e:unknown)=>setError(e instanceof Error?e.message:'Chưa thể cập nhật. Vui lòng thử lại.')
 const perform=async(action:()=>Promise<unknown>)=>{setBusy(true);setError('');try{await action();query.retry()}catch(e){fail(e)}finally{setBusy(false)}}
 const begin=(item?:PortWindow|PortClosure,exception=false)=>{setSubmitted(false);setError('');setHistory(null);setReason(item&&'reason'in item?item.reason:'');setDraft(item&&'windowId'in item?{windowType:item.windowType,validFrom:item.validFrom,validTo:item.validTo,daysOfWeek:[...item.daysOfWeek],localStartTime:item.localStartTime,localEndTime:item.localEndTime,sourceType:item.sourceType,sourceReference:item.sourceReference,sourceEffectiveDate:item.sourceEffectiveDate,overnightAllowed:item.overnightAllowed,maxStayMinutes:item.maxStayMinutes}:item?{...blank(),validFrom:item.validFrom,validTo:item.validTo,sourceType:item.sourceType,sourceReference:item.sourceReference,sourceEffectiveDate:item.sourceEffectiveDate}:blank());setEditor({id:item?('windowId'in item?item.windowId:item.exceptionId):undefined,exception,revision:item?.revision})}
 const field=<K extends keyof WindowWrite>(key:K,value:WindowWrite[K])=>setDraft(old=>({...old,[key]:value}))
 const invalidTime=Boolean(draft.localStartTime&&draft.localEndTime
   && (draft.localEndTime+':00').slice(0,8) <= (draft.localStartTime+':00').slice(0,8))
 const [submitted,setSubmitted]=useState(false)
 const missingWeekdays=submitted&&draft.daysOfWeek.length===0
 async function save(event:FormEvent){event.preventDefault();if(!editor||busy)return;setSubmitted(true);if(!editor.exception&&(invalidTime||draft.daysOfWeek.length===0))return;setBusy(true);setError('');try{if(editor.exception)await portWindowApi.closure(portId,{expectedRevision:editor.revision,validFrom:draft.validFrom,validTo:draft.validTo??'',reason,sourceType:draft.sourceType,sourceReference:draft.sourceReference,sourceEffectiveDate:draft.sourceEffectiveDate},editor.id);else await portWindowApi.write(portId,{...draft,expectedRevision:editor.revision},editor.id);setEditor(null);query.retry()}catch(e){fail(e)}finally{setBusy(false)}}
 const today=(()=>{try{const parts=new Intl.DateTimeFormat('en-CA',{timeZone:query.data?.portTimeZoneId,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());const part=(key:string)=>parts.find(p=>p.type===key)?.value;return `${part('year')}-${part('month')}-${part('day')}`}catch{return null}})()
 const status=(w:PortWindow|PortClosure)=>w.validTo&&today&&w.validTo<today?'Đã hết hiệu lực':today&&w.validFrom>today?'Chưa đến ngày hiệu lực':w.verifiedTimeZoneId&&w.verifiedTimeZoneId!==query.data?.portTimeZoneId?'Múi giờ cảng đã đổi — cần xác minh lại':w.verificationStatus!=='VERIFIED'?'Chưa được Quản lý vận hành xác minh':w.lifecycleStatus!=='ACTIVE'?'Đã xác minh · chưa kích hoạt':'Đã xác minh · đang hoạt động'
 const actions=(w:PortWindow|PortClosure,exception=false)=>{const id='windowId'in w?w.windowId:w.exceptionId;return ops?<div className={styles.actions}>
 {access.canDo('PORT_CALL_WINDOW_UPDATE')&&<Button tone="secondary" disabled={busy||Boolean(editor)} onClick={()=>begin(w,exception)}>Chỉnh sửa</Button>}
 {access.canDo('PORT_CALL_WINDOW_VERIFY')&&<Button tone="secondary" disabled={busy||Boolean(editor)} onClick={()=>void perform(()=>portWindowApi.verify(portId,id,w.revision,exception))}>Xác minh nguồn</Button>}
 {access.canDo('PORT_CALL_WINDOW_UPDATE')&&<Button tone="secondary" disabled={busy||Boolean(editor)||(w.lifecycleStatus!=='ACTIVE'&&(w.verificationStatus!=='VERIFIED'||w.verifiedTimeZoneId!==query.data?.portTimeZoneId))} onClick={()=>void perform(()=>portWindowApi.lifecycle(portId,id,w.revision,w.lifecycleStatus==='ACTIVE'?'INACTIVE':'ACTIVE',exception))}>{w.lifecycleStatus==='ACTIVE'?'Ngừng áp dụng':'Kích hoạt'}</Button>}
 {access.canDo('PORT_CALL_WINDOW_READ')&&<Button tone="text" disabled={busy} onClick={()=>{setError('');setHistory(null);void portWindowApi.history(portId,id,exception).then(setHistory).catch(fail)}}>Lịch sử</Button>}</div>:null}
 return <Panel title="Khung giờ cảng cho phép tàu đến/rời"><div className={windowStyles.content}>
 {query.loading?<Loading label="Đang tải khung giờ cảng…"/>:query.error?<Notice tone="error" title="Chưa tải được khung giờ cảng"><p>{query.error.message}</p><Button onClick={query.retry}>Thử lại</Button></Notice>:query.data&&<>
 <p>Giờ địa phương: <strong>{query.data.portTimeZoneId}</strong>. Khung giờ đã xác minh chưa phải xác nhận cầu cảng.</p>
 {(['ARRIVAL','DEPARTURE'] as const).map(type=><section key={type}><h3>{type==='ARRIVAL'?'Khung giờ tàu đến (ARRIVAL)':'Khung giờ tàu rời (DEPARTURE)'}</h3>
 {!query.data!.windows.some(w=>w.windowType===type)&&<p>Chưa cấu hình khung giờ. Chuyến khởi hành cần dữ liệu đã xác minh để kiểm tra.</p>}
 {query.data!.windows.filter(w=>w.windowType===type).map(w=><article key={w.windowId}><p><strong>{w.localStartTime}–{w.localEndTime}</strong> · {weekdays.filter(([day])=>w.daysOfWeek.includes(day)).map(([,label])=>label).join(', ')}</p><p>Hiệu lực: {w.validFrom} → {w.validTo??'Không ghi ngày kết thúc'} · {status(w)}</p><p>Nguồn: {w.sourceType==='PORT_AUTHORITY'?'Cơ quan cảng':'Đại lý cảng'} · {w.sourceReference}{w.sourceEffectiveDate?` · Nguồn hiệu lực từ ${w.sourceEffectiveDate}`:''}</p><p>Lưu qua đêm: {w.overnightAllowed===null?'Chưa có thông tin nguồn':w.overnightAllowed?'Nguồn cho phép':'Nguồn không cho phép'}{w.maxStayMinutes!==null?` · Tối đa ${w.maxStayMinutes} phút`:''}</p>{actions(w)}</article>)}</section>)}
 <section><h3>Ngày đóng cảng</h3>{!query.data.exceptions.length?<p>Chưa ghi nhận ngoại lệ đóng cảng. Thông tin này không có nghĩa cảng hoạt động 24/7.</p>:query.data.exceptions.map(c=><article key={c.exceptionId}><p><strong>{c.validFrom} → {c.validTo}</strong> · {c.reason}</p><p>{status(c)} · Nguồn: {c.sourceReference}</p>{actions(c,true)}</article>)}</section>
 {ops&&access.canDo('PORT_CALL_WINDOW_CREATE')&&!editor&&<div className={styles.actions}><Button onClick={()=>begin()}>Thêm khung giờ</Button><Button tone="secondary" onClick={()=>begin(undefined,true)}>Thêm ngày đóng cảng</Button></div>}
 </>}
 {!manage&&<Notice title="Cần ngày khởi hành thực tế">Khung giờ chỉ để tham khảo khi lập mẫu. Kiểm tra theo ngày thực tế được hoãn đến bước tạo chuyến khởi hành.</Notice>}
 {error&&<Notice title="Chưa thể hoàn tất" tone="error">{error}</Notice>}
 {editor&&<form onSubmit={e=>void save(e)}><h3>{editor.id?'Chỉnh sửa': 'Thêm'} {editor.exception?'ngày đóng cảng':'khung giờ cảng'}</h3><p>{editor.id?'Lưu thay đổi sẽ ngừng áp dụng bản đang sửa. Cần xác minh lại trước khi kích hoạt.':'Bản mới cần được xác minh trước khi kích hoạt.'}</p>
 <fieldset className={styles.editorFields} disabled={busy}>
 {!editor.exception&&<section aria-labelledby="window-time-heading"><h4 id="window-time-heading">Loại lượt và giờ địa phương</h4><p>{query.data?.portTimeZoneId}</p><div className={styles.formGrid}>
 {!editor.exception&&<Field htmlFor="window-type" label="Tàu đến / rời"><select id="window-type" value={draft.windowType} onChange={e=>field('windowType',e.target.value as 'ARRIVAL'|'DEPARTURE')}><option value="ARRIVAL">Tàu đến</option><option value="DEPARTURE">Tàu rời</option></select></Field>}
</div><div className={styles.formGrid}>
 {!editor.exception&&<><Field htmlFor="window-start" label="Giờ bắt đầu *"><input id="window-start" type="time" step="1" required value={draft.localStartTime} onChange={e=>field('localStartTime',e.target.value)}/></Field><Field htmlFor="window-end" label="Giờ kết thúc *"><input id="window-end" aria-describedby="window-end-hint" aria-invalid={invalidTime || undefined} type="time" step="1" required value={draft.localEndTime} onChange={e=>field('localEndTime',e.target.value)}/><small id="window-end-hint">{invalidTime ? 'Giờ kết thúc phải sau giờ bắt đầu.' : 'Mốc kết thúc không thuộc khung giờ.'}</small></Field></>}
</div></section>}
 <section aria-labelledby="window-validity-heading"><h4 id="window-validity-heading">Ngày hiệu lực và thứ áp dụng</h4><div className={styles.formGrid}>
 <Field htmlFor="window-from" label="Hiệu lực từ *"><input id="window-from" type="date" required value={draft.validFrom} onChange={e=>field('validFrom',e.target.value)}/></Field>
 <Field htmlFor="window-to" label={editor.exception?'Đến hết ngày *':'Đến hết ngày'}><input id="window-to" type="date" min={draft.validFrom} required={editor.exception} value={draft.validTo??''} onChange={e=>field('validTo',e.target.value||null)}/></Field>
</div>
{!editor.exception&&<fieldset className={styles.weekdayGroup}><legend>Thứ áp dụng *</legend><div className={styles.weekdays}>{weekdays.map(([day,label])=><label key={day}><input type="checkbox" checked={draft.daysOfWeek.includes(day)} onChange={e=>field('daysOfWeek',e.target.checked?[...draft.daysOfWeek,day]:draft.daysOfWeek.filter(d=>d!==day))}/>{label} </label>)}</div>{missingWeekdays&&<p role="alert">Chọn ít nhất một thứ áp dụng.</p>}</fieldset>}
</section>
 <section aria-labelledby="window-evidence-heading"><h4 id="window-evidence-heading">Nguồn xác minh</h4><div className={styles.formGrid}>
 <Field htmlFor="window-source-type" label="Loại nguồn"><select id="window-source-type" value={draft.sourceType} onChange={e=>field('sourceType',e.target.value as WindowWrite['sourceType'])}><option value="PORT_AUTHORITY">Cơ quan cảng</option><option value="PORT_AGENT">Đại lý cảng</option></select></Field>
 <Field htmlFor="window-source-date" label="Ngày nguồn có hiệu lực"><input id="window-source-date" type="date" value={draft.sourceEffectiveDate??''} onChange={e=>field('sourceEffectiveDate',e.target.value||null)}/></Field>
<div className={styles.fullWidth}>
 <Field htmlFor="window-source" label="Tài liệu / nguồn tham chiếu *"><textarea id="window-source" required maxLength={2000} value={draft.sourceReference} onChange={e=>field('sourceReference',e.target.value)}/></Field>
</div>
 {editor.exception?<Field htmlFor="closure-reason" label="Lý do đóng cảng *"><textarea id="closure-reason" required maxLength={2000} value={reason} onChange={e=>setReason(e.target.value)}/></Field>:<>
 <Field htmlFor="window-overnight" label="Quyền lưu qua đêm theo nguồn"><select id="window-overnight" value={draft.overnightAllowed===null?'':String(draft.overnightAllowed)} onChange={e=>field('overnightAllowed',e.target.value===''?null:e.target.value==='true')}><option value="">Nguồn chưa xác định</option><option value="true">Nguồn cho phép</option><option value="false">Nguồn không cho phép</option></select></Field>
 <Field htmlFor="window-maxstay" label="Thời gian lưu tối đa theo nguồn (phút)"><input id="window-maxstay" type="number" min="1" step="1" value={draft.maxStayMinutes??''} onChange={e=>field('maxStayMinutes',e.target.value?Number(e.target.value):null)}/></Field></>}
</div></section>
 <div className={styles.actions}><Button type="submit">{busy?'Đang lưu…':'Lưu bản chưa xác minh'}</Button><Button type="button" tone="secondary" onClick={()=>setEditor(null)}>Hủy</Button></div></fieldset></form>}
 {history&&<section><h3>Lịch sử cập nhật</h3>{history.content.length?history.content.map(row=><details key={row.auditId}><summary>{row.occurredAt} · {row.action} · {row.actorUserId}</summary><pre>{row.detail}</pre></details>):<p>Chưa có lịch sử.</p>}<Button tone="text" onClick={()=>setHistory(null)}>Đóng lịch sử</Button></section>}
 </div></Panel>
}
