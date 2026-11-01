import { Link } from 'react-router'
import { Notice } from '@/shared/ui'
import { usePlanning } from '../hooks'
export function TripReviewPage(){
  const {root}=usePlanning()
  return <Notice title="Quy trình duyệt mẫu lịch trình đã dừng"><p>Quản lý lịch trình kiểm tra và chốt mẫu lịch trình. Quản lý vận hành xét duyệt kế hoạch chuyến khởi hành tại mục riêng. Nội dung và lịch sử mẫu theo quy trình cũ được giữ nguyên để tra cứu.</p><Link to={root}>Danh sách chuyến đi</Link></Notice>
}
