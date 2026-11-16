import { useCallback, useState } from 'react'
import { ApiError, apiRequest, useReadQuery } from '@/shared/api'
import { useSessionAccess } from '@/shared/auth'
import { journeyTime } from '@/shared/lib/journey-time'
import { Button, DataTable, Empty, Field, Loading, Modal, Notice, Panel } from '@/shared/ui'
import styles from './Cruises.module.css'

const root = '/cruise-preparation-reviews'
const statuses = { SUBMITTED: 'Chờ xác nhận', CONFIRMED: 'Đã xác nhận', RETURNED: 'Cần bổ sung' } as const
type Group = {
  cruiseId: string
  cruiseName: string
  cruiseCode: string
  sectionCode: string
  sectionName: string
  status: keyof typeof statuses
  submittedAt: string
}
type GroupDetail = {
  summary: Group
  revision: number
  evidence: string | null
  returnReason: string | null
  checks: { name: string; ready: boolean; required: boolean }[]
  allowedActions: ('CONFIRM' | 'RETURN')[]
}
const groupPath = (group: Group) =>
  `${root}/${encodeURIComponent(group.cruiseId)}/${encodeURIComponent(group.sectionCode)}`

export function SubmittedPreparationGroups() {
  const { userId } = useSessionAccess()
  const query = useReadQuery(`submitted-groups:${userId}`,
    useCallback(signal => apiRequest<Group[]>(root, { signal }), []))
  const [selected, setSelected] = useState<Group | null>(null)
  const [status, setStatus] = useState<keyof typeof statuses>('SUBMITTED')
  const [feedback, setFeedback] = useState('')
  const groups = query.data?.filter(group => group.status === status) ?? []

  return <Panel title="Nhóm hồ sơ đã gửi" subtitle="Xét từng nhóm hồ sơ đã nhận.">
    <div className={styles.lifecycleActions} role="group" aria-label="Lọc nhóm hồ sơ">
      {(Object.keys(statuses) as (keyof typeof statuses)[]).map(key =>
        <Button key={key} autoWidth tone={key === status ? 'primary' : 'secondary'}
          aria-pressed={key === status} onClick={() => setStatus(key)}>{statuses[key]}</Button>)}
    </div>
    {feedback && <Notice tone="success" title={feedback}>{null}</Notice>}
    {query.loading && <Loading label="Đang tải nhóm hồ sơ…" />}
    {query.error && <Notice tone="error" title="Chưa tải được nhóm hồ sơ">
      <Button tone="secondary" onClick={query.retry}>Thử lại</Button>
    </Notice>}
    {!query.loading && !query.error && (groups.length === 0
      ? <Empty title="Không có nhóm ở trạng thái này" />
      : <DataTable label="Nhóm hồ sơ đã gửi" headers={['Chuyến khởi hành', 'Nhóm hồ sơ', 'Thời điểm gửi', 'Thao tác']}>
        {groups.map(group => <tr key={groupPath(group)}>
          <td><strong>{group.cruiseName}</strong><br />{group.cruiseCode}</td>
          <td>{group.sectionName}</td>
          <td>{journeyTime(group.submittedAt)}</td>
          <td><Button tone="secondary" autoWidth onClick={() => setSelected(group)}>Xem nhóm</Button></td>
        </tr>)}
      </DataTable>)}
    {selected && <GroupReview group={selected} onClose={() => setSelected(null)} onSaved={action => {
      setSelected(null)
      setFeedback(action === 'confirm' ? 'Đã xác nhận nhóm hồ sơ' : 'Đã gửi yêu cầu bổ sung cho bộ phận Lịch trình')
      query.retry()
    }} />}
  </Panel>
}

function GroupReview({ group, onClose, onSaved }: {
  group: Group
  onClose: () => void
  onSaved: (action: 'confirm' | 'return') => void
}) {
  const { userId } = useSessionAccess()
  const path = groupPath(group)
  const query = useReadQuery(`group-review:${userId}:${path}`,
    useCallback(signal => apiRequest<GroupDetail>(path, { signal }), [path]))
  const [returning, setReturning] = useState(false)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const detail = query.data

  async function decide(action: 'confirm' | 'return') {
    if (!detail || busy || !detail.allowedActions.includes(action === 'confirm' ? 'CONFIRM' : 'RETURN')) return
    if (action === 'return' && !reason.trim()) return
    setBusy(true)
    setError('')
    try {
      await apiRequest<void>(`${path}/${action}`, {
        method: 'POST',
        body: { expectedRevision: detail.revision, ...(action === 'return' ? { reason: reason.trim() } : {}) },
      })
      onSaved(action)
    } catch (failure) {
      setError(failure instanceof ApiError && failure.status === 409
        ? 'Nhóm hồ sơ vừa thay đổi. Đọc lại nội dung trước khi quyết định.'
        : 'Chưa xác nhận được kết quả. Tải lại nhóm hồ sơ để kiểm tra trạng thái.')
      query.retry()
    } finally {
      setBusy(false)
    }
  }

  return <Modal variant="drawer" title={group.sectionName} description={`${group.cruiseName} · ${group.cruiseCode}`}
    busy={busy} onClose={onClose}>
    {query.loading && <Loading label="Đang tải nội dung đã gửi…" />}
    {query.error && <Notice tone="error" title="Chưa tải được nội dung đã gửi">
      <Button tone="secondary" onClick={query.retry}>Thử lại</Button>
    </Notice>}
    {error && <Notice tone="error" title="Chưa hoàn tất thao tác">{error}</Notice>}
    {!query.loading && !query.error && detail && <>
      <p><strong>{statuses[detail.summary.status]}</strong></p>
      {detail.evidence && <><h3>Nội dung bộ phận Lịch trình đã gửi</h3><p>{detail.evidence}</p></>}
      {detail.checks.length > 0 && <>
        <h3>Thông tin lúc gửi</h3>
        <ul>{detail.checks.map(check =>
          <li key={check.name}>{check.name} · {check.ready ? 'Đạt' : check.required ? 'Cần bổ sung' : 'Chưa có'}</li>)}</ul>
      </>}
      {detail.summary.status === 'RETURNED' && detail.returnReason &&
        <Notice title="Lý do cần bổ sung" tone="warning">{detail.returnReason}</Notice>}
      {returning && detail.allowedActions.includes('RETURN') &&
        <Field label="Bộ phận Lịch trình cần bổ sung nội dung gì?" htmlFor="group-return-reason">
          <textarea id="group-return-reason" value={reason} disabled={busy} onChange={event => setReason(event.target.value)} />
        </Field>}
      <div className={styles.lifecycleActions}>
        {!returning && detail.allowedActions.includes('CONFIRM') &&
          <Button autoWidth busy={busy} onClick={() => void decide('confirm')}>Xác nhận nhóm</Button>}
        {detail.allowedActions.includes('RETURN') && (returning
          ? <><Button autoWidth busy={busy} disabled={!reason.trim()} onClick={() => void decide('return')}>Gửi cho bộ phận Lịch trình</Button>
            <Button autoWidth tone="secondary" disabled={busy} onClick={() => setReturning(false)}>Hủy</Button></>
          : <Button autoWidth tone="secondary" disabled={busy} onClick={() => setReturning(true)}>Yêu cầu bổ sung</Button>)}
      </div>
    </>}
  </Modal>
}
