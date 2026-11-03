import {useCallback} from 'react'
import {useReadQuery} from '@/shared/api'
import {cruisePackageApi} from '@/domain/cruise-package'
import {Button} from '@/shared/ui'
import {publicContentFailure} from '../model/public-content-feedback'
import styles from './Booking.module.css'

/** Public selection contract only; never read internal OfferView, prices or readiness APIs. */
export function PublicCruisePackages({cruiseId}:{cruiseId:string}){
 const query=useReadQuery('public-cruise-packages:'+cruiseId,useCallback(signal=>cruisePackageApi.available(cruiseId,signal),[cruiseId]))
 const labels={INCLUDED:'Đã bao gồm',LIMITED_INCLUDED:'Đã bao gồm, có giới hạn',OPTIONAL:'Tùy chọn, chưa bao gồm',NOT_INCLUDED:'Không bao gồm'} as const
 return <section id="cruise-packages" className={styles.liveInfoPanel} aria-labelledby="public-packages-heading">
  <h2 id="public-packages-heading">Gói du thuyền</h2>
  {query.loading&&<p role="status">Đang tải các gói du thuyền được công bố…</p>}
  {query.error&&<div role="status"><p>{publicContentFailure(query.error)}</p><Button tone="secondary" onClick={query.retry}>Kiểm tra lại gói du thuyền</Button></div>}
  {!query.loading&&!query.error&&query.data&&(query.data.offers.length?query.data.offers.map(({selection})=><article key={selection.offerId}>
   <h3>{selection.templateName} · {selection.logicalCategory}</h3>
   {selection.templateDescription&&<p>{selection.templateDescription}</p>}
   <p><strong>{selection.amount.replace('.',',')} USD / người</strong></p>
   <ul>{selection.benefits.map(benefit=><li key={benefit.sourceBenefitId}>
    <strong>{benefit.resourceName}</strong> · {labels[benefit.inclusion]}
    {benefit.inclusion==='LIMITED_INCLUDED'&&<p>Giới hạn: {benefit.quantityLimit} {benefit.usageUnit==='PARTICIPATION'?'lượt tham gia':benefit.serviceUnitCode??'đơn vị chưa xác định'}.</p>}
    {benefit.requiresReservation===true&&<p>Cần đăng ký riêng theo lịch và chỗ còn khả dụng.</p>}
    <p>{benefit.eligibility}</p>
    {benefit.occurrences.length>0&&<p>Lần phục vụ: {benefit.occurrences.map(item=>item.name).join(' · ')}</p>}
    {benefit.usageStartsAt&&benefit.usageEndsAt&&<p>Thời gian sử dụng: {new Date(benefit.usageStartsAt).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'})} – {new Date(benefit.usageEndsAt).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'})} · Giờ Việt Nam</p>}
   </li>)}</ul>
  </article>):<p>Hiện chưa có gói du thuyền để hiển thị cho chuyến này.</p>)}
  <p>Quyền lợi cần đăng ký riêng phụ thuộc lịch phục vụ và chỗ còn khả dụng.</p>
 </section>
}
