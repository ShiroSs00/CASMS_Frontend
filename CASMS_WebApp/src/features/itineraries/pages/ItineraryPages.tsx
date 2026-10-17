import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router'

import { Button, ButtonLink, DataTable, Empty, Field, Loading, Notice, PageHeader, Panel } from '@/shared/ui'

import { itineraryApi } from '../api/itinerary-api'
import { ItineraryFrame, ItineraryStatusBadge } from '../components/ItineraryUI'
import styles from '../components/Itineraries.module.css'
import type { ItineraryDraft, ItineraryType } from '../model/itinerary'

const EMPTY_DRAFT: ItineraryDraft = {
  cruiseId: '', itineraryName: '', startDate: '', endDate: '', itineraryType: 'ROUND_TRIP',
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}

export function ItineraryListPage() {
  const [page, setPage] = useState(1)
  const [data, setData] = useState<Awaited<ReturnType<typeof itineraryApi.list>> | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const load = useCallback(() => {
    const controller = new AbortController()
    setLoading(true)
    setError('')
    void itineraryApi.list(page, controller.signal).then(setData).catch((reason: unknown) => setError(errorMessage(reason, 'Không tải được lịch trình.'))).finally(() => setLoading(false))
    return () => controller.abort()
  }, [page])
  useEffect(() => {
    const controller = new AbortController()
    let active = true
    void itineraryApi.list(page, controller.signal).then((result) => { if (active) setData(result) }).catch((reason: unknown) => { if (active) setError(errorMessage(reason, 'Không tải được lịch trình.')) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false; controller.abort() }
  }, [page])

  return <ItineraryFrame>
    <PageHeader breadcrumb="VẬN HÀNH / LỊCH TRÌNH" title="Lịch trình hải trình" description="Thiết kế ngày đi biển, điểm dừng và luồng phê duyệt cho từng cruise." actions={<ButtonLink to="/admin/itineraries/new">Tạo lịch trình</ButtonLink>} />
    <Panel title="Danh sách lịch trình" subtitle="Mỗi cruise chỉ có một itinerary theo hợp đồng backend.">
      {loading && <Loading label="Đang tải lịch trình…" />}
      {error && <Notice title="Không tải được dữ liệu" tone="error"><p>{error}</p><Button onClick={load}>Thử lại</Button></Notice>}
      {!loading && data && !data.items.length && <Empty title="Chưa có lịch trình" />}
      {!loading && data?.items.length ? <><DataTable label="Danh sách lịch trình" headers={['Lịch trình', 'Cruise', 'Khoảng ngày', 'Loại', 'Trạng thái', '']}>
        {data.items.map((item) => <tr key={item.itineraryId}><td><strong>{item.itineraryName}</strong></td><td>{item.cruiseId}</td><td>{item.startDate} → {item.endDate}</td><td>{item.itineraryType}</td><td><ItineraryStatusBadge status={item.status} /></td><td><Link className={styles.link} to={`/admin/itineraries/${item.itineraryId}`}>Mở →</Link></td></tr>)}
      </DataTable><div className={styles.pager}><span>{data.total} lịch trình</span><div><Button tone="secondary" disabled={page <= 1} onClick={() => { setLoading(true); setPage((value) => value - 1) }}>Trước</Button> <Button tone="secondary" disabled={page >= data.pageCount} onClick={() => { setLoading(true); setPage((value) => value + 1) }}>Sau</Button></div></div></> : null}
    </Panel>
  </ItineraryFrame>
}

export function ItineraryFormPage() {
  const { itineraryId } = useParams()
  const editing = Boolean(itineraryId)
  const navigate = useNavigate()
  const [draft, setDraft] = useState<ItineraryDraft>(EMPTY_DRAFT)
  const [editableId, setEditableId] = useState<string | null>(null)
  const submitLock = useRef(false)
  const canSave = !editing || editableId === itineraryId
  const [loading, setLoading] = useState(editing)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!itineraryId) return
    const controller = new AbortController()
    void itineraryApi.get(itineraryId, controller.signal).then((item) => {
      setDraft({ cruiseId: item.cruiseId, itineraryName: item.itineraryName, startDate: item.startDate, endDate: item.endDate, itineraryType: item.itineraryType, createdByUserId: item.createdByUserId ?? undefined })
      if (item.status === 'DRAFT') setEditableId(item.itineraryId)
      else setError('Chỉ lịch trình ở trạng thái DRAFT mới được chỉnh sửa thông tin.')
    }).catch((reason: unknown) => setError(errorMessage(reason, 'Không tải được lịch trình.'))).finally(() => setLoading(false))
    return () => controller.abort()
  }, [itineraryId])

  function update<K extends keyof ItineraryDraft>(key: K, value: ItineraryDraft[K]) { setDraft((current) => ({ ...current, [key]: value })) }
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (submitLock.current || !canSave) return
    setError('')
    if (!draft.cruiseId.trim() || !draft.itineraryName.trim() || !draft.startDate || !draft.endDate || draft.endDate <= draft.startDate) { setError('Nhập đủ cruise, tên và khoảng ngày; ngày kết thúc phải sau ngày bắt đầu.'); return }
    submitLock.current = true
    setBusy(true)
    try {
      const payload: ItineraryDraft = {
        ...draft,
        createdByUserId: draft.createdByUserId?.trim() || undefined,
      }
      const saved = editing && itineraryId ? await itineraryApi.update(itineraryId, draft) : await itineraryApi.create(payload)
      navigate(`/admin/itineraries/${saved.itineraryId}`)
    } catch (reason) { setError(errorMessage(reason, 'Không lưu được lịch trình.')) } finally { submitLock.current = false; setBusy(false) }
  }

  return <ItineraryFrame>
    <PageHeader breadcrumb="VẬN HÀNH / LỊCH TRÌNH" title={editing ? 'Chỉnh sửa lịch trình' : 'Tạo lịch trình'} description="Tạo khung thời gian trước, sau đó cấu hình từng ngày và điểm dừng trong trình biên tập." />
    {loading ? <Loading label="Đang tải biểu mẫu…" /> : <form onSubmit={submit} noValidate><Panel title="Thông tin lịch trình">
      <div className={styles.formGrid}>
        <Field htmlFor="itinerary-cruise" label="Cruise ID"><input id="itinerary-cruise" value={draft.cruiseId} disabled={editing} onChange={(event) => update('cruiseId', event.target.value)} required /></Field>
        <Field htmlFor="itinerary-name" label="Tên lịch trình"><input id="itinerary-name" maxLength={200} value={draft.itineraryName} onChange={(event) => update('itineraryName', event.target.value)} required /></Field>
        <Field htmlFor="itinerary-start" label="Ngày bắt đầu"><input id="itinerary-start" type="date" value={draft.startDate} onChange={(event) => update('startDate', event.target.value)} required /></Field>
        <Field htmlFor="itinerary-end" label="Ngày kết thúc"><input id="itinerary-end" type="date" value={draft.endDate} onChange={(event) => update('endDate', event.target.value)} required /></Field>
        <Field htmlFor="itinerary-type" label="Loại hành trình"><select id="itinerary-type" value={draft.itineraryType} onChange={(event) => update('itineraryType', event.target.value as ItineraryType)}><option value="ROUND_TRIP">Khứ hồi</option><option value="ONE_WAY">Một chiều</option></select></Field>
        <Field htmlFor="itinerary-author" label="Người tạo (UUID)"><input id="itinerary-author" disabled={editing} value={draft.createdByUserId ?? ''} onChange={(event) => update('createdByUserId', event.target.value || undefined)} placeholder="Nhập UUID người tạo (tùy chọn)" /></Field>
      </div>
      {error && <Notice title="Chưa thể lưu" tone="error"><p>{error}</p></Notice>}
      <div className={styles.actions}><Button tone="secondary" disabled={busy} onClick={() => navigate(editing && itineraryId ? `/admin/itineraries/${itineraryId}` : '/admin/itineraries')}>Hủy</Button><Button type="submit" disabled={busy || !canSave}>{busy ? 'Đang lưu…' : 'Lưu lịch trình'}</Button></div>
    </Panel></form>}
  </ItineraryFrame>
}


export { ItineraryDetailPage } from './ItineraryDetailPage'
