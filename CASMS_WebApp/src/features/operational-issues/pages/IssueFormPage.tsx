import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router'

import { Badge, Button, Field, Loading, Notice, PageHeader, Panel } from '@/shared/ui'

import { AdminFrame } from '../components/AdminFrame'
import { operationalIssuesApi } from '../api/operational-issues-api'
import { ISSUE_SEVERITIES, ISSUE_TYPES, type IssueSeverity, type IssueType, type OperationalIssue } from '../model/issue'
import styles from '../components/OperationalIssues.module.css'

type FormData = {
  issueCode: string
  shipId: string
  cruiseId: string
  cabinId: string
  issueType: IssueType
  severity: IssueSeverity
  description: string
}

const initialForm: FormData = {
  issueCode: '',
  shipId: '',
  cruiseId: '',
  cabinId: '',
  issueType: 'OPERATIONAL',
  severity: 'MEDIUM',
  description: '',
}

export function IssueFormPage() {
  const { issueId } = useParams()
  const isEdit = Boolean(issueId)
  const navigate = useNavigate()

  const [form, setForm] = useState<FormData>(initialForm)
  const [existingIssue, setExistingIssue] = useState<OperationalIssue | null>(null)
  const [loading, setLoading] = useState(isEdit)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const lock = useRef(false)

  useEffect(() => {
    if (!issueId) return
    let active = true
    void operationalIssuesApi.detail(issueId)
      .then((issue) => {
        if (!active) return
        setExistingIssue(issue)
        setForm({
          issueCode: issue.code,
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

  const isBlockedEdit = isEdit && existingIssue && existingIssue.status !== 'OPEN'

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (lock.current || isBlockedEdit) return

    if (!isEdit && !form.issueCode.trim()) {
      setError('Vui lòng nhập mã sự cố.')
      return
    }
    if (!form.shipId.trim()) {
      setError('Vui lòng nhập Ship ID.')
      return
    }
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
          shipId: form.shipId.trim(),
          cruiseId: form.cruiseId.trim() || null,
          cabinId: form.cabinId.trim() || null,
          issueType: form.issueType,
          severity: form.severity,
          description: form.description.trim(),
        })
        navigate(`/admin/issues/${updated.id}`)
      } else {
        const created = await operationalIssuesApi.create({
          issueCode: form.issueCode.trim(),
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
        description={isEdit ? 'Chỉnh sửa thông tin sự cố khi còn ở trạng thái OPEN.' : 'Tạo mới hồ sơ sự cố vận hành phát sinh trên tàu hoặc chuyến đi.'}
        actions={
          <Link className={styles.secondaryButton} to={isEdit && issueId ? `/admin/issues/${issueId}` : '/admin/issues'}>
            Hủy và quay lại
          </Link>
        }
      />

      {loading && <Loading label="Đang tải dữ liệu sự cố…" />}

      {error && !isBlockedEdit && (
        <Notice title="Lỗi thao tác" tone="error">
          <p>{error}</p>
        </Notice>
      )}

      {isBlockedEdit && (
        <Notice title="Không thể chỉnh sửa sự cố" tone="warning">
          <p>
            Sự cố đang ở trạng thái <strong>{existingIssue?.status}</strong>. Backend chỉ cho phép chỉnh sửa sự cố khi ở trạng thái <strong>OPEN</strong>.
          </p>
          <Link className={styles.primaryButton} to={`/admin/issues/${issueId}`}>Quay lại chi tiết</Link>
        </Notice>
      )}

      {!loading && (!isEdit || !isBlockedEdit) && (
        <form onSubmit={handleSubmit}>
          <Panel title="Thông tin cơ bản">
            {isEdit && existingIssue && (
              <div style={{ marginBottom: '1.5rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
                <span>Mã sự cố: <strong>{existingIssue.code}</strong> (chỉ đọc)</span>
                <span>Trạng thái: <Badge label={existingIssue.status} tone="warning" /></span>
                <span>Người báo cáo: <strong>{existingIssue.reportedBy.name}</strong></span>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
              {!isEdit && (
                <Field htmlFor="issue-code" label="Mã sự cố *">
                  <input
                    id="issue-code"
                    required
                    maxLength={30}
                    placeholder="VD: ISS-101"
                    value={form.issueCode}
                    onChange={(e) => setForm((curr) => ({ ...curr, issueCode: e.target.value }))}
                  />
                </Field>
              )}

              <Field htmlFor="issue-type" label="Loại sự cố *">
                <select
                  id="issue-type"
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

              <Field htmlFor="ship-id" label="Ship ID *">
                <input
                  id="ship-id"
                  required
                  placeholder="UUID tàu"
                  value={form.shipId}
                  onChange={(e) => setForm((curr) => ({ ...curr, shipId: e.target.value }))}
                />
              </Field>

              <Field htmlFor="cruise-id" label="Cruise ID (không bắt buộc)">
                <input
                  id="cruise-id"
                  placeholder="UUID chuyến đi"
                  value={form.cruiseId}
                  onChange={(e) => setForm((curr) => ({ ...curr, cruiseId: e.target.value }))}
                />
              </Field>

              <Field htmlFor="cabin-id" label="Cabin ID (không bắt buộc)">
                <input
                  id="cabin-id"
                  placeholder="UUID phòng / cabin"
                  value={form.cabinId}
                  onChange={(e) => setForm((curr) => ({ ...curr, cabinId: e.target.value }))}
                />
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
              <Button type="submit" disabled={busy}>
                {busy ? 'Đang lưu…' : (isEdit ? 'Lưu thay đổi' : 'Tạo sự cố')}
              </Button>
            </div>
          </Panel>
        </form>
      )}
    </AdminFrame>
  )
}
