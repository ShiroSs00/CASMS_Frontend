import { businessCopy } from '@/shared/i18n/business-copy'
import { useCallback, useState } from 'react'
import { Link } from 'react-router'
import { useReadQuery } from '@/shared/api'
import { Button, ButtonLink, DataTable, Empty, Field, Loading, Notice, Panel } from '@/shared/ui'
import { usePlanning } from '../hooks'
import type { TripFilters } from '../api/gateway'
import { type Trip } from '../model/plan'
import styles from '../Planning.module.css'
import { versionContext, workingVersionLabel } from '../model/version-context'

export function TripListPage() {
  const { gateway, root, can } = usePlanning()
  const [page, setPage] = useState(0)
  const [statusFilter, setStatusFilter] = useState('')
  const [filters, setFilters] = useState<TripFilters>({ search: '', durationGroup: '', plannedScope: '' })
  const [searchText, setSearchText] = useState('')

  const list = useReadQuery(
    `trips:${gateway.mode}:${page}:${statusFilter}:${JSON.stringify(filters)}`,
    useCallback(signal => gateway.list(page, statusFilter, signal, filters), [gateway, page, statusFilter, filters])
  )
  const filtered = Boolean(filters.search || filters.plannedScope || filters.durationGroup || statusFilter)

  function resetFilters() {
    setFilters({ search: '', durationGroup: '', plannedScope: '' })
    setStatusFilter('')
    setSearchText('')
    setPage(0)
  }


  return (
    <>
      <header className={styles.heading}>
        <div>
          <h1>Khung chuyến và lịch trình</h1>
          <p className={styles.muted}>Xây dựng tuyến hành trình và chốt lịch trình mẫu. Mỗi chuyến khởi hành sử dụng một mẫu đã chốt; bản chỉnh sửa được quản lý riêng.</p>
        </div>
        {can('TRIP_CREATE') && !gateway.readOnly && (
          <ButtonLink to={`${root}/new`}>Tạo khung chuyến</ButtonLink>
        )}
      </header>


      <Panel className={styles.listPanel}>
        <form
          className={`${styles.filters} ${styles.tripFilters}`}
          onSubmit={e => {
            e.preventDefault()
            setFilters(current => ({ ...current, search: searchText.trim() }))
            setPage(0)
          }}
        >
          <Field htmlFor="trip-search" label="Tìm khung chuyến">
            <input
              id="trip-search"
              type="search"
              placeholder="Mã hoặc tên khung chuyến"
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
            />
          </Field>
          <Field htmlFor="trip-scope-filter" label="Loại hành trình">
            <select
              id="trip-scope-filter"
              value={filters.plannedScope}
              onChange={e => {
                setFilters(current => ({ ...current, plannedScope: e.target.value as TripFilters['plannedScope'] }))
                setPage(0)
              }}
            >
              <option value="">Tất cả loại hành trình</option>
              <option value="DOMESTIC">Trong nước</option>
              <option value="INTERNATIONAL">{businessCopy('source.scope.INTERNATIONAL')}</option>
            </select>
          </Field>
          <Field htmlFor="trip-duration-filter" label="Thời lượng">
            <select id="trip-duration-filter" value={filters.durationGroup} onChange={event => {
              setFilters(current => ({ ...current, durationGroup: event.target.value as TripFilters['durationGroup'] }))
              setPage(0)
            }}>
              <option value="">Tất cả thời lượng</option>
              <option value="SHORT">Ngắn ngày</option>
              <option value="LONG">Dài ngày</option>
            </select>
          </Field>
          <Field htmlFor="trip-status-filter" label="Trạng thái">
            <select
              id="trip-status-filter"
              value={statusFilter}
              onChange={e => {
                setStatusFilter(e.target.value)
                setPage(0)
              }}
            >
              <option value="">Tất cả</option>
              <option value="DRAFT">Bản nháp</option>
              <option value="READY">Đã chốt</option>
              <option value="ARCHIVED">Ngừng sử dụng</option>
            </select>
          </Field>
          <Button type="submit" tone="secondary" autoWidth>
            Tìm kiếm
          </Button>
        </form>

        <div className={styles.resultsHead}>
          <h2>
            Khung chuyến
            {!list.loading && !list.error && list.data && <span className={styles.resultCount}>{list.data.totalElements}</span>}
          </h2>
          {filtered && (
            <Button tone="text" size="compact" onClick={resetFilters}>
              Xóa bộ lọc
            </Button>
          )}
        </div>

        {list.loading ? (
          <Loading label="Đang tải chuyến đi…" />
        ) : list.error ? (
          <Notice title="Chưa tải được danh sách" tone="error">
            {list.error.message}
            <Button onClick={list.retry}>Thử lại</Button>
          </Notice>
        ) : !list.data?.content.length ? (
          <Empty title={filtered ? 'Không tìm thấy chuyến phù hợp' : 'Chưa có chuyến đi'}>
            <p>
              {filtered
                ? 'Thử đổi từ khóa hoặc xóa bộ lọc.'
                : 'Bắt đầu bằng thông tin chuyến; lịch trình sẽ được tổ chức ngay trong chuyến đó.'}
            </p>
            {filtered ? (
              <Button tone="secondary" onClick={resetFilters}>
                Xóa bộ lọc
              </Button>
            ) : (
              can('TRIP_CREATE') &&
              !gateway.readOnly && (
                <Link className={styles.primaryLink} to={`${root}/new`}>
                  Tạo khung chuyến
                </Link>
              )
            )}
          </Empty>
        ) : (
          <DataTable
            label="Khung chuyến"
            headers={['Khung chuyến', 'Hành trình', 'Mẫu đã chốt', 'Bản đang thiết kế']}
          >
            {[...list.data.content].sort((a, b) => b.tripCode.localeCompare(a.tripCode, 'vi', { numeric: true })).map(trip => (
              <TripListRow
                key={trip.tripId}
                trip={trip}

              />
            ))}
          </DataTable>
        )}

        {list.data && list.data.totalPages > 1 && (
          <div className={styles.pagination}>
            <span>
              {list.data.totalElements} chuyến · Trang {page + 1}/{Math.max(1, list.data.totalPages)}
            </span>
            <div className={styles.actions}>
              <Button
                tone="secondary"
                size="compact"
                disabled={page === 0 || list.loading}
                onClick={() => setPage(n => n - 1)}
              >
                Trang trước
              </Button>
              <Button
                tone="secondary"
                size="compact"
                disabled={list.loading || page + 1 >= list.data.totalPages}
                onClick={() => setPage(n => n + 1)}
              >
                Trang sau
              </Button>
            </div>
          </div>
        )}
      </Panel>


    </>
  )
}

function TripListRow({ trip }: { trip: Trip }) {
  const { gateway, root, can } = usePlanning()

  const needsContext =
    Boolean(trip.structuralLockedAt || trip.status === 'READY') &&
    trip.latestVersionStatus !== 'PUBLISHED' &&
    !trip.versions

  const detail = useReadQuery(
    `trip-list-context:${gateway.mode}:${trip.tripId}:${trip.revision}`,
    useCallback(
      signal => (needsContext ? gateway.getTrip(trip.tripId, signal) : Promise.resolve(null)),
      [gateway, needsContext, trip.tripId]
    )
  )

  const versions = versionContext(detail.data?.versions ?? trip.versions)
  const published =
    versions.published?.versionNumber ??
    (trip.latestVersionStatus === 'PUBLISHED' ? trip.latestVersionNumber : undefined)
  const working =
    versions.working?.versionNumber ??
    (['DRAFT', 'IN_REVIEW'].includes(trip.latestVersionStatus ?? '') ? trip.latestVersionNumber : undefined)
  const isArchived = trip.status === 'ARCHIVED'
  const workingStatus = versions.working?.status ?? trip.latestVersionStatus
  const canContinueDraft = !isArchived && !gateway.readOnly && can('TRIP_PLAN_WRITE')
    && workingStatus === 'DRAFT'

  return (
    <tr>
      <th scope="row">
        <Link className={styles.tripName} to={`${root}/${trip.tripId}/schedule`}>
          {trip.name}
        </Link>
        <span className={styles.cellMeta}>
          {trip.tripCode}
          {trip.updatedAt
            ? ` · Cập nhật ${new Date(trip.updatedAt).toLocaleDateString('vi-VN', {
                timeZone: 'Asia/Ho_Chi_Minh',
              })}`
            : ''}
        </span>
      </th>
      <td>
        {trip.durationDays} ngày
        <span className={styles.cellMeta}>
          {trip.info.scope === 'DOMESTIC'
            ? 'Trong nước'
            : trip.info.scope === 'INTERNATIONAL'
              ? businessCopy('source.scope.INTERNATIONAL')
              : 'Chưa xác định phạm vi'}
        </span>
      </td>
      <td>
        {isArchived ? <span className={styles.muted}>Đã ngừng sử dụng</span>
          : needsContext && detail.loading ? <span role="status">Đang xác minh mẫu…</span>
          : detail.error ? <div><span>Chưa tải được mẫu đã chốt.</span><Button tone="text" size="compact" onClick={detail.retry}>Tải lại</Button></div>
          : published !== undefined ? <Link className={styles.templateReference} to={`${root}/${trip.tripId}/schedule?view=published`}>Mẫu {published}<span>Đã chốt · Xem lịch trình</span></Link>
          : <span className={styles.muted}>Chưa có mẫu đã chốt</span>}
      </td>
      <td>
        <div className={styles.tripNextTask}>
          <span>{working !== undefined ? `${workingVersionLabel(workingStatus ?? 'DRAFT')} · Bản ${working}` : isArchived ? 'Tra cứu lịch trình đã lưu' : 'Chưa có bản chỉnh sửa'}</span>
          <ButtonLink tone="secondary" size="compact" autoWidth to={`${root}/${trip.tripId}/schedule`}>
            {canContinueDraft ? 'Mở thiết kế hải trình' : 'Xem lịch trình'}
          </ButtonLink>
        </div>
      </td>
    </tr>
  )
}
