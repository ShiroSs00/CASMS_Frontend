import { useCallback, useState } from 'react'
import { useReadQuery } from '@/shared/api'
import { Button } from '@/shared/ui'
import { customerExtrasApi } from '../api/customer-extras-api'
import { bookingMoney } from '../model/booking-presentation'
import { BookingReadState } from './RealBookingUI'
import styles from './LiveBooking.module.css'

function PackageRead({ id }: { id: string }) {
  const query = useReadQuery('customer-package:' + id, useCallback(signal => customerExtrasApi.package(id, signal), [id]))
  const item = query.data
  return <div className={styles.stack} aria-live="polite"><BookingReadState {...query} publicResource="chi tiết gói" />{item && <div>
    <h3>{item.name}</h3><p>{item.description || 'Chưa có mô tả gói.'}</p>
    <p>{bookingMoney(item.price, item.currency)} · {({ BASIC: 'Cơ bản', PREMIUM: 'Cao cấp', ADVANCED: 'Nâng cao' } as Record<string, string>)[item.type]}</p>
    {(item.startDate || item.endDate) && <p>Khoảng ngày áp dụng: {item.startDate || 'Chưa cung cấp'} → {item.endDate || 'Chưa cung cấp'}. Điều kiện áp dụng được kiểm tra khi gửi đặt chỗ.</p>}
    {item.status !== 'ACTIVE' && <p role="alert">Gói hiện không hoạt động. Bỏ chọn hoặc chọn gói khác trước khi gửi.</p>}
    <p className={styles.helper}>Giá gói chưa phải tổng giá đặt chỗ. Chi tiết quyền lợi chưa được cung cấp trực tuyến cho khách; chọn gói không tự giữ chỗ hoạt động hay dịch vụ.</p>
  </div>}</div>
}
export function CustomerPackageDetails({ id, passenger }: { id: string; passenger: number }) {
  const [opened, setOpened] = useState(false)
  const region = `package-details-${passenger}`
  return <div><Button tone="secondary" aria-expanded={opened} aria-controls={region} onClick={() => setOpened(value => !value)}>{opened ? 'Ẩn' : 'Xem'} chi tiết gói cho khách {passenger}</Button><div id={region}>{opened && <PackageRead id={id} />}</div></div>
}
