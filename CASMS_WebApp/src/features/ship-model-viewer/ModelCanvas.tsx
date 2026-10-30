import { useEffect, useRef, useState } from 'react'
import { apiAsset } from '@/shared/api'
import { Button } from '@/shared/ui'
import { assetPath } from './model'
import { createModelScene, type ModelScene, type CameraView } from './scene'
import styles from './Viewer.module.css'
import type {Point,SceneMarker} from './ble'
export function ModelCanvas({ship,model,file,selected,onPick,markers,focusedMarker,placing=false,onPlace,onMarker,publicModel=false,autoFocusSelection=false,selectionLabel,selectionContext}:{autoFocusSelection?:boolean;selectionLabel?:string;selectionContext?:string;publicModel?:boolean;ship:string;model:string;file:string;selected:string;onPick:(name:string)=>void;markers?:SceneMarker[];focusedMarker?:string;placing?:boolean;onPlace?:(point:Point,node:string)=>void;onMarker?:(id:string)=>void}) {
  const host=useRef<HTMLDivElement>(null), scene=useRef<ModelScene|null>(null), pick=useRef(onPick)
  const [state,setState]=useState<{loading:boolean;loaded:number;total:number;error:string}>({loading:true,loaded:0,total:0,error:''})
  const [attempt,setAttempt]=useState(0),[wire,setWire]=useState(false),[focused,setFocused]=useState(false)
  useEffect(()=>{pick.current=onPick},[onPick])
  const placement=useRef(onPlace),markerPick=useRef(onMarker)
  useEffect(()=>{placement.current=onPlace;markerPick.current=onMarker},[onPlace,onMarker])
  useEffect(()=>{
    if(!host.current)return
    const controller=new AbortController();let alive=true;let engine:ModelScene|null=null
    const timeout=setTimeout(()=>controller.abort(),180000)
    void Promise.resolve().then(()=>{controller.signal.throwIfAborted();if(!host.current)throw new Error('Khung xem 3D chưa sẵn sàng.');engine=createModelScene(host.current,name=>pick.current(name),()=>{if(alive)setState(s=>({...s,loading:false,error:'Ngữ cảnh 3D đã bị ngắt. Tải lại mô hình để tiếp tục.'}))},(point,node)=>placement.current?.(point,node),id=>markerPick.current?.(id));scene.current=engine;return apiAsset(publicModel?assetPath(ship,model,file).replace('/models/','/public-model/'):assetPath(ship,model,file),controller.signal,(loaded,total)=>{if(alive)setState({loading:true,loaded,total,error:''})},publicModel)}).then(async bytes=>{if(alive)await engine?.load(bytes);if(alive)setState(s=>({...s,loading:false}))}).catch(error=>{if(alive)setState(s=>({...s,loading:false,error:error instanceof Error&&error.name!=='AbortError'?error.message:'Tải asset bị gián đoạn hoặc quá thời gian. Thử lại.'}))}).finally(()=>clearTimeout(timeout))
    return()=>{alive=false;controller.abort();clearTimeout(timeout);engine?.dispose();scene.current=null}
  },[ship,model,file,attempt,publicModel])
  useEffect(()=>{if(!state.loading)setFocused(scene.current?.select(selected,autoFocusSelection)??false)},[selected,state.loading,autoFocusSelection])
  useEffect(()=>{if(!state.loading)scene.current?.markers(markers??[])},[markers,state.loading])
  useEffect(()=>{if(!state.loading&&focusedMarker)scene.current?.focusMarker(focusedMarker)},[focusedMarker,state.loading])
  useEffect(()=>{scene.current?.placement(placing)},[placing,state.loading])
  const view=(value:CameraView)=>scene.current?.view(value)
  return <section className={styles.canvasPanel} aria-label="Khung xem model 3D">
    <div className={styles.canvasToolbar}><div>{([['perspective','Phối cảnh'],['top','Từ trên'],['side','Mạn tàu'],['front','Mũi tàu']] as const).map(([value,label])=><button type="button" key={value} onClick={()=>view(value)} disabled={state.loading||Boolean(state.error)}>{label}</button>)}</div><button type="button" onClick={()=>{const element=host.current?.parentElement;if(document.fullscreenElement)void document.exitFullscreen();else void element?.requestFullscreen().catch(()=>{})}}>Toàn màn hình ↗</button></div>
    <div className={styles.canvas} ref={host}/>
    {selected&&selectionLabel&&!state.loading&&!state.error&&<div className={styles.selectionLabel} role="status"><span className={styles.locationDot} aria-hidden="true"/><div><strong>{selectionLabel}</strong><span>{selectionContext}</span></div>{!focused&&<span>Không tìm thấy vị trí trên sơ đồ</span>}</div>}
    {state.loading&&<div className={styles.canvasOverlay} role="status"><span className={styles.loader}/><strong>Đang tải mô hình</strong><span>{state.loaded?`${(state.loaded/1048576).toFixed(1)} MB${state.total?` / ${(state.total/1048576).toFixed(1)} MB`:''}`:'Đang kết nối tới asset…'}</span>{state.total>0&&<progress value={state.loaded} max={state.total} aria-label="Tiến độ tải model"/>}</div>}
    {state.error&&<div className={styles.canvasOverlay} role="alert"><strong>Chưa hiển thị được mô hình</strong><p>{state.error}</p><Button onClick={()=>{setState({loading:true,loaded:0,total:0,error:''});setWire(false);setFocused(false);setAttempt(n=>n+1)}}>Tải lại model</Button></div>}
    <div className={styles.canvasBottom}><div><button type="button" aria-label="Phóng to" onClick={()=>scene.current?.zoom(.8)}>＋</button><button type="button" aria-label="Thu nhỏ" onClick={()=>scene.current?.zoom(1.25)}>−</button><button type="button" onClick={()=>view('perspective')}>Đặt lại</button><button type="button" aria-pressed={wire} onClick={()=>{setWire(!wire);scene.current?.wireframe(!wire)}}>Khung lưới</button>{selected&&<button type="button" onClick={()=>setFocused(scene.current?.select(selected,true)??false)}>Xem vị trí đã chọn</button>}</div></div>
    {selected&& !focused &&<span className={styles.srOnly}>Đối tượng được tô viền vàng nếu có trong asset đang hiển thị.</span>}
  </section>
}
