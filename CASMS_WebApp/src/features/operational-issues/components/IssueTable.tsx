import { Link, useLocation } from 'react-router'

import type { OperationalIssue } from '../model/issue'
import { IssueSeverityBadge, IssueStatusBadge } from './IssueStatusBadge'
import styles from './OperationalIssues.module.css'

export function IssueTable({ issues }: { issues: OperationalIssue[] }) {
  const location = useLocation()
  const returnTo = `${location.pathname}${location.search}`

  return (
    <div className={styles.tableViewport} tabIndex={0} role="region" aria-label="Danh sách sự cố vận hành">
      <table className={styles.table}>
        <caption className={styles.visuallyHidden}>Danh sách sự cố vận hành</caption>
        <thead>
          <tr>
            <th scope="col">Mã sự cố</th>
            <th scope="col">Sự cố</th>
            <th scope="col">Mức độ</th>
            <th scope="col">Trạng thái</th>
            <th scope="col">Tàu / Chuyến</th>
            <th scope="col">Người xử lý</th>
            <th scope="col">Báo lúc</th>
          </tr>
        </thead>
        <tbody>
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
        </tbody>
      </table>
    </div>
  )
}
