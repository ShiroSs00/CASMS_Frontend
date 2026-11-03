import {useCallback} from 'react'
import {useReadQuery} from '@/shared/api'
import {useSessionAccess} from '@/shared/auth'
import {Button,Loading,Notice} from '@/shared/ui'
import {shipImportApi} from './api'
import type {ImportSession} from './model'
import styles from './ShipImport.module.css'

export function ImportPreviewDetails({session}:{session:ImportSession}) {
  const access=useSessionAccess(),canReadShip=access.canDo('SHIP_READ'),key=session.modelKey,version=session.assetVersion,id=session.registration?.shipId
  const load=useCallback((signal:AbortSignal)=>shipImportApi.preview(session,signal),[session])
  const preview=useReadQuery(`import-preview:${key}:${version}`,load)
  const readShip=useCallback((signal:AbortSignal)=>id&&canReadShip?shipImportApi.ship(id,signal):Promise.resolve(null),[id,canReadShip])
  const ship=useReadQuery(`import-created-ship:${id}`,readShip)
  const data=preview.data,saved=ship.data
  const rows:Array<[string,unknown]>=[
    ['Tên tàu',saved?.shipName??data?.name],...(id?[['Mã tàu',saved?.shipCode] as [string,unknown]]:[]),
    ['Sức chứa hành khách',saved?.totalCapacity??data?.passengerCapacity],['Số boong hành khách',saved?.totalDecks??data?.deckCount??data?.decks.length],
    ['Chiều dài',saved?.lengthMeters!=null?`${saved.lengthMeters} m`:data?.length!=null?`${data.length} ${['metre','meter','meters','metres','m'].includes(data.units??'')?'m':data.units??''}`:undefined],
    ['Chiều rộng',saved?.beamMeters!=null?`${saved.beamMeters} m`:data?.beam!=null?`${data.beam} ${['metre','meter','meters','metres','m'].includes(data.units??'')?'m':data.units??''}`:undefined],
    ['Ngày đưa vào hoạt động',saved?.commissionDate??data?.commissionDate],
    ['Mô hình đã chọn',`${key} · ${version}`],
  ]
  return <div className={styles.previewDetails}>
    {preview.loading&&<Loading label="Đang tải thông tin mô hình…"/>}
    {preview.error&&<Notice title="Không tải được thông tin mô hình" tone="error">{preview.error.message}<Button tone="text" onClick={preview.retry}>Thử lại</Button></Notice>}
    {id&&ship.loading&&<Loading label="Đang tải thông tin tàu…"/>}
    {ship.error&&<Notice title="Không tải được thông tin tàu" tone="error">{ship.error.message}<Button tone="text" onClick={ship.retry}>Thử lại</Button></Notice>}
    {data&&<>
      <section><h3 className={styles.sectionTitle}>{id?'Thông tin tàu vừa tạo':'Thông tin tàu từ mô hình'}</h3>
        <dl className={styles.previewFacts}>{rows.map(([label,value])=><div key={label}><dt>{label}</dt><dd>{typeof value==='string'||typeof value==='number'?value:'Chưa có dữ liệu'}</dd></div>)}</dl>
      </section>
      <section><h3 className={styles.sectionTitle}>{id?'Boong và phòng sắp tạo':'Cấu trúc trong mô hình'}</h3>
        <div className={styles.previewTotals}><span><strong>{data.decks.length+(data.serviceDecks?.length??0)}</strong> boong</span><span><strong>{data.cabins.length}</strong> phòng</span><span><strong>{data.areas?.length??'—'}</strong> khu vực dịch vụ</span></div>
        <div className={styles.previewDecks}>{[...data.decks,...data.serviceDecks??[]].sort((a,b)=>a.number-b.number).map(deck=>{
          const cabins=data.cabins.filter(c=>c.deckId===deck.id),areas=data.areas?.filter(a=>a.deckId===deck.id)
          return <details key={deck.id}><summary><strong>Boong {deck.number} · {deck.name}</strong><span>{cabins.length} phòng · {areas?.length??'—'} khu vực dịch vụ</span></summary><div className={styles.roomNumbers}>{cabins.length?cabins.map(c=><span key={c.cabinNumber}>{c.cabinNumber}</span>):<span>Không có phòng.</span>}</div></details>
        })}</div>
      </section>
    </>}
  </div>
}
