import { useRef, useState } from 'react'
import { SupplierDetailPage } from '../pages/SupplierDetailPage'

import { Badge, Button, DataTable, Empty, Field, ListFilters, ListFooter, Loading, Modal, Notice, Panel } from '@/shared/ui'
import { supplierStatusLabels, supplierTypeLabels, supplierUpdatedDate, supplierVerificationLabels, type SupplierFilters, type SupplierListItem } from '../model/supplier-list'
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
  const [selected, setSelected] = useState<SupplierListItem|null>(null)
  const changed = useRef(false)
  function closeDetail(){setSelected(null);if(changed.current)onRetry?.();changed.current=false}
  function openDetail(row:SupplierListItem){changed.current=false;setSelected(row)}
  const filtered = Boolean(filters.search || filters.status !== 'ALL' || filters.verification !== 'ALL')
  return <>
    <Panel>
      <div style={{ display: 'grid', gap: '16px' }}>
        <ListFilters label="Bộ lọc nhà cung cấp" actions={filtered ? <Button tone="secondary" onClick={onReset}>Xóa lọc</Button> : undefined}>
          <Field htmlFor="supplier-search" label="Tìm kiếm"><input id="supplier-search" type="search" placeholder="Tên, loại hoặc thông tin liên hệ…" value={filters.search} onChange={event => onFiltersChange({ ...filters, search: event.target.value })} /></Field>
          <Field htmlFor="supplier-status" label="Trạng thái"><select id="supplier-status" value={filters.status} onChange={event => onFiltersChange({ ...filters, status: event.target.value as SupplierFilters['status'] })}>
            <option value="ALL">Tất cả</option>{Object.entries(supplierStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select></Field>
          <Field htmlFor="supplier-verification" label="Xác minh"><select id="supplier-verification" value={filters.verification} onChange={event => onFiltersChange({ ...filters, verification: event.target.value as SupplierFilters['verification'] })}>
            <option value="ALL">Tất cả</option>{Object.entries(supplierVerificationLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select></Field>
        </ListFilters>
        {loading ? <Loading label="Đang tải nhà cung cấp…" /> : error ? <Notice title="Không tải được nhà cung cấp" tone="error"><p>{error}</p>{onRetry && <Button tone="secondary" onClick={onRetry}>Thử lại</Button>}</Notice> : rows.length ? <>
          <DataTable label="Danh sách nhà cung cấp" headers={['Nhà cung cấp', 'Loại', 'Liên hệ', 'Trạng thái', 'Xác minh', 'Cập nhật', 'Thao tác']}>
            {rows.map(row => <tr key={row.id}>
              <td><Button tone="text" autoWidth className={styles.name} onClick={() => openDetail(row)}>{row.supplierName}</Button></td>
              <td><span className={styles.type}>{row.supplierType ? (supplierTypeLabels[row.supplierType] ?? row.supplierType) : 'Chưa phân loại'}</span></td>
              <td><div className={styles.contact}>
                {row.contactName && <strong>{row.contactName}</strong>}
                {row.contactEmail && <span>{row.contactEmail}</span>}
                {row.contactPhone && <span>{row.contactPhone}</span>}
                {!row.contactName && !row.contactEmail && !row.contactPhone && <span>Chưa có thông tin</span>}
              </div></td>
              <td><Badge label={supplierStatusLabels[row.status]} tone={row.status === 'ACTIVE' ? 'success' : 'neutral'} /></td>
              <td><Badge label={supplierVerificationLabels[row.verificationStatus]} tone={row.verificationStatus === 'VERIFIED' ? 'success' : row.verificationStatus === 'REJECTED' ? 'error' : 'warning'} /></td>
              <td><time className={styles.date} dateTime={row.updatedAt}>{supplierUpdatedDate(row.updatedAt)}</time></td>
              <td><Button tone="secondary" size="compact" autoWidth onClick={() => openDetail(row)} aria-label={`Chi tiết ${row.supplierName}`}>Chi tiết</Button></td>
            </tr>)}
          </DataTable>
        </> : <Empty title={totalCount ? 'Không tìm thấy nhà cung cấp phù hợp' : 'Chưa có nhà cung cấp'}>
          {filtered && <Button tone="secondary" onClick={onReset}>Xóa lọc</Button>}
        </Empty>}
        {!loading && !error && rows.length > 0 && <ListFooter summary={filtered ? `${rows.length} / ${totalCount} nhà cung cấp` : `${totalCount} nhà cung cấp`} />}
      </div>
    </Panel>
    {selected && <Modal title={selected.supplierName} large protectChanges={false} onClose={closeDetail} footer={<Button tone="secondary" onClick={closeDetail}>Đóng</Button>}><SupplierDetailPage key={selected.id} recordId={selected.id} embedded onChanged={() => {changed.current=true}} onDeleted={() => {changed.current=true;closeDetail()}} /></Modal>}
  </>
}
