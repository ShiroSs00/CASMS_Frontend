import {useCallback,useEffect,useState} from 'react'
import {useSearchParams} from 'react-router'
import {useSessionAccess} from '@/shared/auth'
import {useReadQuery} from '@/shared/api'
import {AdminShell} from '@/shared/ui/admin-v3'
import {Badge,Button,ButtonLink,Empty,Field,Loading,Notice,PageHeader,Panel} from '@/shared/ui'
import {viewerApi} from './api'
import {bleApi,liveRegion,signalLabels,type Tracking} from './ble'
import {formatTime,type Manifest} from './model'
import {ModelCanvas} from './ModelCanvas'
import styles from './Viewer.module.css'

function LivePassengers({ship,cruise,model,manifest}:{ship:string;cruise:string;model:string;manifest:Manifest}) {
  const [state,setState]=useState<{data:Tracking|null;error:string}>({data:null,error:''}),[clock,setClock]=useState(()=>Date.now()),[paused,setPaused]=useState(false),[attempt,setAttempt]=useState(0),[selected,setSelected]=useState(''),[deckId,setDeck]=useState(''),[search,setSearch]=useState('')
  const mapLoad=useCallback((signal:AbortSignal)=>bleApi.mappings(ship,model,signal),[ship,model]),mapping=useReadQuery(`tracking-mappings:${ship}:${model}`,mapLoad)
  useEffect(()=>{const timer=setInterval(()=>setClock(Date.now()),1000);return()=>clearInterval(timer)},[])
  useEffect(()=>{const controller=new AbortController();let timer:ReturnType<typeof setTimeout>;let alive=true;async function poll(){if(document.hidden){timer=setTimeout(()=>void poll(),3000);return}try{const data=await bleApi.tracking(ship,cruise,controller.signal);if(alive)setState({data,error:''})}catch(error){if(alive&&!controller.signal.aborted)setState(previous=>({...previous,error:error instanceof Error?error.message:'Chưa tải được dữ liệu định vị.'}))}finally{if(alive&&!paused)timer=setTimeout(()=>void poll(),3000)}}void poll();return()=>{alive=false;controller.abort();clearTimeout(timer)}},[ship,cruise,paused,attempt])
  const passengers=state.data?.passengers??[],focus=passengers.find(p=>p.identityId===selected)
  const regions=passengers.map(p=>({p,region:liveRegion(p,clock)})).filter(value=>value.region!==null)
  const focusRegion=focus?liveRegion(focus,clock):null
  const receiverDeck=focus?.receiver?.deckId,mappedDeck=mapping.data?.find(m=>m.deckId===receiverDeck)?.modelDeckId
  const effectiveDeck=selected&&focusRegion?mappedDeck??deckId:deckId,deck=manifest.decks.find(d=>d.id===effectiveDeck)
  const visible=passengers.filter(p=>(!search||`${p.fullName} ${p.tagName??''}`.toLocaleLowerCase('vi').includes(search.toLocaleLowerCase('vi'))))
  const markers=regions.filter(({p})=>!deck||mapping.data?.find(m=>m.deckId===p.receiver?.deckId)?.modelDeckId===deck.id).flatMap(({region,p})=>region?[{...region,color:p.identityId===selected?'#e49a15':'#167f98'}]:[])
  return <div className={styles.page}>
    <div className={styles.trackingStatus}><div><Badge label={paused?'Đã tạm dừng':state.error?'Mất kết nối':'Tự cập nhật mỗi 3 giây'} tone={state.error?'warning':paused?'neutral':'success'}/><span>{state.data?`Cập nhật ${formatTime(state.data.generatedAt)}`:'Đang kết nối…'}</span></div><div><Button tone="secondary" onClick={()=>setAttempt(n=>n+1)}>Làm mới</Button><Button tone="secondary" onClick={()=>setPaused(!paused)}>{paused?'Tiếp tục':'Tạm dừng'}</Button><Button onClick={()=>{setSelected('');setDeck('')}}>Xem tổng thể</Button></div></div>
    <Notice title="Vùng tín hiệu ước lượng" tone="info">Vòng tròn thể hiện phạm vi ước lượng quanh bộ thu tín hiệu trong 5 giây gần nhất, không phải tọa độ tuyệt đối của hành khách.</Notice>
    {state.error&&<Notice title="Chưa cập nhật được tín hiệu" tone="error">{state.error}</Notice>}{mapping.error&&<Notice title="Chưa tải được ánh xạ boong" tone="warning">{mapping.error.message}<Button onClick={mapping.retry}>Thử lại</Button></Notice>}
    {!state.data&&!state.error&&<Loading label="Đang tải hành khách và tín hiệu…"/>}
    <div className={styles.bleWorkspace}><aside className={styles.inspector}><div className={styles.panelLabel}><h2>Hành khách</h2><span>{passengers.length}</span></div><Field htmlFor="tracking-search" label="Tìm hành khách"><input id="tracking-search" type="search" placeholder="Tên hành khách hoặc thẻ định vị" value={search} onChange={e=>setSearch(e.target.value)}/></Field><p className={styles.note}>{regions.length} vùng có tín hiệu mới</p><div className={styles.passengerList}>{visible.map(p=><button key={p.identityId} className={styles.anchorItem} aria-pressed={selected===p.identityId} onClick={()=>setSelected(p.identityId)}><strong>{p.fullName}</strong><small>{liveRegion(p,clock)?'Có tín hiệu':p.status==='LIVE'?'Tín hiệu đã cũ':signalLabels[p.status]??p.status}</small></button>)}</div>{state.data&&!passengers.length&&<Empty title="Chưa có hành khách được gán thẻ định vị"/>}</aside>
      <div className={styles.sceneColumn}><Field htmlFor="tracking-deck" label="Boong đang xem"><select id="tracking-deck" value={effectiveDeck} onChange={e=>{setSelected('');setDeck(e.target.value)}}><option value="">Tổng thể tàu</option>{manifest.decks.map(d=><option key={d.id} value={d.id}>Boong {d.number} · {d.name}</option>)}</select></Field><ModelCanvas key={`${model}:${deck?.asset??manifest.assets.exterior}`} ship={ship} model={model} file={deck?.asset??manifest.assets.exterior??manifest.assets.full??''} selected="" onPick={()=>{}} markers={markers} focusedMarker={focusRegion&&mapping.data?selected:undefined} onMarker={setSelected}/></div>
      {focus&&<aside className={styles.inspector}><h2>{focus.fullName}</h2><Badge label={focusRegion?'Đang có tín hiệu':'Chưa xác định vị trí'} tone={focusRegion?'success':'warning'}/><dl className={styles.facts}>{[['Thẻ định vị',focus.tagName??'Chưa đặt tên'],['Bộ thu tín hiệu',focus.receiver?.deviceName??'Chưa có'],['Boong ghi nhận',manifest.decks.find(d=>mapping.data?.find(m=>m.deckId===focus.receiver?.deckId)?.modelDeckId===d.id)?.name??'Chưa xác định'],['Khoảng cách ước lượng',focusRegion&&focus.proximity?.distanceMeters!=null?`≈ ${focus.proximity.distanceMeters.toFixed(1)} m${focus.proximity.distanceClamped?' (đã giới hạn)':''}`:'Chưa có tín hiệu mới'],['Tín hiệu gần nhất',focus.proximity?.lastSeen?formatTime(focus.proximity.lastSeen):'Chưa có'],['Hiệu chuẩn thiết bị',focus.proximity?.calibrated?'Đã hiệu chuẩn':'Chưa hiệu chuẩn']].map(([k,v])=><div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl></aside>}
    </div>
  </div>
}
function TrackingCruise({ship,cruise}:{ship:string;cruise:string}) {
  const load=useCallback((signal:AbortSignal)=>bleApi.activeModel(ship,signal),[ship]),query=useReadQuery(`tracking-model:${ship}`,load)
  return <>{query.loading&&<Loading label="Đang tải mô hình 3D của tàu…"/>}{query.error&&<Notice title="Tàu chưa có mô hình 3D sẵn sàng" tone="warning">{query.error.message}<Button onClick={query.retry}>Thử lại</Button></Notice>}{query.data&&<TrackingModel key={query.data.id} ship={ship} cruise={cruise} model={query.data.id}/>}</>
}
function TrackingModel({ship,cruise,model}:{ship:string;cruise:string;model:string}) {const load=useCallback((signal:AbortSignal)=>viewerApi.manifest(ship,model,signal),[ship,model]),query=useReadQuery(`tracking-manifest:${ship}:${model}`,load);return <>{query.loading&&<Loading label="Đang đọc dữ liệu mô hình tàu…"/>}{query.error&&<Notice title="Chưa tải được mô hình tàu" tone="error">{query.error.message}<Button onClick={query.retry}>Thử lại</Button></Notice>}{query.data&&<LivePassengers key={`${ship}:${cruise}:${model}`} ship={ship} cruise={cruise} model={model} manifest={query.data}/>}</>}
function ShipTracking({ship,cruise,onCruise}:{ship:string;cruise:string;onCruise:(id:string)=>void}) {
  const load=useCallback((signal:AbortSignal)=>bleApi.cruises(ship,signal),[ship]),query=useReadQuery(`tracking-cruises:${ship}`,load),selected=query.data?.find(c=>c.cruiseId===cruise)??(!cruise?query.data?.[0]:undefined)
  return <>{query.loading&&<Loading label="Đang tải chuyến đang khai thác…"/>}{query.error&&<Notice title="Chưa tải được chuyến" tone="error">{query.error.message}<Button onClick={query.retry}>Thử lại</Button></Notice>}{query.data && query.data.length > 0 && <Field htmlFor="tracking-cruise" label="Chuyến đang khai thác"><select id="tracking-cruise" value={selected?.cruiseId??''} onChange={e=>onCruise(e.target.value)}>{!selected&&<option value="">Chọn chuyến</option>}{query.data.map(c=><option key={c.cruiseId} value={c.cruiseId}>{c.cruiseCode} · {c.cruiseName}</option>)}</select></Field>}{query.data?.length===0&&<Empty title="Tàu hiện chưa có chuyến nào đang khai thác"/>}{selected&&<TrackingCruise key={`${ship}:${selected.cruiseId}`} ship={ship} cruise={selected.cruiseId}/>}</>
}
export function PassengerTrackingPage({ backTo }: { backTo?: string }) {
  const access=useSessionAccess()
  const [params,setParams]=useSearchParams()
  const allowed=access.roles.includes('SHIP_MANAGER')&&access.canDo('SHIP_READ')&&access.canDo('BLE_TELEMETRY_READ')
  const load=useCallback((signal:AbortSignal)=>allowed?viewerApi.ships(signal):Promise.resolve([]),[allowed])
  const query=useReadQuery('tracking-ships',load)
  const requestedShip=params.get('ship')??''
  const ship=requestedShip || (query.data?.length === 1 ? query.data[0].shipId : '')
  const validShip=query.data?.some(s=>s.shipId===ship)
  function selectShip(shipId: string) {
    const next = new URLSearchParams(params)
    if (shipId) next.set('ship', shipId)
    else next.delete('ship')
    next.delete('cruise')
    setParams(next)
  }

  function selectCruise(cruiseId: string) {
    const next = new URLSearchParams(params)
    if (cruiseId) next.set('cruise', cruiseId)
    else next.delete('cruise')
    setParams(next)
  }

  return <AdminShell>
    <PageHeader title="Hành khách trên tàu" breadcrumb="Quản lý tàu / Hành khách trên tàu"
      description=""
      actions={backTo && <ButtonLink to={backTo} tone="secondary" size="compact" autoWidth>Về danh sách hành khách</ButtonLink>} />
    <Panel>
      <div className={styles.page}>
        {!allowed && <Notice title="Chưa đủ quyền theo dõi" tone="warning">Tài khoản chưa được cấp quyền xem tàu và dữ liệu định vị.</Notice>}
        {query.error && <Notice title="Chưa tải được tàu" tone="error">{query.error.message}<Button onClick={query.retry}>Thử lại</Button></Notice>}
        <Field htmlFor="tracking-ship" label="Tàu">
          <select id="tracking-ship" value={ship} onChange={event => selectShip(event.target.value)}>
            <option value="">Chọn tàu</option>
            {query.data?.map(s => <option key={s.shipId} value={s.shipId}>{s.shipCode} · {s.shipName}</option>)}
          </select>
        </Field>
        {validShip
          ? <ShipTracking key={ship} ship={ship} cruise={params.get('cruise') ?? ''} onCruise={selectCruise} />
          : <Empty title="Chọn tàu để theo dõi vị trí hành khách" />}
      </div>
    </Panel>
  </AdminShell>
}
