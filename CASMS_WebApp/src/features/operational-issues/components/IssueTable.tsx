import { DataTable } from '@/shared/ui'
import { Link, useLocation } from 'react-router'

import type { OperationalIssue } from '../model/issue'
import { IssueSeverityBadge, IssueStatusBadge } from './IssueStatusBadge'
import styles from './OperationalIssues.module.css'

export function IssueTable({ issues }: { issues: OperationalIssue[] }) {
  const location = useLocation()
  const returnTo = `${location.pathname}${location.search}`

  return (
    <DataTable label="Danh sách sự cố vận hành" headers={['Mã sự cố', 'Sự cố', 'Mức độ', 'Trạng thái', 'Tàu / Chuyến', 'Người xử lý', 'Báo lúc']}>

          {issues.map((issue) => (
            <tr key={issue.id}>
              <td>
                <Link
                  className={styles.issueLink}
                  state={{ returnTo }}
                  to={`/admin/issues/${issue.id}`}
                >
                  {issue.code}
                </Link>
              </td>
              <td><Link className={styles.issueName} state={{ returnTo }} to={`/admin/issues/${issue.id}`}>{issue.displayTitle}</Link></td>
              <td>
                <IssueSeverityBadge severity={issue.severity} />
              </td>
              <td>
                <IssueStatusBadge status={issue.status} />
              </td>
              <td>{issue.ship.name}{issue.cruise ? ` · ${issue.cruise.code}` : ''}</td>
              <td>{issue.assignedTo?.name ?? 'Chưa gán'}</td>
              <td>{new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(issue.reportedAt))}</td>
            </tr>
          ))}


    </DataTable>
  )
}
