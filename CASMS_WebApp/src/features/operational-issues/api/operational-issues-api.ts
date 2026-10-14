import { apiRequest } from '@/shared/api'
import type { IssueQuery } from '../model/issue-query'
import type { CruiseReference, PersonReference, ShipReference } from '../model/issue'
import type { IssueDetailResult, IssueListResult } from '../model/issue-adapter'
import { selectIssuePage } from '../model/issue-list'
import { collectPeople, mapIssueDto, type IssueLookups, type OperationalIssueDto } from './contract'

type PageDto<T> = { content: T[]; totalPages: number }
type ShipDto = { shipId: string; shipCode: string; shipName: string }
type CruiseDto = { cruiseId: string; cruiseCode: string; cruiseName: string; shipId: string | null }
export type UserLookupDto = { id: string; displayName: string; username: string; status: string }

async function loadShips(): Promise<ShipReference[]> {
  const first = await apiRequest<PageDto<ShipDto>>('/ship', { query: { page: 0, size: 100 } })
  const rows = [...first.content]
  for (let page = 1; page < first.totalPages; page += 1) {
    const next = await apiRequest<PageDto<ShipDto>>('/ship', { query: { page, size: 100 } })
    rows.push(...next.content)
  }
  return rows.map((ship) => ({ id: ship.shipId, name: `${ship.shipCode} · ${ship.shipName}` }))
}

async function loadReferences(dtos: OperationalIssueDto[]) {
  const notices: string[] = []
  async function optional<T>(label: string, request: Promise<T>, fallback: T): Promise<T> {
    try { return await request } catch (error) {
      notices.push(`${label}: ${error instanceof Error ? error.message : 'Không tải được.'}`)
      return fallback
    }
  }
  const [ships, users, cruiseRows] = await Promise.all([
    optional('Danh mục tàu', loadShips(), []),
    optional('Danh sách người xử lý', apiRequest<UserLookupDto[]>('/identity/users', {
      query: { status: 'ACTIVE', assignableFor: 'OPERATIONAL_ISSUE' },
    }), []),
    Promise.all([...new Set(dtos.flatMap((dto) => dto.cruiseId ? [dto.cruiseId] : []))]
      .map((id) => optional('Thông tin chuyến', apiRequest<CruiseDto | null>(`/cruise/${encodeURIComponent(id)}`), null))),
  ])
  const handlers: PersonReference[] = users.filter((user) => user.status === 'ACTIVE')
    .map((user) => ({ id: user.id, name: user.displayName || user.username }))
    .sort((a, b) => a.name.localeCompare(b.name, 'vi'))
  const people = new Map(collectPeople(dtos).map((person) => [person.id, person]))
  for (const handler of handlers) people.set(handler.id, handler)
  const cruises = new Map<string, CruiseReference>()
  for (const dto of dtos) {
    if (dto.cruiseId) cruises.set(dto.cruiseId, {
      id: dto.cruiseId, code: `Cruise ${dto.cruiseId.slice(0, 8)}`,
      name: `Cruise ${dto.cruiseId.slice(0, 8)}`, shipId: dto.shipId,
    })
  }
  for (const cruise of cruiseRows) {
    if (cruise) cruises.set(cruise.cruiseId, {
      id: cruise.cruiseId, code: cruise.cruiseCode, name: cruise.cruiseName,
      shipId: cruise.shipId ?? cruises.get(cruise.cruiseId)?.shipId ?? '',
    })
  }
  const lookups: IssueLookups = { people, ships: new Map(ships.map((ship) => [ship.id, ship])), cruises }
  return { ships, cruises: [...cruises.values()], handlers, people: [...people.values()], lookups,
    sourceNotice: notices.length ? notices.join(' ') : undefined }
}

export const operationalIssuesApi = {
  async list(query: IssueQuery): Promise<IssueListResult> {
    const dtos = await apiRequest<OperationalIssueDto[]>('/operational-issues')
    const refs = await loadReferences(dtos)
    return selectIssuePage({
      items: dtos.map((dto) => mapIssueDto(dto, refs.lookups)), total: dtos.length,
      page: 1, pageSize: query.pageSize,
      statusTotals: { OPEN: 0, IN_PROGRESS: 0, RESOLVED: 0, CLOSED: 0, review: 0 },
      handlers: refs.people, ships: refs.ships, cruises: refs.cruises,
      source: 'backend', sourceNotice: refs.sourceNotice,
    }, query)
  },

  async detail(id: string): Promise<IssueDetailResult> {
    const dto = await apiRequest<OperationalIssueDto>(`/operational-issues/${encodeURIComponent(id)}`)
    const refs = await loadReferences([dto])
    return {
      issue: mapIssueDto(dto, refs.lookups), handlers: refs.handlers,
      source: 'backend', sourceNotice: refs.sourceNotice,
    }
  },

  assign: (id: string, handlerId: string) => apiRequest<OperationalIssueDto>(
    `/operational-issues/${encodeURIComponent(id)}/assign`,
    { method: 'PATCH', body: { assignedToId: handlerId } },
  ),
  start: (id: string) => apiRequest<OperationalIssueDto>(
    `/operational-issues/${encodeURIComponent(id)}/start`, { method: 'PATCH' },
  ),
  // Actor is resolved exclusively from the authenticated BE principal.
  recordResolution: (id: string, resolution: string) => apiRequest<OperationalIssueDto>(
    `/operational-issues/${encodeURIComponent(id)}/resolution`, { method: 'POST', body: { resolution } },
  ),
  verifyResolution: (id: string) => apiRequest<OperationalIssueDto>(
    `/operational-issues/${encodeURIComponent(id)}/verify`, { method: 'PATCH' },
  ),
  close: (id: string) => apiRequest<OperationalIssueDto>(
    `/operational-issues/${encodeURIComponent(id)}/close`, { method: 'PATCH' },
  ),
  reopen: (id: string) => apiRequest<OperationalIssueDto>(
    `/operational-issues/${encodeURIComponent(id)}/reopen`, { method: 'PATCH' },
  ),
}
