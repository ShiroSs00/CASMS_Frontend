import { useCallback, useState } from 'react'
import { useParams } from 'react-router'
import { useReadQuery } from '@/shared/api'
import { useSessionAccess } from '@/shared/auth'
import { Badge, Button, ButtonLink, DataTable, Empty, Field, ListFooter, Loading, Notice, PageHeader, Panel, PermissionLink } from '@/shared/ui'
import { AdminShell } from '@/shared/ui/admin-v3'
import { shipTypesApi, shipError, type Page, type ShipType, type TypeStatus } from './api'
import { DesignPreview } from './DesignPreview'
import { DesignVersionFacts } from './DesignVersionFacts'
import { StatusBadge } from '../components/Common'
import styles from './ShipWork.module.css'

export function TypeStatusBadge({ status }: { status: TypeStatus }) {
  return <Badge label={status === 'ACTIVE' ? 'Đang sử dụng' : 'Ngừng sử dụng'} tone={status === 'ACTIVE' ? 'success' : 'neutral'} />
}

export function PageControls({ page, label, onPage }: {
  page: Pick<Page<unknown>, 'number' | 'size' | 'totalElements' | 'totalPages'>
  label: string
  onPage: (value: number) => void
}) {
  if (!page.totalElements) return null
  const first = page.number * page.size + 1
  return <ListFooter summary={first + '–' + Math.min(page.totalElements, first + page.size - 1) + ' / ' + page.totalElements + ' ' + label}>
    <Button size="compact" tone="secondary" disabled={page.number === 0} onClick={() => onPage(page.number - 1)}>Trang trước</Button>
    <span aria-live="polite">Trang {page.number + 1} / {page.totalPages}</span>
    <Button size="compact" tone="secondary" disabled={page.number + 1 >= page.totalPages} onClick={() => onPage(page.number + 1)}>Trang sau</Button>
  </ListFooter>
}

export function DesignFacts({ type }: { type: ShipType }) {
  return <dl className={styles.facts}>
    <div><dt>Mã loại</dt><dd>{type.code}</dd></div>
    <div><dt>Sức chứa thiết kế</dt><dd>{type.totalCapacity.toLocaleString('vi-VN')} khách</dd></div>
    <div><dt>Boong hành khách</dt><dd>{type.totalDecks}</dd></div>
    <div><dt>Kích thước</dt><dd>{type.lengthMeters} m × {type.beamMeters} m</dd></div>
    <div><dt>Nhà sản xuất</dt><dd>{type.manufacturerName}</dd></div>
    <div><dt>Động cơ</dt><dd>{type.engineType}</dd></div>
  </dl>
}

export function ShipTypeCatalogPage() {
  const access = useSessionAccess()
  const [input, setInput] = useState('')
  const [q, setQ] = useState('')
  const [status, setStatus] = useState<TypeStatus | undefined>()
  const [page, setPage] = useState(0)
  const load = useCallback((signal: AbortSignal) => shipTypesApi.list(page, q, status, signal), [page, q, status])
  const result = useReadQuery('type-catalog:' + [page, q, status, access.userId].join(':'), load)
  return <AdminShell><div className={styles.stack}>
    <PageHeader breadcrumb="Cấu hình tàu / Loại tàu" title="Quản lý loại tàu"
      actions={<ButtonLink to="/admin/ship-types/new">Thêm loại tàu</ButtonLink>} />
    <Panel>
      <form className={styles.filters} role="search" onSubmit={event => { event.preventDefault(); setQ(input.trim()); setPage(0) }}>
        <Field htmlFor="type-search" label="Tìm theo tên hoặc mã loại"><input type="search" value={input} onChange={event => setInput(event.target.value)} /></Field>
        <Field htmlFor="type-filter" label="Trạng thái"><select value={status ?? ''} onChange={event => {
          setStatus((event.target.value || undefined) as TypeStatus | undefined); setPage(0)
        }}><option value="">Tất cả trạng thái</option><option value="ACTIVE">Đang sử dụng</option><option value="INACTIVE">Ngừng sử dụng</option></select></Field>
        <Button type="submit" tone="secondary" autoWidth>Tìm</Button>
      </form>
    </Panel>
    {result.loading && <Loading label="Đang tải danh sách loại tàu…" />}
    {result.error && <Notice title="Chưa tải được danh sách loại tàu" tone="error">{shipError(result.error)} <Button tone="text" onClick={result.retry}>Thử lại</Button></Notice>}
    {result.data && <Panel title="Danh sách loại tàu">
      {result.data.content.length ? <DataTable label="Danh sách loại tàu"
        headers={['Mã loại', 'Tên loại', 'Sức chứa', 'Số boong', 'Phiên bản mô hình', 'Số tàu', 'Trạng thái', '']}>
        {result.data.content.map(type => <tr key={type.shipTypeId}>
          <td>{type.code}</td><th scope="row">{type.name}</th>
          <td className={styles.number}>{type.totalCapacity.toLocaleString('vi-VN')}</td><td className={styles.number}>{type.totalDecks}</td>
          <td className={styles.version}>{type.assetVersion}</td><td className={styles.number}>{type.shipCount}</td>
          <td><TypeStatusBadge status={type.status} /></td>
          <td><PermissionLink to={'/admin/ship-types/' + type.shipTypeId} aria-label={'Chi tiết loại tàu ' + type.name}>Chi tiết</PermissionLink></td>
        </tr>)}
      </DataTable> : <Empty title={q || status ? 'Không tìm thấy loại tàu phù hợp' : 'Chưa có loại tàu'}>
        {q || status ? <Button tone="text" onClick={() => { setInput(''); setQ(''); setStatus(undefined); setPage(0) }}>Xóa bộ lọc</Button> : 'Thêm loại tàu từ gói mô hình đã xác minh.'}
      </Empty>}
      <PageControls page={result.data} label="loại tàu" onPage={setPage} />
    </Panel>}
  </div></AdminShell>
}

function TypeVessels({ id }: { id: string }) {
  const [page, setPage] = useState(0)
  const load = useCallback((signal: AbortSignal) => shipTypesApi.ships(id, page, signal), [id, page])
  const result = useReadQuery('type-ships:' + id + ':' + page, load)
  return <Panel title="Tàu thuộc loại">
    {result.loading && <Loading label="Đang tải tàu thuộc loại…" />}
    {result.error && <Notice title="Chưa tải được danh sách tàu" tone="error">{shipError(result.error)} <Button tone="text" onClick={result.retry}>Thử lại</Button></Notice>}
    {result.data?.content.length ? <DataTable label="Tàu thuộc loại" headers={['Mã tàu', 'Tên tàu', 'Trạng thái', '']}>
      {result.data.content.map(ship => <tr key={ship.shipId}><td>{ship.shipCode}</td><th scope="row">{ship.shipName}</th>
        <td><StatusBadge status={ship.status} /></td>
        <td><PermissionLink to={'/admin/ships/' + ship.shipId} aria-label={'Chi tiết tàu ' + ship.shipName}>Chi tiết</PermissionLink></td>
      </tr>)}
    </DataTable> : result.data && <Empty title="Chưa có tàu trong phạm vi xem" />}
    {result.data && <PageControls page={result.data} label="tàu" onPage={setPage} />}
  </Panel>
}

function TypeDetail({ id }: { id: string }) {
  const access = useSessionAccess()
  const admin = access.roles.includes('ADMIN')
  const canPreview = admin && access.canDo('SHIP_CREATE') && access.canDo('SHIP_MODEL_CREATE') && access.canDo('SHIP_MODEL_READ')
  const [previewOpen, setPreviewOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const load = useCallback((signal: AbortSignal) => shipTypesApi.detail(id, signal), [id])
  const result = useReadQuery('type-detail:' + id, load)
  const type = result.data
  async function changeStatus(current: ShipType) {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      await shipTypesApi.setStatus(id, current.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE')
      result.retry()
    } catch (failure) {
      setError(shipError(failure))
    } finally {
      setBusy(false)
    }
  }
  return <div className={styles.stack}>
    <PageHeader title={type?.name ?? 'Chi tiết loại tàu'} breadcrumb="Cấu hình tàu / Loại tàu / Chi tiết"
      actions={type && (admin ? <ButtonLink to={'/admin/ship-types/' + id + '/edit'}>Thay phiên bản mô hình</ButtonLink>
        : type.status === 'ACTIVE' && access.canDo('SHIP_READ') &&
          <ButtonLink to={'/admin/ships/new?type=' + id}>Thêm tàu từ loại này</ButtonLink>)} />
    {admin && <PermissionLink to="/admin/ship-types">Danh sách loại tàu</PermissionLink>}
    {result.loading && <Loading />}
    {result.error && <Notice title="Chưa tải được loại tàu" tone="error">{shipError(result.error)} <Button tone="text" onClick={result.retry}>Thử lại</Button></Notice>}
    {error && <Notice title="Chưa cập nhật được trạng thái" tone="error">{error}</Notice>}
    {type && <>
      <Panel title="Thông số thiết kế">
        <DesignFacts type={type} />
        <div className={styles.actions}><TypeStatusBadge status={type.status} />
          {admin && <Button busy={busy} tone="secondary" onClick={() => void changeStatus(type)}>
            {type.status === 'ACTIVE' ? 'Ngừng sử dụng loại' : 'Bật sử dụng loại'}
          </Button>}
        </div>
      </Panel>
      <Panel title="Phiên bản mô hình">
        <DesignVersionFacts design={type} />
        {canPreview && <div className={styles.actions}><Button tone="secondary" aria-expanded={previewOpen} onClick={() => setPreviewOpen(value => !value)}>
          {previewOpen ? 'Đóng xem trước' : 'Xem trước mô hình 3D'}
        </Button></div>}
        {previewOpen && canPreview && <DesignPreview design={type} />}
      </Panel>
      {access.canDo('SHIP_READ') && <TypeVessels id={id} />}
    </>}
  </div>
}

export function ShipTypeDetailPage() {
  const { typeId = '' } = useParams()
  return <AdminShell><TypeDetail id={typeId} key={typeId} /></AdminShell>
}
