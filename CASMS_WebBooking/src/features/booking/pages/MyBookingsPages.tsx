import { useCallback, useState } from 'react'
import { Link, useParams } from 'react-router'
import { ApiError, useReadQuery } from '@/shared/api'
import { useSessionAccess } from '@/shared/auth'
import { Badge, Button, ButtonLink, Empty, Field, Notice, PageHeader, Panel } from '@/shared/ui'
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
          breadcrumb="TÀI KHOẢN / CHUYẾN ĐI CỦA TÔI"
          title="Chuyến đi của tôi"
        />

        {access.status === 'loading' && <p role="status">Đang kiểm tra phiên đăng nhập…</p>}

        {access.status !== 'loading' && !ready && (
          <Notice title="Vui lòng đăng nhập để xem chuyến đi của bạn" tone="info">
            <p>Đăng nhập bằng tài khoản hành khách để theo dõi lịch khởi hành, thanh toán và làm thủ tục check-in trực tuyến.</p>
            <div className={styles.actions}>
              <ButtonLink to="/login?next=%2Fmy-bookings" autoWidth>
                Đăng nhập tài khoản hành khách
              </ButtonLink>
              <ButtonLink tone="secondary" to="/booking/lookup" autoWidth>
                Tra cứu bằng mã đặt chỗ
              </ButtonLink>
            </div>
          </Notice>
        )}

        {ready && (
          <Panel>
            <div className={styles.fields} role="group" aria-label="Bộ lọc chuyến đi của tôi" style={{ marginBottom: '20px', alignItems: 'end' }}>
              <Field htmlFor="my-bookings-search" label="Tìm chuyến đi">
                <input
                  id="my-bookings-search"
                  type="search"
                  placeholder="Mã đặt chỗ hoặc tên hải trình…"
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
                <div>
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
                    Xóa lọc
                  </Button>
                </div>
              )}
            </div>
            <BookingReadState {...listQuery} />
            {listQuery.data && !listQuery.loading && !listQuery.error && (
              visibleRows.length === 0 ? (
                <Empty title={hasActiveFilter ? 'Không có chuyến đi khớp bộ lọc' : 'Bạn chưa có chuyến đi nào'}>
                  <p>
                    {hasActiveFilter
                      ? 'Thử thay đổi trạng thái hoặc từ khóa tìm kiếm.'
                      : 'Khám phá các hải trình đang mở đặt chỗ để lên kế hoạch cho kỳ nghỉ tiếp theo.'}
                  </p>
                  {!hasActiveFilter && (
                    <ButtonLink to="/cruises" autoWidth>
                      Khám phá hải trình
                    </ButtonLink>
                  )}
                </Empty>
              ) : (
                <div style={{ display: 'grid', gap: '16px' }}>
                  {visibleRows.map(item => {
                    const isConfirmed = item.bookingStatus === 'Confirmed'
                    const isCancelled = item.bookingStatus === 'Cancelled'
                    const ctaLabel = isCancelled
                      ? 'Xem chi tiết'
                      : isConfirmed
                        ? 'Quản lý chuyến đi'
                        : 'Tiếp tục thanh toán'
                    return (
                      <article
                        key={item.bookingId}
                        style={{
                          display: 'grid',
                          gap: '14px',
                          padding: '20px 24px',
                          background: 'var(--surface-default, #fff)',
                          border: '1px solid var(--border-default, #d5e0e4)',
                          borderLeft: `4px solid ${isConfirmed ? 'var(--status-success, #167347)' : isCancelled ? 'var(--border-default, #d5e0e4)' : 'var(--brand-gold, #d4af37)'}`,
                          borderRadius: '12px',
                        }}
                      >
                        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
                          <div style={{ display: 'grid', gap: '4px' }}>
                            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--brand-teal, #0e6b7a)', letterSpacing: '0.04em' }}>
                              MÃ ĐẶT CHỖ · {item.bookingReference}
                            </span>
                            <h2 style={{ margin: 0, fontSize: '19px', fontFamily: 'var(--font-heading)', color: 'var(--brand-navy, #0b2a4a)' }}>
                              {item.cruiseName}
                            </h2>
                          </div>
                          <Badge
                            label={bookingStatusName[item.bookingStatus] ?? item.bookingStatus}
                            tone={isConfirmed ? 'success' : isCancelled ? 'neutral' : 'warning'}
                          />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px 20px', paddingBlock: '12px', borderBlock: '1px solid var(--border-default, #d5e0e4)' }}>
                          <div>
                            <div style={{ fontSize: '12px', color: 'var(--text-secondary, #506777)' }}>Khởi hành</div>
                            <strong style={{ fontSize: '14px', color: 'var(--brand-navy, #0b2a4a)', fontVariantNumeric: 'tabular-nums' }}>
                              {item.departureDatetime ? bookingWhen(item.departureDatetime) : 'Đang cập nhật'}
                            </strong>
                          </div>
                          <div>
                            <div style={{ fontSize: '12px', color: 'var(--text-secondary, #506777)' }}>Tổng giá trị đặt chỗ</div>
                            <strong style={{ fontSize: '15px', color: 'var(--brand-navy, #0b2a4a)', fontVariantNumeric: 'tabular-nums' }}>
                              {item.agreedFareAmount != null && item.currency
                                ? bookingMoney(item.agreedFareAmount, item.currency)
                                : '—'}
                            </strong>
                          </div>
                          <div>
                            <div style={{ fontSize: '12px', color: 'var(--text-secondary, #506777)' }}>Ngày đặt</div>
                            <strong style={{ fontSize: '14px', color: 'var(--brand-navy, #0b2a4a)', fontVariantNumeric: 'tabular-nums' }}>
                              {bookingWhen(item.createdAt)}
                            </strong>
                          </div>
                        </div>

                        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'flex-end', gap: '10px' }}>
                          <ButtonLink
                            tone={isCancelled ? 'secondary' : 'primary'}
                            size="compact"
                            autoWidth
                            to={`/my-bookings/${item.bookingId}`}
                          >
                            {ctaLabel} →
                          </ButtonLink>
                        </div>
                      </article>
                    )
                  })}
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
  const [renderNow] = useState(() => Date.now())
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
          <Link to="/my-bookings">← Chuyến đi của tôi</Link>
          <Button tone="secondary" size="compact" autoWidth disabled={detailQuery.loading} onClick={detailQuery.retry}>
            Làm mới
          </Button>
        </div>

        <PageHeader
          breadcrumb="CHUYẾN ĐI CỦA TÔI / CHI TIẾT"
          title={detailQuery.data?.cruiseName ?? detailQuery.data?.bookingReference ?? 'Chi tiết chuyến đi'}
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
            {(() => {
              const b = detailQuery.data
              const isPaid = b.outstandingBalance != null && b.outstandingBalance <= 0
              const contractDone = b.contractStatus === 'Accepted'
              const departed = Boolean(b.departureDatetime && Date.parse(b.departureDatetime) <= renderNow)
              return (
                <div
                  role="region"
                  aria-label="Tiến độ chuẩn bị chuyến đi"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: '12px',
                    padding: '16px 20px',
                    background: 'var(--surface-default, #fff)',
                    border: '1px solid var(--border-default, #d5e0e4)',
                    borderTop: '3px solid var(--brand-gold, #d4af37)',
                    borderRadius: '12px',
                  }}
                >
                  <div style={{ display: 'grid', gap: '4px' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary, #506777)' }}>1. Hợp đồng & xác nhận</span>
                    <Badge label={contractDone ? 'Đã chấp nhận hợp đồng' : 'Chờ chấp nhận hợp đồng'} tone={contractDone ? 'success' : 'warning'} />
                  </div>
                  <div style={{ display: 'grid', gap: '4px' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary, #506777)' }}>2. Thanh toán</span>
                    <Badge
                      label={isPaid ? 'Đã thanh toán đủ' : b.outstandingBalance != null && b.currency ? `Còn ${bookingMoney(b.outstandingBalance, b.currency)}` : 'Chờ thanh toán'}
                      tone={isPaid ? 'success' : 'warning'}
                    />
                  </div>
                  <div style={{ display: 'grid', gap: '4px' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary, #506777)' }}>3. Check-in lên tàu</span>
                    <Badge
                      label={departed ? 'Chuyến đã khởi hành' : b.bookingStatus === 'Confirmed' ? 'Mở trước giờ xuất bến 3 giờ' : 'Mở sau khi xác nhận'}
                      tone={departed ? 'neutral' : b.bookingStatus === 'Confirmed' ? 'info' : 'neutral'}
                    />
                  </div>
                </div>
              )
            })()}
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
