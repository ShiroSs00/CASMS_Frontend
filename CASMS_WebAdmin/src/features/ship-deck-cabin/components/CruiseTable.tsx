import { DataTable, Empty } from '@/shared/ui'
import { formatDate, type CruisePreview } from '../model/types'

export function CruiseTable({ rows, label = 'Các chuyến bị ảnh hưởng' }: { rows: CruisePreview[]; label?: string }) {
  return rows.length ? <DataTable label={label} headers={['MÃ CHUYẾN', 'HÀNH TRÌNH', 'THỜI GIAN', 'TRẠNG THÁI']}>
    {rows.map((row) => <tr key={row.id}><td>{row.code}</td><td>{row.name}</td><td>{formatDate(row.departure)} → {formatDate(row.returnAt)}</td><td>{row.status}</td></tr>)}
  </DataTable> : <Empty title="Không có chuyến bị ảnh hưởng trong khoảng thời gian đã chọn" />
}
