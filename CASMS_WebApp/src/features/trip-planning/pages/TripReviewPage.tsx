import { Link } from 'react-router'
import { Notice } from '@/shared/ui'
import { usePlanning } from '../hooks'
export function TripReviewPage(){
  const {root}=usePlanning()
  return <Notice title="Mẫu chờ xử lý theo quy trình cũ"><p>CRM chốt lịch trình mẫu. Kế hoạch khởi hành được xét duyệt riêng trong từng lần khởi hành.</p><Link to={root}>Danh sách khung chuyến</Link></Notice>
}
