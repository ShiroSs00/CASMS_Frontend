import { useState } from 'react'

import { ISSUE_STATUSES } from '../model/issue'
import { issueStatusLabels } from '../model/issue'
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
      <div className={styles.filterActions}>
        <button className={styles.primaryButton} onClick={() => onChange(draft)} type="button">
          Áp dụng
        </button>
        <button className={styles.secondaryButton} onClick={reset} type="button">
          Đặt lại
        </button>
      </div>
      <p className={styles.filterGap}>Tìm kiếm, lọc mức độ/người xử lý và phân trang chưa khả dụng.</p>
    </section>
  )
}
