import type {
  CruiseReference,
  IssueSeverity,
  IssueStatus,
  IssueType,
  OperationalIssue,
  PersonReference,
  ShipReference,
} from '../model/issue'

export type OperationalIssueDto = {
  issueId: string
  issueCode: string
  cruiseId: string | null
  shipId: string
  cabinId: string | null
  issueType: IssueType
  severity: IssueSeverity
  description: string
  reportedAt: string
  resolvedAt: string | null
  status: IssueStatus
  reportedById: string
  resolvedById: string | null
  assignedToId: string | null
  verifiedById: string | null
  verifiedAt: string | null
  resolution: string | null
  createdAt: string
  updatedAt: string
}

export type IssueLookups = {
  people?: ReadonlyMap<string, PersonReference>
  ships?: ReadonlyMap<string, ShipReference>
  cruises?: ReadonlyMap<string, CruiseReference>
  cabins?: ReadonlyMap<string, string>
}

function referenceLabel(prefix: string, id: string) {
  return `${prefix} ${id.length > 8 ? id.slice(0, 8) : id}`
}

function person(id: string | null, lookups: IssueLookups): PersonReference | null {
  if (!id) return null
  return lookups.people?.get(id) ?? { id, name: referenceLabel('User', id) }
}

function displayTitle(description: string) {
  return description.split('.')[0]?.trim() || description
}

export function mapIssueDto(
  dto: OperationalIssueDto,
  lookups: IssueLookups = {},
): OperationalIssue {
  const ship = lookups.ships?.get(dto.shipId) ?? {
    id: dto.shipId,
    name: referenceLabel('Ship', dto.shipId),
  }
  const cruise = dto.cruiseId
    ? lookups.cruises?.get(dto.cruiseId) ?? {
        id: dto.cruiseId,
        code: referenceLabel('Cruise', dto.cruiseId),
        name: referenceLabel('Cruise', dto.cruiseId),
        shipId: dto.shipId,
      }
    : null

  return {
    id: dto.issueId,
    code: dto.issueCode,
    displayTitle: displayTitle(dto.description),
    ship,
    cruise,
    cabin: dto.cabinId
      ? lookups.cabins?.get(dto.cabinId) ?? referenceLabel('Cabin', dto.cabinId)
      : null,
    type: dto.issueType,
    severity: dto.severity,
    status: dto.status,
    description: dto.description,
    reportedBy: person(dto.reportedById, lookups) ?? {
      id: dto.reportedById,
      name: referenceLabel('User', dto.reportedById),
    },
    reportedAt: dto.reportedAt,
    assignedTo: person(dto.assignedToId, lookups),
    resolution: dto.resolution,
    resolvedBy: person(dto.resolvedById, lookups),
    resolvedAt: dto.resolvedAt,
    verifiedBy: person(dto.verifiedById, lookups),
    verifiedAt: dto.verifiedAt,
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt,
  }
}

export function collectPeople(dtos: readonly OperationalIssueDto[]) {
  const ids = new Set<string>()
  for (const dto of dtos) {
    for (const id of [dto.reportedById, dto.resolvedById, dto.assignedToId, dto.verifiedById]) {
      if (id) ids.add(id)
    }
  }
  return [...ids].map<PersonReference>((id) => ({ id, name: referenceLabel('User', id) }))
}
