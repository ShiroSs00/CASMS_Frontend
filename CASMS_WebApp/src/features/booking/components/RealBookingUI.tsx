import type { ReactNode } from 'react'
import { AdminFrame, Button, Loading, Notice } from '@/shared/ui'
import type { useReadQuery } from '@/shared/api'
import { ApiError } from '@/shared/api'
import { bookingReadFailure } from '../model/booking-feedback'
import styles from './Booking.module.css'
import journey from './LiveBooking.module.css'
export function RealBookingFrame({ children, admin = false }: { children: ReactNode; admin?: boolean }) { return admin ? <AdminFrame>{children}</AdminFrame> : <div className={`${styles.surface} ${journey.publicJourney}`}><div className={styles.container}>{children}</div></div> }
export function BookingReadState({ loading, error, retry, publicResource }: Pick<ReturnType<typeof useReadQuery>, 'loading' | 'error' | 'retry'> & { publicResource?: string }) {
  return loading ? <Loading label={publicResource ? `Đang tải ${publicResource}…` : 'Đang tải đặt chỗ…'} /> : error ? <Notice title={publicResource ? `Chưa tải được ${publicResource}` : 'Không tải được dữ liệu'} tone="error">
    {publicResource ? <div className={journey.recoveryBody}><p>{bookingReadFailure(error instanceof ApiError ? error.status : undefined)}</p><Button tone="secondary" onClick={retry}>Tải lại {publicResource}</Button></div> : <>{error.message}<Button tone="secondary" onClick={retry}>Thử lại</Button></>}
  </Notice> : null
}
