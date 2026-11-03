import { Link } from 'react-router'
import { Button, Modal } from '@/shared/ui'
import { usePlanning } from '../hooks'
import type { useTripOperation } from '../useTripOperation'

/** No permanent recovery banner: open only when starting another operation. */
export function OperationRecovery({operation,onClose}:{operation:ReturnType<typeof useTripOperation>;onClose:()=>void}){
  const {root}=usePlanning(),{record}=operation
  return <Modal title={record?.tripId?'Chuyến đã được tạo':'Kiểm tra chuyến trước khi tạo thêm'} onClose={onClose} footer={<><Button tone="secondary" onClick={onClose}>Quay lại</Button><Button onClick={()=>{operation.clear();onClose()}}>Tôi đã kiểm tra, tạo chuyến khác</Button></>}>
    <p>{record?.tripId?'Chuyến trước đã được máy chủ xác nhận. Bạn có thể tiếp tục lập lịch trình.':'Lần gửi trước chưa nhận được phản hồi. Hãy kiểm tra danh sách chuyến để tránh tạo trùng trước khi bắt đầu chuyến khác.'}</p>
    <Link onClick={onClose} to={record?.tripId?`${root}/${record.tripId}/schedule`:root}>{record?.tripId?'Tiếp tục lập lịch trình':'Xem danh sách chuyến'}</Link>
  </Modal>
}
