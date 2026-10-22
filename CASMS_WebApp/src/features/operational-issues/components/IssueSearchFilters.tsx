import { useState } from 'react'
import { Button, Field, ListFilters, Panel } from '@/shared/ui'

import { ISSUE_STATUSES } from '../model/issue'
import { issueStatusLabels } from '../model/issue'
import { DEFAULT_ISSUE_QUERY, type IssueQuery } from '../model/issue-query'
import type { CruiseReference, PersonReference, ShipReference } from '../model/issue'

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
    <Panel title="Bộ lọc">
      <ListFilters label="Bộ lọc sự cố" onSubmit={() => onChange(draft)} actions={<><Button type="submit">Áp dụng bộ lọc</Button><Button tone="secondary" onClick={reset}>Xóa bộ lọc</Button></>}>
      <Field htmlFor="issue-filter-status" label="Trạng thái">
        <select
          id="issue-filter-status"
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
      </Field>
      <Field htmlFor="issue-filter-ship" label="Tàu">
        <select id="issue-filter-ship" value={draft.shipId} onChange={(event) => updateDraft({ shipId: event.target.value })}>
          <option value="">Tất cả</option>
          {ships.map((ship) => (
            <option key={ship.id} value={ship.id}>
              {ship.name}
            </option>
          ))}
        </select>
      </Field>
      <Field htmlFor="issue-filter-cruise" label="Chuyến đi">
        <select
          id="issue-filter-cruise"
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
      </Field>
      </ListFilters>
    </Panel>
  )
}
