import { useCallback, useRef, useState } from 'react'
import { useSessionAccess } from '@/shared/auth'
import { useReadQuery } from '@/shared/api'
import { Button, Empty, Field, Loading, Modal, Notice, PageHeader, Panel } from '@/shared/ui'
import { geographyApi, type GeographyItem } from '../api/geography'
import styles from '../Planning.module.css'

export function GeographyPage() {
  const access = useSessionAccess()
  const allowed = access.status === 'ready' && access.roles.includes('CRUISE_MANAGER')
  const list = useReadQuery(`geography:${access.userId}:${allowed}`, useCallback(signal => allowed ? geographyApi.list(signal) : Promise.resolve(null), [allowed]))
  const countries = useReadQuery(`geography-countries:${access.userId}:${allowed}`, useCallback(signal => allowed ? geographyApi.countries(signal) : Promise.resolve(null), [allowed]))
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('')
  const [countryCode, setCountryCode] = useState('')
  const [adding, setAdding] = useState(false)
  const [target, setTarget] = useState<GeographyItem | null>(null)
  const [targetStatus, setTargetStatus] = useState<GeographyItem['status']>('ACTIVE')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [uncertain, setUncertain] = useState(false)
  const lock = useRef(false)

  if (!allowed) return <Notice title="Không có quyền quản lý phạm vi">Mục này dành cho Quản lý lịch trình.</Notice>
  const availableCountries = countries.data?.filter(country => !list.data?.some(item => item.kind === 'COUNTRY' && item.code === country.code)) ?? []
  const vietnamActive = list.data?.some(item => item.kind === 'COUNTRY' && item.code === 'VN' && item.status === 'ACTIVE')
  const visible = list.data?.filter(item => (!filter || item.status === filter) && `${item.label} ${item.code}`.toLocaleLowerCase('vi').includes(search.trim().toLocaleLowerCase('vi'))) ?? []

  async function reconcile() {
    if (lock.current) return
    lock.current = true
    setBusy(true)
    try {
      await geographyApi.list()
      setUncertain(false)
      setError('')
      list.retry()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Chưa tải lại được danh mục.') }
    finally { lock.current = false; setBusy(false) }
  }

  async function save() {
    if (lock.current || uncertain || !list.data || list.error || list.loading) return
    const country = availableCountries.find(item => item.code === countryCode)
    if (!target && !country) return
    lock.current = true
    setBusy(true)
    setError('')
    setMessage('')
    try {
      if (target) await geographyApi.status(target, targetStatus)
      else await geographyApi.add(country!)
      setMessage(target ? `Đã cập nhật ${target.label}: ${targetStatus === 'ACTIVE' ? 'Đang sử dụng' : 'Ngừng sử dụng'}.` : `Đã thêm ${country!.label} vào phạm vi lập chuyến.`)
      setTarget(null)
      setAdding(false)
      setCountryCode('')
      list.retry()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Chưa xác nhận được thay đổi.')
      setUncertain(true)
      setTarget(null)
    } finally { lock.current = false; setBusy(false) }
  }

  return <>
    <PageHeader breadcrumb="" title="Quản lý phạm vi" description="Chọn quốc gia và miền được phép sử dụng khi lập chuyến. Thay đổi ở đây không thay đổi lịch trình đã lưu."
      actions={<Button autoWidth disabled={busy || uncertain || !list.data || list.loading || Boolean(list.error)} onClick={() => { setAdding(true); setError('') }}>Thêm quốc gia</Button>} />
    {message && <p role="status">{message}</p>}
    {error && <Notice tone="error" title="Chưa xác nhận được thay đổi"><p>{error}</p><Button tone="secondary" disabled={busy} onClick={() => void reconcile()}>Tải lại để kiểm tra</Button></Notice>}
    <Panel>
      <div className={styles.geographyToolbar}>
        <Field htmlFor="geography-search" label="Tìm quốc gia hoặc miền"><input id="geography-search" type="search" value={search} onChange={event => setSearch(event.target.value)} /></Field>
        <Field htmlFor="geography-filter" label="Trạng thái sử dụng"><select id="geography-filter" value={filter} onChange={event => setFilter(event.target.value)}><option value="">Tất cả</option><option value="ACTIVE">Đang sử dụng</option><option value="INACTIVE">Ngừng sử dụng</option></select></Field>
      </div>
      {adding && <Modal title="Thêm quốc gia vào phạm vi lập chuyến" busy={busy} onClose={() => { if (!busy) setAdding(false) }} footer={<><Button tone="secondary" disabled={busy} onClick={() => setAdding(false)}>Hủy</Button><Button type="submit" form="geography-add-country" busy={busy} disabled={!countryCode || uncertain || Boolean(countries.error) || countries.loading}>Thêm quốc gia</Button></>}>
      <form id="geography-add-country" className={styles.geographyAdd} onSubmit={event => { event.preventDefault(); void save() }}>
        {countries.loading && <Loading label="Đang tải danh sách quốc gia…" />}
        {countries.error && <Notice title="Chưa tải được quốc gia" tone="error"><Button tone="secondary" onClick={countries.retry}>Tải lại</Button></Notice>}
        <Field htmlFor="geography-country" label="Quốc gia cần thêm"><select id="geography-country" value={countryCode} disabled={busy || countries.loading || Boolean(countries.error)} onChange={event => setCountryCode(event.target.value)}><option value="">Chọn quốc gia</option>{availableCountries.map(country => <option key={country.code} value={country.code}>{country.label}</option>)}</select></Field>
      </form></Modal>}
      {list.loading && <Loading label="Đang tải phạm vi…" />}
      {list.error && <Notice title="Chưa tải được phạm vi" tone="error"><p>{list.error.message}</p><Button tone="secondary" onClick={list.retry}>Tải lại</Button></Notice>}
      {list.data && !list.loading && !list.error && <>
        {!visible.length && <Empty title="Không có khu vực phù hợp"><Button tone="secondary" onClick={() => { setSearch(''); setFilter('') }}>Xóa bộ lọc</Button></Empty>}
        {(['REGION', 'COUNTRY'] as const).map(kind => {
          const items = visible.filter(item => item.kind === kind)
          return items.length > 0 && <section key={kind} className={styles.geographyGroup}><h2>{kind === 'REGION' ? 'Các miền Việt Nam' : 'Quốc gia'}</h2><ul>{items.map(item => <li key={item.code}>
            <strong>{item.label}</strong><span className={styles.muted}>{item.status === 'ACTIVE' ? 'Đang sử dụng' : 'Ngừng sử dụng'}</span>
            <Button tone="secondary" size="compact" autoWidth disabled={busy || uncertain || item.kind === 'REGION' && !vietnamActive} onClick={() => { setTarget(item); setTargetStatus(item.status); setError('') }}>Chỉnh sửa</Button>
          </li>)}</ul>{kind === 'REGION' && !vietnamActive && <p>Cho phép lựa chọn Việt Nam trước khi sử dụng các miền.</p>}</section>
        })}
      </>}
    </Panel>
    {target && <Modal title={`Chỉnh sửa phạm vi: ${target.label}`} busy={busy} onClose={() => { if (!busy) setTarget(null) }} footer={<><Button tone="secondary" disabled={busy} onClick={() => setTarget(null)}>Hủy</Button><Button busy={busy} disabled={targetStatus === target.status} onClick={() => void save()}>Lưu thay đổi</Button></>}>
      <Field htmlFor="geography-edit-status" label="Trạng thái" hint="Áp dụng cho danh sách lựa chọn khi lập chuyến. Các lịch trình đã lưu được giữ nguyên."><select id="geography-edit-status" value={targetStatus} disabled={busy} onChange={event => setTargetStatus(event.target.value as GeographyItem['status'])}><option value="ACTIVE">Đang sử dụng</option><option value="INACTIVE">Ngừng sử dụng</option></select></Field>
      {target.kind === 'COUNTRY' && target.code === 'VN' && targetStatus !== target.status && <p>{targetStatus === 'INACTIVE' ? 'Các miền Việt Nam cũng sẽ chuyển sang Ngừng sử dụng.' : 'Sau khi sử dụng lại Việt Nam, chỉnh sửa trạng thái từng miền cần khai thác.'}</p>}
    </Modal>}
  </>
}
