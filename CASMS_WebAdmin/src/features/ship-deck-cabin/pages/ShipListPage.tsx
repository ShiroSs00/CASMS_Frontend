import { useCallback, useState } from 'react'
import { useLocation, useSearchParams } from 'react-router'
import { useSessionAccess } from '@/shared/auth'
import { Badge, Button, ButtonLink, DataTable, Empty, Field, Loading, Notice, PageHeader, PermissionLink } from '@/shared/ui'
import { AdminShell } from '@/shared/ui/admin-v3'
import { PageControls } from '../ship-types/Catalog'
import { shipError, shipTypesApi } from '../ship-types/api'
import { StatusBadge } from '../components/Common'
import { shipDeckCabinApi } from '../api/ship-deck-cabin-api'
import { shipStatuses, type ShipStatus } from '../model/types'
import { readShipListFilters, readShipListPage, shipListParams, type ShipListFilters } from '../model/ship-list-filters'
import { useFleetQuery } from '../hooks/useFleetQuery'
import styles from '../ship-types/ShipWork.module.css'

const blankFilters: ShipListFilters = { search: '', status: '', type: '' }
function Filters({ filters, options, canViewArchive, onSubmit, onReset }: {
  canViewArchive: boolean
  filters: ShipListFilters; options: Map<string, string>; onSubmit: (value: ShipListFilters) => void; onReset: () => void
}) {
  const [draft, setDraft] = useState(filters)
  return <section aria-label="Bộ lọc danh sách tàu">
    <form role="search" className={styles.shipListFilters} onSubmit={event => {
      event.preventDefault()
      onSubmit({ ...draft, search: draft.search.trim() })
    }}>
      <div className={styles.shipListSearchField}><Field htmlFor="find-vessel" label="Tìm theo tên hoặc mã tàu">
        <input type="search" placeholder="Nhập tên hoặc mã tàu" maxLength={100} value={draft.search} onChange={event => setDraft(value => ({ ...value, search: event.target.value }))} />
      </Field></div>
      <div className={styles.shipListSelects} data-has-archive={canViewArchive}>
      <Field htmlFor="vessel-type-filter" label="Loại tàu">
        <select value={draft.type} onChange={event => setDraft(value => ({ ...value, type: event.target.value }))}>
          <option value="">Tất cả loại tàu</option><option value="legacy">Chưa phân loại</option>
          {[...options].map(([id, label]) => <option key={id} value={id}>{label}</option>)}
        </select>
      </Field>
      <Field htmlFor="vessel-status-filter" label="Trạng thái">
        <select value={draft.status} onChange={event => setDraft(value => ({ ...value, status: event.target.value as ShipStatus | '' }))}>
          <option value="">Tất cả trạng thái</option>{Object.entries(shipStatuses).map(([code, label]) => <option key={code} value={code}>{label}</option>)}
        </select>
      </Field>
      {canViewArchive && <Field htmlFor="vessel-archive-filter" label="Tình trạng lưu trữ">
        <select value={draft.archived ? 'archived' : 'active'} onChange={event => setDraft(value => ({ ...value, archived: event.target.value === 'archived' }))}>
          <option value="active">Chưa lưu trữ</option><option value="archived">Đã lưu trữ</option>
        </select>
      </Field>}
      </div>
      <div className={styles.shipFilterActions}><Button type="submit" tone="secondary" autoWidth>Áp dụng bộ lọc</Button>
      {(filters.search || filters.type || filters.status || filters.archived || draft.search || draft.type || draft.status || draft.archived) &&
        <Button tone="text" onClick={() => { setDraft(blankFilters); onReset() }}>Xóa bộ lọc</Button>}
      </div>
    </form>
  </section>
}

export function ShipListPage() {
  const access = useSessionAccess()
  const { search: locationSearch, state } = useLocation()
  const [, setParams] = useSearchParams()
  const params = new URLSearchParams(locationSearch)
  const filters = readShipListFilters(params)
  const { type } = filters
  const canViewArchive = access.roles.includes('SHIP_MANAGER') && !access.roles.includes('ADMIN') && access.canDo('SHIP_ARCHIVE')
  const page = readShipListPage(params)
  const listQuery = shipListParams(filters, page).toString()
  const canReadTypes = access.roles.some(role => role === 'ADMIN' || role === 'SHIP_MANAGER')
  const loadTypes = useCallback(async (signal: AbortSignal) => {
    const first = await shipTypesApi.list(0, '', undefined, signal)
    const rows = [...first.content]
    for (let index = 1; index < first.totalPages; index++) rows.push(...(await shipTypesApi.list(index, '', undefined, signal)).content)
    return rows
  }, [])
  const types = useFleetQuery('ship-list-type-options:' + access.userId, loadTypes, canReadTypes)
  const load = useCallback((signal: AbortSignal) => {
    const query = new URLSearchParams(locationSearch)
    return shipDeckCabinApi.listShipPage(readShipListPage(query), signal, readShipListFilters(query))
  }, [locationSearch])
  const result = useFleetQuery('ship-list:' + access.userId + ':' + listQuery, load, access.canDo('SHIP_READ'))
  const typeOptions = new Map((types.data ?? []).map(type => [type.shipTypeId, type.name]))
  for (const ship of result.data?.content ?? []) {
    if (ship.shipTypeId && !typeOptions.has(ship.shipTypeId)) typeOptions.set(ship.shipTypeId, ship.shipTypeName || ship.shipTypeCode || 'Loại tàu đã gắn')
  }
  if (type && type !== 'legacy' && !typeOptions.has(type)) typeOptions.set(type, 'Loại đang lọc')
  const filtered = Boolean(filters.search || filters.status || filters.type || filters.archived)
  const totalPages = result.data?.totalPages ?? 0

  function reset() { setParams(shipListParams(blankFilters, 0)) }

  return <AdminShell><div className={`${styles.stack} ${styles.designPage}`}>
    <PageHeader breadcrumb="Quản lý tàu / Danh sách tàu" title="Quản lý tàu"
      description="Tra cứu và quản lý các tàu trong phạm vi được phân công."
      actions={access.roles.includes('SHIP_MANAGER') && <ButtonLink to="/admin/ships/new">Thêm tàu</ButtonLink>} />
    {state?.archivedShipName && <Notice title="Đã lưu trữ tàu" tone="success">{state.archivedShipName}</Notice>}
    <Filters key={shipListParams(filters, 0).toString()} filters={filters} options={typeOptions} canViewArchive={canViewArchive}
      onSubmit={value => setParams(shipListParams(value, 0))} onReset={reset} />
    {types.error && <Notice tone="warning" title="Chưa tải được toàn bộ danh mục loại tàu">
      Danh sách tàu vẫn tra cứu được. <Button tone="text" onClick={types.retry}>Tải lại danh mục</Button>
    </Notice>}
    <section className={`${styles.catalogList} ${styles.shipListTable}`} aria-labelledby="ship-list-heading" aria-busy={result.loading}>
      <div className={styles.listHeading}><div className={styles.shipListTitle}><h2 id="ship-list-heading">{filters.archived ? 'Danh sách tàu đã lưu trữ' : 'Danh sách tàu'}</h2>
        {result.data && <span aria-live="polite">{result.data.totalElements.toLocaleString('vi-VN')} tàu</span>}</div>
        <Button tone="text" busy={result.loading} onClick={result.retry}>Làm mới danh sách</Button></div>
      {result.loading && <Loading label="Đang tải danh sách tàu…" />}
      {result.error && <Notice title="Chưa tải được danh sách tàu" tone="error">{shipError(result.error)} <Button tone="text" onClick={result.retry}>Thử lại</Button></Notice>}
      {result.data && <>
      {result.data.content.length > 0 && <p className={styles.tableHint}>Vuốt ngang bảng để xem đầy đủ thông tin tàu.</p>}
      {page > 0 && page >= totalPages ? <Empty title="Trang này không còn kết quả">
        <Button tone="text" onClick={() => setParams(shipListParams(filters, Math.max(0, totalPages - 1)))}>Về trang còn dữ liệu</Button>
      </Empty> : result.data.content.length ? <DataTable label="Danh sách tàu"
        headers={['Mã tàu', 'Tên tàu', 'Loại tàu', 'Sức chứa (khách)', 'Số boong', 'Trạng thái', 'Thao tác']}>
        {result.data.content.map(ship => <tr key={ship.id}>
          <td>{ship.code}</td><th scope="row">{ship.name}</th>
          <td>{ship.shipTypeId ? ship.shipTypeName || ship.shipTypeCode || 'Loại tàu đã gắn' : 'Chưa phân loại'}</td>
          <td className={styles.number}>{ship.capacity.toLocaleString('vi-VN')}</td>
          <td className={styles.number}>{ship.totalDecks}</td><td>{ship.archivedAt ? <Badge label="Đã lưu trữ" /> : <StatusBadge status={ship.status} />}</td>
          <td><PermissionLink to={'/admin/ships/' + ship.id} state={{ listQuery }}
            aria-label={'Chi tiết tàu ' + ship.name}>Chi tiết</PermissionLink></td>
        </tr>)}
      </DataTable> : <Empty title={filtered ? 'Không có tàu phù hợp' : 'Chưa có tàu trong phạm vi quản lý'}>
        <p>{filtered ? 'Thử đổi điều kiện tìm kiếm hoặc xóa bộ lọc để xem lại danh sách.' : access.roles.includes('SHIP_MANAGER')
          ? 'Chọn Thêm tàu để tạo tàu từ một loại tàu đang sử dụng.' : 'Danh sách chỉ hiển thị tàu trong phạm vi được phân công cho bạn.'}</p>
      </Empty>}
      {result.data.totalPages > 1 && page < result.data.totalPages && <PageControls page={result.data} label="tàu" onPage={value => setParams(shipListParams(filters, value))} />}
      </>}
    </section>
  </div></AdminShell>
}
