import type { ReactNode } from 'react'
import { AdminFrame, Button, Loading, Notice } from '@/shared/ui'
import type { useReadQuery } from '@/shared/api'
import styles from './Booking.module.css'
export function RealBookingFrame({ children, admin = false }: { children: ReactNode; admin?: boolean }) { return admin ? <AdminFrame>{children}</AdminFrame> : <div className={styles.surface}><div className={styles.container}>{children}</div></div> }
export function BookingReadState({ loading, error, retry }: Pick<ReturnType<typeof useReadQuery>, 'loading' | 'error' | 'retry'>) { return loading ? <Loading label="Đang tải đặt chỗ…" /> : error ? <Notice title="Không tải được dữ liệu" tone="error">{error.message}<Button tone="secondary" onClick={retry}>Thử lại</Button></Notice> : null }
