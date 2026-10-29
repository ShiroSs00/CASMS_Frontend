import { EditorLayout } from '@/shared/ui'
import { PermissionLink as Link } from '@/shared/ui'
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router'
import { useReadQuery } from '@/shared/api'
import { useSessionAccess } from '@/shared/auth'

import { Badge, Button, Field, Loading, Notice, PageHeader, Panel } from '@/shared/ui'

import { AdminFrame } from '../components/AdminFrame'
import { operationalIssuesApi } from '../api/operational-issues-api'
import { issueLocationApi, validateIssueLocation } from '../api/location-lookup-api'
import { ISSUE_SEVERITIES, ISSUE_TYPES, type IssueSeverity, type IssueType, type OperationalIssue } from '../model/issue'
import styles from '../components/OperationalIssues.module.css'

type FormData = {
  shipId: string
  cruiseId: string
  cabinId: string
  issueType: IssueType
  severity: IssueSeverity
  description: string
}

const initialForm: FormData = {
  shipId: '',
  cruiseId: '',
  cabinId: '',
  issueType: 'OPERATIONAL',
  severity: 'MEDIUM',
  description: '',
}

export function IssueFormPage() {
  const access = useSessionAccess()
  const { issueId } = useParams()
  const isEdit = Boolean(issueId)
  const navigate = useNavigate()

  const [form, setForm] = useState<FormData>(initialForm)
  const [existingIssue, setExistingIssue] = useState<OperationalIssue | null>(null)
  const [loading, setLoading] = useState(isEdit)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const lock = useRef(false)
  const ships = useReadQuery('issue-ships', issueLocationApi.ships)
  const cruises = useReadQuery('issue-cruises', issueLocationApi.cruises)
  const cabins = useReadQuery(`issue-cabins:${form.shipId}`, useCallback(signal => form.shipId ? issueLocationApi.cabinsForShip(form.shipId, signal) : Promise.resolve([]), [form.shipId]))
  const contextReady = !ships.loading && !ships.error
    && (!form.cruiseId || (!cruises.loading && !cruises.error))
    && (!form.cabinId || (!cabins.loading && !cabins.error))

  useEffect(() => {
    if (!issueId) return
    let active = true
    void operationalIssuesApi.detail(issueId)
      .then((issue) => {
        if (!active) return
        setExistingIssue(issue)
        setForm({
          shipId: issue.ship.id,
          cruiseId: issue.cruise?.id ?? '',
          cabinId: issue.cabin ?? '',
          issueType: issue.type,
          severity: issue.severity,
          description: issue.description,
        })
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof Error ? err.message : 'Không tải được chi tiết sự cố.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [issueId])

  const isBlockedEdit = isEdit && (!existingIssue || existingIssue.id !== issueId || existingIssue.status !== 'OPEN')
  const allowed = access.canDo(isEdit ? 'OPERATIONAL_ISSUE_UPDATE' : 'OPERATIONAL_ISSUE_CREATE')

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (lock.current || isBlockedEdit || !allowed) return

    const locationError = !isEdit ? validateIssueLocation(form.shipId, form.cruiseId, form.cabinId, contextReady ? { ships: ships.data ?? [], cruises: cruises.data ?? [], cabins: cabins.data ?? [] } : null) : ''
    if (locationError) { setError(locationError); return }
    if (!form.description.trim()) {
      setError('Vui lòng nhập mô tả sự cố.')
      return
    }

    lock.current = true
    setBusy(true)
    setError('')

    try {
      if (isEdit && issueId) {
        const updated = await operationalIssuesApi.update(issueId, {
          severity: form.severity,
          description: form.description.trim(),
        })
        navigate(`/admin/issues/${updated.id}`)
      } else {
        const created = await operationalIssuesApi.create({
          shipId: form.shipId.trim(),
          cruiseId: form.cruiseId.trim() || null,
          cabinId: form.cabinId.trim() || null,
          issueType: form.issueType,
          severity: form.severity,
          description: form.description.trim(),
        })
        navigate(`/admin/issues/${created.id}`)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Thao tác không thành công.')
    } finally {
      lock.current = false
      setBusy(false)
    }
  }

  return (
    <AdminFrame>
      <PageHeader
        breadcrumb="SỰ CỐ VẬN HÀNH"
        title={isEdit ? `Chỉnh sửa sự cố ${existingIssue ? existingIssue.code : ''}` : 'Báo cáo sự cố mới'}

        actions={
          <Link className={styles.secondaryButton} to={isEdit && issueId ? `/admin/issues/${issueId}` : '/admin/issues'}>
            Hủy và quay lại
          </Link>
        }
      />

      {loading && <Loading label="Đang tải dữ liệu sự cố…" />}

      {!allowed && <Notice title="Chưa có quyền lưu sự cố" tone="warning">{access.status === 'loading' ? 'Đang tải quyền tài khoản…' : access.error || 'Tài khoản chưa có quyền thực hiện thao tác này.'}</Notice>}
      {!isEdit && [ships, cruises, cabins].some(query => query.loading) && <Loading label="Đang tải danh mục tàu, chuyến và cabin…" />}
      {!isEdit && ships.data?.length === 0 && <Notice title="Chưa có tàu để gắn sự cố">Cần có tàu trong danh mục trước khi báo cáo sự cố. <Link to="/admin/ships">Mở danh mục tàu</Link></Notice>}
      {!isEdit && [ships, cruises, cabins].map((query, index) => query.error && <Notice key={index} title={`Không tải được ${['tàu', 'chuyến', 'cabin'][index]}`} tone="error">{query.error.message}<Button onClick={query.retry}>Thử lại</Button></Notice>)}
      {error && (
        <Notice title="Lỗi thao tác" tone="error">
          <p>{error}</p>
        </Notice>
      )}

      {isBlockedEdit && (
        <Notice title="Không thể chỉnh sửa sự cố" tone="warning">
          <p>
            {existingIssue ? <>Sự cố đang ở trạng thái <strong>{existingIssue.status}</strong>. Chỉ có thể chỉnh sửa sự cố đang mở.</> : 'Chưa tải được hồ sơ sự cố để chỉnh sửa.'}
          </p>
          <Link className={styles.primaryButton} to={`/admin/issues/${issueId}`}>Quay lại chi tiết</Link>
        </Notice>
      )}

      {!loading && (!isEdit || !isBlockedEdit) && (
        <EditorLayout ><form onSubmit={handleSubmit}>
          <Panel title="Thông tin cơ bản">
            {isEdit && existingIssue && (
              <div className={styles.readonlySummary}>
                <span>Mã sự cố: <strong>{existingIssue.code}</strong> (chỉ đọc)</span>
                <span>Trạng thái: <Badge label={existingIssue.status} tone="warning" /></span>
                <span>Người báo cáo: <strong>{existingIssue.reportedBy.name}</strong></span>
              </div>
            )}

            <div className={styles.formGrid}>
              <Field htmlFor="issue-type" label="Loại sự cố *">
                <select
                  id="issue-type"
                  disabled={isEdit || busy}
                  value={form.issueType}
                  onChange={(e) => setForm((curr) => ({ ...curr, issueType: e.target.value as IssueType }))}
                >
                  {ISSUE_TYPES.map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </Field>

              <Field htmlFor="issue-severity" label="Mức độ nghiêm trọng *">
                <select
                  id="issue-severity"
                  value={form.severity}
                  onChange={(e) => setForm((curr) => ({ ...curr, severity: e.target.value as IssueSeverity }))}
                >
                  {ISSUE_SEVERITIES.map((sev) => (
                    <option key={sev} value={sev}>{sev}</option>
                  ))}
                </select>
              </Field>

              <Field htmlFor="ship-id" label="Tàu *">
                {isEdit ? <p>{existingIssue?.ship.name || 'Chưa tải được tên tàu'} (không đổi)</p> : <select id="ship-id" required disabled={busy || ships.loading || Boolean(ships.error)} value={form.shipId} onChange={event => setForm(current => ({ ...current, shipId: event.target.value, cruiseId: '', cabinId: '' }))}><option value="">Chọn tàu</option>{ships.data?.map(ship => <option key={ship.shipId} value={ship.shipId}>{ship.shipName} · {ship.shipCode}</option>)}</select>}
              </Field>

              <Field htmlFor="cruise-id" label="Chuyến liên quan (không bắt buộc)">
                {isEdit ? <p>{existingIssue?.cruise?.name || 'Không gắn chuyến'} (không đổi)</p> : <select id="cruise-id" disabled={busy || !form.shipId || cruises.loading || Boolean(cruises.error)} value={form.cruiseId} onChange={event => setForm(current => ({ ...current, cruiseId: event.target.value }))}><option value="">Không gắn chuyến</option>{cruises.data?.filter(cruise => cruise.shipId === form.shipId).map(cruise => <option key={cruise.cruiseId} value={cruise.cruiseId}>{cruise.cruiseName} · {cruise.cruiseCode}</option>)}</select>}
              </Field>

              <Field htmlFor="cabin-id" label="Cabin liên quan (không bắt buộc)">
                {isEdit ? <p>{existingIssue?.cabin ? `Cabin ${existingIssue.cabin}` : 'Không gắn cabin'} (không đổi)</p> : <select id="cabin-id" disabled={busy || !form.shipId || cabins.loading || Boolean(cabins.error)} value={form.cabinId} onChange={event => setForm(current => ({ ...current, cabinId: event.target.value }))}><option value="">Không gắn cabin</option>{cabins.data?.filter(cabin => cabin.shipId === form.shipId).map(cabin => <option key={cabin.cabinId} value={cabin.cabinId}>Cabin {cabin.cabinNumber}</option>)}</select>}
              </Field>
            </div>

            <div style={{ marginTop: '1rem' }}>
              <Field htmlFor="issue-description" label="Mô tả sự cố *">
                <textarea
                  id="issue-description"
                  required
                  rows={4}
                  placeholder="Mô tả chi tiết nguyên nhân, hiện tượng hoặc tác động của sự cố…"
                  value={form.description}
                  onChange={(e) => setForm((curr) => ({ ...curr, description: e.target.value }))}
                />
              </Field>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1.5rem' }}>
              <Button
                type="button"
                tone="secondary"
                disabled={busy}
                onClick={() => navigate(isEdit && issueId ? `/admin/issues/${issueId}` : '/admin/issues')}
              >
                Hủy
              </Button>
              <Button type="submit" disabled={busy || !allowed || isBlockedEdit || (!isEdit && (!contextReady || !ships.data?.length))}>
                {busy ? 'Đang lưu…' : (isEdit ? 'Lưu thay đổi' : 'Tạo sự cố')}
              </Button>
            </div>
          </Panel>
        </form></EditorLayout>
      )}
    </AdminFrame>
  )
}
