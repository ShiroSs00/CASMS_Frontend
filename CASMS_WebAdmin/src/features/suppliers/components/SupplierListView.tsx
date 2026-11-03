import { PermissionLink as Link } from '@/shared/ui'

import { Badge, Button, CollectionSummary, DataTable, Empty, Field, ListFilters, ListFooter, Loading, Notice, Panel } from '@/shared/ui'
import { supplierStatusLabels, supplierUpdatedDate, supplierVerificationLabels, type SupplierFilters, type SupplierListItem } from '../model/supplier-list'
import styles from './SupplierList.module.css'

type Props = {
  rows: readonly SupplierListItem[]
  filters: SupplierFilters
  totalCount: number
  loading?: boolean
  error?: string | null
  onFiltersChange: (value: SupplierFilters) => void
  onReset: () => void
  onRetry?: () => void
}

export function SupplierListView({ rows, filters, totalCount, loading = false, error, onFiltersChange, onReset, onRetry }: Props) {
  const filtered = Boolean(filters.search || filters.status !== 'ALL' || filters.verification !== 'ALL')
  return <>
    <CollectionSummary count={loading || error ? null : totalCount} visible={rows.length} filtered={filtered} label="Đối tác đã tải" />
    <Panel title="Bộ lọc">
      <ListFilters label="Bộ lọc nhà cung cấp" actions={<Button tone="secondary" disabled={!filtered} onClick={onReset}>Xóa bộ lọc</Button>}>
        <Field htmlFor="supplier-search" label="Tìm kiếm"><input id="supplier-search" type="search" placeholder="Tên, loại hoặc thông tin liên hệ" value={filters.search} onChange={event => onFiltersChange({ ...filters, search: event.target.value })} /></Field>
        <Field htmlFor="supplier-status" label="Trạng thái"><select id="supplier-status" value={filters.status} onChange={event => onFiltersChange({ ...filters, status: event.target.value as SupplierFilters['status'] })}>
          <option value="ALL">Tất cả trạng thái</option>{Object.entries(supplierStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select></Field>
        <Field htmlFor="supplier-verification" label="Xác minh"><select id="supplier-verification" value={filters.verification} onChange={event => onFiltersChange({ ...filters, verification: event.target.value as SupplierFilters['verification'] })}>
          <option value="ALL">Tất cả trạng thái xác minh</option>{Object.entries(supplierVerificationLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select></Field>
      </ListFilters>
    </Panel>
    <Panel title="Danh sách nhà cung cấp">
      {loading ? <Loading label="Đang tải nhà cung cấp…" /> : error ? <Notice title="Không tải được nhà cung cấp" tone="error"><p>{error}</p>{onRetry && <Button tone="secondary" onClick={onRetry}>Thử lại</Button>}</Notice> : rows.length ? <>
        <DataTable label="Danh sách nhà cung cấp" headers={['Nhà cung cấp', 'Loại', 'Liên hệ', 'Trạng thái', 'Xác minh', 'Cập nhật', 'Thao tác']}>
          {rows.map(row => <tr key={row.id}>
            <td><Link className={styles.name} to={`/admin/suppliers/${row.id}`}>{row.supplierName}</Link></td>
            <td><span className={styles.type}>{row.supplierType || 'Chưa phân loại'}</span></td>
            <td><div className={styles.contact}>
              {row.contactName && <strong>{row.contactName}</strong>}
              {row.contactEmail && <span>{row.contactEmail}</span>}
              {row.contactPhone && <span>{row.contactPhone}</span>}
              {!row.contactName && !row.contactEmail && !row.contactPhone && <span>Chưa có thông tin</span>}
            </div></td>
            <td><Badge label={supplierStatusLabels[row.status]} tone={row.status === 'ACTIVE' ? 'success' : 'neutral'} /></td>
            <td><Badge label={supplierVerificationLabels[row.verificationStatus]} tone={row.verificationStatus === 'VERIFIED' ? 'success' : row.verificationStatus === 'REJECTED' ? 'error' : 'warning'} /></td>
            <td><time className={styles.date} dateTime={row.updatedAt}>{supplierUpdatedDate(row.updatedAt)}</time></td>
            <td><Link className={styles.rowAction} to={`/admin/suppliers/${row.id}`} aria-label={`Xem chi tiết ${row.supplierName}`}>Chi tiết →</Link></td>
          </tr>)}
        </DataTable>
      </> : <Empty title={totalCount ? 'Không tìm thấy nhà cung cấp phù hợp' : 'Chưa có nhà cung cấp'}>
        <p>{totalCount ? 'Thử thay đổi từ khóa hoặc xóa bộ lọc.' : 'Nhà cung cấp mới sẽ xuất hiện tại đây.'}</p>
        {filtered && <Button tone="secondary" onClick={onReset}>Xóa bộ lọc</Button>}
      </Empty>}
      {!loading && !error && <ListFooter summary={filtered ? `${rows.length} / ${totalCount} nhà cung cấp` : `${totalCount} nhà cung cấp`} />}
    </Panel>
  </>
}