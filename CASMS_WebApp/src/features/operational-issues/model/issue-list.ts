import { paginateItems } from '../../../shared/pagination.ts'
import type { IssueQuery } from './issue-query'
import type { IssueListResult } from './issue-adapter'

/** Filter the complete loaded collection before slicing, never just the visible page. */
export function selectIssuePage(data: IssueListResult, query: IssueQuery): IssueListResult {
  const term = query.search.trim().toLocaleLowerCase('vi')
  const filtered = data.items.filter((issue) => {
    const searchable = [issue.code, issue.displayTitle, issue.description, issue.ship.name,
      issue.cruise?.code ?? '', issue.cruise?.name ?? ''].join(' ').toLocaleLowerCase('vi')
    return (!term || searchable.includes(term)) &&
      (!query.severity || issue.severity === query.severity) &&
      (!query.status || issue.status === query.status) &&
      (!query.shipId || issue.ship.id === query.shipId) &&
      (!query.cruiseId || issue.cruise?.id === query.cruiseId) &&
      (!query.handlerId || issue.assignedTo?.id === query.handlerId)
  })
  const page = paginateItems(filtered, query.page, query.pageSize)
  return {
    ...data, items: page.items, page: page.page, pageSize: page.pageSize, total: page.total,
    statusTotals: {
      OPEN: filtered.filter((issue) => issue.status === 'OPEN').length,
      IN_PROGRESS: filtered.filter((issue) => issue.status === 'IN_PROGRESS').length,
      RESOLVED: filtered.filter((issue) => issue.status === 'RESOLVED').length,
      CLOSED: filtered.filter((issue) => issue.status === 'CLOSED').length,
      review: filtered.filter((issue) => issue.severity === 'CRITICAL').length,
    },
  }
}
