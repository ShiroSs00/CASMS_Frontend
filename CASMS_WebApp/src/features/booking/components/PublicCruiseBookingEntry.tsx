import {useCallback} from 'react'
import {ApiError,useReadQuery} from '@/shared/api'
import {liveCruiseCatalogApi} from '../api/booking-api'
import {bookingReadFailure} from '../model/booking-feedback'
import {ButtonLink} from '@/shared/ui'
import {businessCopy} from '@/shared/i18n/business-copy'
import {bookingStepPaths,catalogReturn} from '../model/live-booking-navigation'

export function PublicCruiseBookingEntry({ cruiseId,back }: { cruiseId: string; back: string }) {
  const query=useReadQuery('public-sellability:'+cruiseId,useCallback(signal=>liveCruiseCatalogApi.saleState(cruiseId,signal),[cruiseId]))
  if(query.loading)return <p role="status">Đang kiểm tra trạng thái lần khởi hành…</p>
  if(query.error)return <div role="status"><p>{bookingReadFailure(query.error instanceof ApiError?query.error.status:undefined)}</p><button type="button" onClick={query.retry}>Thử lại</button></div>
  if(query.data?.sellable===true)return <ButtonLink to={`${bookingStepPaths[0]}?${new URLSearchParams({cruiseId,from:catalogReturn(back)})}`}>{businessCopy('booking.action.chooseCabin')}</ButtonLink>
  const state=query.data?.saleState
  const message=state==='STOPPED'?'Hệ thống báo lần khởi hành đang tạm dừng bán.'
    :state==='SOLD_OUT'?'Hệ thống báo không còn sức chứa; tình trạng cabin cần được đối chiếu.'
    :state==='NOT_YET_OPEN'||state==='DRAFT'?'Lần khởi hành chưa mở nhận đặt chỗ.'
    :state==='CANCELLED'?'Lần khởi hành đã được hủy.'
    :state==='DEPARTED'?'Lần khởi hành đã qua thời điểm nhận đặt chỗ.'
    :'Chưa xác nhận được đầy đủ điều kiện nhận đặt chỗ cho lần khởi hành này.'
  return <div role="status"><p>{message}</p><p>Vui lòng liên hệ bộ phận hỗ trợ. Các đặt chỗ đã có vẫn được tra cứu riêng.</p></div>
}
