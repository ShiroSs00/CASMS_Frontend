import { Link, useLocation } from 'react-router'

import type { OperationalIssue } from '../model/issue'
import { IssueSeverityBadge, IssueStatusBadge } from './IssueStatusBadge'
import styles from './OperationalIssues.module.css'

export function IssueTable({ issues }: { issues: OperationalIssue[] }) {
  const location = useLocation()
  const returnTo = `${location.pathname}${location.search}`

  return (
    <div className={styles.tableViewport}>
      <table className={styles.table}>
        <caption className={styles.visuallyHidden}>Danh sách sự cố vận hành</caption>
        <thead>
          <tr>
            <th scope="col">Sự cố</th>
            <th scope="col">Cruise / khu vực</th>
            <th scope="col">Ảnh hưởng</th>
            <th scope="col">Assignee</th>
            <th scope="col">Trạng thái</th>
            <th scope="col">
              <span className={styles.visuallyHidden}>Thao tác</span>
            </th>
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
                  {issue.code} · {issue.displayTitle}
                </Link>
              </td>
              <td>
                {issue.cruise ? `${issue.cruise.code} · ${issue.cruise.name}` : issue.ship.name}
                {issue.cabin ? ` · ${issue.cabin}` : ''}
              </td>
              <td>
                <IssueSeverityBadge severity={issue.severity} />
              </td>
              <td>{issue.assignedTo?.name ?? 'Chưa phân công'}</td>
              <td>
                <IssueStatusBadge status={issue.status} />
              </td>
              <td>
                <Link
                  className={styles.issueLink}
                  state={{ returnTo }}
                  to={`/admin/issues/${issue.id}`}
                >
                  Mở →
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
