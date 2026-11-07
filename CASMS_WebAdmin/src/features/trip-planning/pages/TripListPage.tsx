import { businessCopy } from '@/shared/i18n/business-copy'
import { useCallback, useState } from 'react'
import { Link } from 'react-router'
import { useReadQuery } from '@/shared/api'
import { Badge, Button, DataTable, Empty, Field, Loading, Notice, Panel } from '@/shared/ui'
import { usePlanning } from '../hooks'
import type { TripFilters } from '../api/gateway'
import { tripLabels, type Trip } from '../model/plan'
import styles from '../Planning.module.css'
import { versionContext } from '../model/version-context'
import { PublishedTemplateDialog } from '../components/PublishedTemplateDialog'

export function TripListPage() {
  const { gateway, root, can } = usePlanning()
  const [page, setPage] = useState(0)
  const [filters, setFilters] = useState<TripFilters>({ search: '', durationGroup: '', plannedScope: '' })
  const [searchText, setSearchText] = useState('')

  const list = useReadQuery(
    `trips:${gateway.mode}:${page}:${JSON.stringify(filters)}`,
    useCallback(signal => gateway.list(page, '', signal, filters), [gateway, page, filters])
  )
  const filtered = Boolean(filters.search)

  function resetFilters() {
    setFilters({ search: '', durationGroup: '', plannedScope: '' })
    setSearchText('')
    setPage(0)
  }

  return (
    <>
      <header className={styles.heading}>
        <div>
          <h1>Chuyến đi</h1>
        </div>
        {can('TRIP_CREATE') && !gateway.readOnly && (
          <Link className={styles.primaryLink} to={`${root}/new`}>
            + Tạo chuyến đi
          </Link>
        )}
      </header>

      <Panel className={styles.listPanel}>
        <form
          className={styles.filters}
          onSubmit={e => {
            e.preventDefault()
            setFilters({ search: searchText.trim(), durationGroup: '', plannedScope: '' })
            setPage(0)
          }}
        >
          <Field htmlFor="trip-search" label="Tìm kiếm chuyến đi">
            <input
              id="trip-search"
              type="search"
              placeholder="Nhập mã hoặc tên chuyến đi cần tìm..."
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
            />
          </Field>
          <Button type="submit" autoWidth>
            Tìm kiếm
          </Button>
        </form>

        <div className={styles.resultsHead}>
          <h2>
            Danh sách chuyến đi
            {list.data && <span className={styles.resultCount}>{list.data.totalElements}</span>}
          </h2>
          {filtered && (
            <Button tone="text" size="compact" onClick={resetFilters}>
              Xóa tìm kiếm
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
                ? 'Thử đổi từ khóa hoặc xóa tìm kiếm.'
                : 'Bắt đầu bằng thông tin chuyến; lịch trình sẽ được tổ chức ngay trong chuyến đó.'}
            </p>
            {filtered ? (
              <Button tone="secondary" onClick={resetFilters}>
                Xóa tìm kiếm
              </Button>
            ) : (
              can('TRIP_CREATE') &&
              !gateway.readOnly && (
                <Link className={styles.primaryLink} to={`${root}/new`}>
                  Tạo chuyến đi
                </Link>
              )
            )}
          </Empty>
        ) : (
          <DataTable
            label="Danh sách chuyến đi"
            headers={['Chuyến đi', 'Thời lượng / phạm vi', 'Trạng thái', 'Thao tác']}
          >
            {list.data.content.map(trip => (
              <TripListRow key={trip.tripId} trip={trip} />
            ))}
          </DataTable>
        )}

        {list.data && (
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
  const { gateway, root } = usePlanning()
  const [preview, setPreview] = useState(false)

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
        {published !== undefined ? (
          <Badge tone="success" label="Đã chốt" />
        ) : working !== undefined ? (
          <Badge tone="warning" label="Bản nháp" />
        ) : (
          <Badge tone={trip.status === 'READY' ? 'success' : 'neutral'} label={tripLabels[trip.status] ?? 'Chưa chốt'} />
        )}
      </td>
      <td>
        {preview && <PublishedTemplateDialog trip={trip} onClose={() => setPreview(false)} />}
        <div className={styles.listRowActions}>
          {published !== undefined && (
            <Button tone="secondary" size="compact" onClick={() => setPreview(true)}>
              Xem lịch trình đã chốt
            </Button>
          )}
          <Link className={styles.secondaryLink} to={`${root}/${trip.tripId}/schedule`}>
            {working !== undefined ? 'Chỉnh sửa lịch trình' : 'Mở lịch trình'}
          </Link>
        </div>
      </td>
    </tr>
  )
}
