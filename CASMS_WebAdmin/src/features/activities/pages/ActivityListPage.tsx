import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router'

import { useReadQuery } from '@/shared/api'
import { Badge, Button, ButtonLink, CollectionSummary, DataTable, Empty, Field, ListFilters, Loading, Modal, Notice, PageHeader, Panel } from '@/shared/ui'
import { useSessionAccess } from '@/shared/auth'
import { activityApi } from '../api/activity-api'
import { ActivityFrame, ActivityState } from '../components/ActivityUI'
import { activityTime, activityStatusLabels } from '../model/activity'
import styles from '../components/Activities.module.css'
import { ActivityDetailPage } from './ActivityDetailPage'

export function ActivityListPage() {
  const access = useSessionAccess()
  const navigate = useNavigate()
  const query = useReadQuery('activities', activityApi.list)
  const cruises = useReadQuery('activity-cruises', activityApi.cruises)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [cruiseFilter, setCruiseFilter] = useState('')
  const catalog = useReadQuery(`activity-catalog:${access.userId}`, activityApi.catalog)
  const [selected, setSelected] = useState<{ id: string; name: string } | null>(null)
  const [view, setView] = useState<'catalog' | 'schedule'>('catalog')
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerSearch, setPickerSearch] = useState('')
  const results = useRef<HTMLElement>(null)
  const focusResults = useRef(false)

  useLayoutEffect(() => {
    if (!focusResults.current) return
    focusResults.current = false
    results.current?.focus()
  }, [view])

  function changeView(next: typeof view) {
    if (next === view) return
    focusResults.current = true
    setView(next)
  }

  const cruiseMap = useMemo(() => {
    const map = new Map<string, { code: string; name: string; departure: string }>()
    for (const item of cruises.data ?? []) {
      map.set(item.cruiseId, {
        code: item.cruiseCode,
        name: item.cruiseName,
        departure: item.departureDatetime,
      })
    }
    return map
  }, [cruises.data])

  const normalizedSearch = search.trim().toLocaleLowerCase('vi')
  const catalogItems = [...(catalog.data?.filter(item =>
    `${item.code} ${item.name}`.toLocaleLowerCase('vi').includes(normalizedSearch),
  ) ?? [])].sort((a, b) => b.code.localeCompare(a.code, 'vi', { numeric: true }))

  const items = [...(query.data?.filter(item => {
    if (status && item.status !== status) return false
    if (cruiseFilter && item.cruiseId !== cruiseFilter) return false
    const cruiseInfo = item.cruiseId ? cruiseMap.get(item.cruiseId) : undefined
    const hay = `${item.code} ${item.name} ${cruiseInfo?.code ?? ''} ${cruiseInfo?.name ?? ''}`.toLocaleLowerCase('vi')
    return hay.includes(normalizedSearch)
  }) ?? [])].sort((a, b) => (Date.parse(b.startTime ?? '') || 0) - (Date.parse(a.startTime ?? '') || 0))

  const pickerCruises = useMemo(() => {
    const q = pickerSearch.trim().toLocaleLowerCase('vi')
    return (cruises.data ?? []).filter(item => {
      if (!q) return true
      return `${item.cruiseCode} ${item.cruiseName}`.toLocaleLowerCase('vi').includes(q)
    })
  }, [cruises.data, pickerSearch])

  const canCreate = access.canDo('ACTIVITY_CREATE')

  return (
    <ActivityFrame>
      <PageHeader
        breadcrumb="QUẢN LÝ HOẠT ĐỘNG VÀ DỊCH VỤ"
        title="Hoạt động trên tàu"
        description="Tạo mẫu hoạt động một lần trong Kho hoạt động mẫu, sau đó chọn mẫu để xếp ngày giờ & khu vực cụ thể cho từng chuyến khởi hành."
        actions={
          <>
            <ButtonLink tone="secondary" to="/admin/activity-registrations">
              Đăng ký & điểm danh
            </ButtonLink>
            {canCreate && (
              view === 'catalog' ? (
                <ButtonLink to="/admin/activities/new">
                  + Tạo hoạt động mẫu
                </ButtonLink>
              ) : (
                <Button
                  autoWidth
                  onClick={() => {
                    setPickerSearch('')
                    setPickerOpen(true)
                  }}
                >
                  + Xếp lịch hoạt động cho chuyến
                </Button>
              )
            )}
          </>
        }
      />

      <div className={styles.actions} role="tablist" aria-label="Chế độ xem hoạt động">
        <Button
          tone={view === 'catalog' ? 'primary' : 'secondary'}
          aria-pressed={view === 'catalog'}
          onClick={() => changeView('catalog')}
        >
          Kho hoạt động mẫu ({catalog.data?.length ?? 0})
        </Button>
        <Button
          tone={view === 'schedule' ? 'primary' : 'secondary'}
          aria-pressed={view === 'schedule'}
          onClick={() => changeView('schedule')}
        >
          Lịch hoạt động theo chuyến ({query.data?.length ?? 0})
        </Button>
      </div>

      <section
        ref={results}
        tabIndex={-1}
        aria-label={view === 'catalog' ? 'Kho hoạt động mẫu' : 'Lịch hoạt động theo chuyến'}
        className={styles.listResults}
      >
        {view === 'catalog' ? (
          <>
            <div className={styles.modeBanner}>
              <div className={styles.modeBannerText}>
                <strong>Kho hoạt động mẫu dùng chung là gì?</strong>
                <span>
                  Đây là thư viện các hoạt động chuẩn (tên, nhóm, sức chứa mặc định, giá tham chiếu) chưa gắn ngày giờ — tạo 1 lần để chọn nhanh cho nhiều chuyến khác nhau.
                </span>
              </div>
              {canCreate && (
                <ButtonLink tone="secondary" size="compact" to="/admin/activities/new">
                  Tạo mẫu mới →
                </ButtonLink>
              )}
            </div>

            <Panel title="Danh sách hoạt động mẫu">
              <ListFilters
                label="Tìm trong kho hoạt động mẫu"
                actions={
                  <Button tone="secondary" disabled={!search} onClick={() => setSearch('')}>
                    Xóa bộ lọc
                  </Button>
                }
              >
                <Field htmlFor="activity-catalog-search" label="Tên hoặc mã hoạt động">
                  <input
                    id="activity-catalog-search"
                    type="search"
                    placeholder="VD: Yoga, Lớp nấu ăn, Biểu diễn nhạc..."
                    value={search}
                    onChange={event => setSearch(event.target.value)}
                  />
                </Field>
              </ListFilters>
              <ActivityState {...catalog} />
              {catalog.data && !catalogItems.length && (
                <Empty title={search ? 'Không có hoạt động mẫu khớp tìm kiếm' : 'Chưa có hoạt động nào trong kho mẫu'}>
                  <p>
                    {search
                      ? 'Thử tìm bằng tên hoặc mã khác.'
                      : 'Tạo hoạt động mẫu trước để có thể chọn nhanh khi xếp lịch chương trình cho từng chuyến khởi hành.'}
                  </p>
                </Empty>
              )}
              {catalogItems.length > 0 && (
                <DataTable label="Kho hoạt động mẫu" headers={['Hoạt động mẫu', 'Sức chứa mặc định', 'Giá tham chiếu', '']}>
                  {catalogItems.map(item => (
                    <tr key={item.id}>
                      <td>
                        <span className={styles.recordName}>{item.name}</span>
                        <span className={styles.recordCode}>{item.code}</span>
                      </td>
                      <td>{item.capacity ?? 'Chưa cấu hình'}</td>
                      <td>{item.price == null ? 'Chưa cấu hình' : `${item.price} ${item.currencyCode ?? ''}`}</td>
                      <td>
                        <Button
                          tone="secondary"
                          size="compact"
                          autoWidth
                          onClick={() => setSelected({ id: item.id, name: item.name })}
                        >
                          Xem chi tiết
                        </Button>
                      </td>
                    </tr>
                  ))}
                </DataTable>
              )}
            </Panel>
          </>
        ) : (
          <>
            <div className={styles.modeBanner}>
              <div className={styles.modeBannerText}>
                <strong>Lịch hoạt động theo chuyến khác gì Kho mẫu?</strong>
                <span>
                  Đây là các buổi hoạt động đã được xếp ngày giờ và khu vực cụ thể trên từng chuyến khởi hành. Để thêm buổi mới, bấm <strong>+ Xếp lịch hoạt động cho chuyến</strong> và chọn chuyến cần cấu hình.
                </span>
              </div>
              {canCreate && (
                <Button
                  tone="secondary"
                  size="compact"
                  autoWidth
                  onClick={() => {
                    setPickerSearch('')
                    setPickerOpen(true)
                  }}
                >
                  Chọn chuyến để xếp lịch →
                </Button>
              )}
            </div>

            <CollectionSummary
              count={query.loading || query.error ? null : query.data?.length ?? null}
              visible={items.length}
              filtered={Boolean(search || status || cruiseFilter)}
              label="Buổi hoạt động theo chuyến"
            />
            <Panel title="Tìm kiếm & bộ lọc">
              <ListFilters
                label="Bộ lọc hoạt động theo chuyến"
                actions={
                  <Button
                    tone="secondary"
                    disabled={!search && !status && !cruiseFilter}
                    onClick={() => {
                      setSearch('')
                      setStatus('')
                      setCruiseFilter('')
                    }}
                  >
                    Xóa bộ lọc
                  </Button>
                }
              >
                <Field htmlFor="activity-search" label="Tên hoạt động hoặc mã chuyến">
                  <input
                    id="activity-search"
                    type="search"
                    placeholder="Tìm hoạt động hoặc mã chuyến (CR-...)…"
                    value={search}
                    onChange={event => setSearch(event.target.value)}
                  />
                </Field>
                <Field htmlFor="activity-cruise-filter" label="Chuyến khởi hành">
                  <select
                    id="activity-cruise-filter"
                    value={cruiseFilter}
                    onChange={event => setCruiseFilter(event.target.value)}
                  >
                    <option value="">Tất cả các chuyến</option>
                    {(cruises.data ?? []).map(item => (
                      <option key={item.cruiseId} value={item.cruiseId}>
                        {item.cruiseCode} · {item.cruiseName}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field htmlFor="activity-status" label="Trạng thái">
                  <select id="activity-status" value={status} onChange={event => setStatus(event.target.value)}>
                    <option value="">Tất cả</option>
                    {Object.entries(activityStatusLabels).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </Field>
              </ListFilters>
            </Panel>

            <Panel title="Danh sách lịch hoạt động theo chuyến">
              <ActivityState {...query} />
              {query.data && !items.length && (
                <Empty title={query.data.length ? 'Không có hoạt động khớp bộ lọc' : 'Chưa có buổi hoạt động nào được xếp lịch theo chuyến'}>
                  {!query.data.length && canCreate && (
                    <Button
                      size="compact"
                      autoWidth
                      onClick={() => {
                        setPickerSearch('')
                        setPickerOpen(true)
                      }}
                    >
                      + Xếp lịch hoạt động cho chuyến
                    </Button>
                  )}
                </Empty>
              )}
              {query.data && items.length > 0 && (
                <DataTable
                  label="Lịch hoạt động theo chuyến"
                  headers={['Hoạt động', 'Chuyến khởi hành', 'Thời gian', 'Địa điểm', 'Sức chứa', 'Trạng thái', '']}
                >
                  {items.map(item => {
                    const cruiseInfo = item.cruiseId ? cruiseMap.get(item.cruiseId) : undefined
                    return (
                      <tr key={item.id}>
                        <td>
                          <span className={styles.recordName}>{item.name}</span>
                          <span className={styles.recordCode}>{item.code}</span>
                        </td>
                        <td>
                          {cruiseInfo ? (
                            <>
                              <span className={styles.recordName}>{cruiseInfo.code}</span>
                              <span className={styles.recordCode}>{cruiseInfo.name}</span>
                            </>
                          ) : (
                            <span className={styles.recordCode}>Chưa gắn chuyến</span>
                          )}
                        </td>
                        <td>
                          {activityTime(item.startTime)}
                          <span className={styles.recordCode}>đến {activityTime(item.endTime)}</span>
                        </td>
                        <td>{item.location || 'Chưa xác định'}</td>
                        <td>{item.capacity}</td>
                        <td>
                          <Badge
                            label={activityStatusLabels[item.status] ?? item.status}
                            tone={
                              item.status === 'CANCELLED'
                                ? 'error'
                                : item.status === 'COMPLETED'
                                  ? 'success'
                                  : item.status === 'IN_PROGRESS'
                                    ? 'info'
                                    : 'neutral'
                            }
                          />
                        </td>
                        <td>
                          <div className={styles.rowActions}>
                            <Button
                              tone="secondary"
                              size="compact"
                              autoWidth
                              onClick={() => setSelected({ id: item.id, name: item.name })}
                            >
                              Xem chi tiết
                            </Button>
                            {item.cruiseId && (
                              <ButtonLink
                                tone="secondary"
                                size="compact"
                                to={`/admin/cruises/${encodeURIComponent(item.cruiseId)}?work=program&programKind=activities`}
                              >
                                Chương trình
                              </ButtonLink>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </DataTable>
              )}
            </Panel>
          </>
        )}
      </section>

      {selected && (
        <Modal
          title={selected.name}
          large
          protectChanges={false}
          onClose={() => setSelected(null)}
          footer={<Button tone="secondary" onClick={() => setSelected(null)}>Đóng</Button>}
        >
          <div>
            <ActivityDetailPage recordId={selected.id} embedded />
          </div>
        </Modal>
      )}

      {pickerOpen && (
        <Modal
          title="Chọn chuyến khởi hành để xếp lịch hoạt động"
          description="Chọn chuyến cần cấu hình để mở thẳng mục Hoạt động trên tàu trong Chương trình của chuyến."
          protectChanges={false}
          onClose={() => setPickerOpen(false)}
          footer={<Button tone="secondary" onClick={() => setPickerOpen(false)}>Đóng</Button>}
        >
          <div className={styles.cruisePicker}>
            <Field htmlFor="activity-cruise-picker-search" label="Tìm chuyến khởi hành">
              <input
                id="activity-cruise-picker-search"
                type="search"
                placeholder="Nhập mã chuyến (CR-...) hoặc tên chuyến…"
                value={pickerSearch}
                onChange={event => setPickerSearch(event.target.value)}
              />
            </Field>
            {cruises.loading && <Loading label="Đang tải danh sách chuyến khởi hành…" />}
            {cruises.error && (
              <Notice tone="error" title="Chưa tải được danh sách chuyến">
                <Button tone="secondary" size="compact" autoWidth onClick={cruises.retry}>Thử lại</Button>
              </Notice>
            )}
            {cruises.data && !pickerCruises.length && (
              <Empty title="Không tìm thấy chuyến phù hợp" />
            )}
            {pickerCruises.length > 0 && (
              <ul className={styles.cruisePickerList}>
                {pickerCruises.map(item => (
                  <li key={item.cruiseId} className={styles.cruisePickerItem}>
                    <div className={styles.cruisePickerMeta}>
                      <strong>{item.cruiseCode} · {item.cruiseName}</strong>
                      <span>Khởi hành: {activityTime(item.departureDatetime)}</span>
                    </div>
                    <Button
                      size="compact"
                      autoWidth
                      onClick={() => {
                        setPickerOpen(false)
                        navigate(`/admin/cruises/${encodeURIComponent(item.cruiseId)}?work=program&programKind=activities&openCreate=1`)
                      }}
                    >
                      Xếp lịch hoạt động →
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Modal>
      )}
    </ActivityFrame>
  )
}
