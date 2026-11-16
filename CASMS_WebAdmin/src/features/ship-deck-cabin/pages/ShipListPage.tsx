import { useCallback, useState } from 'react'
import { useSessionAccess } from '@/shared/auth'
import { Button, ButtonLink, DataTable, Empty, Field, Loading, Notice, PageHeader, Panel, PermissionLink } from '@/shared/ui'
import { AdminShell } from '@/shared/ui/admin-v3'
import { PageControls } from '../ship-types/Catalog'
import { shipError, shipTypesApi, type Page } from '../ship-types/api'
import { StatusBadge } from '../components/Common'
import { shipDeckCabinApi, toShip } from '../api/ship-deck-cabin-api'
import { shipStatuses, type Ship, type ShipStatus } from '../model/types'
import { useFleetQuery } from '../hooks/useFleetQuery'
import styles from '../ship-types/ShipWork.module.css'

const blankFilters = { search: '', status: '', type: '' }
const size = 20

export function ShipListPage() {
  const access = useSessionAccess()
  const [page, setPage] = useState(0)
  const [pending, setPending] = useState(blankFilters)
  const [filters, setFilters] = useState(blankFilters)
  const canReadTypes = access.roles.some(role => role === 'ADMIN' || role === 'SHIP_MANAGER')
  const loadTypes = useCallback(async (signal: AbortSignal) => {
    const first = await shipTypesApi.list(0, '', undefined, signal)
    const rows = [...first.content]
    for (let index = 1; index < first.totalPages; index++) rows.push(...(await shipTypesApi.list(index, '', undefined, signal)).content)
    return rows
  }, [])
  const types = useFleetQuery('ship-list-type-options:' + access.userId, loadTypes, canReadTypes)
  const load = useCallback(async (signal: AbortSignal): Promise<Page<Ship>> => {
    if (!filters.search && !filters.status && !filters.type) return shipDeckCabinApi.listShipPage(page, signal)
    if (!filters.search && !filters.status && types.data?.some(type => type.shipTypeId === filters.type)) {
      const result = await shipTypesApi.ships(filters.type, page, signal)
      return { ...result, content: result.content.map(toShip) }
    }
    // The general ships API supports paging. Combined search and status filters use its existing complete read.
    const term = filters.search.toLocaleLowerCase('vi')
    const all = (await shipDeckCabinApi.listShips(signal)).filter(ship =>
      (!term || (ship.code + ' ' + ship.name).toLocaleLowerCase('vi').includes(term))
      && (!filters.status || ship.status === filters.status)
      && (!filters.type || (filters.type === 'legacy' ? !ship.shipTypeId : ship.shipTypeId === filters.type)))
    return { content: all.slice(page * size, (page + 1) * size), number: page, size, totalElements: all.length, totalPages: Math.ceil(all.length / size) }
  }, [filters, page, types.data])
  const result = useFleetQuery('ship-list:' + access.userId + ':' + page + ':' + JSON.stringify(filters), load, access.canDo('SHIP_READ'))
  const typeOptions = new Map((types.data ?? []).map(type => [type.shipTypeId, type.name]))
  for (const ship of result.data?.content ?? []) {
    if (ship.shipTypeId && !typeOptions.has(ship.shipTypeId)) typeOptions.set(ship.shipTypeId, ship.shipTypeName || ship.shipTypeCode || 'Loại tàu đã gắn')
  }
  if (pending.type && pending.type !== 'legacy' && !typeOptions.has(pending.type)) typeOptions.set(pending.type, 'Loại đang lọc')
  const filtered = Boolean(filters.search || filters.status || filters.type)

  function reset() { setPending(blankFilters); setFilters(blankFilters); setPage(0) }

  return <AdminShell><div className={styles.stack}>
    <PageHeader breadcrumb="Quản lý tàu / Danh sách tàu" title="Quản lý tàu"
      actions={access.roles.includes('SHIP_MANAGER') && <ButtonLink to="/admin/ships/new">Thêm tàu</ButtonLink>} />
    <Panel>
      <form role="search" className={styles.filters} onSubmit={event => {
        event.preventDefault(); setFilters({ ...pending, search: pending.search.trim() }); setPage(0)
      }}>
        <Field htmlFor="find-vessel" label="Tìm theo tên hoặc mã tàu"><input type="search" value={pending.search}
          onChange={event => setPending(value => ({ ...value, search: event.target.value }))} /></Field>
        <Field htmlFor="vessel-type-filter" label="Loại tàu"><select value={pending.type} onChange={event => setPending(value => ({ ...value, type: event.target.value }))}>
          <option value="">Tất cả loại tàu</option><option value="legacy">Chưa phân loại</option>
          {[...typeOptions].map(([id, label]) => <option key={id} value={id}>{label}</option>)}
        </select></Field>
        <Field htmlFor="vessel-status-filter" label="Trạng thái"><select value={pending.status}
          onChange={event => setPending(value => ({ ...value, status: event.target.value as ShipStatus | '' }))}>
          <option value="">Tất cả trạng thái</option>{Object.entries(shipStatuses).map(([code, label]) => <option key={code} value={code}>{label}</option>)}
        </select></Field>
        <Button type="submit" tone="secondary" autoWidth>Tìm và lọc</Button>
        {(filtered || pending.search || pending.type || pending.status) && <Button tone="text" onClick={reset}>Xóa bộ lọc</Button>}
      </form>
    </Panel>
    {types.error && <Notice tone="warning" title="Chưa tải được toàn bộ danh mục loại tàu">
      Danh sách tàu vẫn tra cứu được. <Button tone="text" onClick={types.retry}>Tải lại danh mục</Button>
    </Notice>}
    {result.loading && <Loading label="Đang tải danh sách tàu…" />}
    {result.error && <Notice title="Chưa tải được danh sách tàu" tone="error">{shipError(result.error)} <Button tone="text" onClick={result.retry}>Thử lại</Button></Notice>}
    {result.data && <Panel title="Danh sách tàu">
      {result.data.content.length ? <DataTable label="Danh sách tàu"
        headers={['Mã tàu', 'Tên tàu', 'Loại tàu', 'Sức chứa', 'Số boong', 'Trạng thái', '']}>
        {result.data.content.map(ship => <tr key={ship.id}>
          <td>{ship.code}</td><th scope="row">{ship.name}</th>
          <td>{ship.shipTypeId ? ship.shipTypeName || ship.shipTypeCode || 'Loại tàu đã gắn' : 'Chưa phân loại'}</td>
          <td className={styles.number}>{ship.capacity.toLocaleString('vi-VN')}</td>
          <td className={styles.number}>{ship.totalDecks}</td><td><StatusBadge status={ship.status} /></td>
          <td><PermissionLink to={'/admin/ships/' + ship.id} aria-label={'Chi tiết tàu ' + ship.name}>Chi tiết</PermissionLink></td>
        </tr>)}
      </DataTable> : <Empty title={filtered ? 'Không có tàu phù hợp' : 'Chưa có tàu trong phạm vi quản lý'}>
        {filtered ? <Button tone="text" onClick={reset}>Xóa bộ lọc</Button> : undefined}
      </Empty>}
      <PageControls page={result.data} label="tàu" onPage={setPage} />
    </Panel>}
  </div></AdminShell>
}
