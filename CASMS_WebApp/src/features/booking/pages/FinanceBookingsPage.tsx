import { useCallback, useState } from 'react'
import { useReadQuery } from '@/shared/api'
import { useSessionAccess } from '@/shared/auth'
import { Button, DataTable, Empty, Notice, PageHeader, Panel } from '@/shared/ui'
import { realBookingApi } from '../api/real-booking-api'
import { BookingReadState, RealBookingFrame } from '../components/RealBookingUI'
import { BookingInstallments } from '../components/BookingInstallments'
import { bookingMoney } from '../model/booking-presentation'
import { bookingStatusName } from '../model/real-booking-view'

export function FinanceBookingsPage() {
  const [page,setPage]=useState(0),[selected,setSelected]=useState('')
  const access=useSessionAccess(),allowed=access.status==='ready'&&access.has('BOOKING_READ')
  const list=useReadQuery(`finance-bookings:${access.userId}:${allowed}:${page}`,useCallback(signal=>allowed?realBookingApi.list(page,undefined,undefined,signal):Promise.resolve(null),[allowed,page]))
  const detail=useReadQuery(`finance-schedule:${access.userId}:${allowed}:${selected}`,useCallback(signal=>allowed&&selected?realBookingApi.get(selected,signal):Promise.resolve(null),[allowed,selected]))
  return <RealBookingFrame admin><PageHeader title="Tài chính & lịch thanh toán" breadcrumb="TÀI CHÍNH" description="Tra cứu giá vé và các đợt thanh toán theo hợp đồng." />
    {!allowed&&<Notice title="Chưa thể mở dữ liệu tài chính">{access.status==='loading'?'Đang kiểm tra quyền truy cập…':'Tài khoản cần quyền xem đặt chỗ.'}</Notice>}
    {allowed&&<><Panel title="Đặt chỗ"><BookingReadState {...list}/>{list.data&&<>
      {!list.data.content.length?<Empty title="Chưa có đặt chỗ"/>:<DataTable label="Đặt chỗ và giá vé" headers={['Mã đặt chỗ','Chuyến đi','Trạng thái','Tổng giá vé','']}>
        {list.data.content.map(item=><tr key={item.bookingId}><td>{item.bookingReference}</td><td>{item.cruiseName}</td><td>{bookingStatusName[item.bookingStatus]}</td><td>{item.agreedFareAmount!=null&&item.currency?bookingMoney(item.agreedFareAmount,item.currency):'Chưa có'}</td><td><Button tone="secondary" onClick={()=>setSelected(item.bookingId)}>Xem lịch thanh toán</Button></td></tr>)}
      </DataTable>}
      <Button tone="secondary" disabled={page===0} onClick={()=>setPage(value=>value-1)}>Trang trước</Button><span> Trang {page+1} </span><Button tone="secondary" disabled={page+1>=list.data.totalPages} onClick={()=>setPage(value=>value+1)}>Trang sau</Button>
    </>}</Panel>{selected&&<Panel title="Lịch thanh toán"><BookingReadState {...detail}/>{detail.data&&<><h2>{detail.data.bookingReference}</h2><p>Hợp đồng: {detail.data.contractReference??'Chưa có'}</p><BookingInstallments booking={detail.data}/><p>Đối chiếu chứng từ thanh toán trước khi xác nhận đã thu tiền.</p></>}</Panel>}</>}
  </RealBookingFrame>
}
