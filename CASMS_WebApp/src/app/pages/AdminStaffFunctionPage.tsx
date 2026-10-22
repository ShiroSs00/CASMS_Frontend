import { useParams } from 'react-router'
import { Notice, PageHeader } from '@/shared/ui'
import { AdminShell } from '@/shared/ui/admin-v3'
import { FinanceBookingsPage } from '@/features/booking'

export function AdminStaffFunctionPage() {
  const {area}=useParams()
  if(area==='finance') return <FinanceBookingsPage />
  const label=area==='checkin'?'Làm thủ tục':'Tài chính'
  return <AdminShell><PageHeader breadcrumb="ĐÓN KHÁCH" title={label} description="Kiểm tra giấy tờ và hướng dẫn hành khách tại cảng." /><Notice title="Làm thủ tục tại quầy">Liên hệ bộ phận điều phối để kiểm tra danh sách hành khách và hoàn tất thủ tục trước khi lên tàu.</Notice></AdminShell>
}
