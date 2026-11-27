import { apiRequest } from '@/shared/api'

import type { IssueQuery } from '../model/issue-query'
import type { IssueStatus, OperationalIssue, PersonReference } from '../model/issue'
import type { CreateOperationalIssueRequest, OperationalIssueDto, UpdateOperationalIssueRequest } from './dto'

export type IssueStatusTotals = Record<IssueStatus, number> & { critical: number }
export type IssueListResult = {
  items: OperationalIssue[]
  total: number
  statusTotals: IssueStatusTotals
  handlers: PersonReference[]
}

const roleUsernameLabels: Record<string, string> = {
  admin: 'Quản trị viên',
  super_admin: 'Quản trị viên cấp cao',
  operations_manager: 'Quản lý vận hành',
  ops_manager: 'Quản lý vận hành',
  cruise_manager: 'Quản lý hành trình',
  ship_manager: 'Quản lý tàu',
  activity_manager: 'Quản lý dịch vụ & hoạt động',
  shore_manager: 'Quản lý tour bờ',
  booking_agent: 'Nhân viên đặt chỗ',
  finance_officer: 'Nhân viên tài chính',
  hr_manager: 'Quản lý nhân sự',
  onboard_staff: 'Nhân viên trên tàu',
  checkin_staff: 'Nhân viên check-in',
  customer_service: 'Chăm sóc khách hàng',
}

function formatPersonName(name?: string | null): string {
  const cleaned = name?.trim()
  if (!cleaned) return 'Chưa tải được tên người dùng'
  return roleUsernameLabels[cleaned.toLowerCase()] ?? cleaned
}

const person = (id: string | null | undefined, name?: string | null): PersonReference | null =>
  id ? { id, name: formatPersonName(name) } : null

function toIssue(dto: OperationalIssueDto): OperationalIssue {
  const reporterId = dto.reportedById ?? dto.reportedBy ?? dto.reporterId ?? 'unknown'
  const assignedId = dto.assignedToId ?? dto.assignedTo ?? null
  const resolvedId = dto.resolvedById ?? dto.resolvedBy ?? null
  const verifiedId = dto.verifiedById ?? dto.verifiedBy ?? null
  return {
    id: dto.issueId,
    code: dto.issueCode,
    displayTitle: dto.description.split('.')[0]?.trim() || dto.description,
    ship: { id: dto.shipId, name: dto.shipName?.trim() || 'Chưa tải được tên tàu' },
    cruise: dto.cruiseId
      ? {
          id: dto.cruiseId,
          code: dto.cruiseCode?.trim() || 'Chưa có mã chuyến',
          name: dto.cruiseName?.trim() || dto.cruiseCode?.trim() || 'Chưa tải được tên chuyến',
          shipId: dto.shipId,
        }
      : null,
    cabinId: dto.cabinId ?? null,
    cabin: dto.cabinNumber ?? (dto.cabinId ? 'Đã gắn cabin, chưa tải được số phòng' : null),
    type: dto.issueType,
    severity: dto.severity,
    status: dto.status,
    description: dto.description,
    reportedBy: person(reporterId, dto.reporterName) ?? { id: reporterId, name: formatPersonName(reporterId) },
    reportedAt: dto.reportedAt,
    assignedTo: person(assignedId, dto.assignedToName),
    resolution: dto.resolution ?? null,
    resolvedBy: person(resolvedId, dto.resolvedByName),
    resolvedAt: dto.resolvedAt ?? null,
    verifiedBy: person(verifiedId, dto.verifiedByName),
    verifiedAt: dto.verifiedAt ?? null,
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt,
  }
}

let revision = 0
const listeners = new Set<() => void>()
const notify = () => { revision += 1; listeners.forEach((listener) => listener()) }
const path = (id: string) => `/operational-issues/${encodeURIComponent(id)}`

type LookupMaps = {
  ships: Map<string, string>
  cruises: Map<string, { code: string; name: string }>
  users: Map<string, string>
  loadedAt: number
}

let lookupCache: LookupMaps | null = null

async function loadIssueLookups(signal?: AbortSignal): Promise<LookupMaps> {
  if (lookupCache && Date.now() - lookupCache.loadedAt < 30_000) return lookupCache
  const [shipsRaw, cruisesRaw, usersRaw] = await Promise.all([
    apiRequest<unknown>('/ships', { query: { page: 0, size: 100 }, signal }).catch(() => []),
    apiRequest<unknown>('/cruise', { query: { page: 0, size: 100 }, signal }).catch(() => []),
    apiRequest<unknown>('/identity/users', { query: { status: 'ACTIVE' }, signal }).catch(() => []),
  ])
  const extractRows = (value: unknown): Record<string, unknown>[] => {
    if (Array.isArray(value)) return value.filter((v): v is Record<string, unknown> => Boolean(v) && typeof v === 'object')
    if (value && typeof value === 'object' && Array.isArray((value as { content?: unknown }).content)) {
      return ((value as { content: unknown[] }).content).filter((v): v is Record<string, unknown> => Boolean(v) && typeof v === 'object')
    }
    return []
  }
  const ships = new Map<string, string>()
  for (const row of extractRows(shipsRaw)) {
    const id = typeof row.shipId === 'string' ? row.shipId : typeof row.id === 'string' ? row.id : ''
    const name = typeof row.shipName === 'string' ? row.shipName : typeof row.name === 'string' ? row.name : ''
    if (id && name.trim()) ships.set(id, name.trim())
  }
  const cruises = new Map<string, { code: string; name: string }>()
  for (const row of extractRows(cruisesRaw)) {
    const id = typeof row.cruiseId === 'string' ? row.cruiseId : typeof row.id === 'string' ? row.id : ''
    const code = typeof row.cruiseCode === 'string' ? row.cruiseCode.trim() : ''
    const name = typeof row.cruiseName === 'string' ? row.cruiseName.trim() : ''
    if (id && (code || name)) cruises.set(id, { code: code || name, name: name || code })
  }
  const users = new Map<string, string>()
  for (const row of extractRows(usersRaw)) {
    const id = typeof row.id === 'string' ? row.id : typeof row.userId === 'string' ? row.userId : ''
    const display = (typeof row.displayName === 'string' && row.displayName.trim())
      || (typeof row.fullName === 'string' && row.fullName.trim())
      || (typeof row.username === 'string' && row.username.trim())
      || ''
    if (id && display) users.set(id, display)
  }
  lookupCache = { ships, cruises, users, loadedAt: Date.now() }
  return lookupCache
}

function needsLookupHydration(dtos: OperationalIssueDto[]) {
  return dtos.some(dto =>
    !dto.shipName?.trim()
    || (Boolean(dto.cruiseId) && (!dto.cruiseName?.trim() || !dto.cruiseCode?.trim()))
    || !dto.reporterName?.trim()
    || (Boolean(dto.assignedToId ?? dto.assignedTo) && !dto.assignedToName?.trim())
    || (Boolean(dto.resolvedById ?? dto.resolvedBy) && !dto.resolvedByName?.trim())
    || (Boolean(dto.verifiedById ?? dto.verifiedBy) && !dto.verifiedByName?.trim()),
  )
}

function hydrateDto(dto: OperationalIssueDto, lookups: LookupMaps): OperationalIssueDto {
  const reporterId = dto.reportedById ?? dto.reportedBy ?? dto.reporterId ?? ''
  const assignedId = dto.assignedToId ?? dto.assignedTo ?? ''
  const resolvedId = dto.resolvedById ?? dto.resolvedBy ?? ''
  const verifiedId = dto.verifiedById ?? dto.verifiedBy ?? ''
  const cruiseMatch = dto.cruiseId ? lookups.cruises.get(dto.cruiseId) : undefined
  return {
    ...dto,
    shipName: dto.shipName?.trim() || lookups.ships.get(dto.shipId) || dto.shipName,
    cruiseCode: dto.cruiseCode?.trim() || cruiseMatch?.code || dto.cruiseCode,
    cruiseName: dto.cruiseName?.trim() || cruiseMatch?.name || dto.cruiseName,
    reporterName: dto.reporterName?.trim() || (reporterId ? lookups.users.get(reporterId) : undefined) || dto.reporterName,
    assignedToName: dto.assignedToName?.trim() || (assignedId ? lookups.users.get(assignedId) : undefined) || dto.assignedToName,
    resolvedByName: dto.resolvedByName?.trim() || (resolvedId ? lookups.users.get(resolvedId) : undefined) || dto.resolvedByName,
    verifiedByName: dto.verifiedByName?.trim() || (verifiedId ? lookups.users.get(verifiedId) : undefined) || dto.verifiedByName,
  }
}

export const operationalIssuesApi = {
  subscribe(listener: () => void) { listeners.add(listener); return () => listeners.delete(listener) },
  getRevision: () => revision,
  async list(query: IssueQuery, signal?: AbortSignal): Promise<IssueListResult> {
    const rawRows = await apiRequest<OperationalIssueDto[]>('/operational-issues', {
      query: {
        status: query.status || undefined,
        shipId: query.shipId || undefined,
        cruiseId: query.cruiseId || undefined,
      },
      signal,
    })
    const rows = needsLookupHydration(rawRows)
      ? rawRows.map(row => hydrateDto(row, lookupCache ?? { ships: new Map(), cruises: new Map(), users: new Map(), loadedAt: 0 }))
      : rawRows
    const hydratedRows = needsLookupHydration(rawRows)
      ? await loadIssueLookups(signal).then(lookups => rawRows.map(row => hydrateDto(row, lookups)))
      : rows
    const allItems = hydratedRows.map(toIssue)
    const handlers = [...new Map(
      allItems.flatMap((item) => (item.assignedTo ? [item.assignedTo] : [])).map((item) => [item.id, item]),
    ).values()]
    const term = query.search.trim().toLocaleLowerCase('vi')
    const filtered = allItems.filter((item) => {
      if (query.severity && item.severity !== query.severity) return false
      if (query.handlerId && item.assignedTo?.id !== query.handlerId) return false
      if (!term) return true
      return [
        item.code,
        item.displayTitle,
        item.description,
        item.ship.name,
        item.cruise?.code ?? '',
        item.cruise?.name ?? '',
        item.cabin ?? '',
        item.reportedBy.name,
        item.assignedTo?.name ?? '',
      ].some((value) => value.toLocaleLowerCase('vi').includes(term))
    })
    const pageSize = Math.max(1, query.pageSize || 20)
    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
    const safePage = Math.min(Math.max(1, query.page || 1), totalPages)
    const startIndex = (safePage - 1) * pageSize
    const items = filtered.slice(startIndex, startIndex + pageSize)
    return {
      items,
      total: filtered.length,
      handlers,
      statusTotals: {
        OPEN: filtered.filter((item) => item.status === 'OPEN').length,
        IN_PROGRESS: filtered.filter((item) => item.status === 'IN_PROGRESS').length,
        RESOLVED: filtered.filter((item) => item.status === 'RESOLVED').length,
        CLOSED: filtered.filter((item) => item.status === 'CLOSED').length,
        critical: filtered.filter((item) => item.severity === 'CRITICAL').length,
      },
    }
  },
  async detail(id: string, signal?: AbortSignal) {
    const raw = await apiRequest<OperationalIssueDto>(path(id), { signal })
    const hydrated = needsLookupHydration([raw]) ? hydrateDto(raw, await loadIssueLookups(signal)) : raw
    return toIssue(hydrated)
  },
  async create(body: CreateOperationalIssueRequest) {
    const raw = await apiRequest<OperationalIssueDto>('/operational-issues', { method: 'POST', body: {
      cruiseId: body.cruiseId?.trim() || null,
      shipId: body.shipId.trim(),
      cabinId: body.cabinId?.trim() || null,
      issueType: body.issueType,
      severity: body.severity,
      description: body.description.trim(),
    } })
    const result = toIssue(needsLookupHydration([raw]) ? hydrateDto(raw, await loadIssueLookups()) : raw)
    notify(); return result
  },
  async update(id: string, body: UpdateOperationalIssueRequest) {
    const raw = await apiRequest<OperationalIssueDto>(path(id), { method: 'PUT', body: { severity: body.severity, description: body.description.trim() } })
    const result = toIssue(needsLookupHydration([raw]) ? hydrateDto(raw, await loadIssueLookups()) : raw)
    notify(); return result
  },
  async assign(id: string, assignedToId: string) {
    const raw = await apiRequest<OperationalIssueDto>(`${path(id)}/assign`, { method: 'PATCH', body: { assignedToId } })
    const result = toIssue(needsLookupHydration([raw]) ? hydrateDto(raw, await loadIssueLookups()) : raw)
    notify(); return result
  },
  async start(id: string) {
    const raw = await apiRequest<OperationalIssueDto>(`${path(id)}/start`, { method: 'PATCH' })
    const result = toIssue(needsLookupHydration([raw]) ? hydrateDto(raw, await loadIssueLookups()) : raw)
    notify(); return result
  },
  async recordResolution(id: string, resolution: string) {
    const raw = await apiRequest<OperationalIssueDto>(`${path(id)}/resolution`, { method: 'POST', body: { resolution } })
    const result = toIssue(needsLookupHydration([raw]) ? hydrateDto(raw, await loadIssueLookups()) : raw)
    notify(); return result
  },
  async verify(id: string) {
    const raw = await apiRequest<OperationalIssueDto>(`${path(id)}/verify`, { method: 'PATCH' })
    const result = toIssue(needsLookupHydration([raw]) ? hydrateDto(raw, await loadIssueLookups()) : raw)
    notify(); return result
  },
  async close(id: string) {
    const raw = await apiRequest<OperationalIssueDto>(`${path(id)}/close`, { method: 'PATCH' })
    const result = toIssue(needsLookupHydration([raw]) ? hydrateDto(raw, await loadIssueLookups()) : raw)
    notify(); return result
  },
  async reopen(id: string) {
    const raw = await apiRequest<OperationalIssueDto>(`${path(id)}/reopen`, { method: 'PATCH' })
    const result = toIssue(needsLookupHydration([raw]) ? hydrateDto(raw, await loadIssueLookups()) : raw)
    notify(); return result
  },
  async validate(id: string) {
    await apiRequest<void>(`${path(id)}/validate`, { method: 'POST' })
  },
}
