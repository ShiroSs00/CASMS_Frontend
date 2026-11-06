import {useCallback} from 'react'
import {useReadQuery} from '@/shared/api'
import {useSessionAccess} from '@/shared/auth'
import {Button,Loading,Notice} from '@/shared/ui'
import {serviceAreaName, serviceType} from '@/shared/i18n/service-area-copy'
import {shipProfileFacts} from '@/shared/lib/ship-profile'
import {shipImportApi, type ImportPreview} from './api'
import type {ImportSession} from './model'
import styles from './ShipImport.module.css'

function useImportedShip(id: string | undefined) {
  const canReadShip=useSessionAccess().canDo('SHIP_READ')
  const readShip=useCallback((signal:AbortSignal)=>id&&canReadShip?shipImportApi.ship(id,signal):Promise.resolve(null),[id,canReadShip])
  return useReadQuery(`import-created-ship:${id}:${canReadShip}`,readShip)
}

export function ImportedShipProfile({ shipId }: { shipId: string }) {
  const ship = useImportedShip(shipId)
  return <section>
    <h3 className={styles.sectionTitle}>Thông tin hồ sơ tàu</h3>
    {ship.loading && <Loading label="Đang tải thông tin tàu…" />}
    {ship.error && <Notice title="Không tải được thông tin tàu" tone="error">
      {ship.error.message}<Button tone="text" onClick={ship.retry}>Thử lại</Button>
    </Notice>}
    {ship.data && <dl className={styles.previewFacts}>
      {shipProfileFacts(ship.data).map(([label, value]) => (
        <div key={label}><dt>{label}</dt><dd>{value}</dd></div>
      ))}
    </dl>}
  </section>
}

export function ImportPreviewDetails({session,preview}:{session:ImportSession;preview:{data:ImportPreview|null;loading:boolean;error:Error|null;retry:()=>void}}) {
  const key=session.modelKey,id=session.registration?.shipId
  const ship=useImportedShip(id)
  const data=preview.data,saved=ship.data
  const profileRows = id
    ? shipProfileFacts(saved ?? {}, saved ? 'Chưa cập nhật' : ship.loading ? 'Đang tải…' : 'Chưa có dữ liệu')
    : []
  const rows:Array<[string,unknown]>=[
    ['Tên tàu',saved?.shipName??data?.name],...(id?[['Mã tàu',saved?.shipCode] as [string,unknown]]:[]),
    ['Sức chứa hành khách',saved?.totalCapacity??data?.passengerCapacity],['Số boong hành khách',saved?.totalDecks??data?.deckCount??data?.decks.length],
    ['Chiều dài',saved?.lengthMeters!=null?`${saved.lengthMeters} m`:data?.length!=null?`${data.length} ${['metre','meter','meters','metres','m'].includes(data.units??'')?'m':data.units??''}`:undefined],
    ['Chiều rộng',saved?.beamMeters!=null?`${saved.beamMeters} m`:data?.beam!=null?`${data.beam} ${['metre','meter','meters','metres','m'].includes(data.units??'')?'m':data.units??''}`:undefined],
    ['Ngày đưa vào hoạt động',saved?.commissionDate??data?.commissionDate],
    ...profileRows,
    ['Mô hình đã chọn',key],
  ]
  return <div className={styles.previewDetails}>
    {preview.loading&&<Loading label="Đang tải thông tin mô hình…"/>}
    {preview.error&&<Notice title="Không tải được thông tin mô hình" tone="error">{preview.error.message}<Button tone="text" onClick={preview.retry}>Thử lại</Button></Notice>}
    {id&&ship.loading&&<Loading label="Đang tải thông tin tàu…"/>}
    {ship.error&&<Notice title="Không tải được thông tin tàu" tone="error">{ship.error.message}<Button tone="text" onClick={ship.retry}>Thử lại</Button></Notice>}
    {(data || id) &&
      <section><h3 className={styles.sectionTitle}>{id?'Thông tin tàu vừa tạo':'Thông tin tàu từ mô hình'}</h3>
        <dl className={styles.previewFacts}>{rows.map(([label,value])=><div key={label}><dt>{label}</dt><dd>{typeof value==='string'||typeof value==='number'?value:'Chưa có dữ liệu'}</dd></div>)}</dl>
      </section>
    }
    {data&&<>
      <section><h3 className={styles.sectionTitle}>Cấu trúc trong manifest</h3>
        <div className={styles.previewTotals}><span><strong>{data.decks.length+(data.serviceDecks?.length??0)}</strong> boong</span><span><strong>{data.cabins.length}</strong> phòng</span><span><strong>{data.areas?.length??'—'}</strong> mục khu vực</span></div>
        <div className={styles.previewDecks}>{[...data.decks,...data.serviceDecks??[]].sort((a,b)=>a.number-b.number).map(deck=>{
          const cabins=data.cabins.filter(c=>c.deckId===deck.id),areas=data.areas?.filter(a=>a.deckId===deck.id)
          const serviceDeck = data.serviceDecks?.some(item => item.id === deck.id)
          return <details key={deck.id}><summary><strong>{serviceDeck ? 'Boong dịch vụ' : 'Boong'} {deck.number} · {deck.name}</strong><span>{cabins.length} phòng · {areas?.length??'—'} mục khu vực</span></summary>
            <div className={styles.roomNumbers}>{cabins.length?cabins.map(c=><span key={c.cabinNumber} translate="no">{c.cabinNumber}</span>):<span>Không có phòng.</span>}</div>
            {!!areas?.length && <ul className={styles.areaPreview}>{areas.map((area, index) => {
              const name = typeof area.name === 'string' && area.name.trim() ? area.name : 'Chưa đặt tên'
              const kind = typeof area.kind === 'string' ? area.kind : ''
              return <li key={area.id ?? index}>{serviceAreaName({ name, kind })}{kind ? ` · ${serviceType(kind)}` : ''}</li>
            })}</ul>}
          </details>
        })}</div>
      </section>
    </>}
  </div>
}
