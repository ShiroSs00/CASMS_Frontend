import { useState } from 'react'

import { ISSUE_SEVERITIES, ISSUE_STATUSES } from '../model/issue'
import { issueSeverityLabels, issueStatusLabels } from '../model/issue'
import { DEFAULT_ISSUE_QUERY, type IssueQuery } from '../model/issue-query'
import type { CruiseReference, PersonReference, ShipReference } from '../model/issue'
import styles from './OperationalIssues.module.css'

type Props = {
  query: IssueQuery
  ships: ShipReference[]
  cruises: CruiseReference[]
  handlers: PersonReference[]
  onChange: (patch: Partial<IssueQuery>) => void
  onReset: () => void
}

export function IssueSearchFilters({
  query,
  ships,
  cruises,
  handlers,
  onChange,
  onReset,
}: Props) {
  const [draft, setDraft] = useState(query)
  const availableCruises = draft.shipId
    ? cruises.filter((cruise) => cruise.shipId === draft.shipId)
    : cruises

  function updateDraft(patch: Partial<IssueQuery>) {
    setDraft((current) => {
      const next = { ...current, ...patch }
      if (patch.shipId !== undefined && patch.shipId !== current.shipId) {
        const cruise = cruises.find((candidate) => candidate.id === next.cruiseId)
        if (cruise && cruise.shipId !== patch.shipId) next.cruiseId = ''
      }
      return next
    })
  }

  function reset() {
    setDraft(DEFAULT_ISSUE_QUERY)
    onReset()
  }

  return (
    <section className={styles.filters} aria-label="Bộ lọc sự cố">
      <label className={styles.field}>
        Tìm sự cố
        <input
          value={draft.search}
          onChange={(event) => updateDraft({ search: event.target.value })}
          placeholder="Mã / mô tả / cruise"
          type="search"
        />
      </label>
      <label className={styles.field}>
        Mức ảnh hưởng
        <select
          value={draft.severity}
          onChange={(event) =>
            updateDraft({ severity: event.target.value as IssueQuery['severity'] })
          }
        >
          <option value="">Tất cả</option>
          {ISSUE_SEVERITIES.map((severity) => (
            <option key={severity} value={severity}>
              {issueSeverityLabels[severity]}
            </option>
          ))}
        </select>
      </label>
      <label className={styles.field}>
        Trạng thái
        <select
          value={draft.status}
          onChange={(event) => updateDraft({ status: event.target.value as IssueQuery['status'] })}
        >
          <option value="">Tất cả</option>
          {ISSUE_STATUSES.map((status) => (
            <option key={status} value={status}>
              {issueStatusLabels[status]}
            </option>
          ))}
        </select>
      </label>
      <label className={styles.field}>
        Tàu
        <select value={draft.shipId} onChange={(event) => updateDraft({ shipId: event.target.value })}>
          <option value="">Tất cả</option>
          {ships.map((ship) => (
            <option key={ship.id} value={ship.id}>
              {ship.name}
            </option>
          ))}
        </select>
      </label>
      <label className={styles.field}>
        Cruise
        <select
          value={draft.cruiseId}
          onChange={(event) => updateDraft({ cruiseId: event.target.value })}
        >
          <option value="">Tất cả</option>
          {availableCruises.map((cruise) => (
            <option key={cruise.id} value={cruise.id}>
              {cruise.code} · {cruise.name}
            </option>
          ))}
        </select>
      </label>
      <label className={styles.field}>
        Người xử lý
        <select
          value={draft.handlerId}
          onChange={(event) => updateDraft({ handlerId: event.target.value })}
        >
          <option value="">Tất cả</option>
          {handlers.map((handler) => (
            <option key={handler.id} value={handler.id}>
              {handler.name}
            </option>
          ))}
        </select>
      </label>
      <div className={styles.filterActions}>
        <button className={styles.primaryButton} onClick={() => onChange(draft)} type="button">
          Áp dụng
        </button>
        <button className={styles.secondaryButton} onClick={reset} type="button">
          Đặt lại
        </button>
      </div>
    </section>
  )
}
