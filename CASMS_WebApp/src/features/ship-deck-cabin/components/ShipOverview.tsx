import {ShipAreaCount} from './ShipAreaCount'
import {useCallback} from 'react'
import {useSessionAccess} from '@/shared/auth'
import {Loading,Notice,Panel} from '@/shared/ui'
import {shipDeckCabinApi} from '../api/ship-deck-cabin-api'
import {useFleetQuery} from '../hooks/useFleetQuery'
import {formatDate,type Ship} from '../model/types'
import styles from './ShipOverview.module.css'

export function ShipOverview({ship}:{ship:Ship}) {
  const access=useSessionAccess()
  const loadCapacity=useCallback((signal:AbortSignal)=>shipDeckCabinApi.getShipCapacity(ship.id,signal),[ship.id])
  const loadCruise=useCallback((signal:AbortSignal)=>shipDeckCabinApi.getCurrentCruise(ship.id,signal),[ship.id])
  const capacity=useFleetQuery(`overview-capacity:${ship.id}`,loadCapacity,access.canDo('SHIP_CAPACITY_SUMMARY'))
  const cruise=useFleetQuery(`overview-cruise:${ship.id}`,loadCruise,access.canDo('SHIP_CURRENT_CRUISE'))
  const facts=[['Boong hành khách',ship.totalDecks],['Chiều dài',ship.lengthMeters!=null?`${ship.lengthMeters.toLocaleString('vi-VN')} m`:'Chưa cập nhật'],['Chiều rộng',ship.beamMeters!=null?`${ship.beamMeters.toLocaleString('vi-VN')} m`:'Chưa cập nhật'],['Ngày đưa vào khai thác',formatDate(ship.commissionDate)],['Cập nhật hồ sơ',formatDate(ship.updatedAt)]]
  return <div className={styles.overview}>
    <dl className={styles.summary} aria-label="Sức chứa và phòng trên tàu">
      <div><dt>Sức chứa hành khách</dt><dd>{ship.capacity.toLocaleString('vi-VN')} <span>khách</span></dd></div>
      <div><dt>Tổng số boong</dt><dd>{capacity.data?.actualDeckCount??'—'}</dd></div>
      <div><dt>Tổng số phòng</dt><dd>{capacity.data?.actualCabinCount??'—'}</dd></div>
      <div><dt>Phòng còn trống</dt><dd>{capacity.data?.availableCabinCount??'—'}</dd></div>
      <ShipAreaCount count={capacity.data?.actualServiceAreaCount}/>
    </dl>
    {capacity.loading&&<span className={styles.loading} role="status">Đang tải số liệu…</span>}
    {capacity.error&&<Notice title="Không tải được số liệu tàu" tone="error">{capacity.error}</Notice>}
    <div className={styles.panels}>
      <Panel title="Thông số tàu"><dl className={styles.facts}>{facts.map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></Panel>
      {access.canDo('SHIP_CURRENT_CRUISE')&&<Panel title="Chuyến đang thực hiện">
        {cruise.loading&&!cruise.data&&<Loading label="Đang tải chuyến đi…"/>}
        {cruise.error&&<div className={styles.cruiseError} role="alert"><strong>Không tải được chuyến đi</strong><p>{cruise.error}</p></div>}
        {cruise.data&&<div className={styles.cruise}><span className={styles.cruiseCode}>{cruise.data.code}</span><h3>{cruise.data.name}</h3><dl className={styles.facts}><div><dt>Khởi hành</dt><dd>{formatDate(cruise.data.departure)}</dd></div><div><dt>Kết thúc</dt><dd>{formatDate(cruise.data.returnAt)}</dd></div></dl></div>}
        {!cruise.loading&&!cruise.error&&!cruise.data&&<div className={styles.noCruise}><span aria-hidden="true">—</span><strong>Không có chuyến đang thực hiện</strong></div>}
      </Panel>}
    </div>
  </div>
}
