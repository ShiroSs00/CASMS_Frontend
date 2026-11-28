import { useState } from 'react'
import {useBookingModelRenderer} from './BookingModelIntegration'
import { Button, Field, Notice, Panel } from '@/shared/ui'
import type { CruisePackageCatalog, CabinSelectionMode } from '@/domain/cruise-package'
import type { AvailableCabin, BookingPersonDraft } from '../api/real-booking-api'
import { useLiveBooking, blankBookingPerson } from '../model/live-booking-context'
import styles from './BookingAgent.module.css'

/** Booking adapter only. Rendering/import/model mappings belong to the existing 3D feature. */
export function CruisePackageCabinSelection({catalog,cabins,shipId}:{catalog:CruisePackageCatalog;cabins:AvailableCabin[];shipId:string}) {
  const {draft,setDraft,errors}=useLiveBooking(),[personIndex,setPersonIndex]=useState(0)
  const renderModel=useBookingModelRenderer()
  const index=Math.min(personIndex,draft.passengers.length-1),person=draft.passengers[index]
  const selection=catalog.offers.find(o=>o.selection.offerId===person?.farePackageOfferId)?.selection
  function update(index:number,change:Partial<BookingPersonDraft>){setDraft(d=>({...d,passengers:d.passengers.map((p,i)=>i===index?{...p,...change}:p)}))}
  const choices=cabins.filter(c=>selection?.physicalCabinIds.includes(c.cabinId)&&c.remainingCapacity===c.capacity).map(c=>({cabinId:c.cabinId,remainingCapacity:Math.max(0,c.remainingCapacity-draft.passengers.filter((p,i)=>i!==index&&p.cabinId===c.cabinId).length)}))
  return <section className={styles.cabinSelection} aria-label="Chọn gói du thuyền và cabin">
    {!catalog.offers.length&&<Notice title="Chưa có gói du thuyền khả dụng" tone="warning"><p>Chưa thể tiếp tục đặt chỗ trên chuyến này. Cần đối chiếu điều kiện bán từ máy chủ.</p></Notice>}
    {draft.passengers.map((p,i)=><Panel key={i} className={styles.passengerSelection} title={p.fullName || `Hành khách ${i+1}`}>
      <div className={styles.cabinFields}>
      <Field htmlFor={`person-${i}-farePackageOfferId`} label="Gói du thuyền và hạng cabin" error={errors[`person-${i}-farePackageOfferId`]}><select id={`person-${i}-farePackageOfferId`} value={p.farePackageOfferId??''} onChange={e=>{const fare=catalog.offers.find(o=>o.selection.offerId===e.target.value)?.selection;update(i,{farePackageOfferId:fare?.offerId,farePackagePriceRevisionId:fare?.priceRevisionId,tourPackageId:'',cabinId:''})}}><option value="">Chọn gói du thuyền</option>{catalog.offers.map(o=><option key={o.selection.offerId} value={o.selection.offerId}>{o.selection.templateName} · {o.selection.logicalCategory} · {new Intl.NumberFormat('vi-VN',{maximumFractionDigits:2}).format(Number(o.selection.amount))} {o.currencyCode}/người</option>)}</select></Field>
      <Field htmlFor={`person-${i}-cabinSelectionMode`} label="Cách chọn cabin" error={errors[`person-${i}-cabinSelectionMode`]}><select id={`person-${i}-cabinSelectionMode`} value={p.cabinSelectionMode??''} onChange={e=>update(i,{cabinSelectionMode:e.target.value?e.target.value as CabinSelectionMode:undefined,cabinId:''})}><option value="">Chọn cách nhận cabin</option><option value="PHYSICAL_CABIN">Chọn cabin ngay trên mô hình 3D</option><option value="CATEGORY_HOLD">Giữ chỗ theo hạng, chọn cabin sau</option></select></Field>
      <Field htmlFor={`person-${i}-cabinGroupKey`} label="Nhóm ở chung cabin" hint="Dùng cùng tên nhóm cho những người ở chung." error={errors[`person-${i}-cabinGroupKey`]}><input id={`person-${i}-cabinGroupKey`} maxLength={100} placeholder="Ví dụ: Gia đình 1" value={p.cabinGroupKey??''} onChange={e=>update(i,{cabinGroupKey:e.target.value})}/></Field>
      </div>
      {p.cabinSelectionMode==='CATEGORY_HOLD'&&<p className={styles.helper}>Chưa chọn cabin cụ thể. Nếu bỏ trống tên nhóm, những khách giữ theo hạng sẽ ở chung một nhóm; cần còn cabin đủ chỗ cho cả nhóm.</p>}
      {p.cabinSelectionMode==='PHYSICAL_CABIN'&&<><Button tone="secondary" onClick={()=>setPersonIndex(i)}>Chọn cabin 3D cho hành khách {i+1}</Button><p>{p.cabinId?`Cabin đã chọn: ${cabins.find(c=>c.cabinId===p.cabinId)?.cabinNumber??'Cần kiểm tra lại'}`:'Chưa chọn cabin.'}</p>{errors[`person-${i}-cabinId`]&&<p role="alert">{errors[`person-${i}-cabinId`]}</p>}</>}
    </Panel>)}
    {person?.cabinSelectionMode==='PHYSICAL_CABIN'&&selection&&<Panel title={`Chọn cabin cho hành khách ${index+1} · ${selection.logicalCategory}`}>{renderModel?renderModel({shipId,cruiseId:draft.cruiseId,cabins:choices,selectedCabinId:person.cabinId||undefined,onSelectCabin:id=>{if(choices.some(c=>c.cabinId===id&&c.remainingCapacity>0))update(index,{cabinId:id})}}):<Notice title="Chưa tải được sơ đồ 3D chọn cabin" tone="warning"><p>Tàu này chưa có sơ đồ 3D khả dụng để chọn cabin trực quan.</p></Notice>}</Panel>}
    <div className={styles.operationButtons}><Button tone="secondary" onClick={()=>setDraft(d=>({...d,passengers:[...d.passengers,blankBookingPerson()]}))}>Thêm hành khách</Button>
    {draft.passengers.length>1&&<Button tone="text" onClick={()=>setDraft(d=>({...d,passengers:d.passengers.slice(0,-1)}))}>Bỏ hành khách cuối</Button>}</div>
    <p className={styles.helper}>Giá gói đã gồm hành trình và cabin. Hoạt động, dịch vụ cần đăng ký riêng theo số chỗ còn lại.</p>
  </section>
}
