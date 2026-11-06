import { useCallback, useState } from 'react'
import { useReadQuery } from '@/shared/api'
import { Button, Notice } from '@/shared/ui'
import { shipImportApi } from './api'
import { issueMessage, jobLabel, type ImportIssue, type ImportJob } from './model'
import styles from './ShipImport.module.css'

const objectLabels: Record<string, string> = { DECK: 'Boong', CABIN: 'Phòng', AREA: 'Khu vực', FACILITY: 'Khu vực' }
const time = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' })
export const importTime = (value: string | null) => value && Number.isFinite(Date.parse(value)) ? time.format(new Date(value)) : '—'

export function ImportIssueList({ issues }: { issues: ImportIssue[] }) {
  return issues.length ? <ul className={styles.issueList}>
    {issues.map(issue => <li key={issue.issueId}>
      <strong>{objectLabels[issue.objectType] ?? 'Đối tượng'} · {issue.objectIdentifier ?? 'Chưa xác định'}</strong>
      <p>{issueMessage(issue.errorCode, issue.message)}</p>
      <details><summary>Thông tin kỹ thuật</summary><code translate="no">{issue.errorCode}</code><p>{issue.message}</p></details>
    </li>)}
  </ul> : <p>Chưa có chi tiết lỗi theo đối tượng.</p>
}

function JobIssues({ shipId, jobId }: { shipId: string; jobId: string }) {
  const load = useCallback((signal: AbortSignal) => shipImportApi.issues({ shipId, jobId }, signal), [shipId, jobId])
  const query = useReadQuery(`import-issues:${shipId}:${jobId}`, load)
  return <>
    {query.loading && <p role="status">Đang tải các mục cần xử lý…</p>}
    {query.error && <Notice title="Không tải được chi tiết lỗi" tone="error">{query.error.message} <Button tone="text" onClick={query.retry}>Tải lại</Button></Notice>}
    {query.data && <ImportIssueList issues={query.data} />}
  </>
}

function JobIssuesDisclosure({ job }: { job: ImportJob }) {
  const [requested, setRequested] = useState(false)
  return <details className={styles.issues} onToggle={event => {
    if (event.currentTarget.open) setRequested(true)
  }}>
    <summary>Các mục cần xử lý ({job.objectsFailed})</summary>
    {requested && <JobIssues shipId={job.shipId} jobId={job.jobId} />}
  </details>
}

export function ImportJobDetails({ job, canRead }: { job: ImportJob; canRead: boolean }) {
  return <div className={styles.stack}>
    <p role="status"><strong>{jobLabel(job.status)}</strong> · {importTime(job.startedAt)}{job.finishedAt ? ` – ${importTime(job.finishedAt)}` : ''}</p>
    <dl className={styles.metrics}>
      <div><dt>Boong đã import</dt><dd>{job.decksImported}</dd></div>
      <div><dt>Phòng đã import</dt><dd>{job.cabinsImported}</dd></div>
      <div><dt>Thành công</dt><dd>{job.objectsSucceeded}/{job.totalObjects}</dd></div>
      <div><dt>Có lỗi / Bỏ qua</dt><dd>{job.objectsFailed} / {job.objectsSkipped}</dd></div>
    </dl>
    {job.errorMessage && <Notice title="Chi tiết kết quả" tone={job.status === 'FAILED' ? 'error' : 'warning'}>
      {job.objectsFailed ? 'Một số đối tượng cần kiểm tra.' : 'Máy chủ đã ghi nhận lỗi xử lý.'}
      <details><summary>Thông tin kỹ thuật</summary><p>{job.errorMessage}</p></details>
    </Notice>}
    {canRead && job.objectsFailed > 0 && <JobIssuesDisclosure key={job.jobId} job={job} />}
  </div>
}
