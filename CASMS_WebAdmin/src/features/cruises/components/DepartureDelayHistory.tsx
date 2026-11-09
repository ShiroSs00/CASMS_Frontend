import { useCallback } from 'react'
import { useReadQuery } from '@/shared/api'
import { DataTable, Empty, Panel, RecordFacts } from '@/shared/ui'
import { journeyTime } from '@/shared/lib/journey-time'
import { departureApi } from '../api/departure-api'
import { ReadState } from './DepartureData'

export function DepartureDelayHistory({ id, userId, refreshKey }: { id: string; userId: string; refreshKey: number }) {
  const query = useReadQuery(`departure-delay-history:${userId}:${id}:${refreshKey}`,
    useCallback(signal => departureApi.delayHistory(id, signal), [id]))
  const data = query.data
  return <Panel title="Lịch sử dời giờ khởi hành" subtitle="Các mốc giờ hiển thị theo giờ Việt Nam.">
    <ReadState {...query} />
    {data && <>
      <RecordFacts entries={[
        ['Giờ ban đầu', data.originalDeparture ? journeyTime(data.originalDeparture) : 'Chưa xác định'],
        ['Giờ dự kiến hiện tại', data.expectedDeparture ? journeyTime(data.expectedDeparture) : 'Chưa xác định'],
        ['Giờ thực tế', data.actualDeparture ? journeyTime(data.actualDeparture) : 'Chưa ghi nhận'],
        ['Tổng thời gian dời', `${data.totalDelayMinutes} phút`],
      ]} />
      {data.events.length ? <DataTable label="Các lần dời giờ đã xác nhận" headers={['Thời điểm ghi nhận', 'Số phút', 'Nhóm lý do', 'Lý do']}>
        {data.events.map(event => <tr key={event.eventId}>
          <td>{journeyTime(event.createdAt)}</td><td>{event.delayMinutes}</td><td>{event.category}</td><td>{event.reason}</td>
        </tr>)}
      </DataTable> : <Empty title="Chưa có lần dời giờ nào" />}
    </>}
  </Panel>
}
