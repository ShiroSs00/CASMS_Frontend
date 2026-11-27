import { useCallback, useState } from 'react'
import { Link, useParams } from 'react-router'
import { ApiError, useReadQuery } from '@/shared/api'
import { useSessionAccess } from '@/shared/auth'
import { Badge, Button, ButtonLink, DataTable, Empty, Field, Notice, PageHeader, Panel } from '@/shared/ui'
import { realBookingApi } from '../api/real-booking-api'
import { BookingPaymentActionCard } from '../components/BookingPaymentActionCard'
import { CustomerCancellation } from '../components/CustomerCancellation'
import { OnlineCheckinPanel } from '../components/OnlineCheckinPanel'
import { PublicBookingRecord } from '../components/PublicBookingRecord'
import { BookingReadState, RealBookingFrame } from '../components/RealBookingUI'
import { bookingMoney } from '../model/booking-presentation'
import { bookingStatusName, bookingWhen } from '../model/real-booking-view'
import styles from '../components/LiveBooking.module.css'

export function MyBookingsPage() {
  const access = useSessionAccess()
  const [page, setPage] = useState(0)
  const [statusFilter, setStatusFilter] = useState('')
  const [sortBy, setSortBy] = useState('createdAt,desc')
  const [searchQuery, setSearchQuery] = useState('')
  const ready = access.status === 'ready' && access.roles.includes('PASSENGER') && Boolean(access.userId)

  const listQuery = useReadQuery(
    `my-bookings:${access.userId ?? ''}:${page}:${statusFilter}:${sortBy}:${ready}`,
    useCallback(
      signal => (ready ? realBookingApi.listMine(page, signal, { status: statusFilter || undefined, sort: sortBy }) : Promise.resolve(null)),
      [ready, page, statusFilter, sortBy],
    ),
  )

  const normalizedSearch = searchQuery.trim().toLocaleLowerCase('vi-VN')
  const visibleRows = (listQuery.data?.content ?? []).filter(item =>
    !normalizedSearch
    || item.bookingReference.toLocaleLowerCase('vi-VN').includes(normalizedSearch)
    || item.cruiseName.toLocaleLowerCase('vi-VN').includes(normalizedSearch),
  )
  const hasActiveFilter = Boolean(statusFilter || sortBy !== 'createdAt,desc' || normalizedSearch)

  return (
    <RealBookingFrame>
      <div className={styles.stack}>
        <div className={styles.journeyTopline}>
          <Link to="/cruises">← Khám phá hành trình</Link>
          <Link to="/booking/lookup">Tra cứu bằng mã đặt chỗ</Link>
        </div>
        <PageHeader
          breadcrumb="TÀI KHOẢN / ĐẶT CHỖ CỦA TÔI"
          title="Đặt chỗ của tôi"
        />

        {access.status === 'loading' && <p role="status">Đang kiểm tra phiên đăng nhập…</p>}

        {access.status !== 'loading' && !ready && (
          <Notice title="Vui lòng đăng nhập để xem đặt chỗ của bạn" tone="info">
            <p>Đăng nhập bằng tài khoản hành khách để quản lý đặt chỗ và thanh toán VietQR.</p>
            <div className={styles.actions}>
              <ButtonLink to="/login?next=%2Fmy-bookings" autoWidth>
                Đăng nhập tài khoản hành khách
              </ButtonLink>
              <ButtonLink tone="secondary" to="/booking/lookup" autoWidth>
                Tra cứu công khai bằng mã
              </ButtonLink>
            </div>
          </Notice>
        )}

        {ready && (
          <Panel title="Danh sách đặt chỗ">
            <div className={styles.fields} role="group" aria-label="Bộ lọc đặt chỗ của tôi" style={{ marginBottom: '16px' }}>
              <Field htmlFor="my-bookings-search" label="Tìm nhanh trên trang">
                <input
                  id="my-bookings-search"
                  type="search"
                  placeholder="Mã đặt chỗ hoặc tên chuyến…"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
              </Field>
              <Field htmlFor="my-bookings-status" label="Trạng thái">
                <select
                  id="my-bookings-status"
                  value={statusFilter}
                  onChange={e => { setStatusFilter(e.target.value); setPage(0) }}
                >
                  <option value="">Tất cả trạng thái</option>
                  {Object.entries(bookingStatusName).map(([code, label]) => (
                    <option key={code} value={code}>{label}</option>
                  ))}
                </select>
              </Field>
              <Field htmlFor="my-bookings-sort" label="Sắp xếp">
                <select
                  id="my-bookings-sort"
                  value={sortBy}
                  onChange={e => { setSortBy(e.target.value); setPage(0) }}
                >
                  <option value="createdAt,desc">Mới đặt gần nhất</option>
                  <option value="createdAt,asc">Đặt cũ nhất trước</option>
                  <option value="departureDatetime,asc">Khởi hành sớm nhất</option>
                </select>
              </Field>
              {hasActiveFilter && (
                <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                  <Button
                    tone="secondary"
                    size="compact"
                    autoWidth
                    onClick={() => {
                      setStatusFilter('')
                      setSortBy('createdAt,desc')
                      setSearchQuery('')
                      setPage(0)
                    }}
                  >
                    Xóa bộ lọc
                  </Button>
                </div>
              )}
            </div>
            <BookingReadState {...listQuery} />
            {listQuery.data && !listQuery.loading && !listQuery.error && (
              visibleRows.length === 0 ? (
                <Empty title={hasActiveFilter ? 'Không có đặt chỗ khớp bộ lọc' : 'Bạn chưa có đặt chỗ nào'}>
                  <p>
                    {hasActiveFilter
                      ? 'Thử thay đổi trạng thái hoặc từ khóa tìm kiếm.'
                      : 'Khám phá các hành trình đang mở bán để tạo đặt chỗ đầu tiên.'}
                  </p>
                  {!hasActiveFilter && (
                    <ButtonLink to="/cruises" autoWidth>
                      Khám phá chuyến du thuyền
                    </ButtonLink>
                  )}
                </Empty>
              ) : (
                <div className={styles.bookingsTableWrap}>
                  <DataTable
                    label="Đặt chỗ của bạn"
                    headers={['Mã đặt chỗ', 'Chuyến khởi hành', 'Trạng thái', 'Tổng giá vé', 'Ngày tạo', '']}
                  >
                    {visibleRows.map(item => (
                      <tr key={item.bookingId}>
                        <td className={styles.monoCode} style={{ whiteSpace: 'nowrap' }}>{item.bookingReference}</td>
                        <td>
                          <strong>{item.cruiseName}</strong>
                          {item.departureDatetime && <small>Khởi hành: {bookingWhen(item.departureDatetime)}</small>}
                        </td>
                        <td className={styles.statusCell}>
                          <Badge
                            label={bookingStatusName[item.bookingStatus] ?? item.bookingStatus}
                            tone={
                              item.bookingStatus === 'Confirmed'
                                ? 'success'
                                : item.bookingStatus === 'Cancelled'
                                  ? 'neutral'
                                  : 'warning'
                            }
                          />
                        </td>
                        <td className={styles.numericCell}>
                          {item.agreedFareAmount != null && item.currency
                            ? bookingMoney(item.agreedFareAmount, item.currency)
                            : '—'}
                        </td>
                        <td style={{ whiteSpace: 'nowrap' }}>{bookingWhen(item.createdAt)}</td>
                        <td className={styles.actionCell}>
                          <ButtonLink tone="secondary" size="compact" autoWidth className={styles.tableActionBtn} to={`/my-bookings/${item.bookingId}`}>
                            {item.bookingStatus === 'Cancelled' ? 'Xem chi tiết' : 'Chi tiết & thanh toán'}
                          </ButtonLink>
                        </td>
                      </tr>
                    ))}
                  </DataTable>
                  {listQuery.data.totalPages > 1 && (
                    <div className={styles.financePagination}>
                      <Button
                        tone="secondary"
                        size="compact"
                        autoWidth
                        disabled={page === 0}
                        onClick={() => setPage(v => Math.max(0, v - 1))}
                      >
                        Trang trước
                      </Button>
                      <span>
                        Trang {page + 1} / {listQuery.data.totalPages}
                      </span>
                      <Button
                        tone="secondary"
                        size="compact"
                        autoWidth
                        disabled={page + 1 >= listQuery.data.totalPages}
                        onClick={() => setPage(v => v + 1)}
                      >
                        Trang sau →
                      </Button>
                    </div>
                  )}
                </div>
              )
            )}
          </Panel>
        )}
      </div>
    </RealBookingFrame>
  )
}

export function MyBookingDetailPage() {
  const { bookingId = '' } = useParams()
  const access = useSessionAccess()
  const ready = access.status === 'ready' && access.roles.includes('PASSENGER') && Boolean(access.userId) && Boolean(bookingId)

  const detailQuery = useReadQuery(
    `my-booking-detail:${access.userId ?? ''}:${bookingId}:${ready}`,
    useCallback(signal => (ready ? realBookingApi.getMine(bookingId, signal) : Promise.resolve(null)), [ready, bookingId]),
  )

  const isForbidden = detailQuery.error instanceof ApiError && detailQuery.error.status === 403

  return (
    <RealBookingFrame>
      <div className={styles.stack}>
        <div className={styles.journeyTopline}>
          <Link to="/my-bookings">← Danh sách đặt chỗ của tôi</Link>
          <Button tone="secondary" size="compact" autoWidth disabled={detailQuery.loading} onClick={detailQuery.retry}>
            Tải lại đặt chỗ
          </Button>
        </div>

        <PageHeader
          breadcrumb="ĐẶT CHỖ CỦA TÔI / CHI TIẾT"
          title={detailQuery.data?.bookingReference ?? 'Chi tiết đặt chỗ'}
        />

        {access.status === 'loading' && <p role="status">Đang kiểm tra phiên đăng nhập…</p>}

        {access.status !== 'loading' && !ready && (
          <Notice title="Vui lòng đăng nhập để xem chi tiết và thanh toán đặt chỗ này" tone="info">
            <div className={styles.actions}>
              <ButtonLink to={`/login?next=${encodeURIComponent(`/my-bookings/${bookingId}`)}`} autoWidth>
                Đăng nhập tài khoản hành khách
              </ButtonLink>
            </div>
          </Notice>
        )}

        {ready && isForbidden && (
          <Notice title="Không thể truy cập đặt chỗ này" tone="error">
            Đặt chỗ này thuộc tài khoản hành khách khác. Vui lòng đăng nhập đúng tài khoản đã thực hiện đặt chỗ.
          </Notice>
        )}

        {ready && !isForbidden && <BookingReadState {...detailQuery} />}

        {ready && detailQuery.data && (
          <>
            <PublicBookingRecord
              booking={detailQuery.data}
              showPassengerDetails
              paymentAction={
                <BookingPaymentActionCard booking={detailQuery.data} onBookingReload={detailQuery.retry} />
              }
            />
            <OnlineCheckinPanel booking={detailQuery.data} />
            <CustomerCancellation
              key={detailQuery.data.bookingId}
              bookingId={detailQuery.data.bookingId}
              bookingStatus={detailQuery.data.bookingStatus}
              departureDatetime={detailQuery.data.departureDatetime}
            />
          </>
        )}
      </div>
    </RealBookingFrame>
  )
}
