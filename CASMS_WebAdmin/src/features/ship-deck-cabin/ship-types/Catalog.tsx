import { useCallback, useRef, useState } from 'react'
import { useParams } from 'react-router'
import { useReadQuery } from '@/shared/api'
import { useSessionAccess } from '@/shared/auth'
import { Badge, Button, ButtonLink, DataTable, Empty, Field, ListFooter, Loading, Modal, Notice, PageHeader, PermissionLink } from '@/shared/ui'
import { AdminShell } from '@/shared/ui/admin-v3'
import { shipTypesApi, shipError, type Page, type ShipType, type TypeStatus } from './api'
import { DesignVersionFacts } from './DesignVersionFacts'
import { manufacturingFields } from './design-metadata'
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
  const clearFilters = () => { setInput(''); setQ(''); setStatus(undefined); setPage(0) }
  return <AdminShell><div className={`${styles.stack} ${styles.designPage}`}>
    <PageHeader breadcrumb="Cấu hình tàu / Loại tàu" title="Quản lý loại tàu"
      description=""
      actions={<ButtonLink to="/admin/ship-types/new">Tạo loại tàu</ButtonLink>} />
    <section aria-label="Bộ lọc loại tàu">
      <form className={styles.catalogFilters} role="search" onSubmit={event => { event.preventDefault(); setQ(input.trim()); setPage(0) }}>
        <Field htmlFor="type-search" label="Tên hoặc mã loại tàu"><input type="search" placeholder="Nhập tên hoặc mã loại tàu" value={input} onChange={event => setInput(event.target.value)} /></Field>
        <Field htmlFor="type-filter" label="Trạng thái"><select value={status ?? ''} onChange={event => {
          setStatus((event.target.value || undefined) as TypeStatus | undefined); setPage(0)
        }}><option value="">Tất cả trạng thái</option><option value="ACTIVE">Đang sử dụng</option><option value="INACTIVE">Ngừng sử dụng</option></select></Field>
        <div className={styles.filterActions}><Button type="submit" tone="secondary" autoWidth>Tìm kiếm</Button>
          {(input || q || status) && <Button tone="text" onClick={clearFilters}>Xóa bộ lọc</Button>}</div>
      </form>
    </section>
    {result.loading && <Loading label="Đang tải danh sách loại tàu…" />}
    {result.error && <Notice title="Chưa tải được danh sách loại tàu" tone="error">{shipError(result.error)} <Button tone="text" onClick={result.retry}>Thử lại</Button></Notice>}
    {result.data && <section className={`${styles.catalogList} ${styles.catalogTable}`} aria-labelledby="type-catalog-heading">
      <div className={styles.listHeading}><h2 id="type-catalog-heading">Danh sách loại tàu</h2><span aria-live="polite">{result.data.totalElements.toLocaleString('vi-VN')} loại tàu</span></div>
      {result.data.content.length > 0 && <p className={styles.tableHint}>Vuốt ngang bảng để xem đầy đủ thông tin.</p>}
      {result.data.content.length ? <DataTable label="Danh sách loại tàu"
        headers={['Mã loại', 'Tên loại tàu', 'Sức chứa (khách)', 'Boong hành khách', 'Số tàu', 'Trạng thái', 'Thao tác']}>
        {result.data.content.map(type => <tr key={type.shipTypeId}>
          <td>{type.code}</td><th scope="row">{type.name}</th>
          <td className={styles.number}>{type.totalCapacity.toLocaleString('vi-VN')}</td><td className={styles.number}>{type.totalDecks}</td>
          <td className={styles.number}>{type.shipCount}</td>
          <td><TypeStatusBadge status={type.status} /></td>
          <td><PermissionLink to={'/admin/ship-types/' + type.shipTypeId} aria-label={'Chi tiết loại tàu ' + type.name}>Chi tiết</PermissionLink></td>
        </tr>)}
      </DataTable> : <Empty title={q || status ? 'Không tìm thấy loại tàu phù hợp' : 'Chưa có loại tàu'}>
        {q || status ? 'Thử đổi từ khóa hoặc xóa bộ lọc để xem thêm kết quả.' : 'Tạo loại tàu từ tệp thiết kế đã được kiểm tra.'}
      </Empty>}
      {result.data.totalPages > 1 && <PageControls page={result.data} label="loại tàu" onPage={setPage} />}
    </section>}
  </div></AdminShell>
}

function TypeVessels({ id }: { id: string }) {
  const [page, setPage] = useState(0)
  const load = useCallback((signal: AbortSignal) => shipTypesApi.ships(id, page, signal), [id, page])
  const result = useReadQuery('type-ships:' + id + ':' + page, load)
  return <section className={`${styles.catalogList} ${styles.typeVessels}`} aria-labelledby="type-vessels-heading">
    <div className={styles.typeVesselsHeading}><div className={styles.shipListTitle}><h2 id="type-vessels-heading">Danh sách tàu cùng loại</h2>{result.data && <span aria-live="polite">{result.data.totalElements.toLocaleString('vi-VN')} tàu</span>}</div>
      <p>Các tàu sử dụng loại tàu này, trong phạm vi bạn được phép xem.</p></div>
    {result.loading && <Loading label="Đang tải danh sách tàu cùng loại…" />}
    {result.error && <Notice title="Chưa tải được danh sách tàu" tone="error">{shipError(result.error)} <Button tone="text" onClick={result.retry}>Thử lại</Button></Notice>}
    {!!result.data?.content.length && <p className={styles.tableHint}>Vuốt ngang bảng để xem đầy đủ thông tin.</p>}
    {result.data?.content.length ? <DataTable label="Danh sách tàu cùng loại" headers={['Mã tàu', 'Tên tàu', 'Trạng thái', 'Thao tác']}>
      {result.data.content.map(ship => <tr key={ship.shipId}><td>{ship.shipCode}</td><th scope="row">{ship.shipName}</th>
        <td><StatusBadge status={ship.status} /></td>
        <td><PermissionLink to={'/admin/ships/' + ship.shipId} aria-label={'Chi tiết tàu ' + ship.shipName}>Xem tàu</PermissionLink></td>
      </tr>)}
    </DataTable> : result.data && <p className={styles.sectionEmpty}>Chưa có tàu cùng loại trong phạm vi xem của bạn.</p>}
    {result.data && result.data.totalPages > 1 && <PageControls page={result.data} label="tàu" onPage={setPage} />}
  </section>
}

function TypeDetail({ id }: { id: string }) {
  const access = useSessionAccess()
  const admin = access.roles.includes('ADMIN')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [statusTarget, setStatusTarget] = useState<TypeStatus | null>(null)
  const [saved, setSaved] = useState(false)
  const saving = useRef(false)
  const load = useCallback((signal: AbortSignal) => shipTypesApi.detail(id, signal), [id])
  const result = useReadQuery('type-detail:' + id, load)
  const type = result.data
  async function changeStatus() {
    if (saving.current || !statusTarget) return
    saving.current = true
    setBusy(true)
    setError('')
    try {
      await shipTypesApi.setStatus(id, statusTarget)
      setStatusTarget(null)
      setSaved(true)
      result.retry()
    } catch (failure) {
      setError(shipError(failure))
    } finally {
      setBusy(false)
      saving.current = false
    }
  }
  return <div className={`${styles.stack} ${styles.designPage}`}>
    <PageHeader title={type?.name ?? 'Chi tiết loại tàu'} breadcrumb="Cấu hình tàu / Loại tàu / Chi tiết"
      actions={<>
        {admin && <ButtonLink to="/admin/ship-types" tone="secondary" autoWidth><span aria-hidden="true">←</span> Về danh sách loại tàu</ButtonLink>}
        {type && (admin ? <ButtonLink to={'/admin/ship-types/' + id + '/edit'} autoWidth>Cập nhật thiết kế</ButtonLink>
        : type.status === 'ACTIVE' && access.canDo('SHIP_READ') &&
          <ButtonLink to={'/admin/ships/new?type=' + id}>Thêm tàu từ loại này</ButtonLink>)}
      </>} />
    {result.loading && <Loading />}
    {result.error && <Notice title="Chưa tải được loại tàu" tone="error">{shipError(result.error)} <Button tone="text" onClick={result.retry}>Thử lại</Button></Notice>}
    {saved && <Notice title="Đã cập nhật trạng thái loại tàu" tone="success">Thông tin đã được lưu.</Notice>}
    {type && <>
      <div className={styles.typeStatusBar}><div><span>Trạng thái sử dụng</span><TypeStatusBadge status={type.status} /></div>
        {admin && <Button tone="secondary" autoWidth onClick={() => { setError(''); setSaved(false); setStatusTarget(type.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE') }}>
          {type.status === 'ACTIVE' ? 'Ngừng sử dụng loại tàu' : 'Bật sử dụng loại tàu'}
        </Button>}
      </div>
      <div className={styles.typeDetailSections}>
        <section aria-labelledby="type-specs-heading"><h2 id="type-specs-heading">Thông số loại tàu</h2><DesignFacts type={type} /></section>
        <section aria-labelledby="type-manufacturing-heading"><h2 id="type-manufacturing-heading">Thông tin đóng tàu</h2>
          {manufacturingFields.some(({ key }) => type.manufacturingMetadata?.[key] != null && type.manufacturingMetadata[key] !== '')
            ? <DesignVersionFacts design={type} showReference={false} />
            : <p className={styles.sectionEmpty}>Tệp thiết kế chưa cung cấp thông tin đóng tàu.</p>}
        </section>
      </div>
      {access.canDo('SHIP_READ') && <TypeVessels id={id} />}
    </>}
    {statusTarget && <Modal title={statusTarget === 'INACTIVE' ? 'Ngừng sử dụng loại tàu?' : 'Bật sử dụng loại tàu?'}
      onClose={() => { if (!saving.current) setStatusTarget(null) }} busy={busy} protectChanges={false}
      footer={<><Button tone="secondary" disabled={busy} onClick={() => setStatusTarget(null)}>Hủy</Button><Button tone={statusTarget === 'INACTIVE' ? 'danger' : 'primary'} busy={busy} onClick={() => void changeStatus()}>Xác nhận</Button></>}>
      <p>Chuyển loại tàu <strong>{type?.name}</strong> sang trạng thái <strong>{statusTarget === 'INACTIVE' ? 'Ngừng sử dụng' : 'Đang sử dụng'}</strong>?</p>
      {error && <Notice title="Chưa cập nhật được trạng thái" tone="error">{error}</Notice>}
    </Modal>}
  </div>
}

export function ShipTypeDetailPage() {
  const { typeId = '' } = useParams()
  return <AdminShell><TypeDetail id={typeId} key={typeId} /></AdminShell>
}
