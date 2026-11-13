import { useCallback, useRef, useState, type FormEvent } from 'react'
import { ApiError, useReadQuery } from '@/shared/api'
import { useSessionAccess } from '@/shared/auth'
import { businessErrorMessage } from '@/shared/api/business-errors'
import { Button, Field, Loading, Notice, Panel, RecordFacts } from '@/shared/ui'
import { itineraryApi } from '../api/itinerary-api'
import type { Port } from '../model/itinerary'

export function PortDestinationLink({ port, onReadback }: { port: Port; onReadback: (port: Port) => void }) {
  const access = useSessionAccess()
  const allowed = access.roles.includes('OPERATIONS_MANAGER') && access.canDo('PORT_UPDATE') && access.has('DESTINATION_READ')
  const [open, setOpen] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [busy, setBusy] = useState(false)
  const lock = useRef(false)
  const read = open && allowed
  const query = useReadQuery(JSON.stringify(['port-destination-link', access.userId, port.portId, read]),
    useCallback(signal => read ? itineraryApi.activeDestinations(signal) : Promise.resolve([]), [read]))
  const options = (query.data ?? []).filter(destination => destination.status === 'ACTIVE' && destination.countryCode === port.countryCode)
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const id = new FormData(event.currentTarget).get('destination')
    if (!allowed || lock.current || query.loading || query.error || id === port.destinationId || !options.some(item => item.destinationId === id) || typeof id !== 'string') return
    lock.current = true
    setBusy(true)
    setError('')
    try {
      await itineraryApi.linkPortDestination(port.portId, id)
      const actual = await itineraryApi.getPort(port.portId)
      if (actual.portId !== port.portId || actual.destinationId !== id) throw new ApiError('Chưa đối chiếu được điểm đến vừa lưu.', 502)
      onReadback(actual)
      setOpen(false)
      setSuccess(true)
    } catch (reason) {
      setError(reason instanceof ApiError ? businessErrorMessage(reason.code, reason.message) : 'Chưa thể liên kết điểm đến.')
    } finally {
      lock.current = false
      setBusy(false)
    }
  }
  return <Panel title="Điểm đến liên kết">
    <RecordFacts entries={[[ 'Điểm đến', port.destinationName ?? (port.destinationId ? 'Chưa đọc được tên' : 'Chưa liên kết') ]]}/>
    {success && <Notice role="status" title="Đã cập nhật điểm đến" tone="success">Thông tin đã được đọc lại từ hệ thống.</Notice>}
    {allowed && !open && <Button tone="secondary" onClick={() => { setOpen(true); setSuccess(false) }}>{port.destinationId ? 'Đổi điểm đến' : 'Liên kết điểm đến'}</Button>}
    {read && <form onSubmit={save}>
      {query.loading && <Loading label="Đang tải điểm đến…"/>}
      {query.error && <Notice tone="error" title="Chưa tải được điểm đến"><Button tone="secondary" onClick={query.retry}>Thử lại</Button></Notice>}
      <Field htmlFor="port-destination" label="Điểm đến" hint="Chọn điểm đến đang hoạt động cùng quốc gia với cảng." error={error || undefined}>
        <select id="port-destination" name="destination" defaultValue="" required disabled={busy || query.loading || Boolean(query.error)}>
          <option value="">Chọn điểm đến</option>{options.filter(item => item.destinationId !== port.destinationId).map(item => <option key={item.destinationId} value={item.destinationId}>{item.destinationName}</option>)}
        </select>
      </Field>
      <Button type="submit" busy={busy} disabled={query.loading || Boolean(query.error) || !options.some(item => item.destinationId !== port.destinationId)}>Lưu liên kết</Button>
      <Button tone="secondary" disabled={busy} onClick={() => { setOpen(false); setError('') }}>Quay lại</Button>
    </form>}
  </Panel>
}
