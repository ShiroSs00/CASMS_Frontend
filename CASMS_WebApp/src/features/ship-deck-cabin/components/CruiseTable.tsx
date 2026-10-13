import { DataTable, Empty } from '@/shared/ui'
import { formatDate, type CruisePreview } from '../model/types'

export function CruiseTable({ rows }: { rows: CruisePreview[] }) {
  return rows.length ? <DataTable label="Các chuyến bị ảnh hưởng" headers={['MÃ CHUYẾN', 'HÀNH TRÌNH', 'THỜI GIAN', 'TRẠNG THÁI']}>
    {rows.map((row) => <tr key={row.id}><td>{row.code}</td><td>{row.name}</td><td>{formatDate(row.departure)} → {formatDate(row.returnAt)}</td><td>{row.status}</td></tr>)}
  </DataTable> : <Empty title="Không có chuyến bị ảnh hưởng trong khoảng thời gian đã chọn" />
}
