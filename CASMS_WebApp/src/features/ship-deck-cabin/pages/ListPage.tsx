import { useSessionAccess } from '@/shared/auth'
import { entityPermission } from '../model/permissions'
import { useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router'
import { Button, ButtonLink, DataTable, Empty, Modal, Notice, PageHeader, Panel } from '@/shared/ui'
import { AdminShell } from '@/shared/ui/admin-v3'
import { useAdminData, useAvailableCabins, useMutation } from '../hooks/useAdminData'
import { shipDeckCabinApi } from '../api/ship-deck-cabin-api'
import { cabinStatuses, cabinTypes, entityName, kindLabels, sectionLabels, shipStatuses } from '../model/types'
import type { CabinType, Entity, EntityKind } from '../model/types'
import { DataState, InputField, SelectField, StatusBadge } from '../components/Common'
import styles from '../components/Management.module.css'

type Filters = { ship: string; deck: string; search: string; status: string; type: string; accessible: string; minCapacity: string; available: string }
const titles: Record<EntityKind, string> = { ships: 'Quản lý tàu', decks: 'Quản lý boong', cabins: 'Quản lý cabin' }
const headers: Record<EntityKind, string[]> = {
  ships: ['MÃ / TÊN TÀU', 'SỨC CHỨA', 'SỐ BOONG', 'TRẠNG THÁI', 'THAO TÁC'],
  decks: ['SỐ BOONG', 'TÊN BOONG', 'TÀU', 'SỐ CABIN', 'THAO TÁC'],
  cabins: ['SỐ CABIN', 'BOONG / TÀU', 'LOẠI', 'SỨC CHỨA', 'TRẠNG THÁI', 'TIẾP CẬN', 'THAO TÁC'],
}
function ListPage({ kind }: { kind: EntityKind }) {
  const access = useSessionAccess()
  const [params, setParams] = useSearchParams()
  const empty: Filters = { ship: '', deck: '', search: '', status: '', type: '', accessible: '', minCapacity: '', available: '' }
  const initial = Object.fromEntries(Object.keys(empty).map((key) => [key, params.get(key) ?? ''])) as Filters
  const [filters, setFilters] = useState(initial)
  const [page, setPage] = useState(1)
  const [deleting, setDeleting] = useState<Entity | null>(null)
  const snapshot = useAdminData()
  const { data } = snapshot
  const searchAvailable = kind === 'cabins' && initial.available === '1' && access.has('CABIN_SEARCH')
  const available = useAvailableCabins(searchAvailable, {
    shipId: initial.ship || undefined, deckId: initial.deck || undefined,
    cabinType: initial.type ? initial.type as CabinType : undefined,
    minCapacity: initial.minCapacity ? Number(initial.minCapacity) : undefined,
    isAccessible: initial.accessible ? initial.accessible === 'true' : undefined,
  })
  const loading = snapshot.loading || (searchAvailable && available.loading)
  const error = snapshot.error || (searchAvailable ? available.error : '')
  const retry = () => { snapshot.retry(); if (searchAvailable) available.retry() }
  const [filterError, setFilterError] = useState('')
  const mutation = useMutation()
  const update = (key: keyof Filters, value: string) => { setFilterError(''); setFilters((current) => ({ ...current, [key]: value,
    ...(key === 'ship' ? { deck: '' } : {}), ...(key === 'status' && value !== 'AVAILABLE' ? { available: '' } : {}) })) }
  const apply = (values: Filters) => {
    if (values.minCapacity && (!Number.isSafeInteger(Number(values.minCapacity)) || Number(values.minCapacity) <= 0)) {
      setFilterError('Sức chứa tối thiểu phải là số nguyên dương.'); return
    }
    setFilterError('')
    setParams(Object.fromEntries(Object.entries(values).filter(([, value]) => value !== '')))
    setPage(1)
  }
  const ship = data?.ships.find((item) => item.id === initial.ship)
  const rows = (searchAvailable ? available.data ?? [] : data?.[kind] ?? []).filter((row) => {
    const term = initial.search.trim().toLocaleLowerCase('vi')
    const text = 'code' in row ? `${row.code} ${row.name}` : 'deckId' in row ? row.number : `${row.number} ${row.name}`
    if (term && !text.toLocaleLowerCase('vi').includes(term)) return false
    if ('shipId' in row && initial.ship && row.shipId !== initial.ship) return false
    if ('status' in row && initial.status && row.status !== initial.status) return false
    if ('deckId' in row) {
      if (initial.deck && row.deckId !== initial.deck) return false
      if (initial.type && row.type !== initial.type) return false
      if (initial.accessible && String(row.accessible) !== initial.accessible) return false
      if (initial.minCapacity && row.capacity < Number(initial.minCapacity)) return false
    }
    return true
  })
  const pageCount = Math.max(1, Math.ceil(rows.length / 10))
  const currentPage = Math.min(page, pageCount)
  const visible = rows.slice((currentPage - 1) * 10, currentPage * 10)
  return <>
    <PageHeader title={titles[kind]} breadcrumb={`Vận hành / Tàu & đội tàu / ${sectionLabels[kind]}`}
      description={kind === 'ships' ? 'Quản lý thông tin và trạng thái đội tàu.' : kind === 'decks' ? 'Theo dõi boong và cabin theo từng tàu.' : 'Quản lý cabin, sức chứa và trạng thái vận hành.'}
      actions={<ButtonLink to={`/admin/${kind}/new${initial.ship ? `?ship=${initial.ship}` : ''}`}>{kind === 'ships' ? 'Tạo tàu' : `Thêm ${kindLabels[kind]}`}</ButtonLink>} />
    {mutation.success && <Panel title="Kết quả thao tác"><Notice title="Thao tác thành công" tone="success">{mutation.success}</Notice></Panel>}
    <Panel title="Tìm kiếm & bộ lọc">
      <form onSubmit={(event) => { event.preventDefault(); apply(filters) }} className={styles.stack}>
        <div className={styles.grid}>
          {kind !== 'ships' && <SelectField label="Tàu" value={filters.ship} onChange={(value) => update('ship', value)}><option value="">Tất cả tàu</option>{data?.ships.map((row) => <option value={row.id} key={row.id}>{row.code} · {row.name}</option>)}</SelectField>}
          {kind === 'cabins' && <SelectField label="Boong" value={filters.deck} onChange={(value) => update('deck', value)}><option value="">Tất cả boong</option>{data?.decks.filter((row) => !filters.ship || row.shipId === filters.ship).map((row) => <option key={row.id} value={row.id}>Boong {row.number} · {row.name || data.ships.find((item) => item.id === row.shipId)?.code}</option>)}</SelectField>}
          <InputField label={`Tìm ${kindLabels[kind]}`} placeholder={kind === 'ships' ? 'Nhập mã hoặc tên' : kind === 'decks' ? 'Nhập số hoặc tên boong' : 'Nhập số cabin'} value={filters.search} onChange={(event) => update('search', event.target.value)} />
          {kind === 'cabins' && <SelectField label="Loại cabin" value={filters.type} onChange={(value) => update('type', value)}><option value="">Tất cả</option>{Object.entries(cabinTypes).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</SelectField>}
          {kind !== 'decks' && <SelectField label="Trạng thái" value={filters.status} onChange={(value) => update('status', value)}><option value="">Tất cả</option>{Object.entries(kind === 'ships' ? shipStatuses : cabinStatuses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</SelectField>}
          {kind === 'cabins' && <SelectField label="Hỗ trợ tiếp cận" value={filters.accessible} onChange={(value) => update('accessible', value)}><option value="">Tất cả</option><option value="true">Có</option><option value="false">Không</option></SelectField>}
          {kind === 'cabins' && <InputField label="Sức chứa tối thiểu" type="number" min={1} step={1} value={filters.minCapacity} error={filterError} onChange={(event) => update('minCapacity', event.target.value)} placeholder="Không giới hạn" />}
        </div>
        <div className={styles.actions}><Button type="submit">Áp dụng bộ lọc</Button><Button tone="secondary" onClick={() => { setFilters(empty); apply(empty) }}>Xóa bộ lọc</Button>
          {kind === 'cabins' && (access.has('CABIN_SEARCH') ? <Button tone="text" disabled={!access.has('CABIN_SEARCH')} onClick={() => { const values = { ...filters, status: 'AVAILABLE', available: '1' }; setFilters(values); apply(values) }}>Tìm cabin sẵn sàng</Button> : null)}
        </div>
        {kind === 'cabins' && <p className={styles.muted}>Trạng thái Sẵn sàng không xác nhận cabin còn chỗ cho một đặt chỗ hoặc chuyến đi cụ thể. Hãy kiểm tra yêu cầu chuyến đi trước khi gán khách.</p>}
      </form>
    </Panel>
    <Panel title={`Danh sách ${kindLabels[kind]}${ship ? ` · ${ship.name}` : ''} · ${rows.length}`}>
      {searchAvailable && <p className={styles.muted}>Danh sách theo trạng thái Sẵn sàng hiện tại; kết quả không giữ chỗ hoặc gán khách.</p>}
      <DataState loading={loading} error={error} retry={retry} />
      {!loading && !error && data && (rows.length ? <>
        <DataTable headers={headers[kind]} label={`Danh sách ${kindLabels[kind]}`}>
          {visible.map((row) => <tr key={row.id}>
            {'code' in row ? <><td><strong>{row.code}</strong><br />{row.name}</td><td>{row.capacity} khách</td><td>{row.totalDecks}</td><td><StatusBadge status={row.status} /></td></>
              : 'deckId' in row ? <><td><strong>{row.number}</strong></td><td>Boong {data.decks.find((item) => item.id === row.deckId)?.number}<br /><span className={styles.muted}>{data.ships.find((item) => item.id === row.shipId)?.code}</span></td><td>{cabinTypes[row.type]}</td><td>{row.capacity} khách</td><td><StatusBadge status={row.status} /></td><td>{row.accessible ? 'Có' : 'Không'}</td></>
                : <><td>{row.number}</td><td>{row.name || 'Chưa đặt tên'}</td><td>{data.ships.find((item) => item.id === row.shipId)?.code}</td><td>{data.cabins.filter((item) => item.deckId === row.id).length}</td></>}
            <td><div className={styles.rowActions}>
              <Link className={styles.link} to={`/admin/${kind}/${row.id}`}>Xem chi tiết</Link>
              <Link className={styles.link} to={`/admin/${kind}/${row.id}/edit`}>Chỉnh sửa</Link>
              {'code' in row && <><Link className={styles.link} to={`/admin/decks?ship=${row.id}`}>Boong</Link><Link className={styles.link} to={`/admin/cabins?ship=${row.id}`}>Cabin</Link></>}
              {kind === 'decks' && 'shipId' in row && <Link className={styles.link} to={`/admin/cabins?ship=${row.shipId}&deck=${row.id}`}>Xem cabin</Link>}
              {access.has(entityPermission(kind, 'DELETE')) && <button className={`${styles.link} ${styles.danger}`} disabled={!access.has(entityPermission(kind, 'DELETE'))} onClick={() => { mutation.clear(); setDeleting(row) }}>Xóa chưa sử dụng</button>}
            </div></td>
          </tr>)}
        </DataTable>
        {rows.length > 10 && <div className={styles.pagination}><span className={styles.muted}>Trang {currentPage}/{pageCount} · {rows.length} kết quả</span><div className={styles.actions}><Button tone="secondary" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>Trang trước</Button><Button tone="secondary" disabled={currentPage === pageCount} onClick={() => setPage(currentPage + 1)}>Trang sau</Button></div></div>}
      </> : <Empty><p>Thử tìm kiếm khác hoặc xóa bộ lọc.</p><Button tone="secondary" onClick={() => { setFilters(empty); apply(empty) }}>Xóa bộ lọc</Button></Empty>)}
    </Panel>
    {deleting && <Modal title={`Xóa ${kindLabels[kind]} chưa sử dụng?`} busy={mutation.busy} onClose={() => setDeleting(null)}>
      <div className={styles.stack}>
        <Notice title={entityName(deleting)} tone="warning">Chỉ có thể xóa mục chưa được sử dụng và không còn dữ liệu liên quan.</Notice>
        {mutation.error && <Notice title="Xóa thất bại" tone="error">{mutation.error}</Notice>}
        <div className={styles.actions}><Button tone="danger" disabled={mutation.busy} onClick={() => void mutation.run(async () => { if (!access.has(entityPermission(kind, 'DELETE'))) return; await shipDeckCabinApi.deleteUnused(kind, deleting.id); setDeleting(null) }, 'Đã xóa đối tượng chưa sử dụng.')}>{mutation.busy ? 'Đang xóa…' : 'Xác nhận xóa'}</Button><Button tone="secondary" disabled={mutation.busy} onClick={() => setDeleting(null)} data-overlay-dismiss>Hủy</Button></div>
      </div>
    </Modal>}
  </>
}
export function ShipListPage() { const location = useLocation(); return <AdminShell><ListPage key={location.key} kind="ships" /></AdminShell> }
export function DeckListPage() { const location = useLocation(); return <AdminShell><ListPage key={location.key} kind="decks" /></AdminShell> }
export function CabinListPage() { const location = useLocation(); return <AdminShell><ListPage key={location.key} kind="cabins" /></AdminShell> }
